import 'dotenv/config'
import './workers'
import { scrapingQueue } from '@/lib/queue'
import { prisma } from '@/lib/prisma'

async function scheduleScraping() {
  console.log('⏰ Scheduled scraping triggered...')
  try {
    const users = await prisma.user.findMany({
      where: { upworkCookies: { not: null } },
      select: { id: true }
    })

    for (const user of users) {
      await scrapingQueue.add('scrape-jobs', { userId: user.id })
    }
    console.log(`✅ Scheduled scraping added for ${users.length} users.`)
  } catch (error) {
    console.error('Scheduler error:', error)
  }
}

// Pehli baar 5 second baad chalao
setTimeout(scheduleScraping, 5000)

// Phir har 5 minute (300,000 ms) mein chalao

setInterval(scheduleScraping, 2700000)

console.log('🔄 Auto-scheduler started. Will scrape every 45 minutes.')