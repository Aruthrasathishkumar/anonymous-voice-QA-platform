import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' }
})

// Room API calls
export const roomsApi = {
  create: (data: {
    hostLanguage?: string
    moderationMode?: 'pre' | 'post'
    allowVoice?: boolean
    allowPolls?: boolean
    maxCapacity?: number
  }) => api.post('/api/rooms/create', data),

  join: (roomCode: string) =>
    api.post('/api/rooms/join', { roomCode }),

  get: (roomCode: string) =>
    api.get(`/api/rooms/${roomCode}`),

  close: (roomCode: string, hostToken: string) =>
    api.delete(`/api/rooms/${roomCode}/close`, {
      headers: { 'x-host-token': hostToken }
    })
}

// Questions API calls
export const questionsApi = {
  create: (data: {
    roomId: string
    text: string
    anonymousUserId: string
    languageCode?: string
  }) => api.post('/api/questions', data),

  list: (roomId: string, sort?: string) =>
    api.get(`/api/questions/${roomId}`, { params: { sort } }),

  updateStatus: (questionId: string, status: string, hostToken: string) =>
    api.patch(`/api/questions/${questionId}/status`,
      { status },
      { headers: { 'x-host-token': hostToken } }
    ),

  pin: (questionId: string, isPinned: boolean, hostToken: string) =>
    api.patch(`/api/questions/${questionId}/pin`,
      { isPinned },
      { headers: { 'x-host-token': hostToken } }
    ),

  delete: (questionId: string, hostToken: string) =>
    api.delete(`/api/questions/${questionId}`, {
      headers: { 'x-host-token': hostToken }
    })
}

// Votes API calls
export const votesApi = {
  vote: (data: {
    questionId: string
    anonymousUserId: string
    voteType: 'up' | 'down'
  }) => api.post('/api/votes', data)
}

// Polls API calls
export const pollsApi = {
  create: (data: {
    roomId: string
    question: string
    options: string[]
  }, hostToken: string) =>
    api.post('/api/polls', data, {
      headers: { 'x-host-token': hostToken }
    }),

  vote: (pollId: string, data: {
    optionId: string
    anonymousUserId: string
  }) => api.post(`/api/polls/${pollId}/vote`, data),

  list: (roomId: string) =>
    api.get(`/api/polls/${roomId}`),

  close: (pollId: string, hostToken: string) =>
    api.patch(`/api/polls/${pollId}/close`, {}, {
      headers: { 'x-host-token': hostToken }
    })
}

export default api