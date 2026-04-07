'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { roomsApi } from '@/lib/api'
import toast, { Toaster } from 'react-hot-toast'
import {
  MessageCircleQuestion,
  Mic,
  Globe,
  ArrowUpDown,
  BarChart3,
  Shield,
  FileDown,
  ChevronRight,
  Zap,
  Users,
  GraduationCap,
  Building2,
  Presentation,
  ArrowRight,
} from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const joinRef = useRef<HTMLInputElement>(null)

  async function handleCreateRoom() {
    setIsCreating(true)
    try {
      const res = await roomsApi.create({
        hostLanguage: 'en',
        moderationMode: 'post',
        allowVoice: true,
        allowPolls: true,
        maxCapacity: 500
      })
      const { roomCode, hostToken, roomId, expiresAt } = res.data

      localStorage.setItem(`hostToken:${roomCode}`, hostToken)
      localStorage.setItem(`roomId:${roomCode}`, roomId)
      localStorage.setItem(`expiresAt:${roomCode}`, expiresAt || '')

      toast.success(`Room ${roomCode} created!`)
      router.push(`/host/${roomCode}`)
    } catch {
      toast.error('Failed to create room. Is the backend running?')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleJoinRoom() {
    if (!roomCode.trim()) {
      toast.error('Please enter a room code')
      joinRef.current?.focus()
      return
    }
    setIsJoining(true)
    try {
      await roomsApi.join(roomCode.toUpperCase())
      router.push(`/room/${roomCode.toUpperCase()}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Room not found'
      toast.error(msg)
    } finally {
      setIsJoining(false)
    }
  }

  const features = [
    {
      icon: MessageCircleQuestion,
      title: 'Anonymous Questions',
      description: 'Participants ask freely without identity barriers. No sign-up required.',
    },
    {
      icon: Mic,
      title: 'Voice Questions',
      description: 'Record and submit voice questions. AI transcribes and translates automatically.',
    },
    {
      icon: Globe,
      title: '100+ Languages',
      description: 'Questions are transcribed and translated in real-time using advanced AI models.',
    },
    {
      icon: ArrowUpDown,
      title: 'Live Voting',
      description: 'Audience upvotes surface the most important questions to the top instantly.',
    },
    {
      icon: BarChart3,
      title: 'Live Polls',
      description: 'Create instant polls to gauge audience sentiment with real-time results.',
    },
    {
      icon: Shield,
      title: 'Host Moderation',
      description: 'Full control to approve, pin, hide, or mark questions as answered.',
    },
    {
      icon: FileDown,
      title: 'Export Summaries',
      description: 'Download a complete PDF report of all questions, votes, and translations.',
    },
    {
      icon: Zap,
      title: 'Real-time Updates',
      description: 'Everything syncs instantly. Questions, votes, and polls update live for everyone.',
    },
  ]

  const steps = [
    {
      step: '01',
      title: 'Create a Room',
      description: 'Host creates a room and gets a unique 6-character code to share with the audience.',
    },
    {
      step: '02',
      title: 'Share the Code',
      description: 'Participants enter the code to join. No accounts, no downloads, no friction.',
    },
    {
      step: '03',
      title: 'Engage Live',
      description: 'Questions flow in anonymously. Vote, moderate, poll, and export - all in real-time.',
    },
  ]

  const useCases = [
    {
      icon: Presentation,
      title: 'Conferences',
      description: 'Let attendees ask questions during keynotes and panels without interrupting the flow.',
    },
    {
      icon: GraduationCap,
      title: 'Universities',
      description: 'Students ask questions anonymously in large lecture halls. No more awkward silences.',
    },
    {
      icon: Building2,
      title: 'Town Halls',
      description: 'Employees surface real concerns in all-hands meetings. Honest feedback, zero friction.',
    },
    {
      icon: Users,
      title: 'Community Events',
      description: 'Meetups, workshops, and webinars. Engage every voice in the room, not just the loudest.',
    },
  ]

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

      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <MessageCircleQuestion className="w-4.5 h-4.5 text-background" />
            </div>
            <span className="text-lg font-semibold tracking-tight">SpeakUp</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="hidden sm:inline-flex text-muted-foreground"
            >
              Features
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              className="hidden sm:inline-flex text-muted-foreground"
            >
              How it works
            </Button>
            <Button
              size="sm"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="rounded-full px-4"
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        {/* Background mesh */}
        <div className="absolute inset-0 mesh-gradient-hero" />

        {/* Decorative elements */}
        <div className="absolute top-20 left-[10%] w-72 h-72 rounded-full bg-warm-500/[0.04] blur-3xl float" />
        <div className="absolute bottom-10 right-[10%] w-96 h-96 rounded-full bg-warm-300/[0.06] blur-3xl float-delayed" />
        <div className="absolute top-40 right-[20%] w-48 h-48 rounded-full bg-warm-700/[0.03] blur-2xl float-slow" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-foreground/[0.04] border border-border/60 mb-8 animate-fade-in-up">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-muted-foreground font-medium">Real-time anonymous Q&A</span>
          </div>

          {/* Headline */}
          <h1 className="text-display md:text-[4.5rem] md:leading-[1.05] tracking-tight text-balance animate-fade-in-up" style={{ animationDelay: '80ms' }}>
            Every voice heard.
            <br />
            <span className="text-warm-500">No names attached.</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-body-lg text-muted-foreground max-w-2xl mx-auto text-balance animate-fade-in-up" style={{ animationDelay: '160ms' }}>
            SpeakUp lets your audience ask questions anonymously via text or voice,
            vote on what matters, and participate in live polls - all in real-time.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
            <Button
              size="lg"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="rounded-full px-8 h-12 text-[15px] gap-2 shadow-medium hover:shadow-elevated transition-all"
            >
              {isCreating ? 'Creating...' : 'Create a Room'}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 bg-card border border-border rounded-full pl-1 pr-1 h-12 shadow-soft">
              <Input
                ref={joinRef}
                placeholder="Enter code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                maxLength={6}
                className="w-32 text-center font-mono text-[15px] tracking-[0.2em] uppercase border-0 bg-transparent h-10 focus-visible:ring-0 focus-visible:border-transparent placeholder:tracking-normal placeholder:font-sans"
              />
              <Button
                onClick={handleJoinRoom}
                disabled={isJoining}
                variant="secondary"
                className="rounded-full h-10 px-5 text-sm font-medium"
              >
                {isJoining ? 'Joining...' : 'Join'}
              </Button>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground/60 animate-fade-in-up" style={{ animationDelay: '320ms' }}>
            No sign-up required. Rooms expire automatically after 24 hours.
          </p>

          {/* Hero visual - abstract product mockup */}
          <div className="mt-16 md:mt-20 relative animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <div className="relative mx-auto max-w-3xl">
              {/* Browser chrome mockup */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-float overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/40 bg-muted/30">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-border" />
                    <div className="w-2.5 h-2.5 rounded-full bg-border" />
                    <div className="w-2.5 h-2.5 rounded-full bg-border" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 rounded-md bg-muted/60 text-xs text-muted-foreground font-mono">
                      speakup.app/room/X7K2M9
                    </div>
                  </div>
                  <div className="w-16" />
                </div>
                {/* Mockup content */}
                <div className="p-6 md:p-8 space-y-4">
                  {/* Header bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                        <MessageCircleQuestion className="w-4 h-4 text-background" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Room X7K2M9</div>
                        <div className="text-xs text-muted-foreground">12 questions</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success pulse-live" />
                      <span className="text-xs text-muted-foreground font-medium">Live</span>
                    </div>
                  </div>
                  {/* Question cards preview */}
                  <div className="space-y-2.5">
                    {[
                      { text: 'What inspired the architecture decisions for this project?', votes: 24, pinned: true },
                      { text: 'How do you handle scaling during peak events?', votes: 18, voice: true },
                      { text: 'Will there be an open-source version available?', votes: 12 },
                    ].map((q, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                          q.pinned ? 'border-foreground/15 bg-muted/30' : 'border-border/50 bg-card'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5 pt-0.5">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 -rotate-90" />
                          <span className="text-xs font-semibold text-foreground/80">{q.votes}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 rotate-90" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground/90 leading-relaxed">{q.text}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            {q.pinned && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/60">Pinned</span>
                            )}
                            {q.voice && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/60 flex items-center gap-1">
                                <Mic className="w-2.5 h-2.5" /> Voice
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating accent cards */}
              <div className="absolute -right-4 top-16 md:-right-12 bg-card border border-border/50 rounded-xl p-3 shadow-elevated float hidden md:block">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Live Poll</div>
                    <div className="text-[10px] text-muted-foreground">47 responses</div>
                  </div>
                </div>
              </div>

              <div className="absolute -left-4 bottom-20 md:-left-10 bg-card border border-border/50 rounded-xl p-3 shadow-elevated float-delayed hidden md:block">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-foreground/[0.06] flex items-center justify-center">
                    <Globe className="w-4 h-4 text-warm-500" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Translated</div>
                    <div className="text-[10px] text-muted-foreground">ES → EN</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-24 md:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-warm-500 tracking-wide uppercase mb-3">Features</p>
            <h2 className="text-headline text-balance">
              Everything you need for
              <br className="hidden sm:block" />
              meaningful audience engagement
            </h2>
            <p className="mt-4 text-body-lg text-muted-foreground max-w-2xl mx-auto">
              From anonymous text and voice questions to live polls and real-time moderation -
              built for events of every size.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl bg-card border border-border/50 card-hover cursor-default"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-4 group-hover:bg-foreground/[0.06] transition-colors">
                  <feature.icon className="w-5 h-5 text-foreground/70" />
                </div>
                <h3 className="font-semibold text-[15px] mb-1.5">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-warm-500 tracking-wide uppercase mb-3">How It Works</p>
            <h2 className="text-headline text-balance">
              Up and running in seconds
            </h2>
            <p className="mt-4 text-body-lg text-muted-foreground">
              No accounts. No installs. Just a code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            {steps.map((step, i) => (
              <div key={step.step} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] right-[calc(-50%+40px)] border-t-2 border-dashed border-border/60" />
                )}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-foreground text-background text-xl font-bold mb-5">
                    {step.step}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA after steps */}
          <div className="mt-16 text-center">
            <Button
              size="lg"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="rounded-full px-8 h-12 text-[15px] gap-2 shadow-medium hover:shadow-elevated transition-all"
            >
              {isCreating ? 'Creating...' : 'Create Your First Room'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Use Cases ─── */}
      <section className="py-24 md:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-warm-500 tracking-wide uppercase mb-3">Use Cases</p>
            <h2 className="text-headline text-balance">
              Built for every live audience
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {useCases.map((useCase) => (
              <div
                key={useCase.title}
                className="group flex gap-5 p-6 rounded-2xl bg-card border border-border/50 card-hover"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-foreground/[0.06] transition-colors">
                  <useCase.icon className="w-6 h-6 text-foreground/70" />
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] mb-1">{useCase.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{useCase.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-headline text-balance">
            Ready to hear from your audience?
          </h2>
          <p className="mt-4 text-body-lg text-muted-foreground max-w-xl mx-auto">
            Create a room in seconds. Share the code. Let the questions flow.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="rounded-full px-8 h-12 text-[15px] gap-2 shadow-medium hover:shadow-elevated transition-all"
            >
              {isCreating ? 'Creating...' : 'Create a Room - Free'}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => joinRef.current?.focus()}
              className="rounded-full px-8 h-12 text-[15px]"
            >
              Join with Code
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/50 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
                <MessageCircleQuestion className="w-3.5 h-3.5 text-background" />
              </div>
              <span className="text-sm font-semibold">SpeakUp</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time anonymous Q&A for live events. No sign-up required.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Rooms expire after 24 hours
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
