import { isValidAnonymousId } from '../utils/anonymousId'

describe('isValidAnonymousId', () => {
  it('accepts valid fp- prefixed id', () => {
    expect(isValidAnonymousId('fp-abc123XYZ')).toBe(true)
  })

  it('accepts valid user- prefixed id', () => {
    expect(isValidAnonymousId('user-abc-123')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isValidAnonymousId('')).toBe(false)
  })

  it('rejects id shorter than 5 chars', () => {
    expect(isValidAnonymousId('fp-a')).toBe(false)
  })

  it('rejects id without valid prefix', () => {
    expect(isValidAnonymousId('abc123')).toBe(false)
  })

  it('rejects id with invalid prefix', () => {
    expect(isValidAnonymousId('bad-abc123')).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(isValidAnonymousId(null as any)).toBe(false)
    expect(isValidAnonymousId(undefined as any)).toBe(false)
  })
})