import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Meshara & Udara | Our Wedding Invitation',
  description: 'Join Meshara and Udara as they celebrate their wedding at Vinrich Lake Resort on Friday, 27 November 2026.',
  generator: 'v0.app',
  openGraph: {
    title: 'Meshara & Udara | Our Wedding Invitation',
    description: 'Together with their families, Meshara & Udara invite you to celebrate their wedding.',
    type: 'website',
  },
  icons: {
    icon: [
      {
        url: '/wedding-icon-32.png',
        type: 'image/png',
        sizes: '32x32',
      },
      {
        url: '/wedding-icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
      },
    ],
    apple: '/wedding-apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#FAF9F4',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      {/* Browser extensions such as Grammarly can add attributes before hydration. */}
      <body className="antialiased" suppressHydrationWarning>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
