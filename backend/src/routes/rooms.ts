import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { generateUniqueRoomCode, generateHostToken } from '../utils/roomCode'

const createRoomSchema = z.object({
  hostLanguage: z.string().length(2).default('en'),
  moderationMode: z.enum(['pre', 'post']).default('post'),
  allowVoice: z.boolean().default(true),
  allowPolls: z.boolean().default(true),
  maxCapacity: z.number().min(10).max(1000).default(500)
})

const roomsPlugin: FastifyPluginAsync = async (server) => {

  server.post('/create', async (request, reply) => {
    const body = createRoomSchema.parse(request.body)
    const roomCode = await generateUniqueRoomCode(server.prisma)
    const hostToken = generateHostToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const room = await server.prisma.room.create({
      data: { roomCode, hostToken, expiresAt, ...body }
    })

    return reply.code(201).send({
      roomId: room.id,
      roomCode: room.roomCode,
      hostToken: room.hostToken,
      expiresAt: room.expiresAt
    })
  })

  server.post('/join', async (request, reply) => {
    const { roomCode } = request.body as { roomCode: string }
    const room = await server.prisma.room.findUnique({
      where: { roomCode: roomCode.toUpperCase() }
    })
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    if (!room.isActive) return reply.code(403).send({ error: 'Room is closed' })
    if (new Date() > room.expiresAt) return reply.code(403).send({ error: 'Room expired' })

    const count = await server.redis.get(`room:${roomCode}:count`)
    if (parseInt(count || '0') >= room.maxCapacity) {
      return reply.code(403).send({ error: 'Room is full' })
    }

    return reply.send({
      roomId: room.id,
      roomCode: room.roomCode,
      hostLanguage: room.hostLanguage,
      settings: {
        allowVoice: room.allowVoice,
        allowPolls: room.allowPolls,
        moderationMode: room.moderationMode,
        maxCapacity: room.maxCapacity
      }
    })
  })

  server.get('/:roomCode', async (request, reply) => {
    const { roomCode } = request.params as { roomCode: string }
    const room = await server.prisma.room.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      include: { _count: { select: { questions: true, polls: true } } }
    })
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    const { hostToken, ...safeRoom } = room
    return reply.send(safeRoom)
  })

  server.delete('/:roomCode/close', async (request, reply) => {
    const { roomCode } = request.params as { roomCode: string }
    const hostToken = request.headers['x-host-token'] as string
    const room = await server.prisma.room.findUnique({ where: { roomCode } })
    if (!room || room.hostToken !== hostToken) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    await server.prisma.room.update({
      where: { roomCode }, data: { isActive: false }
    })
    return reply.send({ message: 'Room closed' })
  })
}

export default roomsPlugin