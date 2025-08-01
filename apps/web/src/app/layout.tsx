import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import I18nServer from '@cared/i18n/i18n-server'

import '../globals.css'

import { Suspense } from 'react'

import { Toaster } from '@cared/ui/components/sonner'

import { Providers } from '@/components/providers'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Create Next App',
  description: 'Generated by create next app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Suspense fallback={<></>}>
          <I18nServer>
            <Providers>{children}</Providers>
          </I18nServer>
        </Suspense>
        <Toaster />
      </body>
    </html>
  )
}
