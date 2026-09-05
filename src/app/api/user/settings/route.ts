import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      autoSubmit: true,
      expertise: true,
      lanes: true,
      budgetMin: true,
      budgetMax: true,
      keywords: true,
      timezone: true,
      excludedRegions: true,
      minHireRate: true,
      minTotalSpent: true,
      requirePaymentVerified: true,
    }
  })
  return NextResponse.json(user)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        autoSubmit: body.autoSubmit,
        lanes: body.lanes,
        budgetMin: body.budgetMin,
        budgetMax: body.budgetMax,
        keywords: body.keywords,
        timezone: body.timezone,
        expertise: body.keywords || '',
        excludedRegions: body.excludedRegions,
        minHireRate: body.minHireRate,
        minTotalSpent: body.minTotalSpent,
        requirePaymentVerified: body.requirePaymentVerified,
      }
    })
    return NextResponse.json({ message: 'Updated' })
  } catch (err) {
    console.error('Update settings error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}