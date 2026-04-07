import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { generateUniqueRoomCode, generateHostToken } from '../utils/roomCode'
import { emitToRoom } from '../socket/index'

const createRoomSchema = z.object({
  hostLanguage: z.string().length(2).default('en'),
  moderationMode: z.enum(['pre', 'post']).default('post'),
  allowVoice: z.boolean().default(true),
  allowPolls: z.boolean().default(true),
  maxCapacity: z.number().min(10).max(1000).default(500)
})

const joinRoomSchema = z.object({
  roomCode: z.string().min(4).max(8),
  anonymousUserId: z.string().optional()
})

const roomsPlugin: FastifyPluginAsync = async (server) => {

  server.post('/create', async (request, reply) => {
    const result = createRoomSchema.safeParse(request.body)
    if (!result.success) {
      return reply.code(400).send({ error: result.error.errors[0].message })
    }
    const body = result.data

    const roomCode = await generateUniqueRoomCode(server.prisma)
    const hostToken = generateHostToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const room = await server.prisma.room.create({
      data: { roomCode, hostToken, expiresAt, ...body }
    })

    // Initialize capacity counter in Redis
    await server.redis.set(`room:${roomCode}:count`, '0', 'EX', 86400)

    return reply.code(201).send({
      roomId: room.id,
      roomCode: room.roomCode,
      hostToken: room.hostToken,
      expiresAt: room.expiresAt
    })
  })

  server.post('/join', async (request, reply) => {
    const result = joinRoomSchema.safeParse(request.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Invalid room code' })
    }

    const roomCode = result.data.roomCode.toUpperCase()

    const room = await server.prisma.room.findUnique({
      where: { roomCode }
    })
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    if (!room.isActive) return reply.code(403).send({ error: 'Room is closed' })
    if (new Date() > room.expiresAt) {
      return reply.code(403).send({ error: 'Room has expired' })
    }

    // Track per-device participation to prevent duplicate joins
    // from different browsers on the same physical device.
    const capacityKey = `room:${roomCode}:count`
    const anonId = result.data.anonymousUserId
    let isRejoin = false

    if (anonId) {
      const participantKey = `room:${roomCode}:participant:${anonId}`
      const alreadyJoined = await server.redis.get(participantKey)
      if (alreadyJoined) {
        // Same device rejoining the same room — allow but skip counter increment
        isRejoin = true
      } else {
        // First join for this device — mark as joined (expires with room)
        await server.redis.set(participantKey, '1', 'EX', 86400)
      }
    }

    if (!isRejoin) {
      // Check room capacity from Redis
      const currentCount = parseInt((await server.redis.get(capacityKey)) || '0')
      if (currentCount >= room.maxCapacity) {
        return reply.code(403).send({ error: 'Room is full' })
      }

      // Increment capacity counter
      await server.redis.incr(capacityKey)
      await server.redis.expire(capacityKey, 86400)
    }

    return reply.send({
      roomId: room.id,
      roomCode: room.roomCode,
      hostLanguage: room.hostLanguage,
      expiresAt: room.expiresAt,
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

    // Never expose host token
    const { hostToken, ...safeRoom } = room
    return reply.send(safeRoom)
  })

  server.delete('/:roomCode/close', async (request, reply) => {
    const { roomCode } = request.params as { roomCode: string }
    const hostToken = request.headers['x-host-token'] as string

    if (!hostToken) {
      return reply.code(401).send({ error: 'Host token required' })
    }

    const room = await server.prisma.room.findUnique({ where: { roomCode } })
    if (!room || room.hostToken !== hostToken) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    await server.prisma.room.update({
      where: { roomCode },
      data: { isActive: false }
    })

    // Notify all participants room is closed
    emitToRoom(roomCode, 'room:closed', { roomCode })

    // Clean up Redis keys (count + participant tracking)
    const participantKeys = await server.redis.keys(`room:${roomCode}:participant:*`)
    const keysToDelete = [`room:${roomCode}:count`, ...participantKeys]
    if (keysToDelete.length > 0) await server.redis.del(...keysToDelete)

    return reply.send({ message: 'Room closed' })
  })

  // Hard delete — permanently removes room + all data
  server.delete('/:roomCode/delete', async (request, reply) => {
    const { roomCode } = request.params as { roomCode: string }
    const hostToken = request.headers['x-host-token'] as string

    if (!hostToken) {
      return reply.code(401).send({ error: 'Host token required' })
    }

    const room = await server.prisma.room.findUnique({ where: { roomCode } })
    if (!room || room.hostToken !== hostToken) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    // Notify participants before deleting
    emitToRoom(roomCode, 'room:closed', { roomCode })

    // Hard delete — cascades to questions, votes, polls
    await server.prisma.room.delete({ where: { roomCode } })

    // Clean up Redis (count + participant tracking)
    const participantKeys = await server.redis.keys(`room:${roomCode}:participant:*`)
    const keysToDelete = [`room:${roomCode}:count`, ...participantKeys]
    if (keysToDelete.length > 0) await server.redis.del(...keysToDelete)
    return reply.send({ message: 'Room deleted' })
  })
}

export default roomsPlugin