import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { Server as HTTPServer } from 'http'
import Redis from 'ioredis'

let io: SocketIOServer

export function createSocketServer(httpServer: HTTPServer): SocketIOServer {
  const pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
  const subClient = pubClient.duplicate()

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  })

  io.adapter(createAdapter(pubClient, subClient))

  io.on('connection', (socket) => {
    const { roomCode, anonymousUserId, isHost } = socket.handshake.auth

    if (!roomCode || !anonymousUserId) {
      socket.disconnect()
      return
    }

    // Join the room channel
    socket.join(roomCode)

    // If host, join a special host channel
    if (isHost === 'true' || isHost === true) {
      socket.join(`host:${roomCode}`)
    }

    // Tell everyone someone joined
    socket.to(roomCode).emit('user:joined', {
      count: getSocketCountInRoom(roomCode)
    })

    console.log(`User ${anonymousUserId} joined room ${roomCode}`)

    // When user disconnects
    socket.on('disconnect', () => {
      socket.to(roomCode).emit('user:left', {
        count: getSocketCountInRoom(roomCode)
      })
      console.log(`User ${anonymousUserId} left room ${roomCode}`)
    })
  })

  return io
}

function getSocketCountInRoom(roomCode: string): number {
  const room = io.sockets.adapter.rooms.get(roomCode)
  return room ? room.size : 0
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized')
  return io
}

// Helper functions to emit events from anywhere in the app
export function emitToRoom(roomCode: string, event: string, data: any) {
  getIO().to(roomCode).emit(event, data)
}

export function emitToHost(roomCode: string, event: string, data: any) {
  getIO().to(`host:${roomCode}`).emit(event, data)
}