'use client'
import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface ExpiryCountdownProps {
  expiresAt: string
}

export default function ExpiryCountdown({ expiresAt }: ExpiryCountdownProps) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isWarning, setIsWarning] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    function update() {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('Expired')
        setIsExpired(true)
        return
      }
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      if (hours < 1) setIsWarning(true)
      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`)
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${seconds}s`)
      }
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
        isExpired
          ? 'text-destructive'
          : isWarning
          ? 'text-warning'
          : 'text-muted-foreground'
      }`}
    >
      <Clock className="w-3 h-3" />
      {isExpired ? 'Expired' : timeLeft}
    </span>
  )
}
