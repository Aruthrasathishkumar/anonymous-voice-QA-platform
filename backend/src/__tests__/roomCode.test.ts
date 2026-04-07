import { generateHostToken } from '../utils/roomCode'

describe('generateHostToken', () => {
  it('returns a 32-character string', () => {
    const token = generateHostToken()
    expect(token).toHaveLength(32)
  })

  it('returns only alphanumeric characters', () => {
    const token = generateHostToken()
    expect(token).toMatch(/^[A-Za-z0-9]{32}$/)
  })

  it('generates unique tokens each time', () => {
    const t1 = generateHostToken()
    const t2 = generateHostToken()
    expect(t1).not.toBe(t2)
  })
})