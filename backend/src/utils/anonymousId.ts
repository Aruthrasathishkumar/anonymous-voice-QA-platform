export function isValidAnonymousId(id: string): boolean {
  if (!id || typeof id !== 'string') return false
  if (id.length < 5 || id.length > 100) return false
  // Allow: fp- prefix (FingerprintJS), user- prefix (fallback)
  const validPattern = /^(fp-[a-zA-Z0-9]+|user-[a-zA-Z0-9-]+)$/
  return validPattern.test(id)
}