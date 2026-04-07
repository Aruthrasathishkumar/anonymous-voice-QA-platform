'use client'

interface WordCloudProps {
  questions: { textOriginal: string }[]
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'to', 'of',
  'in', 'on', 'at', 'by', 'for', 'with', 'about', 'as', 'and',
  'or', 'but', 'if', 'what', 'how', 'why', 'when', 'where', 'who',
  'your', 'my', 'our', 'their', 'this', 'that', 'it', 'its', 'you',
  'we', 'they', 'he', 'she', 'i', 'me', 'him', 'her', 'us', 'them',
  'processing', 'voice', 'question'
])

function getWordFrequency(questions: { textOriginal: string }[]) {
  const freq: Record<string, number> = {}
  questions.forEach(q => {
    const words = q.textOriginal
      .toLowerCase()
      .replace(/[^a-zA-Z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  })
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([text, value]) => ({ text, value }))
}

export default function WordCloud({ questions }: WordCloudProps) {
  const words = getWordFrequency(questions)

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Not enough data for word cloud yet
      </div>
    )
  }

  const maxVal = Math.max(...words.map(w => w.value))

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 p-5 justify-center items-center min-h-[140px]">
      {words.map((word) => {
        const ratio = word.value / maxVal
        const size = 13 + Math.round(ratio * 22)
        // Warm palette opacity mapping
        const opacity = 0.3 + ratio * 0.7

        return (
          <span
            key={word.text}
            style={{
              fontSize: `${size}px`,
              opacity,
            }}
            className="font-semibold text-foreground transition-all duration-300 cursor-default hover:opacity-100 hover:scale-110"
            title={`${word.value} occurrence${word.value > 1 ? 's' : ''}`}
          >
            {word.text}
          </span>
        )
      })}
    </div>
  )
}
