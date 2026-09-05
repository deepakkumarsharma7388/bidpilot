import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jobs = await prisma.job.findMany({ where: { userId: session.user.id }, orderBy: { matchScore: 'desc' }, include: { proposals: true } })
  return NextResponse.json(jobs)
}
