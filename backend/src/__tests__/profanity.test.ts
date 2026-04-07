import { isProfane, cleanText } from '../utils/profanity'

describe('isProfane', () => {
  it('returns false for clean text', () => {
    expect(isProfane('What is your name?')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isProfane('')).toBe(false)
  })

  it('returns true for profane text', () => {
    expect(isProfane('you are an ass')).toBe(true)
  })
})

describe('cleanText', () => {
  it('returns original text when no profanity', () => {
    expect(cleanText('Hello world')).toBe('Hello world')
  })

  it('replaces profane words with asterisks', () => {
    const result = cleanText('you are an ass')
    expect(result).not.toContain('ass')
    expect(result).toContain('*')
  })
})
