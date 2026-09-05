import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'BidPilot', description: 'Automated Upwork Bidding' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
