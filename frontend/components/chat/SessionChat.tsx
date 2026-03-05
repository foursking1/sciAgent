'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSSE, type StreamEvent, type FileItem } from '@/hooks/useSSE'
import { EventStream } from '@/components/chat/EventStream'
import { ChatInput } from '@/components/chat/ChatInput'
import { FileBrowser } from '@/components/chat/FileBrowser'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface SessionPageProps {
  sessionId: string
  apiBaseUrl?: string
}

/**
 * Session page component
 * Manages SSE connection, event stream, file upload, and chat layout
 */
export default function SessionPage({ sessionId, apiBaseUrl = '' }: SessionPageProps) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [isSending, setIsSending] = useState(false)

  // SSE connection
  const sseUrl = `${apiBaseUrl}/api/sessions/${sessionId}/events`
  const { events, isConnected, error, isLoading: isConnecting, disconnect } = useSSE(sseUrl)

  // Extract files from completed events
  useEffect(() => {
    const completedEvents = events.filter(
      (e): e is Extract<StreamEvent, { type: 'completed' }> => e.type === 'completed'
    )

    if (completedEvents.length > 0) {
      const latestCompleted = completedEvents[completedEvents.length - 1]
      if (latestCompleted.files_created) {
        const newFiles: FileItem[] = latestCompleted.files_created.map((path) => ({
          name: path.split('/').pop() || path,
          path,
          type: 'file' as const,
        }))
        setFiles(newFiles)
      }
    }
  }, [events])

  // Handle send message
  const handleSubmit = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      setIsSending(true)

      try {
        // Send message to API
        const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        })

        if (!response.ok) {
          throw new Error('Failed to send message')
        }
      } catch (err) {
        console.error('Error sending message:', err)
      } finally {
        setIsSending(false)
      }
    },
    [sessionId, apiBaseUrl]
  )

  // Handle file upload
  const handleFileUpload = useCallback(
    async (uploadedFiles: FileList) => {
      const formData = new FormData()

      Array.from(uploadedFiles).forEach((file) => {
        formData.append('files', file)
      })

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/sessions/${sessionId}/files`,
          {
            method: 'POST',
            body: formData,
          }
        )

        if (!response.ok) {
          throw new Error('Failed to upload files')
        }

        const result = await response.json()

        // Update files list
        if (result.files) {
          setFiles((prev) => [...prev, ...result.files])
        }
      } catch (err) {
        console.error('Error uploading files:', err)
      }
    },
    [sessionId, apiBaseUrl]
  )

  // Handle file download
  const handleDownload = useCallback(
    async (file: FileItem) => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/sessions/${sessionId}/files/${encodeURIComponent(file.path)}`
        )

        if (!response.ok) {
          throw new Error('Failed to download file')
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Error downloading file:', err)
      }
    },
    [sessionId, apiBaseUrl]
  )

  // Handle file refresh
  const handleRefresh = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/sessions/${sessionId}/files`
      )

      if (!response.ok) {
        throw new Error('Failed to refresh files')
      }

      const result = await response.json()
      setFiles(result.files || [])
    } catch (err) {
      console.error('Error refreshing files:', err)
    }
  }, [sessionId, apiBaseUrl])

  // Handle file select
  const handleSelect = useCallback((file: FileItem) => {
    console.log('Selected file:', file)
    // Could open a modal or side panel to preview file content
  }, [])

  // Handle back navigation
  const handleBack = useCallback(() => {
    router.push('/dashboard')
  }, [router])

  const containerClasses = cn(
    'min-h-screen bg-background',
    'flex flex-col'
  )

  return (
    <div className={containerClasses}>
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-surface/50 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="p-2 h-auto"
              aria-label="Back to dashboard"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-100">Session</h1>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    isConnected ? 'bg-emerald-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                  aria-hidden="true"
                />
                <span className="text-xs text-gray-500">
                  {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {error && (
              <span className="text-sm text-red-400" title={error.message}>
                Connection error
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Event stream */}
          <div className="flex-1 overflow-hidden relative">
            <EventStream events={events} className="h-full" />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-surface/50">
            <ChatInput
              value={message}
              onChange={setMessage}
              onSubmit={handleSubmit}
              onFileUpload={handleFileUpload}
              disabled={!isConnected}
              isLoading={isSending}
              placeholder={isConnected ? 'Type your message...' : 'Connecting...'}
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* File browser sidebar */}
        <aside className="w-80 flex-shrink-0 border-l border-gray-800 p-4 overflow-hidden">
          <FileBrowser
            files={files}
            isLoading={false}
            onDownload={handleDownload}
            onRefresh={handleRefresh}
            onSelect={handleSelect}
            className="h-full"
          />
        </aside>
      </main>
    </div>
  )
}
