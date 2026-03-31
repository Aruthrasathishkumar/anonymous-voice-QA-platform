import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { emitToRoom } from '../socket/index'

const createPollSchema = z.object({
  roomId: z.string().min(1),
  question: z.string().min(5).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(4)
})

const pollsPlugin: FastifyPluginAsync = async (server) => {

  server.post('/', async (request, reply) => {
    const hostToken = request.headers['x-host-token'] as string
    const body = createPollSchema.parse(request.body)

    const room = await server.prisma.room.findUnique({
      where: { id: body.roomId }
    })
    if (!room || room.hostToken !== hostToken) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const poll = await server.prisma.poll.create({
      data: {
        roomId: body.roomId,
        question: body.question,
        options: { create: body.options.map(text => ({ text })) }
      },
      include: { options: true }
    })

    // Broadcast new poll to everyone in room
    emitToRoom(room.roomCode, 'poll:created', poll)

    return reply.code(201).send(poll)
  })

  server.post('/:pollId/vote', async (request, reply) => {
    const { pollId } = request.params as { pollId: string }
    const { optionId, anonymousUserId } = request.body as {
      optionId: string
      anonymousUserId: string
    }

    const existing = await server.prisma.pollVote.findUnique({
      where: { pollId_anonymousUserId: { pollId, anonymousUserId } }
    })
    if (existing) return reply.code(409).send({ error: 'Already voted' })

    await server.prisma.pollVote.create({
      data: { pollId, pollOptionId: optionId, anonymousUserId }
    })
    await server.prisma.pollOption.update({
      where: { id: optionId },
      data: { voteCount: { increment: 1 } }
    })

    const results = await server.prisma.pollOption.findMany({
      where: { pollId }
    })
    const total = results.reduce((sum, o) => sum + o.voteCount, 0)

    const poll = await server.prisma.poll.findUnique({
      where: { id: pollId },
      include: { room: true }
    })

    const formattedResults = {
      pollId,
      results: results.map(o => ({
        optionId: o.id,
        text: o.text,
        voteCount: o.voteCount,
        percentage: total > 0 ? ((o.voteCount / total) * 100).toFixed(1) : '0'
      })),
      totalVotes: total
    }

    // Broadcast updated results to everyone
    if (poll?.room.roomCode) {
      emitToRoom(poll.room.roomCode, 'poll:voted', formattedResults)
    }

    return reply.send(formattedResults)
  })

  server.get('/:roomId', async (request, reply) => {
    const { roomId } = request.params as { roomId: string }
    const polls = await server.prisma.poll.findMany({
      where: { roomId },
      include: { options: true },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send(polls)
  })

  server.patch('/:pollId/close', async (request, reply) => {
    const { pollId } = request.params as { pollId: string }
    const hostToken = request.headers['x-host-token'] as string

    const poll = await server.prisma.poll.findUnique({
      where: { id: pollId },
      include: { room: true, options: true }
    })
    if (!poll || poll.room.hostToken !== hostToken) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    await server.prisma.poll.update({
      where: { id: pollId },
      data: { isActive: false, closedAt: new Date() }
    })

    emitToRoom(poll.room.roomCode, 'poll:closed', {
      pollId,
      finalResults: poll.options
    })

    return reply.send({ pollId, isActive: false })
  })
}

export default pollsPlugin