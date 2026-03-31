import Filter from 'bad-words'

const filter = new Filter()

export function isProfane(text: string): boolean {
  try { return filter.isProfane(text) } catch { return false }
}

export function cleanText(text: string): string {
  try { return filter.clean(text) } catch { return text }
}