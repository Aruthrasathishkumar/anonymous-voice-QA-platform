'use client'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Square, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface VoiceRecorderProps {
  roomId: string
  anonymousUserId: string
  onSubmitted: (questionId: string) => void
}

type RecorderState = 'idle' | 'requesting' | 'recording' | 'uploading' | 'processing'

export default function VoiceRecorder({
  roomId,
  anonymousUserId,
  onSubmitted
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [isSupported, setIsSupported] = useState(true)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setIsSupported(false)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  async function startRecording() {
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
        ? 'audio/ogg'
        : 'audio/mp4'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        await uploadAudio(blob, mimeType)
      }

      mediaRecorder.start(1000)
      setState('recording')
      setSeconds(0)

      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev >= 29) {
            stopRecording()
            return 30
          }
          return prev + 1
        })
      }, 1000)

    } catch (err: unknown) {
      setState('idle')
      if ((err as { name?: string }).name === 'NotAllowedError') {
        toast.error('Microphone access denied')
      } else {
        toast.error('Could not access microphone')
      }
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    setState('uploading')
  }

  async function uploadAudio(blob: Blob, mimeType: string) {
    setState('uploading')
    try {
      const extension = mimeType.includes('webm') ? 'webm'
        : mimeType.includes('ogg') ? 'ogg' : 'mp4'

      const formData = new FormData()
      formData.append('file', blob, `recording.${extension}`)
      formData.append('roomId', roomId)
      formData.append('anonymousUserId', anonymousUserId)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const res = await axios.post(
        `${apiUrl}/api/voice/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      setState('processing')
      toast.success('Voice question submitted!')
      onSubmitted(res.data.questionId)

      setTimeout(() => setState('idle'), 3000)

    } catch (err: unknown) {
      setState('idle')
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to upload audio')
    }
  }

  if (!isSupported) {
    return (
      <div className="text-center py-3">
        <p className="text-xs text-muted-foreground">
          Voice recording is not supported in this browser.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {state === 'idle' && (
        <button
          onClick={startRecording}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 border-dashed border-border hover:border-foreground/20 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Mic className="w-4 h-4" />
          Record a voice question
        </button>
      )}

      {state === 'requesting' && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Requesting microphone access...
        </div>
      )}

      {state === 'recording' && (
        <div className="p-4 rounded-xl bg-destructive/[0.04] border border-destructive/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive pulse-live" />
              <span className="text-sm font-medium text-destructive">Recording</span>
            </div>
            <span className="text-sm font-mono text-muted-foreground tabular-nums">
              {String(Math.floor(seconds / 60)).padStart(1, '0')}:{String(seconds % 60).padStart(2, '0')} / 0:30
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-destructive/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-destructive transition-all duration-1000 ease-linear"
              style={{ width: `${(seconds / 30) * 100}%` }}
            />
          </div>

          <Button
            variant="destructive"
            onClick={stopRecording}
            className="w-full rounded-xl gap-2"
          >
            <Square className="w-3.5 h-3.5" />
            Stop & Submit
          </Button>
        </div>
      )}

      {state === 'uploading' && (
        <div className="flex items-center justify-center gap-2.5 py-4 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Uploading audio...
        </div>
      )}

      {state === 'processing' && (
        <div className="flex items-center justify-center gap-2.5 py-4 rounded-xl bg-muted/50">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-muted-foreground">Transcribing your question...</span>
        </div>
      )}
    </div>
  )
}
