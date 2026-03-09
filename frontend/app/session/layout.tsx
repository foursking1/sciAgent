'use client'

import { useAuth } from '@/hooks/useAuth'
import { SessionStoreProvider } from '@/stores/sessionStore'

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { token } = useAuth()
  const apiBaseUrl = 'http://localhost:8000'

  if (!token) {
    return <div>Loading...</div>
  }

  return (
    <SessionStoreProvider token={token} apiBaseUrl={apiBaseUrl}>
      {children}
    </SessionStoreProvider>
  )
}
