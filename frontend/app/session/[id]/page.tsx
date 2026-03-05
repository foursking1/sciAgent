'use client'

import SessionChat from '@/components/chat/SessionChat'

interface SessionPageProps {
  params: {
    id: string
  }
}

/**
 * Session page wrapper
 * Renders the SessionChat component with the session ID from params
 */
export default function SessionPage({ params }: SessionPageProps) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || ''

  return <SessionChat sessionId={params.id} apiBaseUrl={apiBaseUrl} />
}
