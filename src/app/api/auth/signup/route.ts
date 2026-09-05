import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(6) })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password } = schema.parse(body)
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'User exists' }, { status: 400 })
    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.create({ data: { name, email, password: hashed, skills: [] } })
    return NextResponse.json({ message: 'User created' }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Invalid data' }, { status: 400 }) }
}
