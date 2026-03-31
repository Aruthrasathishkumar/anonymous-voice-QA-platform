import { FastifyPluginAsync } from 'fastify'
import { v2 as cloudinary } from 'cloudinary'
import { publishVoiceJob } from '../kafka/producer'
import { emitToHost } from '../socket/index'
import { isValidAnonymousId } from '../utils/anonymousId'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const voicePlugin: FastifyPluginAsync = async (server) => {

  server.post('/upload', async (request, reply) => {
    try {
      const parts = request.parts()
      const fields: Record<string, string> = {}
      let fileBuffer: Buffer | null = null
      let mimeType = 'audio/webm'

      for await (const part of parts) {
        if (part.type === 'field') {
          fields[part.fieldname] = part.value as string
        } else if (part.type === 'file') {
          mimeType = part.mimetype || 'audio/webm'
          const chunks: Uint8Array[] = []
          for await (const chunk of part.file) {
            chunks.push(chunk as Uint8Array)
          }
          fileBuffer = Buffer.concat(chunks)
        }
      }

      const roomIdValue = fields.roomId
      const userIdValue = fields.anonymousUserId

      if (!roomIdValue || !userIdValue) {
        return reply.code(400).send({
          error: 'roomId and anonymousUserId required'
        })
      }

      if (!isValidAnonymousId(userIdValue)) {
        return reply.code(400).send({ error: 'Invalid user ID' })
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return reply.code(400).send({ error: 'No audio data received' })
      }

      const room = await server.prisma.room.findUnique({
        where: { id: roomIdValue }
      })

      if (!room || !room.isActive) {
        return reply.code(404).send({ error: 'Room not found or closed' })
      }

      if (!room.allowVoice) {
        return reply.code(403).send({
          error: 'Voice questions not allowed in this room'
        })
      }

      const countKey = `limit:q:${userIdValue}:${roomIdValue}`
      const qCount = await server.redis.get(countKey)
      if (parseInt(qCount || '0') >= 5) {
        return reply.code(429).send({ error: 'Max 5 questions per session' })
      }

      const voiceRateKey = `limit:voice:${userIdValue}`
      const voiceCount = await server.redis.get(voiceRateKey)
      if (voiceCount) {
        return reply.code(429).send({
          error: 'Please wait 60 seconds between voice questions'
        })
      }

      console.log(`Uploading audio: ${fileBuffer.length} bytes, type: ${mimeType}`)

      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder: `qna-voice/${roomIdValue}`,
            format: 'webm',
            timeout: 60000
          },
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error)
              reject(error)
            } else {
              console.log('Cloudinary upload success:', result?.public_id)
              resolve(result)
            }
          }
        )
        stream.end(fileBuffer)
      })

      const question = await server.prisma.question.create({
        data: {
          roomId: roomIdValue,
          textOriginal: 'Processing voice question...',
          isVoice: true,
          audioUrl: uploadResult.secure_url,
          anonymousUserId: userIdValue,
          status: 'active'
        }
      })

      await server.redis.incr(countKey)
      await server.redis.expire(countKey, 86400)
      await server.redis.set(voiceRateKey, '1', 'EX', 60)

      emitToHost(room.roomCode, 'question:voice:processing', {
        questionId: question.id,
        message: 'Transcribing voice question...'
      })

      await publishVoiceJob({
        questionId: question.id,
        roomId: roomIdValue,
        roomCode: room.roomCode,
        audioUrl: uploadResult.secure_url,
        audioPublicId: uploadResult.public_id,
        hostLanguage: room.hostLanguage,
        anonymousUserId: userIdValue
      })

      return reply.code(202).send({
        questionId: question.id,
        status: 'processing',
        message: 'Voice question submitted, processing...'
      })

    } catch (err: any) {
      server.log.error(err)
      return reply.code(500).send({
        error: 'Failed to process voice upload',
        details: err.message
      })
    }
  })
}

export default voicePlugin