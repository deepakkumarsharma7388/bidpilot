import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateProposal } from '@/lib/ai'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const job = await prisma.job.findUnique({ where: { id } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const content = await generateProposal(job.title, job.description, user.expertise || '', user.name || '')
  await prisma.proposal.create({ data: { content, status: 'GENERATED', jobId: job.id, userId: user.id } })
  await prisma.job.update({ where: { id: job.id }, data: { status: 'MATCHED' } })
  return NextResponse.json({ success: true, content })
}
