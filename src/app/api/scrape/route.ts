import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { scrapingQueue } from '@/lib/queue'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await scrapingQueue.add('scrape-jobs', { userId: session.user.id })
  return NextResponse.json({ message: 'Scraping started' })
}
