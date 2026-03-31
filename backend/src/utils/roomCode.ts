import { PrismaClient } from '@prisma/client'

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length))
  }
  return code
}

export async function generateUniqueRoomCode(prisma: PrismaClient): Promise<string> {
  let attempts = 0
  while (attempts < 10) {
    const code = generateCode()
    const existing = await prisma.room.findUnique({ where: { roomCode: code } })
    if (!existing) return code
    attempts++
  }
  throw new Error('Could not generate unique room code')
}

export function generateHostToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}