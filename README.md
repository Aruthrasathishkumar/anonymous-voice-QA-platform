# 🎤 SpeakUp - Anonymous Voice Q&A Platform

A real-time platform that transforms live event Q&A from **silent audiences** into **interactive, data-driven conversations**.

🔗 **Live Demo (Frontend Preview):**  
https://aruthrasathishkumar.github.io/anonymous-voice-QA-platform/

## ⚠️ Important Disclaimer

> This live demo is frontend-only (hosted on GitHub Pages).

- The backend (Fastify + PostgreSQL + Redis + Kafka) runs locally by design  
- Features like room creation, voting, real-time sync, and voice processing require local backend setup  

💡 This is a deliberate system design choice to demonstrate scalable real-time architecture locally.

## 🧠 What This Project Does

SpeakUp solves a critical problem in live events:

- Most people don’t ask questions  
- Hosts hear only a small fraction of the audience  
- Language barriers prevent global participation  

This platform enables:

- Anonymous participation  
- Real-time interaction  
- Multilingual voice input  
- Community-driven prioritization  

## ⚡ Key Features

- 🏠 Room System - Join via 6-character code (no login required)  
- ❓ Anonymous Questions - Text + voice-based submissions  
- 👍 Real-time Voting - Upvote/downvote with instant sync  
- 🎙️ Voice AI Pipeline - Speech-to-text + translation (99+ languages)  
- 🗳️ Live Polls - Audience engagement with real-time results  
- 📊 Host Dashboard - Moderate, pin, delete, and analyze questions  
- 🔐 Privacy-First Design - No identity tracking, fully anonymous  

## 🛠️ Tech Stack

- Frontend: Next.js 14 + TypeScript + Tailwind CSS  
- Backend: Node.js + Fastify + Socket.io  
- Database: PostgreSQL + Prisma  
- Cache & Realtime: Redis  
- Streaming: Apache Kafka  
- AI: Groq Whisper + Groq LLaMA + DeepL  
- Storage: Cloudinary  

## 🏗️ Architecture

- Next.js frontend (GitHub Pages)  
- Fastify backend (local)  
- PostgreSQL relational database  
- Redis (pub/sub + rate limiting)  
- Kafka (async voice processing pipeline)  
- Socket.io (real-time communication)  

## 💻 Local Setup (Required for Full Functionality)

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## ⚡ System Highlights

- ⚡ Sub-100ms real-time updates via WebSockets  
- 🌍 Supports 99+ languages (voice + translation)  
- 👥 Designed for 500+ concurrent users per room  
- ⚡ Async Kafka pipeline prevents API blocking  
- 🔐 Multi-layer vote integrity (DB + Redis + fingerprinting)

## 📸 Screenshots

<img src="./screenshots/screenshot 2026-04-07 000201.png" width="800"/>

<img src="./screenshots/screenshot 2026-04-07 000220.png" width="800"/>

<img src="./screenshots/screenshot 2026-04-07 000234.png" width="800"/>

<img src="./screenshots/screenshot 2026-04-07 000323.png" width="800"/>

<img src="./screenshots/screenshot 2026-04-07 000338.png" width="800"/>

<img src="./screenshots/screenshot 2026-04-07 000356.png" width="800"/>
