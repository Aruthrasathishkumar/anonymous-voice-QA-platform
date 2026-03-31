'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { questionsApi, votesApi, roomsApi } from '@/lib/api'
import { useAnonymousId } from '@/hooks/useAnonymousId'
import { useSocket } from '@/hooks/useSocket'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import toast, { Toaster } from 'react-hot-toast'
import VoiceRecorder from '@/components/VoiceRecorder'

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

interface Room {
  roomId: string
  roomCode: string
  hostLanguage: string
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

  const [room, setRoom] = useState<Room | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
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

  // Load room and questions on mount
  useEffect(() => {
    if (!roomCode) return
    async function load() {
      try {
        const roomRes = await roomsApi.join(roomCode)
        setRoom(roomRes.data)
        const questionsRes = await questionsApi.list(roomRes.data.roomId, sortBy)
        setQuestions(questionsRes.data)
      } catch {
        toast.error('Room not found or expired')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [roomCode])

  // Reload questions when sort changes
  useEffect(() => {
    if (!room) return
    questionsApi.list(room.roomId, sortBy).then(res => setQuestions(res.data))
  }, [sortBy, room])

  // Socket.io real-time events
  useEffect(() => {
    if (!socket) return

    socket.on('question:new', (question: Question) => {
      setQuestions(prev => {
        const exists = prev.find(q => q.id === question.id)
        if (exists) return prev
        return [question, ...prev]
      })
    })

    socket.on('vote:updated', ({ questionId, netVotes }: any) => {
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, netVotes } : q)
      )
    })

    socket.on('question:status:updated', ({ questionId, status }: any) => {
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, status } : q)
      )
    })

    socket.on('question:deleted', ({ questionId }: any) => {
      setQuestions(prev => prev.filter(q => q.id !== questionId))
    })

    socket.on('question:pinned', ({ questionId, isPinned }: any) => {
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, isPinned } : q)
      )
    })

    socket.on('question:voice:ready', ({ questionId, textOriginal, textTranslated }: any) => {
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
      toast.success('Voice question transcribed! ✅')
    })

    socket.on('question:voice:failed', ({ questionId }: any) => {
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      toast.error('Failed to transcribe voice question')
    })

    return () => {
      socket.off('question:new')
      socket.off('vote:updated')
      socket.off('question:status:updated')
      socket.off('question:deleted')
      socket.off('question:pinned')
      socket.off('question:voice:ready')
      socket.off('question:voice:failed')
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
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to submit')
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
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Vote failed')
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading room...</p>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Room not found</h2>
          <p className="text-muted-foreground">
            This room may have expired or does not exist
          </p>
          <Button onClick={() => window.location.href = '/'}>Go Home</Button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-lg">Room {roomCode}</h1>
            <p className="text-xs text-muted-foreground">
              {questions.length} questions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'Live' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Question Input */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Ask a question anonymously</p>
              <p className="text-xs text-muted-foreground">
                {500 - questionText.length} characters remaining
              </p>
            </div>
            <textarea
              className="w-full min-h-[80px] p-3 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Type your question here..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value.slice(0, 500))}
            />
            <Button
              className="w-full"
              onClick={handleSubmitQuestion}
              disabled={isSubmitting || !questionText.trim() || !anonymousId}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Question'}
            </Button>

            {/* Voice Recorder */}
            {room?.settings?.allowVoice && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <VoiceRecorder
                  roomId={room.roomId}
                  anonymousUserId={anonymousId}
                  onSubmitted={(questionId) => {
                    toast('Voice question processing...', { icon: '🎤' })
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Sort Tabs */}
        <Tabs value={sortBy} onValueChange={setSortBy}>
          <TabsList className="w-full">
            <TabsTrigger value="top" className="flex-1">Top Voted</TabsTrigger>
            <TabsTrigger value="recent" className="flex-1">Recent</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Questions List */}
        <div className="space-y-3">
          {sortedQuestions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No questions yet</p>
              <p className="text-sm">Be the first to ask!</p>
            </div>
          )}

          {sortedQuestions
            .filter(q => q.status !== 'hidden' && q.status !== 'rejected')
            .map((question) => (
              <Card
                key={question.id}
                className={question.isPinned ? 'border-primary' : ''}
              >
                <CardContent className="pt-4">
                  <div className="flex gap-3">

                    {/* Vote buttons */}
                    <div className="flex flex-col items-center gap-1 min-w-[40px]">
                      <button
                        onClick={() => handleVote(question.id, 'up')}
                        className={`text-lg transition-colors ${
                          userVotes[question.id] === 'up'
                            ? 'text-primary font-bold'
                            : 'text-muted-foreground hover:text-primary'
                        }`}
                      >
                        ▲
                      </button>
                      <span className="text-sm font-semibold">
                        {question.netVotes}
                      </span>
                      <button
                        onClick={() => handleVote(question.id, 'down')}
                        className={`text-lg transition-colors ${
                          userVotes[question.id] === 'down'
                            ? 'text-destructive font-bold'
                            : 'text-muted-foreground hover:text-destructive'
                        }`}
                      >
                        ▼
                      </button>
                    </div>

                    {/* Question content */}
                    <div className="flex-1 space-y-2">
                      {question.status === 'processing' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          <p className="text-sm text-muted-foreground italic">
                            Transcribing voice question...
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed">
                          {question.textOriginal}
                        </p>
                      )}

                      {question.textTranslated && (
                        <p className="text-xs text-muted-foreground italic">
                          🌐 {question.textTranslated}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1">
                        {question.isPinned && (
                          <Badge variant="outline" className="text-xs">
                            📌 Pinned
                          </Badge>
                        )}
                        {question.status === 'answered' && (
                          <Badge className="text-xs bg-green-100 text-green-800">
                            ✅ Answered
                          </Badge>
                        )}
                        {question.isVoice && (
                          <Badge variant="outline" className="text-xs">
                            🎤 Voice
                          </Badge>
                        )}
                        {question.textTranslated && (
                          <Badge variant="outline" className="text-xs">
                            🌐 Translated
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </main>
  )
}