'use client'
import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface UseSocketProps {
  roomCode: string
  anonymousUserId: string
  isHost?: boolean
}

export function useSocket({ roomCode, anonymousUserId, isHost = false }: UseSocketProps) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!roomCode || !anonymousUserId) return

    const socket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
      {
        auth: { roomCode, anonymousUserId, isHost: isHost.toString() },
        transports: ['websocket', 'polling']
      }
    )

    socket.on('connect', () => {
      setIsConnected(true)
      console.log('Socket connected')
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      console.log('Socket disconnected')
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [roomCode, anonymousUserId, isHost])

  return {
    socket: socketRef.current,
    isConnected
  }
}