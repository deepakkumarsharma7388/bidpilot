require('dotenv/config')
const Redis = require('ioredis')

console.log('Connecting to:', process.env.REDIS_URL?.replace(/:[^:@]+@/, ':****@'))

const redis = new Redis(process.env.REDIS_URL)

redis.on('connect', () => console.log('✅ connected'))
redis.on('ready', () => console.log('✅ ready'))
redis.on('error', (err) => console.error('❌ error:', err.message))
redis.on('close', () => console.log('🔌 connection closed'))
redis.on('reconnecting', () => console.log('🔁 reconnecting...'))

async function main() {
  try {
    const pong = await redis.ping()
    console.log('PING result:', pong)
    await redis.set('test-key', 'hello')
    const val = await redis.get('test-key')
    console.log('GET test-key:', val)
    process.exit(0)
  } catch (err) {
    console.error('Test failed:', err)
    process.exit(1)
  }
}

main()