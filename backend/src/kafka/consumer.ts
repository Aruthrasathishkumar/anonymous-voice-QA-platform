import dotenv from 'dotenv'
dotenv.config()

import { Kafka } from 'kafkajs'
import { PrismaClient } from '@prisma/client'
import { v2 as cloudinary } from 'cloudinary'
import { emitToRoom, emitToHost } from '../socket/index'
import Groq from 'groq-sdk'

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

async function transcribeAudio(
  audioBuffer: Buffer,
  apiKey: string
): Promise<{ text: string; language: string }> {
  const groq = new Groq({ apiKey })

  const uint8Array = new Uint8Array(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.byteLength
  )
  const audioFile = new File([uint8Array], 'audio.webm', {
    type: 'audio/webm'
  })

  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3',
    response_format: 'verbose_json'
  })

  return {
    text: transcription.text,
    language: (transcription as any).language || 'en'
  }
}

async function translateToEnglish(
  text: string,
  apiKey: string
): Promise<string | undefined> {
  try {
    const groq = new Groq({ apiKey })
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a translator. Translate the user\'s text to English. Return ONLY the translated text, nothing else. No explanations, no quotes, just the translation.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    })
    return response.choices[0]?.message?.content?.trim()
  } catch (err) {
    console.error('Translation failed:', err)
    return undefined
  }
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
      } = jobData

      console.log(`Processing voice question: ${questionId}`)

      try {
        // Step 1: Download audio from Cloudinary
        console.log('Downloading audio from Cloudinary...')
        const audioResponse = await fetch(audioUrl)
        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
        console.log(`Audio downloaded: ${audioBuffer.length} bytes`)

        // Step 2: Transcribe with Groq Whisper
        console.log('Transcribing with Groq Whisper...')
        const { text: transcribedText, language: detectedLanguage } =
          await transcribeAudio(audioBuffer, process.env.GROQ_API_KEY || '')

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

        // Step 3: Translate to English if not already English
        let textTranslated: string | undefined

        if (detectedLanguage !== 'en' && detectedLanguage !== 'english') {
          console.log(`Translating from ${detectedLanguage} to English...`)
          textTranslated = await translateToEnglish(
            transcribedText,
            process.env.GROQ_API_KEY || ''
          )
          if (textTranslated) {
            console.log(`Translated: "${textTranslated}"`)
          }
        }

        // Step 4: Get room moderation mode
        const room = await prisma.room.findUnique({ where: { roomCode } })
        const status = room?.moderationMode === 'pre'
          ? 'pending_approval'
          : 'active'

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

        // Step 6: Delete audio from Cloudinary (privacy)
        try {
          await cloudinary.uploader.destroy(audioPublicId, {
            resource_type: 'video'
          })
          console.log('Audio deleted from Cloudinary')
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