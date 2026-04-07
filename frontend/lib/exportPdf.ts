'use client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Question {
  textOriginal: string
  textTranslated?: string
  netVotes: number
  status: string
  isVoice: boolean
  createdAt: string
}

export function exportSessionPDF(roomCode: string, questions: Question[]) {
  const doc = new jsPDF()

  // Title
  doc.setFontSize(22)
  doc.setTextColor(30, 58, 95)
  doc.text('SpeakUp', 14, 18)

  doc.setFontSize(12)
  doc.setTextColor(100, 100, 100)
  doc.text(`Session Export - Room: ${roomCode}`, 14, 27)
  doc.text(`Exported: ${new Date().toLocaleString()}`, 14, 34)

  // Stats row
  const answered = questions.filter(q => q.status === 'answered').length
  const voiceCount = questions.filter(q => q.isVoice).length
  doc.setFontSize(10)
  doc.text(`Total: ${questions.length}  |  Answered: ${answered}  |  Voice: ${voiceCount}`, 14, 42)

  // Sort: answered first, then by votes
  const sorted = [...questions]
    .filter(q => !['hidden', 'rejected'].includes(q.status))
    .sort((a, b) => {
      if (a.status === 'answered' && b.status !== 'answered') return -1
      if (a.status !== 'answered' && b.status === 'answered') return 1
      return b.netVotes - a.netVotes
    })

  autoTable(doc, {
    startY: 50,
    head: [['#', 'Question', 'English Translation', 'Votes', 'Type', 'Status']],
    body: sorted.map((q, i) => [
      i + 1,
      q.textOriginal.length > 55
        ? q.textOriginal.slice(0, 55) + '...'
        : q.textOriginal,
      q.textTranslated
        ? q.textTranslated.length > 40
          ? q.textTranslated.slice(0, 40) + '...'
          : q.textTranslated
        : '-',
      q.netVotes > 0 ? `+${q.netVotes}` : `${q.netVotes}`,
      q.isVoice ? 'Voice' : 'Text',
      q.status === 'answered' ? 'Answered' : 'Open'
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [240, 247, 255] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 60 },
      2: { cellWidth: 50 },
      3: { cellWidth: 15 },
      4: { cellWidth: 15 },
      5: { cellWidth: 20 }
    }
  })

  doc.save(`speakup-${roomCode}-${Date.now()}.pdf`)
}