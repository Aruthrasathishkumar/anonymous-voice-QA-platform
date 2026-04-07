'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BarChart3, Lock, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface PollOption {
  id: string
  text: string
  voteCount: number
}

interface Poll {
  id: string
  question: string
  isActive: boolean
  options: PollOption[]
}

interface PollCardProps {
  poll: Poll
  anonymousUserId: string
  isHost?: boolean
  hostToken?: string
  onClose?: (pollId: string) => void
  onVote?: (pollId: string, optionId: string) => void
}

export default function PollCard({
  poll,
  anonymousUserId,
  isHost = false,
  hostToken,
  onClose,
  onVote
}: PollCardProps) {
  const [voted, setVoted] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [localOptions, setLocalOptions] = useState(poll.options)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const totalVotes = localOptions.reduce((sum, o) => sum + o.voteCount, 0)
  const showResults = voted || !poll.isActive || isHost

  async function handleVote(optionId: string) {
    if (voted || !poll.isActive) return
    try {
      await axios.post(`${apiUrl}/api/polls/${poll.id}/vote`, {
        optionId,
        anonymousUserId
      })
      setVoted(true)
      setSelectedId(optionId)
      setLocalOptions(prev =>
        prev.map(o => o.id === optionId
          ? { ...o, voteCount: o.voteCount + 1 }
          : o
        )
      )
      if (onVote) onVote(poll.id, optionId)
      toast.success('Vote recorded!')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to vote')
    }
  }

  async function handleClose() {
    if (!hostToken || !onClose) return
    try {
      await axios.patch(
        `${apiUrl}/api/polls/${poll.id}/close`,
        {},
        { headers: { 'x-host-token': hostToken } }
      )
      onClose(poll.id)
      toast.success('Poll closed')
    } catch {
      toast.error('Failed to close poll')
    }
  }

  return (
    <div className={`rounded-2xl border p-5 transition-all ${
      poll.isActive
        ? 'border-foreground/10 bg-card shadow-soft'
        : 'border-border/50 bg-muted/20 opacity-80'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            poll.isActive ? 'bg-foreground/[0.06]' : 'bg-muted'
          }`}>
            <BarChart3 className="w-4.5 h-4.5 text-foreground/60" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-snug">{poll.question}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
              {voted && (
                <span className="text-success ml-1.5 inline-flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> Voted
                </span>
              )}
            </p>
          </div>
        </div>
        {!poll.isActive && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-muted text-muted-foreground">
            <Lock className="w-2.5 h-2.5" /> Closed
          </span>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2">
        {localOptions.map((option) => {
          const percentage = totalVotes > 0
            ? Math.round((option.voteCount / totalVotes) * 100)
            : 0
          const isSelected = selectedId === option.id

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={voted || !poll.isActive}
              className={`relative w-full text-left rounded-xl px-4 py-3 text-sm transition-all overflow-hidden ${
                poll.isActive && !voted
                  ? 'border border-border hover:border-foreground/20 hover:bg-muted/30 cursor-pointer'
                  : 'border border-border/40 cursor-default'
              } ${isSelected ? 'border-foreground/20 bg-foreground/[0.03]' : ''}`}
            >
              {/* Progress bar background */}
              {showResults && (
                <div
                  className={`absolute inset-0 transition-all duration-700 ease-out ${
                    isSelected ? 'bg-foreground/[0.06]' : 'bg-muted/40'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              )}

              <div className="relative flex items-center justify-between">
                <span className={`font-medium ${isSelected ? 'text-foreground' : ''}`}>
                  {option.text}
                </span>
                {showResults && (
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums ml-3">
                    {percentage}%
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Host close button */}
      {isHost && poll.isActive && (
        <div className="mt-4 pt-3 border-t border-border/40">
          <Button
            size="sm"
            variant="outline"
            onClick={handleClose}
            className="w-full text-xs rounded-lg"
          >
            <Lock className="w-3 h-3 mr-1.5" />
            Close Poll
          </Button>
        </div>
      )}
    </div>
  )
}
