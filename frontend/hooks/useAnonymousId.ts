'use client'
import { useState, useEffect } from 'react'

export function useAnonymousId(): string {
  const [anonymousId, setAnonymousId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('qna_anonymous_id') || ''
  })

  useEffect(() => {
    async function initId() {
      try {
        // Always try FingerprintJS to get a stable device-level ID.
        // This ensures the same physical device produces the same ID
        // across different browsers (Chrome, Edge, Firefox, etc.).
        const FingerprintJS = await import('@fingerprintjs/fingerprintjs')
        const fp = await FingerprintJS.load()
        const result = await fp.get()
        const id = `fp-${result.visitorId}`

        // Update localStorage and state with the device-level ID,
        // even if a different value (e.g. a random fallback) was cached.
        localStorage.setItem('qna_anonymous_id', id)
        setAnonymousId(id)
      } catch {
        // FingerprintJS failed — only use a random fallback if we don't
        // already have a stored ID (avoid overwriting a good fp-* ID).
        const stored = localStorage.getItem('qna_anonymous_id')
        if (stored) {
          setAnonymousId(stored)
          return
        }
        const fallback = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
        localStorage.setItem('qna_anonymous_id', fallback)
        setAnonymousId(fallback)
      }
    }
    initId()
  }, [])

  return anonymousId
}
