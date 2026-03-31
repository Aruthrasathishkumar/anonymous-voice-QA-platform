import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@prisma/client'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (server) => {
  const prisma = new PrismaClient({ log: ['error', 'warn'] })
  await prisma.$connect()
  server.log.info('PostgreSQL connected via Prisma')
  server.decorate('prisma', prisma)
  server.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
})

export default prismaPlugin