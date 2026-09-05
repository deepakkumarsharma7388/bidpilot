import { Queue } from 'bullmq'
import Redis from 'ioredis'

// IMPORTANT: This file only exports Queues, never Workers.
// Next.js API routes (e.g. /api/scrape) import this file to add jobs to the
// queue. A BullMQ Worker uses a BLOCKING Redis connection to wait for new
// jobs — if a Worker shared this same connection, calls like queue.add()
// made from Next.js would hang indefinitely while the Worker's blocking
// read holds the connection. Workers live only in workers/workers.ts,
// which runs in the separate `npm run worker` process with its own
// dedicated Redis connection.
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
})
connection.on('connect', () => console.log('✅ [queue.ts] Redis connected'))
connection.on('error', (err) => console.error('❌ [queue.ts] Redis connection error:', err.message))

export const scrapingQueue = new Queue('scraping-queue', { connection })
export const proposalQueue = new Queue('proposal-queue', { connection })