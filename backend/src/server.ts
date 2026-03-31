import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { createServer } from 'http'
import dotenv from 'dotenv'
import { createSocketServer } from './socket/index'
import { startVoiceConsumer, disconnectConsumer } from './kafka/consumer'
import { disconnectProducer } from './kafka/producer'

dotenv.config()

const server = Fastify({
  logger: true,
  serverFactory: (handler) => {
    const httpServer = createServer(handler)
    createSocketServer(httpServer)
    return httpServer
  }
})

async function start() {
  try {
    await server.register(helmet, { global: true })
    await server.register(cors, {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    })
    await server.register(multipart, {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute'
    })

    await server.register(import('./plugins/prisma'))
    await server.register(import('./plugins/redis'))

    await server.register(import('./routes/rooms'), { prefix: '/api/rooms' })
    await server.register(import('./routes/questions'), { prefix: '/api/questions' })
    await server.register(import('./routes/votes'), { prefix: '/api/votes' })
    await server.register(import('./routes/polls'), { prefix: '/api/polls' })
    await server.register(import('./routes/voice'), { prefix: '/api/voice' })

    server.get('/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString()
    }))

    const port = Number(process.env.PORT) || 3001
    await server.listen({ port, host: '0.0.0.0' })

    // Start Kafka consumer after server is ready
    const prismaClient = (server as any).prisma
    await startVoiceConsumer(prismaClient)

  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  await disconnectConsumer()
  await disconnectProducer()
  await server.close()
  process.exit(0)
})

start()