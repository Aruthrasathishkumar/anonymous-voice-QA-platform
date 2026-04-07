import Fastify from 'fastify'
import roomsPlugin from '../routes/rooms'

jest.mock('../socket/index', () => ({
  emitToRoom: jest.fn()
}))

function buildApp() {
  const app = Fastify()

  const mockRoom = {
    id: 'test-room-id',
    roomCode: 'ABC123',
    hostToken: 'test-host-token-32chars-long-abc',
    expiresAt: new Date(Date.now() + 86400000),
    isActive: true,
    hostLanguage: 'en',
    moderationMode: 'post',
    allowVoice: true,
    allowPolls: true,
    maxCapacity: 500
  }

  app.decorate('prisma', {
    room: {
      create: jest.fn().mockResolvedValue(mockRoom),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(mockRoom)
    }
  } as any)

  app.decorate('redis', {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('0'),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1)
  } as any)

  app.register(roomsPlugin, { prefix: '/api/rooms' })
  return app
}

describe('POST /api/rooms/create', () => {
  it('returns 201 with roomCode, hostToken, expiresAt', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms/create',
      payload: {
        hostLanguage: 'en',
        moderationMode: 'post',
        allowVoice: true,
        allowPolls: true,
        maxCapacity: 500
      }
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('roomCode')
    expect(body).toHaveProperty('hostToken')
    expect(body).toHaveProperty('expiresAt')
    expect(body).toHaveProperty('roomId')
  })

  it('returns 400 for invalid hostLanguage', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms/create',
      payload: { hostLanguage: 'english' }
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid moderationMode', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms/create',
      payload: { hostLanguage: 'en', moderationMode: 'invalid' }
    })
    expect(res.statusCode).toBe(400)
  })
})
