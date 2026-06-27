import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/providers/Providers'
import PwaRegister from '@/components/PwaRegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Controle de Horas CLT',
  description: 'Gerencie suas horas de trabalho CLT com facilidade',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Horas CLT',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        <Providers>
          {children}
        </Providers>
        <PwaRegister />
      </body>
    </html>
  )
}
