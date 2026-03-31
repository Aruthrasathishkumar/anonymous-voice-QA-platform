'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { questionsApi, roomsApi } from '@/lib/api'
import { useAnonymousId } from '@/hooks/useAnonymousId'
import { useSocket } from '@/hooks/useSocket'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import toast, { Toaster } from 'react-hot-toast'

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

export default function HostPage() {
  const params = useParams()
  const roomCode = params.code as string
  const anonymousId = useAnonymousId()

  const [questions, setQuestions] = useState<Question[]>([])
  const [hostToken, setHostToken] = useState<string>('')
  const [roomId, setRoomId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  const { socket, isConnected } = useSocket({
    roomCode,
    anonymousUserId: anonymousId || 'host',
    isHost: true
  })

  useEffect(() => {
    const token = localStorage.getItem(`hostToken:${roomCode}`)
    const id = localStorage.getItem(`roomId:${roomCode}`)
    if (!token || !id) {
      toast.error('Host token not found')
      setIsLoading(false)
      return
    }
    setHostToken(token)
    setRoomId(id)
    questionsApi.list(id, 'top')
      .then(res => setQuestions(res.data))
      .catch(() => toast.error('Failed to load questions'))
      .finally(() => setIsLoading(false))
  }, [roomCode])

  useEffect(() => {
    if (!socket) return
    socket.on('question:new', (q: Question) => {
      setQuestions(prev => [q, ...prev])
    })
    socket.on('vote:updated', ({ questionId, netVotes }: any) => {
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, netVotes } : q)
      )
    })
    socket.on('moderation:question:pending', (q: Question) => {
      setQuestions(prev => [q, ...prev])
      toast('New question pending approval', { icon: '⏳' })
    })
    return () => {
      socket.off('question:new')
      socket.off('vote:updated')
      socket.off('moderation:question:pending')
    }
  }, [socket])

  async function handleStatus(questionId: string, status: string) {
    try {
      await questionsApi.updateStatus(questionId, status, hostToken)
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, status } : q)
      )
      toast.success(`Marked as ${status}`)
    } catch {
      toast.error('Failed to update')
    }
  }

  async function handlePin(questionId: string, isPinned: boolean) {
    try {
      await questionsApi.pin(questionId, isPinned, hostToken)
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, isPinned } : q)
      )
      toast.success(isPinned ? 'Pinned' : 'Unpinned')
    } catch {
      toast.error('Failed to pin')
    }
  }

  async function handleDelete(questionId: string) {
    try {
      await questionsApi.delete(questionId, hostToken)
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const getFiltered = () => {
    if (activeTab === 'pending') return questions.filter(q => q.status === 'pending_approval')
    if (activeTab === 'answered') return questions.filter(q => q.status === 'answered')
    if (activeTab === 'hidden') return questions.filter(q => q.status === 'hidden')
    return questions
  }

  const sorted = getFiltered().sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return b.netVotes - a.netVotes
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Toaster position="top-center" />

      <div className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-lg">Host Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Room: <span className="font-mono font-bold">{roomCode}</span>
              {' · '}{questions.length} questions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Live' : 'Connecting...'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/room/${roomCode}`
                )
                toast.success('Room link copied!')
              }}
            >
              Copy Room Link
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{questions.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {questions.filter(q => q.status === 'answered').length}
              </p>
              <p className="text-xs text-muted-foreground">Answered</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-orange-500">
                {questions.filter(q => q.status === 'pending_approval').length}
              </p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="all" className="flex-1">
              All ({questions.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">
              Pending ({questions.filter(q => q.status === 'pending_approval').length})
            </TabsTrigger>
            <TabsTrigger value="answered" className="flex-1">
              Answered ({questions.filter(q => q.status === 'answered').length})
            </TabsTrigger>
            <TabsTrigger value="hidden" className="flex-1">
              Hidden ({questions.filter(q => q.status === 'hidden').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <div className="space-y-3">
              {sorted.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No questions here</p>
                </div>
              )}
              {sorted.map((question) => (
                <Card key={question.id} className={question.isPinned ? 'border-primary' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center min-w-[40px]">
                        <span className="text-lg font-bold">{question.netVotes}</span>
                        <span className="text-xs text-muted-foreground">votes</span>
                      </div>
                      <Separator orientation="vertical" className="h-auto" />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm leading-relaxed">{question.textOriginal}</p>
                        {question.textTranslated && (
                          <p className="text-xs text-muted-foreground italic">
                            🌐 {question.textTranslated}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {question.isPinned && (
                            <Badge variant="outline" className="text-xs">📌 Pinned</Badge>
                          )}
                          {question.status === 'answered' && (
                            <Badge className="text-xs bg-green-100 text-green-800">✅ Answered</Badge>
                          )}
                          {question.status === 'hidden' && (
                            <Badge variant="destructive" className="text-xs">Hidden</Badge>
                          )}
                          {question.status === 'pending_approval' && (
                            <Badge className="text-xs bg-orange-100 text-orange-800">⏳ Pending</Badge>
                          )}
                          {question.isVoice && (
                            <Badge variant="outline" className="text-xs">🎤 Voice</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {question.status === 'pending_approval' && (
                            <Button
                              size="sm"
                              className="text-xs h-7 bg-green-600 hover:bg-green-700"
                              onClick={() => handleStatus(question.id, 'active')}
                            >
                              ✔️ Approve
                            </Button>
                          )}
                          {question.status !== 'answered' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => handleStatus(question.id, 'answered')}
                            >
                              ✅ Answered
                            </Button>
                          )}
                          {question.status === 'answered' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => handleStatus(question.id, 'active')}
                            >
                              Reopen
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => handlePin(question.id, !question.isPinned)}
                          >
                            {question.isPinned ? 'Unpin' : '📌 Pin'}
                          </Button>
                          {question.status !== 'hidden' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => handleStatus(question.id, 'hidden')}
                            >
                              🚫 Hide
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs h-7"
                            onClick={() => handleDelete(question.id)}
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}