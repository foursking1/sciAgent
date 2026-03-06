'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSSE, type StreamEvent, type FileItem } from '@/hooks/useSSE'
import { EventStream } from '@/components/chat/EventStream'
import { ChatInput } from '@/components/chat/ChatInput'
import { FileBrowser } from '@/components/chat/FileBrowser'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { sessionsApi, filesApi } from '@/lib/api'

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
  const { token } = useAuth()
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [isSending, setIsSending] = useState(false)
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<Error | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)

  // Connect to SSE stream when sending a message
  const connectToStream = useCallback((messageContent: string) => {
    const url = `${apiBaseUrl}/api/sessions/${sessionId}/chat`

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Create new EventSource with message in body via fetch + ReadableStream
    // Since EventSource doesn't support POST with body, we use a workaround
    const connectSSE = async () => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: messageContent }),
        })

        if (!response.ok) {
          throw new Error('Failed to connect to chat stream')
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('ReadableStream not supported')
        }

        setIsConnected(true)
        setConnectionError(null)

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            setIsConnected(false)
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk

          // Parse SSE messages
          const messages = buffer.split('\n\n')
          buffer = messages.pop() || ''

          for (const msg of messages) {
            const lines = msg.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6)) as StreamEvent
                  setEvents(prev => [...prev, data])
                } catch (e) {
                  console.error('Failed to parse SSE message:', e)
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('SSE connection error:', err)
        setConnectionError(err instanceof Error ? err : new Error('Connection failed'))
        setIsConnected(false)
      }
    }

    connectSSE()
  }, [sessionId, apiBaseUrl, token])

  // Handle send message
  const handleSubmit = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      setIsSending(true)
      // Don't clear events - append to existing conversation

      try {
        // Connect to stream and send message
        connectToStream(content)
      } catch (err) {
        console.error('Error sending message:', err)
      } finally {
        setIsSending(false)
      }
    },
    [connectToStream]
  )

  // Handle file upload
  const handleFileUpload = useCallback(
    async (uploadedFiles: FileList) => {
      if (!token) {
        console.error('No authentication token')
        return
      }

      try {
        const result = await filesApi.upload(token, sessionId, uploadedFiles)

        // Refresh files list
        const fileList = await filesApi.list(token, sessionId)
        setFiles(fileList.map(f => ({
          name: f.filename,
          path: f.file_path,
          size: f.file_size,
          type: 'file' as const,
        })))
      } catch (err) {
        console.error('Error uploading files:', err)
      }
    },
    [sessionId, token]
  )

  // Handle file download
  const handleDownload = useCallback(
    async (file: FileItem) => {
      try {
        const url = filesApi.getDownloadUrl(sessionId, file.path)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } catch (err) {
        console.error('Error downloading file:', err)
      }
    },
    [sessionId]
  )

  // Handle file refresh
  const handleRefresh = useCallback(async () => {
    if (!token) return

    try {
      const fileList = await filesApi.list(token, sessionId)
      setFiles(fileList.map(f => ({
        name: f.filename,
        path: f.file_path,
        size: f.file_size,
        type: 'file' as const,
      })))
    } catch (err) {
      console.error('Error refreshing files:', err)
    }
  }, [sessionId, token])

  // Load initial files
  useEffect(() => {
    if (!token) return

    filesApi.list(token, sessionId)
      .then(fileList => {
        setFiles(fileList.map(f => ({
          name: f.filename,
          path: f.file_path,
          size: f.file_size,
          type: 'file' as const,
        })))
      })
      .catch(err => console.error('Error loading files:', err))
  }, [sessionId, token])

  // Handle file select
  const handleSelect = useCallback((file: FileItem) => {
    console.log('Selected file:', file)
  }, [])

  // Handle back navigation
  const handleBack = useCallback(() => {
    router.push('/dashboard')
  }, [router])

  // Load historical messages when session changes (no race condition version)
  useEffect(() => {
    if (!token || !sessionId) return

    const loadMessages = async () => {
      try {
        // Reset state first - all in one place to prevent race conditions
        setEvents([])
        setMessage('')
        setIsSending(false)
        setIsConnected(false)
        setConnectionError(null)

        // Load historical messages
        const messages = await sessionsApi.getMessages(token, sessionId)
        // Convert messages to StreamEvent format
        const historicalEvents: StreamEvent[] = messages.map(msg => {
          if (msg.role === 'user') {
            return {
              type: 'user_message',
              content: msg.content,
              timestamp: msg.created_at,
            } as StreamEvent
          } else {
            return {
              type: 'message',
              content: msg.content,
              timestamp: msg.created_at,
            } as StreamEvent
          }
        })
        setEvents(historicalEvents)
      } catch (err) {
        console.error('Error loading messages:', err)
      }
    }

    loadMessages()
  }, [sessionId, token])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

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
                    isConnected ? 'bg-emerald-500' : isSending ? 'bg-yellow-500' : 'bg-gray-500'
                  )}
                  aria-hidden="true"
                />
                <span className="text-xs text-gray-500">
                  {isSending ? 'Processing...' : isConnected ? 'Connected' : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {connectionError && (
              <span className="text-sm text-red-400" title={connectionError.message}>
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
              disabled={isSending}
              isLoading={isSending}
              placeholder={isSending ? 'Processing...' : 'Type your message...'}
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
