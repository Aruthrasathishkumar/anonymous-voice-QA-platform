import { Kafka, Producer } from 'kafkajs'

const kafka = new Kafka({
  clientId: 'qna-platform-producer',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
})

let producer: Producer

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer()
    await producer.connect()
    console.log('Kafka producer connected')
  }
  return producer
}

export async function publishVoiceJob(jobData: {
  questionId: string
  roomId: string
  roomCode: string
  audioUrl: string
  audioPublicId: string
  hostLanguage: string
  anonymousUserId: string
}) {
  const prod = await getProducer()
  await prod.send({
    topic: 'voice-processing',
    messages: [
      {
        key: jobData.questionId,
        value: JSON.stringify(jobData)
      }
    ]
  })
  console.log(`Voice job published for question: ${jobData.questionId}`)
}

export async function disconnectProducer() {
  if (producer) {
    await producer.disconnect()
  }
}