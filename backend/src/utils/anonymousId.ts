export function isValidAnonymousId(id: string): boolean {
  if (!id || typeof id !== 'string') return false
  if (id.length < 10 || id.length > 100) return false
  return true
}