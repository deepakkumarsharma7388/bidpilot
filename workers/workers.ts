import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '../src/lib/prisma'
import { scrapeJobs } from '../src/lib/scraper'
import { getMatchScore, generateProposal, detectLaneWithAI } from '../src/lib/ai'
import { detectFakeJob } from '../src/lib/fakeJobDetector'
import { applyClientFilters } from '../src/lib/clientFilters'
import { autoSubmitProposal } from '../src/lib/autoSubmit'
import { proposalQueue } from '../src/lib/queue'

// Dynamically detect which of the user's own lanes (from Settings) a job matches.
// STRICT / EXACT (offline) matching: the full lane phrase must appear in the job
// text as-is. Used only as a fast fallback if the AI-based classifier fails.
function detectLaneExact(title: string, description: string, userLanes: unknown): string {
  const combinedText = `${title} ${description}`.toLowerCase().replace(/\s+/g, ' ')

  let lanes: string[] = []
  if (Array.isArray(userLanes)) {
    lanes = userLanes.filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
  }

  for (const lane of lanes) {
    const normalizedLane = lane.toLowerCase().trim().replace(/\s+/g, ' ')
    if (normalizedLane && combinedText.includes(normalizedLane)) {
      return lane
    }
  }

  return 'General'
}

// This Worker file has its OWN dedicated Redis connection, separate from the
// one used by src/lib/queue.ts (which Next.js imports for queue.add() calls).
// Workers must never share a connection with code that also needs to send
// normal (non-blocking) Redis commands, since a Worker's blocking wait for
// new jobs occupies the connection.
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
})

connection.on('connect', () => console.log('✅ [workers.ts] Redis connected'))
connection.on('error', (err) => console.error('❌ [workers.ts] Redis connection error:', err.message))

// Scraping Worker
export const scrapingWorker = new Worker(
  'scraping-queue',
  async (job) => {
    const { userId } = job.data
    console.log(`🕷️ Scraping for user ${userId}`)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.expertise) throw new Error('User expertise missing')

    // Pull the user's own dynamic client-quality filter settings
    const excludedRegions = Array.isArray(user.excludedRegions)
      ? user.excludedRegions.filter((r): r is string => typeof r === 'string')
      : []
    const clientFilterSettings = {
      excludedRegions,
      minHireRate: user.minHireRate ?? null,
      minTotalSpent: user.minTotalSpent ?? null,
      requirePaymentVerified: user.requirePaymentVerified ?? false,
    }

    const jobs = await scrapeJobs(userId)
    for (const jobData of jobs) {
      const existing = await prisma.job.findUnique({
        where: { upworkId: jobData.upworkId }
      })
      if (existing) continue

      // --- 1) Client-quality filters (region, hire rate, spend, payment verified) ---
      const clientFilter = applyClientFilters(
        {
          clientCountry: jobData.clientCountry,
          clientHireRate: jobData.clientHireRate,
          clientTotalSpent: jobData.clientTotalSpent,
          clientPaymentVerified: jobData.clientPaymentVerified,
        },
        clientFilterSettings
      )

      // --- 2) Fake/scam job detection (rule-based + AI) ---
      const fakeCheck = await detectFakeJob(jobData.title, jobData.description, jobData.budget, jobData.currency)

      const matchScore = await getMatchScore(jobData.description, user.expertise)

      const userLanesArray = Array.isArray(user.lanes)
        ? (user.lanes.filter((l): l is string => typeof l === 'string'))
        : []

      let lane: string
      try {
        lane = await detectLaneWithAI(jobData.title, jobData.description, userLanesArray)
      } catch {
        lane = detectLaneExact(jobData.title, jobData.description, user.lanes)
      }

      const isBlocked = !clientFilter.passes || fakeCheck.isSuspicious
      const canAutoProposal = matchScore > 0.7 && !isBlocked

      const newJob = await prisma.job.create({
        data: {
          upworkId: jobData.upworkId,
          title: jobData.title,
          description: jobData.description,
          budget: jobData.budget,
          currency: jobData.currency,
          skills: jobData.skills,
          url: jobData.url,
          matchScore,
          lane,
          userId,
          isSuspicious: fakeCheck.isSuspicious,
          suspicionReasons: fakeCheck.reasons.length ? fakeCheck.reasons.join(' | ') : null,
          clientCountry: jobData.clientCountry,
          clientHireRate: jobData.clientHireRate,
          clientTotalSpent: jobData.clientTotalSpent,
          clientPaymentVerified: jobData.clientPaymentVerified,
          filteredReason: !clientFilter.passes ? clientFilter.reason : null,
          status: canAutoProposal ? 'MATCHED' : 'PENDING'
        }
      })

      if (canAutoProposal) {
        await proposalQueue.add('generate-and-submit', {
          jobId: newJob.id,
          userId
        })
      } else if (!clientFilter.passes) {
        console.log(`🌍 Filtered by client rules: ${jobData.title} — ${clientFilter.reason}`)
      } else if (fakeCheck.isSuspicious) {
        console.log(`🚩 Flagged as suspicious: ${jobData.title} — ${fakeCheck.reasons.join('; ')}`)
      }
    }
    console.log(`✅ Scraping done for user ${userId}: ${jobs.length} job(s) found`)
    return { processed: jobs.length }
  },
  { connection }
)

// Proposal + Auto-Submit Worker
export const proposalWorker = new Worker(
  'proposal-queue',
  async (job) => {
    const { jobId, userId } = job.data
    console.log(`📝 Generating proposal for job ${jobId}`)

    const [jobData, user] = await Promise.all([
      prisma.job.findUnique({ where: { id: jobId } }),
      prisma.user.findUnique({ where: { id: userId } })
    ])

    if (!jobData || !user) throw new Error('Data missing')

    const content = await generateProposal(
      jobData.title,
      jobData.description,
      user.expertise || 'General freelancer',
      user.name || 'Freelancer'
    )

    const proposal = await prisma.proposal.create({
      data: {
        content,
        status: 'GENERATED',
        jobId: jobData.id,
        userId: user.id
      }
    })

    if (user.autoSubmit && jobData.url) {
      console.log(`🚀 Auto-submitting proposal for job ${jobId}`)
      const result = await autoSubmitProposal(
        userId,
        jobData.url,
        content,
        jobData.id
      )
      if (!result.success) {
        console.error(`❌ Auto-submit failed: ${result.error}`)
      }
    }

    return { proposalId: proposal.id }
  },
  { connection }
)

scrapingWorker.on('failed', (job, err) => console.error(`Scraping failed: ${err.message}`))
proposalWorker.on('failed', (job, err) => console.error(`Proposal failed: ${err.message}`))

console.log('👷 Workers registered (scraping-queue, proposal-queue)')