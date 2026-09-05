import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { autoSubmitProposal } from '@/lib/autoSubmit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const job = await prisma.job.findUnique({ where: { id }, include: { proposals: true } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const proposal = job.proposals[0]
  if (!proposal) return NextResponse.json({ error: 'No proposal' }, { status: 400 })
  const result = await autoSubmitProposal(session.user.id, job.url || '', proposal.content, job.id)
  return NextResponse.json(result)
}
