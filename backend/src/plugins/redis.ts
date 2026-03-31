import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import Redis from 'ioredis'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

const redisPlugin: FastifyPluginAsync = fp(async (server) => {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
  redis.on('connect', () => server.log.info('Redis connected'))
  redis.on('error', (err) => server.log.error('Redis error:', err))
  server.decorate('redis', redis)
  server.addHook('onClose', async () => { await redis.quit() })
})

export default redisPlugin