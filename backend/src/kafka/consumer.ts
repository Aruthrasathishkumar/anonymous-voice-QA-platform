import dotenv from 'dotenv'
dotenv.config()

import { Kafka } from 'kafkajs'
import { PrismaClient } from '@prisma/client'
import { Translator } from 'deepl-node'
import { v2 as cloudinary } from 'cloudinary'
import { emitToRoom, emitToHost } from '../socket/index'
import https from 'https'
import FormData from 'form-data'

const kafka = new Kafka({
  clientId: 'qna-platform-consumer',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
})

const consumer = kafka.consumer({
  groupId: 'voice-processing-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  retry: { initialRetryTime: 300, retries: 10 }
})

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const DEEPL_LANGUAGE_MAP: Record<string, string> = {
  'es': 'ES', 'fr': 'FR', 'de': 'DE', 'it': 'IT',
  'pt': 'PT', 'nl': 'NL', 'pl': 'PL', 'ru': 'RU',
  'ja': 'JA', 'zh': 'ZH', 'ko': 'KO', 'ar': 'AR',
  'tr': 'TR', 'sv': 'SV', 'da': 'DA', 'fi': 'FI',
  'cs': 'CS', 'ro': 'RO', 'hu': 'HU', 'id': 'ID'
}

// Call Whisper API using Node native https — bypasses node-fetch ECONNRESET bug
async function transcribeWithWhisper(
  audioBuffer: Buffer,
  apiKey: string
): Promise<{ text: string; language: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', audioBuffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm'
    })
    form.append('model', 'whisper-1')
    form.append('response_format', 'verbose_json')

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${apiKey}`
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) {
            reject(new Error(parsed.error.message))
          } else {
            resolve({
              text: parsed.text || '',
              language: parsed.language || 'en'
            })
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`))
        }
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    form.pipe(req)
  })
}

export async function startVoiceConsumer(prisma: PrismaClient) {
  await consumer.connect()
  await consumer.subscribe({
    topic: 'voice-processing',
    fromBeginning: false
  })

  console.log('Kafka voice consumer started')

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return

      let jobData: any
      try {
        jobData = JSON.parse(message.value.toString())
      } catch {
        console.error('Failed to parse Kafka message')
        return
      }

      const {
        questionId,
        roomCode,
        audioUrl,
        audioPublicId,
        hostLanguage,
        anonymousUserId
      } = jobData

      console.log(`Processing voice question: ${questionId}`)

      try {
        // Step 1: Download audio from Cloudinary
        console.log(`Downloading audio from: ${audioUrl}`)
        const audioResponse = await fetch(audioUrl)
        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
        console.log(`Audio downloaded: ${audioBuffer.length} bytes`)

        // Step 2: Transcribe with Whisper using native https
        console.log('Calling Whisper API...')
        const { text: transcribedText, language: detectedLanguage } =
          await transcribeWithWhisper(audioBuffer, process.env.OPENAI_API_KEY || '')

        console.log(`Transcribed: "${transcribedText}" (${detectedLanguage})`)

        if (!transcribedText || transcribedText.trim().length < 3) {
          await prisma.question.update({
            where: { id: questionId },
            data: { status: 'rejected' }
          })
          emitToHost(roomCode, 'question:voice:failed', {
            questionId,
            reason: 'Could not transcribe audio'
          })
          return
        }

        // Step 3: Translate if needed
        let textTranslated: string | undefined
        const targetLang = DEEPL_LANGUAGE_MAP[hostLanguage] || 'EN'
        const sourceLang = DEEPL_LANGUAGE_MAP[detectedLanguage]

        if (detectedLanguage !== hostLanguage && sourceLang && sourceLang !== targetLang) {
          try {
            console.log(`Translating from ${sourceLang} to ${targetLang}...`)
            const translator = new Translator(process.env.DEEPL_API_KEY || '')
            const translation = await translator.translateText(
              transcribedText,
              null,
              targetLang as any
            )
            textTranslated = translation.text
            console.log(`Translated: "${textTranslated}"`)
          } catch (err) {
            console.error('Translation failed:', err)
          }
        }

        // Step 4: Get room for moderation mode
        const room = await prisma.room.findUnique({ where: { roomCode } })
        const status = room?.moderationMode === 'pre' ? 'pending_approval' : 'active'

        // Step 5: Update question in database
        const updatedQuestion = await prisma.question.update({
          where: { id: questionId },
          data: {
            textOriginal: transcribedText,
            textTranslated,
            languageCode: detectedLanguage,
            status,
            audioUrl: null
          }
        })

        // Step 6: Delete audio from Cloudinary
        try {
          await cloudinary.uploader.destroy(audioPublicId, { resource_type: 'video' })
          console.log(`Audio deleted from Cloudinary`)
        } catch (err) {
          console.error('Failed to delete audio:', err)
        }

        // Step 7: Emit Socket event
        if (status === 'active') {
          emitToRoom(roomCode, 'question:new', updatedQuestion)
          emitToHost(roomCode, 'question:voice:ready', {
            questionId,
            textOriginal: transcribedText,
            textTranslated
          })
        } else {
          emitToHost(roomCode, 'moderation:question:pending', updatedQuestion)
        }

        console.log(`✅ Voice question ${questionId} processed successfully`)

      } catch (err) {
        console.error(`Failed to process voice question ${questionId}:`, err)
        try {
          await prisma.question.update({
            where: { id: questionId },
            data: { status: 'rejected' }
          })
        } catch {}
        emitToHost(roomCode, 'question:voice:failed', {
          questionId,
          reason: 'Processing failed'
        })
      }
    }
  })
}

export async function disconnectConsumer() {
  await consumer.disconnect()
}