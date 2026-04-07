import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isValidAnonymousId } from '../utils/anonymousId'
import { emitToRoom } from '../socket/index'

const voteSchema = z.object({
  questionId: z.string().min(1),
  anonymousUserId: z.string().min(1).max(100),
  voteType: z.enum(['up', 'down'])
})

const votesPlugin: FastifyPluginAsync = async (server) => {

  server.post('/', async (request, reply) => {
    const result = voteSchema.safeParse(request.body)
    if (!result.success) {
      return reply.code(400).send({ error: result.error.errors[0].message })
    }
    const body = result.data

    if (!isValidAnonymousId(body.anonymousUserId)) {
      return reply.code(400).send({ error: 'Invalid user ID' })
    }

    // Redis sliding window rate limit: max 10 votes per minute
    const rateLimitKey = `ratelimit:vote:${body.anonymousUserId}`
    const voteCount = await server.redis.incr(rateLimitKey)
    if (voteCount === 1) await server.redis.expire(rateLimitKey, 60)
    if (voteCount > 10) {
      return reply.code(429).send({ error: 'Too many votes. Max 10 per minute.' })
    }

    const question = await server.prisma.question.findUnique({
      where: { id: body.questionId },
      include: { room: true }
    })
    if (!question) {
      return reply.code(404).send({ error: 'Question not found' })
    }

    // Don't allow voting on hidden or rejected questions
    if (['hidden', 'rejected'].includes(question.status)) {
      return reply.code(403).send({ error: 'Cannot vote on this question' })
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
      // New vote — PostgreSQL UNIQUE constraint prevents duplicates at DB level
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