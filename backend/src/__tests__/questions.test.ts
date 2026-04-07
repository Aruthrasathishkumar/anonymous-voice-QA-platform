import Fastify from 'fastify'
import questionsPlugin from '../routes/questions'

jest.mock('../socket/index', () => ({
  emitToRoom: jest.fn(),
  emitToHost: jest.fn()
}))

const mockRoom = {
  id: 'room-123',
  roomCode: 'ABC123',
  isActive: true,
  expiresAt: new Date(Date.now() + 86400000),
  maxCapacity: 500,
  moderationMode: 'post'
}

function buildApp() {
  const app = Fastify()

  app.decorate('prisma', {
    room: { findUnique: jest.fn().mockResolvedValue(mockRoom) },
    question: {
      create: jest.fn().mockResolvedValue({
        id: 'q-1',
        roomId: 'room-123',
        textOriginal: 'What is your name?',
        status: 'active',
        netVotes: 0,
        isPinned: false,
        isVoice: false,
        createdAt: new Date()
      }),
      findFirst: jest.fn().mockResolvedValue(null)
    }
  } as any)

  app.decorate('redis', {
    get: jest.fn().mockResolvedValue('0'),
    incr: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    expire: jest.fn().mockResolvedValue(1)
  } as any)

  app.register(questionsPlugin, { prefix: '/api/questions' })
  return app
}

describe('POST /api/questions', () => {
  it('returns 400 when text is under 5 characters', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/questions',
      payload: {
        roomId: 'room-123',
        text: 'Hi',
        anonymousUserId: 'fp-abc123'
      }
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.error).toMatch(/5 characters/i)
  })

  it('returns 400 for invalid anonymousUserId', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/questions',
      payload: {
        roomId: 'room-123',
        text: 'What is your name?',
        anonymousUserId: 'invalid-id'
      }
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toMatch(/Invalid user ID/i)
  })

  it('returns 400 for profane content', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/questions',
      payload: {
        roomId: 'room-123',
        text: 'you are an ass',
        anonymousUserId: 'fp-abc123'
      }
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toMatch(/Inappropriate/i)
  })

  it('returns 400 when text exceeds 500 characters', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/questions',
      payload: {
        roomId: 'room-123',
        text: 'a'.repeat(501),
        anonymousUserId: 'fp-abc123'
      }
    })
    expect(res.statusCode).toBe(400)
  })
})
