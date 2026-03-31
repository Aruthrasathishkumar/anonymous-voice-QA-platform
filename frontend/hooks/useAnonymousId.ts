'use client'
import { useState, useEffect } from 'react'

function generateId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `user-${timestamp}-${random}`
}

export function useAnonymousId(): string {
  const [anonymousId, setAnonymousId] = useState<string>(() => {
    // Generate a temporary ID immediately so it's never empty
    return generateId()
  })

  useEffect(() => {
    try {
      const stored = localStorage.getItem('qna_anonymous_id')
      if (stored) {
        setAnonymousId(stored)
      } else {
        const newId = generateId()
        localStorage.setItem('qna_anonymous_id', newId)
        setAnonymousId(newId)
      }
    } catch {
      // localStorage not available
    }
  }, [])

  return anonymousId
}