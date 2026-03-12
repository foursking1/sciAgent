'use client'

import { useAuth } from '@/hooks/useAuth'
import { SessionStoreProvider } from '@/stores/sessionStore'

// Helper function to get API base URL (same as in api.ts)
function getApiBaseUrl(): string {
  // 1. Check environment variable
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }

  // 2. In browser, use current hostname with port 8000
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol
    const hostname = window.location.hostname
    return `${protocol}//${hostname}:8000`
  }

  // 3. Server-side fallback
  return 'http://localhost:8000'
}

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { token } = useAuth()
  const apiBaseUrl = getApiBaseUrl()

  if (!token) {
    return <div>Loading...</div>
  }

  return (
    <SessionStoreProvider token={token} apiBaseUrl={apiBaseUrl}>
      {children}
    </SessionStoreProvider>
  )
}
