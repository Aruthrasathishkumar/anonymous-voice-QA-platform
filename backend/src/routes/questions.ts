import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isProfane } from '../utils/profanity'
import { isValidAnonymousId } from '../utils/anonymousId'
import { emitToRoom, emitToHost } from '../socket/index'

const createQuestionSchema = z.object({
  roomId: z.string().min(1),
  text: z.string().min(5, 'Question must be at least 5 characters').max(500, 'Question too long').trim(),
  anonymousUserId: z.string().min(1).max(100),
  languageCode: z.string().optional().default('en')
})

const questionsPlugin: FastifyPluginAsync = async (server) => {

  server.post('/', async (request, reply) => {
    const result = createQuestionSchema.safeParse(request.body)
    if (!result.success) {
      return reply.code(400).send({ error: result.error.errors[0].message })
    }
    const body = result.data

    if (!isValidAnonymousId(body.anonymousUserId)) {
      return reply.code(400).send({ error: 'Invalid user ID' })
    }
    if (isProfane(body.text)) {
      return reply.code(400).send({ error: 'Inappropriate content' })
    }

    const room = await server.prisma.room.findUnique({
      where: { id: body.roomId }
    })
    if (!room || !room.isActive) {
      return reply.code(404).send({ error: 'Room not found or closed' })
    }

    // Check room expiry
    if (new Date() > room.expiresAt) {
      return reply.code(403).send({ error: 'Room has expired' })
    }

    // Check room capacity
    const capacityKey = `room:${room.roomCode}:count`
    const currentCount = await server.redis.get(capacityKey)
    if (parseInt(currentCount || '0') >= room.maxCapacity) {
      return reply.code(403).send({ error: 'Room is at capacity' })
    }

    // Check question limit per user
    const countKey = `limit:q:${body.anonymousUserId}:${body.roomId}`
    const qCount = await server.redis.get(countKey)
    if (parseInt(qCount || '0') >= 5) {
      return reply.code(429).send({ error: 'Max 5 questions per session' })
    }

    const status = room.moderationMode === 'pre' ? 'pending_approval' : 'active'

    const question = await server.prisma.question.create({
      data: {
        roomId: body.roomId,
        textOriginal: body.text,
        languageCode: body.languageCode,
        anonymousUserId: body.anonymousUserId,
        status
      }
    })

    await server.redis.incr(countKey)
    await server.redis.expire(countKey, 86400)

    if (status === 'active') {
      emitToRoom(room.roomCode, 'question:new', question)
    } else {
      emitToHost(room.roomCode, 'moderation:question:pending', question)
    }

    return reply.code(201).send({
      questionId: question.id,
      status: question.status,
      createdAt: question.createdAt
    })
  })

  server.get('/:roomId', async (request, reply) => {
    const { roomId } = request.params as { roomId: string }
    const { sort } = request.query as { sort?: string }

    if (!roomId || roomId.length < 1) {
      return reply.code(400).send({ error: 'Invalid room ID' })
    }

    const questions = await server.prisma.question.findMany({
      where: {
        roomId,
        status: { notIn: ['hidden', 'rejected', 'pending_approval'] }
      },
      orderBy: sort === 'recent'
        ? { createdAt: 'desc' }
        : [{ isPinned: 'desc' }, { netVotes: 'desc' }]
    })
    return reply.send(questions)
  })

  server.patch('/:questionId/status', async (request, reply) => {
    const { questionId } = request.params as { questionId: string }
    const { status } = request.body as { status: string }
    const hostToken = request.headers['x-host-token'] as string

    const validStatuses = ['active', 'answered', 'hidden', 'pending_approval']
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({ error: 'Invalid status' })
    }

    if (!hostToken) {
      return reply.code(401).send({ error: 'Host token required' })
    }

    const question = await server.prisma.question.findUnique({
      where: { id: questionId },
      include: { room: true }
    })
    if (!question || question.room.hostToken !== hostToken) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const updated = await server.prisma.question.update({
      where: { id: questionId },
      data: {
        status,
        answeredAt: status === 'answered' ? new Date() : undefined
      }
    })

    emitToRoom(question.room.roomCode, 'question:status:updated', {
      questionId,
      status: updated.status
    })

    return reply.send({ questionId, status: updated.status })
  })

  server.patch('/:questionId/pin', async (request, reply) => {
    const { questionId } = request.params as { questionId: string }
    const { isPinned } = request.body as { isPinned: boolean }
    const hostToken = request.headers['x-host-token'] as string

    if (!hostToken) {
      return reply.code(401).send({ error: 'Host token required' })
    }

    const question = await server.prisma.question.findUnique({
      where: { id: questionId },
      include: { room: true }
    })
    if (!question || question.room.hostToken !== hostToken) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    await server.prisma.question.update({
      where: { id: questionId },
      data: { isPinned }
    })

    emitToRoom(question.room.roomCode, 'question:pinned', {
      questionId,
      isPinned
    })

    return reply.send({ questionId, isPinned })
  })

  server.delete('/:questionId', async (request, reply) => {
    const { questionId } = request.params as { questionId: string }
    const hostToken = request.headers['x-host-token'] as string

    if (!hostToken) {
      return reply.code(401).send({ error: 'Host token required' })
    }

    const question = await server.prisma.question.findUnique({
      where: { id: questionId },
      include: { room: true }
    })
    if (!question || question.room.hostToken !== hostToken) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    await server.prisma.question.delete({ where: { id: questionId } })
    emitToRoom(question.room.roomCode, 'question:deleted', { questionId })

    return reply.send({ message: 'Question deleted' })
  })
}

export default questionsPlugin