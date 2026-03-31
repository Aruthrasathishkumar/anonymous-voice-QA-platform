import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { emitToRoom } from '../socket/index'

const voteSchema = z.object({
  questionId: z.string().min(1),
  anonymousUserId: z.string().min(10).max(100),
  voteType: z.enum(['up', 'down'])
})

const votesPlugin: FastifyPluginAsync = async (server) => {

  server.post('/', async (request, reply) => {
    const body = voteSchema.parse(request.body)

    // Rate limit: max 10 votes per minute
    const rateLimitKey = `ratelimit:vote:${body.anonymousUserId}`
    const voteCount = await server.redis.incr(rateLimitKey)
    if (voteCount === 1) await server.redis.expire(rateLimitKey, 60)
    if (voteCount > 10) {
      return reply.code(429).send({ error: 'Max 10 votes per minute' })
    }

    // Get question to find roomCode for socket emit
    const question = await server.prisma.question.findUnique({
      where: { id: body.questionId },
      include: { room: true }
    })

    if (!question) {
      return reply.code(404).send({ error: 'Question not found' })
    }

    const existing = await server.prisma.vote.findUnique({
      where: {
        questionId_anonymousUserId: {
          questionId: body.questionId,
          anonymousUserId: body.anonymousUserId
        }
      }
    })

    if (existing) {
      if (existing.voteType === body.voteType) {
        // Same direction — toggle off
        await server.prisma.vote.delete({ where: { id: existing.id } })
        await updateNetVotes(server.prisma, body.questionId)
        const netVotes = await getNetVotes(server.prisma, body.questionId)

        // Emit to everyone in room
        emitToRoom(question.room.roomCode, 'vote:updated', {
          questionId: body.questionId,
          netVotes,
          userVote: null
        })

        return reply.send({ netVotes, userVote: null })
      } else {
        // Different direction — update
        await server.prisma.vote.update({
          where: { id: existing.id },
          data: { voteType: body.voteType }
        })
      }
    } else {
      // New vote
      await server.prisma.vote.create({
        data: {
          questionId: body.questionId,
          anonymousUserId: body.anonymousUserId,
          voteType: body.voteType
        }
      })
    }

    await updateNetVotes(server.prisma, body.questionId)
    const netVotes = await getNetVotes(server.prisma, body.questionId)

    // Emit to everyone in room
    emitToRoom(question.room.roomCode, 'vote:updated', {
      questionId: body.questionId,
      netVotes,
      userVote: body.voteType
    })

    return reply.send({ netVotes, userVote: body.voteType })
  })
}

async function updateNetVotes(prisma: any, questionId: string) {
  const up = await prisma.vote.count({ where: { questionId, voteType: 'up' } })
  const down = await prisma.vote.count({ where: { questionId, voteType: 'down' } })
  await prisma.question.update({
    where: { id: questionId },
    data: { netVotes: up - down }
  })
}

async function getNetVotes(prisma: any, questionId: string): Promise<number> {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    select: { netVotes: true }
  })
  return q?.netVotes || 0
}

export default votesPlugin