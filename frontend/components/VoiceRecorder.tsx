'use client'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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

      // Find supported format
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

      // Start timer
      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev >= 29) {
            stopRecording()
            return 30
          }
          return prev + 1
        })
      }, 1000)

    } catch (err: any) {
      setState('idle')
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone access.')
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
      toast.success('Voice question submitted! Processing...')
      onSubmitted(res.data.questionId)

      // Reset after 3 seconds
      setTimeout(() => setState('idle'), 3000)

    } catch (err: any) {
      setState('idle')
      toast.error(err?.response?.data?.error || 'Failed to upload audio')
    }
  }

  if (!isSupported) {
    return (
      <p className="text-xs text-muted-foreground text-center">
        Voice recording not supported in this browser. Use text instead.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {state === 'idle' && (
        <Button
          variant="outline"
          onClick={startRecording}
          className="w-full gap-2"
        >
          🎤 Record Voice Question
        </Button>
      )}

      {state === 'requesting' && (
        <p className="text-sm text-muted-foreground">
          Requesting microphone access...
        </p>
      )}

      {state === 'recording' && (
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-500">Recording</span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {seconds}s / 30s
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5">
            <div
              className="bg-red-500 h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${(seconds / 30) * 100}%` }}
            />
          </div>
          <Button
            variant="destructive"
            onClick={stopRecording}
            className="w-full"
          >
            ⏹ Stop and Submit
          </Button>
        </div>
      )}

      {state === 'uploading' && (
        <p className="text-sm text-muted-foreground">Uploading audio...</p>
      )}

      {state === 'processing' && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-sm text-muted-foreground">
            Transcribing your question...
          </p>
        </div>
      )}
    </div>
  )
}