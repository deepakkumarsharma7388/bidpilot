import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// MySQL raw queries return BigInt for COUNT()/SUM() results, which JSON.stringify
// cannot serialize by default. This recursively converts any BigInt values to
// plain numbers so the response can be sent as JSON.
function serializeBigInt(value: any): any {
  if (typeof value === 'bigint') return Number(value)
  if (Array.isArray(value)) return value.map(serializeBigInt)
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {}
    for (const key in value) {
      result[key] = serializeBigInt(value[key])
    }
    return result
  }
  return value
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const [totalJobs, proposalsSent, replies, hires] = await Promise.all([
    prisma.job.count({ where: { userId } }),
    prisma.proposal.count({ where: { userId, status: 'SENT' } }),
    prisma.proposal.count({ where: { userId, status: 'REPLIED' } }),
    prisma.proposal.count({ where: { userId, status: 'HIRED' } }),
  ])

  const revenueAgg = await prisma.proposal.aggregate({ where: { userId, status: 'HIRED' }, _sum: { revenue: true } })
  const totalRevenue = revenueAgg._sum.revenue || 0
  const replyRate = proposalsSent > 0 ? (replies / proposalsSent) * 100 : 0
  const winRate = proposalsSent > 0 ? (hires / proposalsSent) * 100 : 0

  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const chartData = await prisma.$queryRaw`
    SELECT DATE(createdAt) as date, COUNT(*) as proposals, SUM(CASE WHEN status = 'REPLIED' THEN 1 ELSE 0 END) as replies, SUM(CASE WHEN status = 'HIRED' THEN 1 ELSE 0 END) as wins, SUM(CASE WHEN status = 'HIRED' THEN revenue ELSE 0 END) as revenue
    FROM Proposal WHERE userId = ${userId} AND createdAt >= ${sevenDaysAgo} GROUP BY DATE(createdAt) ORDER BY date ASC
  `

  const laneStats = await prisma.$queryRaw`
    SELECT j.lane, COUNT(p.id) as proposals, SUM(CASE WHEN p.status = 'REPLIED' THEN 1 ELSE 0 END) as replies, SUM(CASE WHEN p.status = 'HIRED' THEN 1 ELSE 0 END) as wins, SUM(CASE WHEN p.status = 'HIRED' THEN p.revenue ELSE 0 END) as revenue
    FROM Job j LEFT JOIN Proposal p ON j.id = p.jobId WHERE j.userId = ${userId} AND j.lane IS NOT NULL GROUP BY j.lane
  `

  return NextResponse.json(serializeBigInt({ totalJobs, proposalsSent, replies, hires, totalRevenue, replyRate: Math.round(replyRate*10)/10, winRate: Math.round(winRate*10)/10, chartData, laneStats }))
}
