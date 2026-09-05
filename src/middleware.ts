import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function middleware(req: any) {
  const session = await auth()
  const path = req.nextUrl.pathname

  if (path.startsWith('/api/auth') || path === '/login' || path === '/signup') {
    return NextResponse.next()
  }

  if (!session && !path.startsWith('/_next') && !path.includes('.')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|favicon.ico).*)'] }
