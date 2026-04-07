'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { questionsApi, roomsApi } from '@/lib/api'
import { useAnonymousId } from '@/hooks/useAnonymousId'
import { useSocket } from '@/hooks/useSocket'
import { Button } from '@/components/ui/button'
import toast, { Toaster } from 'react-hot-toast'
import WordCloud from '@/components/WordCloud'
import ExpiryCountdown from '@/components/ExpiryCountdown'
import PollCard from '@/components/PollCard'
import { exportSessionPDF } from '@/lib/exportPdf'
import axios from 'axios'
import {
  MessageCircleQuestion,
  Pin,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Mic,
  Globe,
  BarChart3,
  FileDown,
  Link2,
  Plus,
  Loader2,
  Home,
  ChevronDown,
  Clock,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Cloud,
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

export default function HostPage() {
  const params = useParams()
  const roomCode = params.code as string
  const anonymousId = useAnonymousId()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const [questions, setQuestions] = useState<Question[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [hostToken, setHostToken] = useState<string>('')
  const [roomId, setRoomId] = useState<string>('')
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isDeletingRoom, setIsDeletingRoom] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [showWordCloud, setShowWordCloud] = useState(false)
  const [newPollQuestion, setNewPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [creatingPoll, setCreatingPoll] = useState(false)
  const [showCreatePoll, setShowCreatePoll] = useState(false)

  const { socket, isConnected } = useSocket({
    roomCode,
    anonymousUserId: anonymousId || 'host',
    isHost: true
  })

  useEffect(() => {
    const token = localStorage.getItem(`hostToken:${roomCode}`)
    const id = localStorage.getItem(`roomId:${roomCode}`)
    const exp = localStorage.getItem(`expiresAt:${roomCode}`)
    if (!token || !id) {
      toast.error('Host token not found. Please create a new room.')
      setIsLoading(false)
      return
    }
    setHostToken(token)
    setRoomId(id)
    if (exp) setExpiresAt(exp)

    Promise.all([
      questionsApi.list(id, 'top'),
      axios.get(`${apiUrl}/api/polls/${id}`)
    ])
      .then(([qRes, pRes]) => {
        setQuestions(qRes.data)
        setPolls(pRes.data || [])
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode])

  useEffect(() => {
    if (!socket) return
    socket.on('question:new', (q: Question) => {
      setQuestions(prev => {
        if (prev.find(x => x.id === q.id)) return prev
        return [q, ...prev]
      })
    })
    socket.on('vote:updated', ({ questionId, netVotes }: { questionId: string; netVotes: number }) => {
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, netVotes } : q)
      )
    })
    socket.on('moderation:question:pending', (q: Question) => {
      setQuestions(prev => [q, ...prev])
      toast('New question pending approval', { icon: '⏳' })
    })
    socket.on('poll:voted', ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      setPolls(prev => prev.map(p =>
        p.id === pollId
          ? { ...p, options: p.options.map(o => o.id === optionId ? { ...o, voteCount: o.voteCount + 1 } : o) }
          : p
      ))
    })
    socket.on('poll:closed', ({ pollId }: { pollId: string }) => {
      setPolls(prev => prev.map(p => p.id === pollId ? { ...p, isActive: false } : p))
    })
    return () => {
      socket.off('question:new')
      socket.off('vote:updated')
      socket.off('moderation:question:pending')
      socket.off('poll:voted')
      socket.off('poll:closed')
    }
  }, [socket])

  async function handleStatus(questionId: string, status: string) {
    try {
      await questionsApi.updateStatus(questionId, status, hostToken)
      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, status } : q))
      toast.success(`Marked as ${status}`)
    } catch {
      toast.error('Failed to update')
    }
  }

  async function handlePin(questionId: string, isPinned: boolean) {
    try {
      await questionsApi.pin(questionId, isPinned, hostToken)
      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, isPinned } : q))
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

  async function handleDeleteRoom() {
    const wantsPdf = window.confirm(
      'Before deleting, do you want to download a PDF of all questions?\n\nOK = Download PDF first, then delete\nCancel = Delete without downloading'
    )

    if (wantsPdf) {
      try {
        exportSessionPDF(roomCode, questions)
        toast.success('PDF downloaded!')
        await new Promise(resolve => setTimeout(resolve, 1500))
      } catch {
        toast.error('PDF export failed, continuing with deletion...')
      }
    }

    const confirmDelete = window.confirm(
      'Are you sure you want to permanently delete this room?\n\nThis will remove all questions, polls and data. This cannot be undone.'
    )
    if (!confirmDelete) return

    setIsDeletingRoom(true)
    try {
      await roomsApi.delete(roomCode, hostToken)
      localStorage.removeItem(`hostToken:${roomCode}`)
      localStorage.removeItem(`roomId:${roomCode}`)
      localStorage.removeItem(`expiresAt:${roomCode}`)
      toast.success('Room deleted!')
      setTimeout(() => window.location.href = '/', 1500)
    } catch {
      toast.error('Failed to delete room')
      setIsDeletingRoom(false)
    }
  }

  async function handleCreatePoll() {
    const validOptions = pollOptions.filter(o => o.trim().length > 0)
    if (!newPollQuestion.trim()) { toast.error('Poll question required'); return }
    if (validOptions.length < 2) { toast.error('At least 2 options required'); return }
    setCreatingPoll(true)
    try {
      const res = await axios.post(
        `${apiUrl}/api/polls`,
        { roomId, question: newPollQuestion, options: validOptions },
        { headers: { 'x-host-token': hostToken } }
      )
      setPolls(prev => [res.data, ...prev])
      setNewPollQuestion('')
      setPollOptions(['', ''])
      setShowCreatePoll(false)
      toast.success('Poll created!')
    } catch {
      toast.error('Failed to create poll')
    } finally {
      setCreatingPoll(false)
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

  const totalCount = questions.length
  const answeredCount = questions.filter(q => q.status === 'answered').length
  const pendingCount = questions.filter(q => q.status === 'pending_approval').length
  const hiddenCount = questions.filter(q => q.status === 'hidden').length

  const tabs = [
    { key: 'all', label: 'All', count: totalCount },
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'answered', label: 'Answered', count: answeredCount },
    { key: 'hidden', label: 'Hidden', count: hiddenCount },
  ]

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // ─── No host token ───
  if (!hostToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 px-6">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Host session not found</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The host token for this room is missing. Please create a new room.
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            {/* Left: Branding + room info */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
                <MessageCircleQuestion className="w-4.5 h-4.5 text-background" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Host Dashboard</span>
                  <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {roomCode}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {expiresAt && <ExpiryCountdown expiresAt={expiresAt} />}
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success pulse-live' : 'bg-destructive'}`} />
                    <span className="text-[11px] text-muted-foreground">
                      {isConnected ? 'Live' : 'Reconnecting...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportSessionPDF(roomCode, questions)}
                className="hidden sm:inline-flex gap-1.5 rounded-lg text-xs"
              >
                <FileDown className="w-3.5 h-3.5" />
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/room/${roomCode}`)
                  toast.success('Room link copied!')
                }}
                className="gap-1.5 rounded-lg text-xs"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy Link</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteRoom}
                disabled={isDeletingRoom}
                className="gap-1.5 rounded-lg text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isDeletingRoom ? 'Deleting...' : 'Delete'}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ─── Stats Row ─── */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-foreground/[0.05] flex items-center justify-center shrink-0">
                <MessageCircleQuestion className="w-5 h-5 text-foreground/60" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total Questions</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{answeredCount}</p>
                <p className="text-xs text-muted-foreground">Answered</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Two Column Layout ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">

          {/* ─── Main: Questions ─── */}
          <div className="space-y-5">
            {/* Tab bar */}
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-muted/60 w-fit">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === tab.key
                      ? 'bg-card text-foreground shadow-soft'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  <span className={`tabular-nums ${
                    activeTab === tab.key ? 'text-foreground/60' : 'text-muted-foreground/60'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Questions list */}
            <div className="space-y-2.5">
              {sorted.length === 0 && (
                <div className="text-center py-16 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                    <MessageCircleQuestion className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/70">
                      {activeTab === 'pending' ? 'No pending questions' :
                       activeTab === 'answered' ? 'No answered questions yet' :
                       activeTab === 'hidden' ? 'No hidden questions' :
                       'No questions yet'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activeTab === 'all' ? 'Questions will appear here when participants submit them.' : 'Switch to another tab to see questions.'}
                    </p>
                  </div>
                </div>
              )}

              {sorted.map((question) => (
                <div
                  key={question.id}
                  className={`rounded-xl border p-4 transition-all ${
                    question.isPinned
                      ? 'border-foreground/12 bg-foreground/[0.02] shadow-soft'
                      : question.status === 'pending_approval'
                      ? 'border-warning/20 bg-warning/[0.02]'
                      : 'border-border/50 bg-card'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Vote count */}
                    <div className="flex flex-col items-center justify-center min-w-[44px] py-1">
                      <span className="text-lg font-bold tabular-nums">{question.netVotes}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {question.netVotes === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-[14px] leading-relaxed">{question.textOriginal}</p>

                      {question.textTranslated && (
                        <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                          <Globe className="w-3 h-3 mt-0.5 shrink-0" />
                          {question.textTranslated}
                        </p>
                      )}

                      {/* Badges row */}
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
                        {question.status === 'hidden' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive">
                            <EyeOff className="w-2.5 h-2.5" /> Hidden
                          </span>
                        )}
                        {question.status === 'pending_approval' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-warning/10 text-warning">
                            <Clock className="w-2.5 h-2.5" /> Pending
                          </span>
                        )}
                        {question.isVoice && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-muted-foreground">
                            <Mic className="w-2.5 h-2.5" /> Voice
                          </span>
                        )}
                        {question.textTranslated && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-muted-foreground">
                            <Globe className="w-2.5 h-2.5" /> Translated
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/50 ml-auto flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeAgo(question.createdAt)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {question.status === 'pending_approval' && (
                          <button
                            onClick={() => handleStatus(question.id, 'active')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                        )}
                        {question.status !== 'answered' && question.status !== 'pending_approval' && (
                          <button
                            onClick={() => handleStatus(question.id, 'answered')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-muted hover:bg-foreground/[0.08] transition-colors text-foreground/70"
                          >
                            <Check className="w-3 h-3" /> Answered
                          </button>
                        )}
                        {question.status === 'answered' && (
                          <button
                            onClick={() => handleStatus(question.id, 'active')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-muted hover:bg-foreground/[0.08] transition-colors text-foreground/70"
                          >
                            <RotateCcw className="w-3 h-3" /> Reopen
                          </button>
                        )}
                        <button
                          onClick={() => handlePin(question.id, !question.isPinned)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                            question.isPinned
                              ? 'bg-foreground/[0.08] text-foreground/70'
                              : 'bg-muted hover:bg-foreground/[0.08] text-foreground/70'
                          }`}
                        >
                          <Pin className="w-3 h-3" /> {question.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        {question.status === 'hidden' ? (
                          <button
                            onClick={() => handleStatus(question.id, 'active')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-muted hover:bg-foreground/[0.08] transition-colors text-foreground/70"
                          >
                            <Eye className="w-3 h-3" /> Unhide
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatus(question.id, 'hidden')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-muted hover:bg-foreground/[0.08] transition-colors text-foreground/70"
                          >
                            <EyeOff className="w-3 h-3" /> Hide
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(question.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-destructive/[0.06] text-destructive hover:bg-destructive/15 transition-colors ml-auto"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Sidebar ─── */}
          <div className="space-y-5">
            {/* Share card */}
            <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Share Room</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm font-mono tracking-wider text-center font-semibold">
                  {roomCode}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/room/${roomCode}`)
                    toast.success('Link copied!')
                  }}
                  className="rounded-lg"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Share this code or link with your audience to join.
              </p>
            </div>

            {/* Polls section */}
            <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Polls</h3>
                  <span className="text-xs text-muted-foreground">({polls.length})</span>
                </div>
                <button
                  onClick={() => setShowCreatePoll(!showCreatePoll)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                    showCreatePoll
                      ? 'bg-foreground/[0.08] text-foreground'
                      : 'bg-muted hover:bg-foreground/[0.08] text-foreground/70'
                  }`}
                >
                  {showCreatePoll ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {showCreatePoll ? 'Cancel' : 'New Poll'}
                </button>
              </div>

              {/* Create poll form */}
              {showCreatePoll && (
                <div className="space-y-2.5 p-3.5 rounded-xl bg-muted/30 border border-border/40">
                  <input
                    type="text"
                    placeholder="Poll question..."
                    value={newPollQuestion}
                    onChange={e => setNewPollQuestion(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground/20 transition-all placeholder:text-muted-foreground/50"
                  />
                  {pollOptions.map((opt, i) => (
                    <input
                      key={i}
                      type="text"
                      placeholder={`Option ${i + 1}...`}
                      value={opt}
                      onChange={e => {
                        const next = [...pollOptions]
                        next[i] = e.target.value
                        setPollOptions(next)
                      }}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground/20 transition-all placeholder:text-muted-foreground/50"
                    />
                  ))}
                  <div className="flex gap-2">
                    {pollOptions.length < 4 && (
                      <button
                        onClick={() => setPollOptions([...pollOptions, ''])}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-muted hover:bg-foreground/[0.08] transition-colors text-foreground/70"
                      >
                        <Plus className="w-3 h-3" /> Add Option
                      </button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleCreatePoll}
                      disabled={creatingPoll}
                      className="ml-auto rounded-lg text-xs gap-1.5"
                    >
                      {creatingPoll ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
                      {creatingPoll ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Poll cards */}
              {polls.length === 0 && !showCreatePoll && (
                <p className="text-xs text-muted-foreground py-2">No polls yet. Create one to gauge your audience.</p>
              )}
              <div className="space-y-3">
                {polls.map(poll => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    anonymousUserId={anonymousId}
                    isHost={true}
                    hostToken={hostToken}
                    onClose={(pollId) => {
                      setPolls(prev => prev.map(p => p.id === pollId ? { ...p, isActive: false } : p))
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Word cloud */}
            {questions.length > 2 && (
              <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
                <button
                  onClick={() => setShowWordCloud(!showWordCloud)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Word Cloud</h3>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showWordCloud ? 'rotate-180' : ''}`} />
                </button>
                {showWordCloud && <WordCloud questions={questions} />}
              </div>
            )}

            {/* Export section */}
            <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Export Session</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Download a PDF report with all questions, translations, vote counts, and statuses.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportSessionPDF(roomCode, questions)}
                className="w-full rounded-lg gap-1.5 text-xs"
              >
                <FileDown className="w-3.5 h-3.5" />
                Download PDF Report
              </Button>
            </div>
          </div>
        </div>
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
