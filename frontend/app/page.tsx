'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { roomsApi } from '@/lib/api'
import toast, { Toaster } from 'react-hot-toast'

export default function HomePage() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

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
      const { roomCode, hostToken, roomId } = res.data

      // Save host token to localStorage
      localStorage.setItem(`hostToken:${roomCode}`, hostToken)
      localStorage.setItem(`roomId:${roomCode}`, roomId)

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
      return
    }
    setIsJoining(true)
    try {
      await roomsApi.join(roomCode.toUpperCase())
      router.push(`/room/${roomCode.toUpperCase()}`)
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Room not found'
      toast.error(msg)
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Toaster position="top-center" />

      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">AskRoom</h1>
          <p className="text-muted-foreground text-lg">
            Anonymous Q&A for live events
          </p>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap justify-center gap-2 text-sm">
          {['Anonymous', 'Voice Questions', '100+ Languages', 'Real-time Voting'].map(f => (
            <span key={f} className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-xs font-medium">
              {f}
            </span>
          ))}
        </div>

        {/* Join Room Card */}
        <Card>
          <CardHeader>
            <CardTitle>Join a Room</CardTitle>
            <CardDescription>Enter the room code shared by your host</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Enter room code (e.g. ABC123)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              maxLength={6}
              className="text-center text-lg font-mono tracking-widest uppercase"
            />
            <Button
              className="w-full"
              onClick={handleJoinRoom}
              disabled={isJoining}
            >
              {isJoining ? 'Joining...' : 'Join Room →'}
            </Button>
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Create Room */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleCreateRoom}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : '+ Create a New Room'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Rooms automatically expire after 24 hours
        </p>
      </div>
    </main>
  )
}