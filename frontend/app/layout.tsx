import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'

export const metadata: Metadata = {
  title: 'SpeakUp - Anonymous Q&A',
  description: 'Real-time anonymous Q&A platform with voice questions, live polls, and multilingual support. Perfect for conferences, lectures, town halls, and events.',
  keywords: ['Q&A', 'anonymous questions', 'live events', 'voice questions', 'live polls', 'audience engagement'],
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
