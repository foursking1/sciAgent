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
  // Use backend URL directly since frontend and backend are on different ports
  const apiBaseUrl = 'http://localhost:8000'

  return <SessionChat sessionId={params.id} apiBaseUrl={apiBaseUrl} />
}
