import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { cookies } = await req.json()
    if (!cookies) return NextResponse.json({ error: 'Invalid cookies' }, { status: 400 })
    await prisma.user.update({ where: { id: session.user.id }, data: { upworkCookies: JSON.stringify(cookies) } })
    return NextResponse.json({ message: 'Cookies saved!' })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
