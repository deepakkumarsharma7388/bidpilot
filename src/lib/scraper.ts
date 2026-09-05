// NOTE: CloakBrowser bundles its own copy of playwright-core internally, which
// TypeScript treats as a structurally-different type from the top-level
// `playwright` package's Page type (even though they're the same shape at
// runtime). To avoid cross-package type conflicts, we type page params as
// `any` here rather than importing Page from 'playwright'.

import { prisma } from './prisma'
import { sanitizeCookiesForPlaywright } from './cookies'

export interface ScrapedJob {
  upworkId: string
  title: string
  description: string
  budget: number | null
  currency: string
  skills: string[]
  url: string
  clientCountry: string | null
  clientHireRate: number | null
  clientTotalSpent: number | null
  clientPaymentVerified: boolean | null
}

// Converts Upwork's shorthand spend text ("$437K", "$1.2M", "$950") into a plain number.
function parseSpend(text: string): number | null {
  const match = text.match(/\$([\d,.]+)\s*([KM]?)/i)
  if (!match) return null
  let value = parseFloat(match[1].replace(/,/g, ''))
  const suffix = match[2].toUpperCase()
  if (suffix === 'K') value *= 1_000
  if (suffix === 'M') value *= 1_000_000
  return value
}

// If Cloudflare's "Verify you are human" challenge is showing, wait a bit for a
// human to solve it manually in the visible browser window instead of failing
// immediately. Checks repeatedly for up to `maxWaitMs`.
async function waitForCloudflareIfPresent(page: any, maxWaitMs = 60000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const text = await page.textContent('body').catch(() => '')
    const blocked = text?.includes('Verify you are human') || text?.includes('Cloudflare Ray ID')
    if (!blocked) return true
    console.log('⏳ Cloudflare challenge showing — please click the checkbox in the browser window. Waiting...')
    await page.waitForTimeout(3000)
  }
  return false
}

// Visits a single job's detail page (already-authenticated `page`) and extracts
// client-quality signals used for region/hire-rate/spend/payment filtering.
async function scrapeClientInfo(page: any, jobUrl: string): Promise<{
  clientCountry: string | null
  clientHireRate: number | null
  clientTotalSpent: number | null
  clientPaymentVerified: boolean | null
}> {
  try {
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })

    const ok = await waitForCloudflareIfPresent(page, 20000)
    if (!ok) {
      console.warn(`⚠️ Cloudflare challenge not resolved for ${jobUrl} — skipping client info for this job`)
      return { clientCountry: null, clientHireRate: null, clientTotalSpent: null, clientPaymentVerified: null }
    }

    await page.waitForSelector('[data-test="about-client-container"]', { timeout: 20000 }).catch(() => null)

    return await page.evaluate(() => {
      const container = document.querySelector('[data-test="about-client-container"]')
      if (!container) {
        return { clientCountry: null, clientHireRate: null, clientTotalSpent: null, clientPaymentVerified: null }
      }

      const locationEl = container.querySelector('[data-qa="client-location"] strong')
      const clientCountry = locationEl?.textContent?.trim() || null

      const statsText = container.querySelector('[data-qa="client-job-posting-stats"]')?.textContent || ''
      const hireRateMatch = statsText.match(/(\d+)%\s*hire rate/i)
      const clientHireRate = hireRateMatch ? parseFloat(hireRateMatch[1]) : null

      const spendText = container.querySelector('[data-qa="client-spend"]')?.textContent || ''

      const signalRows = Array.from(container.querySelectorAll('[data-ev-label="payment_verified"]'))
      const clientPaymentVerified = signalRows.length > 0

      return { clientCountry, clientHireRate, clientTotalSpent: null, __spendText: spendText, clientPaymentVerified } as any
    }).then((raw: any) => ({
      clientCountry: raw.clientCountry,
      clientHireRate: raw.clientHireRate,
      clientTotalSpent: raw.__spendText ? parseSpend(raw.__spendText) : null,
      clientPaymentVerified: raw.clientPaymentVerified,
    }))
  } catch (err) {
    console.error(`Could not load client info for ${jobUrl}:`, (err as Error).message)
    return { clientCountry: null, clientHireRate: null, clientTotalSpent: null, clientPaymentVerified: null }
  }
}

export async function scrapeJobs(userId: string): Promise<ScrapedJob[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { upworkCookies: true }
  })

  if (!user?.upworkCookies) {
    throw new Error('Upwork cookies missing. Please login via Settings.')
  }

  
  

  // CloakBrowser: a stealth Chromium build with source-level fingerprint patches
  // (not JS injection), specifically built to pass Cloudflare Turnstile and
  // similar bot-detection. It's a drop-in Playwright replacement, so the rest
  // of this code (context, page, selectors) is unchanged.
  const { launch } = await import('cloakbrowser')
  const browser = await launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  })

  // IMPORTANT: everything after this point is wrapped in try/finally so the
  // browser is ALWAYS closed, even on error/timeout.
  try {
    const cookies = sanitizeCookiesForPlaywright(JSON.parse(user.upworkCookies))
    await context.addCookies(cookies)

    const page = await context.newPage()

    // Basic stealth patches to mask common automation fingerprints.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
      // @ts-ignore
      window.chrome = { runtime: {} }
    })

    await page.goto('https://www.upwork.com/nx/find-work/', { waitUntil: 'domcontentloaded', timeout: 60000 })

    const ok = await waitForCloudflareIfPresent(page, 60000)
    if (!ok) {
      throw new Error('Cloudflare challenge was not resolved in time. Please solve it manually in the browser window when it opens, then try again.')
    }

    await page.waitForSelector('[data-test="job-tile-list"] section', { timeout: 45000 })

    const listingJobs = await page.evaluate(() => {
      const items: any[] = []
      const sections = document.querySelectorAll('[data-test="job-tile-list"] section')

      sections.forEach((el) => {
        const upworkId = el.getAttribute('data-ev-opening_uid') || ''

        const titleLink = el.querySelector('.job-tile-title a') as HTMLAnchorElement | null
        const title = titleLink?.textContent?.trim() || ''
        const relativeUrl = titleLink?.getAttribute('href') || ''
        const url = relativeUrl ? `https://www.upwork.com${relativeUrl}` : ''

        const description = el.querySelector('[data-test="job-description-text"]')?.textContent?.trim() || ''

        const budgetText = el.querySelector('[data-test="budget"]')?.textContent?.trim() || ''
        const jobTypeText = el.querySelector('[data-test="job-type"]')?.textContent?.trim() || ''
        const rawBudget = budgetText || jobTypeText
        const budgetMatch = rawBudget.match(/[\d,]+(\.\d+)?/)
        const budget = budgetMatch ? parseFloat(budgetMatch[0].replace(/,/g, '')) : null

        const currency = 'USD'

        const skills = Array.from(el.querySelectorAll('[data-test="token-container"] a[data-test="attr-item"]'))
          .map((s) => s.textContent?.trim() || '')
          .filter(Boolean)

        if (upworkId && title) {
          items.push({ upworkId, title, description, budget, currency, skills, url })
        }
      })

      return items
    })

    const jobs: ScrapedJob[] = []
    for (const job of listingJobs) {
      let clientInfo: {
        clientCountry: string | null
        clientHireRate: number | null
        clientTotalSpent: number | null
        clientPaymentVerified: boolean | null
      } = { clientCountry: null, clientHireRate: null, clientTotalSpent: null, clientPaymentVerified: null }
      if (job.url) {
        clientInfo = await scrapeClientInfo(page, job.url)
        await page.waitForTimeout(4000 + Math.random() * 4000)
      }
      jobs.push({ ...job, ...clientInfo })
    }

    return jobs
  } finally {
    await browser.close()
  }
}