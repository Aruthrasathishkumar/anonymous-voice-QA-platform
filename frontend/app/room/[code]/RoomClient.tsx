'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { questionsApi, votesApi, roomsApi } from '@/lib/api'
import { useAnonymousId } from '@/hooks/useAnonymousId'
import { useSocket } from '@/hooks/useSocket'
import { Button } from '@/components/ui/button'
import toast, { Toaster } from 'react-hot-toast'
import VoiceRecorder from '@/components/VoiceRecorder'
import ExpiryCountdown from '@/components/ExpiryCountdown'
import PollCard from '@/components/PollCard'
import axios from 'axios'
import {
  MessageCircleQuestion,
  ChevronUp,
  ChevronDown,
  Send,
  Pin,
  Check,
  Mic,
  Globe,

  Clock,
  BarChart3,
  Loader2,
  Home,
} from 'lucide-react'

interface Question {
  id: string
  textOriginal: string
  textTranslated?: string
  languageCode: string
  netVotes: number
  status: string
  isPinned: boolean
  isVoice: boolean
  createdAt: string
  anonymousUserId: string
}

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

interface Room {
  roomId: string
  roomCode: string
  hostLanguage: string
  expiresAt?: string
  settings: {
    allowVoice: boolean
    allowPolls: boolean
    moderationMode: string
  }
}

export default function RoomPage() {
  const params = useParams()
  const roomCode = params.code as string
  const anonymousId = useAnonymousId()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const [room, setRoom] = useState<Room | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [questionText, setQuestionText] = useState('')
  const [sortBy, setSortBy] = useState('top')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down' | null>>({})
  const [isLoading, setIsLoading] = useState(true)

  const { socket, isConnected } = useSocket({
    roomCode,
    anonymousUserId: anonymousId,
    isHost: false
  })

  useEffect(() => {
    if (!roomCode || !anonymousId) return
    async function load() {
      try {
        const roomRes = await roomsApi.join(roomCode, anonymousId)
        setRoom(roomRes.data)
        const [questionsRes, pollsRes] = await Promise.all([
          questionsApi.list(roomRes.data.roomId, sortBy),
          axios.get(`${apiUrl}/api/polls/${roomRes.data.roomId}`)
        ])
        setQuestions(questionsRes.data)
        setPolls(pollsRes.data || [])
      } catch {
        toast.error('Room not found or expired')
      } finally {
        setIsLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, anonymousId])

  useEffect(() => {
    if (!room) return
    questionsApi.list(room.roomId, sortBy).then(res => setQuestions(res.data))
  }, [sortBy, room])

  useEffect(() => {
    if (!socket) return

    socket.on('question:new', (question: Question) => {
      setQuestions(prev => {
        const exists = prev.find(q => q.id === question.id)
        if (exists) return prev
        return [question, ...prev]
      })
    })

    socket.on('vote:updated', ({ questionId, netVotes }: { questionId: string; netVotes: number }) => {
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, netVotes } : q)
      )
    })

    socket.on('question:status:updated', ({ questionId, status }: { questionId: string; status: string }) => {
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, status } : q)
      )
    })

    socket.on('question:deleted', ({ questionId }: { questionId: string }) => {
      setQuestions(prev => prev.filter(q => q.id !== questionId))
    })

    socket.on('question:pinned', ({ questionId, isPinned }: { questionId: string; isPinned: boolean }) => {
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, isPinned } : q)
      )
    })

    socket.on('question:voice:ready', ({ questionId, textOriginal, textTranslated }: { questionId: string; textOriginal: string; textTranslated?: string }) => {
      setQuestions(prev => {
        const exists = prev.find(q => q.id === questionId)
        if (exists) {
          return prev.map(q => q.id === questionId
            ? { ...q, textOriginal, textTranslated, status: 'active' }
            : q
          )
        }
        return prev
      })
      toast.success('Voice question transcribed!')
    })

    socket.on('question:voice:failed', ({ questionId }: { questionId: string }) => {
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      toast.error('Failed to transcribe voice question')
    })

    socket.on('poll:new', (poll: Poll) => {
      setPolls(prev => [poll, ...prev])
      toast('New poll available!', { icon: '📊' })
    })

    socket.on('poll:voted', ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      setPolls(prev => prev.map(p =>
        p.id === pollId
          ? {
            ...p,
            options: p.options.map(o =>
              o.id === optionId ? { ...o, voteCount: o.voteCount + 1 } : o
            )
          }
          : p
      ))
    })

    socket.on('poll:closed', ({ pollId }: { pollId: string }) => {
      setPolls(prev => prev.map(p =>
        p.id === pollId ? { ...p, isActive: false } : p
      ))
    })

    return () => {
      socket.off('question:new')
      socket.off('vote:updated')
      socket.off('question:status:updated')
      socket.off('question:deleted')
      socket.off('question:pinned')
      socket.off('question:voice:ready')
      socket.off('question:voice:failed')
      socket.off('poll:new')
      socket.off('poll:voted')
      socket.off('poll:closed')
    }
  }, [socket])

  async function handleSubmitQuestion() {
    if (!questionText.trim() || !room || !anonymousId) return
    if (questionText.length < 5) {
      toast.error('Question must be at least 5 characters')
      return
    }
    setIsSubmitting(true)
    try {
      await questionsApi.create({
        roomId: room.roomId,
        text: questionText,
        anonymousUserId: anonymousId
      })
      setQuestionText('')
      toast.success('Question submitted!')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to submit')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVote(questionId: string, voteType: 'up' | 'down') {
    if (!anonymousId) return
    try {
      const res = await votesApi.vote({
        questionId,
        anonymousUserId: anonymousId,
        voteType
      })
      setUserVotes(prev => ({ ...prev, [questionId]: res.data.userVote }))
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Vote failed')
    }
  }

  const sortedQuestions = [...questions].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return b.netVotes - a.netVotes
  })

  const visibleQuestions = sortedQuestions.filter(q => q.status !== 'hidden' && q.status !== 'rejected')
  const activePolls = polls.filter(p => p.isActive)
  const charCount = questionText.length

  // ─── Loading state ───
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Joining room...</p>
        </div>
      </div>
    )
  }

  // ─── Room not found ───
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 px-6">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <MessageCircleQuestion className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Room not found</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This room may have expired or does not exist.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
            className="rounded-full px-6 gap-2"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#000',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '14px',
            padding: '12px 16px',
          },
        }}
      />

      {/* ─── Sticky Header ─── */}
      <header className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <MessageCircleQuestion className="w-4 h-4 text-background" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold font-mono tracking-wider">{roomCode}</span>
                <span className="text-xs text-muted-foreground">
                  {questions.length} {questions.length === 1 ? 'question' : 'questions'}
                </span>
              </div>
              {room.expiresAt && (
                <ExpiryCountdown expiresAt={room.expiresAt} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success pulse-live' : 'bg-destructive'}`} />
            <span className="text-xs font-medium text-muted-foreground">
              {isConnected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ─── Question Input ─── */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Ask a question</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {charCount > 0 && `${charCount}/500`}
            </span>
          </div>

          <textarea
            className="w-full min-h-[88px] p-3.5 text-sm leading-relaxed rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground/20 transition-all placeholder:text-muted-foreground/50"
            placeholder="What would you like to ask? Your identity stays anonymous."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSubmitQuestion()
              }
            }}
          />

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground/50">
              {room.settings.moderationMode === 'pre' ? 'Questions are reviewed by the host before appearing' : 'Questions appear immediately'}
            </p>
            <Button
              onClick={handleSubmitQuestion}
              disabled={isSubmitting || !questionText.trim() || !anonymousId || questionText.length < 5}
              className="rounded-full px-5 gap-2 h-9"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {isSubmitting ? 'Sending...' : 'Submit'}
            </Button>
          </div>

          {/* Voice Recorder */}
          {room?.settings?.allowVoice && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/40" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-[11px] uppercase tracking-wider text-muted-foreground/50 font-medium">or</span>
                </div>
              </div>
              <VoiceRecorder
                roomId={room.roomId}
                anonymousUserId={anonymousId}
                onSubmitted={() => {
                  toast('Voice question processing...', { icon: '🎤' })
                }}
              />
            </>
          )}
        </div>

        {/* ─── Active Polls ─── */}
        {activePolls.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">
                Live Polls
                <span className="text-muted-foreground font-normal ml-1.5">({activePolls.length})</span>
              </h2>
            </div>
            {activePolls.map(poll => (
              <PollCard
                key={poll.id}
                poll={poll}
                anonymousUserId={anonymousId}
                isHost={false}
              />
            ))}
          </div>
        )}

        {/* ─── Sort Controls ─── */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Questions
            <span className="text-muted-foreground font-normal ml-1.5">({visibleQuestions.length})</span>
          </h2>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/60">
            <button
              onClick={() => setSortBy('top')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                sortBy === 'top'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Top Voted
            </button>
            <button
              onClick={() => setSortBy('recent')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                sortBy === 'recent'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Recent
            </button>
          </div>
        </div>

        {/* ─── Questions List ─── */}
        <div className="space-y-2.5">
          {visibleQuestions.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <MessageCircleQuestion className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/70">No questions yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Be the first to ask something!</p>
              </div>
            </div>
          )}

          {visibleQuestions.map((question) => {
            const isProcessing = question.textOriginal === 'Processing voice question...'

            return (
              <div
                key={question.id}
                className={`group rounded-xl border p-4 transition-all ${
                  question.isPinned
                    ? 'border-foreground/12 bg-foreground/[0.02] shadow-soft'
                    : 'border-border/50 bg-card hover:border-border'
                }`}
              >
                <div className="flex gap-3">
                  {/* Vote buttons */}
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <button
                      onClick={() => handleVote(question.id, 'up')}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                        userVotes[question.id] === 'up'
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <span className={`text-xs font-semibold tabular-nums py-0.5 ${
                      question.netVotes > 0 ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {question.netVotes}
                    </span>
                    <button
                      onClick={() => handleVote(question.id, 'down')}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                        userVotes[question.id] === 'down'
                          ? 'bg-destructive/10 text-destructive'
                          : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {isProcessing ? (
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <p className="text-sm text-muted-foreground italic">
                          Transcribing voice question...
                        </p>
                      </div>
                    ) : (
                      <p className="text-[14px] leading-relaxed text-foreground/90">
                        {question.textOriginal}
                      </p>
                    )}

                    {question.textTranslated && (
                      <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                        <Globe className="w-3 h-3 mt-0.5 shrink-0" />
                        {question.textTranslated}
                      </p>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {question.isPinned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-foreground/60">
                          <Pin className="w-2.5 h-2.5" /> Pinned
                        </span>
                      )}
                      {question.status === 'answered' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-success/10 text-success">
                          <Check className="w-2.5 h-2.5" /> Answered
                        </span>
                      )}
                      {question.isVoice && !isProcessing && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-muted-foreground">
                          <Mic className="w-2.5 h-2.5" /> Voice
                        </span>
                      )}
                      {question.textTranslated && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-muted-foreground">
                          <Globe className="w-2.5 h-2.5" /> Translated
                        </span>
                      )}
                      {/* Time ago */}
                      <span className="text-[10px] text-muted-foreground/50 ml-auto flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimeAgo(question.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom spacing for mobile */}
        <div className="h-8" />
      </div>
    </main>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
