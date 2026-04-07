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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // GitHub Pages SPA redirect handler
              (function(){
                var redirect = sessionStorage.redirect;
                delete sessionStorage.redirect;
                if (redirect && redirect !== location.href) {
                  history.replaceState(null, '', redirect);
                }
              })();
              (function(){
                var l = window.location;
                if (l.search[1] === '/') {
                  var decoded = l.search.slice(1).split('&').map(function(s) {
                    return s.replace(/~and~/g, '&')
                  }).join('?');
                  window.history.replaceState(null, '',
                    l.pathname.slice(0, -1) + decoded + l.hash
                  );
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
