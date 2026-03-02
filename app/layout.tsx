import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from "sonner"
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'ChronoFork -- Historical Simulator Console',
  description: 'Explore divergent historical timelines through AI-driven roleplay.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1220' },
  ],
  userScalable: true,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground overflow-hidden">
        {children}
        <Toaster position="bottom-left" toastOptions={{
          classNames: {
            toast: "!rounded-xl !shadow-lg !border !border-border/30 !backdrop-blur-lg",
            title: "!text-xs !font-semibold",
            description: "!text-xs",
            success: "!bg-[color-mix(in_oklch,var(--chrono-teal)_12%,var(--card))] !text-foreground !border-[color-mix(in_oklch,var(--chrono-teal)_25%,transparent)]",
            info: "!bg-[color-mix(in_oklch,var(--faction-us)_12%,var(--card))] !text-foreground !border-[color-mix(in_oklch,var(--faction-us)_25%,transparent)]",
            error: "!bg-[color-mix(in_oklch,var(--chrono-red)_12%,var(--card))] !text-foreground !border-[color-mix(in_oklch,var(--chrono-red)_25%,transparent)]",
            warning: "!bg-[color-mix(in_oklch,var(--chrono-amber)_12%,var(--card))] !text-foreground !border-[color-mix(in_oklch,var(--chrono-amber)_25%,transparent)]",
          },
        }} />
        <Analytics />
      </body>
    </html>
  )
}
