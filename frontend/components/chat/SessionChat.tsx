'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useSSE, type StreamEvent, type FileItem } from '@/hooks/useSSE'
import { EventStream, type EventStreamRef } from '@/components/chat/EventStream'
import { ChatInput, SessionMode, MODE_CONFIGS } from '@/components/chat/ChatInput'
import { FileBrowser } from '@/components/chat/FileBrowser'
import { FilePreview } from '@/components/chat/FilePreview'
import { SessionSidebar } from '@/components/chat/SessionSidebar'
import { ThinkingIndicator, useThinkingState } from '@/components/chat/ThinkingIndicator'
import { DataSourceModal } from '@/components/data-sources/DataSourceModal'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { sessionsApi, filesApi, type Session } from '@/lib/api'
import { PanelRightClose, PanelRightOpen, PanelLeftOpen } from 'lucide-react'

export interface SessionPageProps {
  sessionId: string
  apiBaseUrl?: string
}

/**
 * Session page component
 * Manages SSE connection, event stream, file upload, and chat layout
 */
export default function SessionPage({ sessionId, apiBaseUrl = '' }: SessionPageProps) {
  const { token } = useAuth()
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [isSending, setIsSending] = useState(false)
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<Error | null>(null)
  const [currentPath, setCurrentPath] = useState('')
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [currentMode, setCurrentMode] = useState<SessionMode>('data-question')
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [isFilePanelOpen, setIsFilePanelOpen] = useState(true) // Default open
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false) // Sidebar collapse state
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(false) // Data source modal

  const eventSourceRef = useRef<EventSource | null>(null)
  const eventStreamRef = useRef<EventStreamRef>(null)

  // Thinking state for dynamic indicator
  const { thinkingState, activeToolName, updateFromEvent, reset: resetThinkingState } = useThinkingState()

  // Connect to SSE stream when sending a message
  const connectToStream = useCallback(async (messageContent: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      // Step 1: Submit chat request and get task_id
      const chatUrl = `${apiBaseUrl}/api/sessions/${sessionId}/chat`
      const chatResponse = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: messageContent }),
      })

      if (!chatResponse.ok) {
        throw new Error('Failed to submit chat request')
      }

      const { task_id } = await chatResponse.json()

      if (!task_id) {
        throw new Error('No task_id returned from server')
      }

      // Store task_id for cancellation
      setCurrentTaskId(task_id)

      // Step 2: Connect to SSE stream with task_id and token
      const eventsUrl = `${apiBaseUrl}/api/sessions/${sessionId}/events?task_id=${task_id}&token=${token}`
      const eventSource = new EventSource(eventsUrl)
      eventSourceRef.current = eventSource

      setIsConnected(true)
      setConnectionError(null)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as StreamEvent
          console.log('[SSE] Received event:', data.type, data)
          setEvents(prev => [...prev, data])

          // Update thinking state based on event
          updateFromEvent(data)

          // Check for completion
          if (data.type === 'completed' || data.type === 'error' || data.type === 'cancelled') {
            eventSource.close()
            setIsConnected(false)
            setCurrentTaskId(null)
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e)
        }
      }

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err)
        setConnectionError(new Error('Connection error'))
        setIsConnected(false)
        eventSource.close()
      }

    } catch (err) {
      console.error('Error connecting to stream:', err)
      setConnectionError(err instanceof Error ? err : new Error('Connection failed'))
      setIsConnected(false)
    }
  }, [sessionId, apiBaseUrl, token, updateFromEvent])

  // Handle send message with optimistic update
  const handleSubmit = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      // Optimistic update: immediately show user message
      const userEvent: StreamEvent = {
        type: 'user_message',
        content: content,
        timestamp: new Date().toISOString(),
      }
      setEvents(prev => [...prev, userEvent])
      setIsSending(true)

      // Scroll to bottom after message is added
      setTimeout(() => {
        eventStreamRef.current?.scrollToBottom()
      }, 0)

      // Initialize thinking state
      updateFromEvent({ type: 'started' })

      try {
        // Connect to stream and send message
        await connectToStream(content)
      } catch (err) {
        console.error('Error sending message:', err)
      } finally {
        setIsSending(false)
      }
    },
    [connectToStream, updateFromEvent]
  )

  // Handle stop generation
  const handleStop = useCallback(async () => {
    if (!token || !currentTaskId) return

    try {
      await sessionsApi.cancelTask(token, sessionId, currentTaskId)
      // Close the SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setIsConnected(false)
      setIsSending(false)
      setCurrentTaskId(null)
    } catch (err) {
      console.error('Error cancelling task:', err)
    }
  }, [token, sessionId, currentTaskId])

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
          type: f.content_type === 'directory' ? 'directory' : 'file',
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
      const fileList = await filesApi.list(token, sessionId, currentPath)
      setFiles(fileList.map(f => ({
        name: f.filename,
        path: f.file_path,
        size: f.file_size,
        type: f.content_type === 'directory' ? 'directory' : 'file',
      })))
    } catch (err) {
      console.error('Error refreshing files:', err)
    }
  }, [sessionId, token, currentPath])

  // Load initial files
  useEffect(() => {
    if (!token) return

    filesApi.list(token, sessionId, currentPath)
      .then(fileList => {
        setFiles(fileList.map(f => ({
          name: f.filename,
          path: f.file_path,
          size: f.file_size,
          type: f.content_type === 'directory' ? 'directory' : 'file',
        })))
      })
      .catch(err => console.error('Error loading files:', err))
  }, [sessionId, token, currentPath])

  // Handle file select - open preview for files
  const handleSelect = useCallback((file: FileItem) => {
    if (file.type !== 'directory') {
      setPreviewFile(file)
    }
  }, [])

  // Handle directory navigation
  const handleNavigate = useCallback((path: string) => {
    setCurrentPath(path)
  }, [])

  // Handle mode change
  const handleModeChange = useCallback(async (newMode: SessionMode) => {
    if (!token || newMode === currentMode) return

    // 检查新模式是否禁用
    const newModeConfig = MODE_CONFIGS[newMode]
    if (newModeConfig.disabled) return

    try {
      const updatedSession = await sessionsApi.switchMode(token, sessionId, newMode)
      setCurrentMode(updatedSession.current_mode as SessionMode)
      setSession(updatedSession)

      // 如果新模式有自动命令且输入框为空，填充到输入框
      if (newModeConfig.autoCommand && !message.trim()) {
        setMessage(newModeConfig.autoCommand)
      }
    } catch (err) {
      console.error('Failed to switch mode:', err)
    }
  }, [token, sessionId, currentMode, message])

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

        // Load session info
        const sessionData = await sessionsApi.get(token, sessionId)
        setSession(sessionData)

        // 兼容旧的 mode 值
        const rawMode = sessionData.current_mode as SessionMode
        const normalizedMode = rawMode === 'normal' ? 'data-question'
          : rawMode === 'research' ? 'scientific-experiment'
          : rawMode || 'data-question'
        setCurrentMode(normalizedMode as SessionMode)

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
              is_stopped: msg.is_stopped,
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
    'flex'
  )

  return (
    <div className={containerClasses}>
      {/* Left sidebar - Session list (collapsible) */}
      <SessionSidebar
        token={token || ''}
        currentSessionId={sessionId}
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenDataSourceMarket={() => setIsDataSourceModalOpen(true)}
      />

      {/* Expand sidebar button - shows when sidebar is collapsed */}
      {isSidebarCollapsed && (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 p-2 bg-surface-200 border border-gray-800 border-l-0 rounded-r-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label="展开侧边栏"
          title="展开侧边栏"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-gray-800 bg-surface/50 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-semibold text-gray-100">
                  {session?.title || `会话 ${sessionId.slice(0, 8)}...`}
                </h1>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      isConnected ? 'bg-emerald-500' : isSending ? 'bg-yellow-500' : 'bg-gray-500'
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-gray-500">
                    {isSending ? '处理中...' : isConnected ? '已连接' : '就绪'}
                  </span>
                  <span className={cn(
                    'ml-2 px-2 py-0.5 rounded text-xs font-medium',
                    MODE_CONFIGS[currentMode]?.bgColor || 'bg-gray-500/20',
                    MODE_CONFIGS[currentMode]?.color || 'text-gray-400'
                  )}>
                    {MODE_CONFIGS[currentMode]?.label || currentMode}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {connectionError && (
                <span className="text-sm text-red-400" title={connectionError.message}>
                  连接错误
                </span>
              )}
              {/* Toggle file panel button */}
              <button
                onClick={() => setIsFilePanelOpen(!isFilePanelOpen)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isFilePanelOpen
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
                aria-label={isFilePanelOpen ? '关闭文件面板' : '打开文件面板'}
                title={isFilePanelOpen ? '关闭文件面板' : '打开文件面板'}
              >
                {isFilePanelOpen ? (
                  <PanelRightClose className="w-5 h-5" />
                ) : (
                  <PanelRightOpen className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex overflow-hidden relative">
          {/* Chat area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Event stream - with bottom padding for fixed input */}
            <div className="flex-1 overflow-hidden relative pb-[120px]">
              <EventStream ref={eventStreamRef} events={events} className="h-full" />
              {/* Thinking indicator - show when sending, default to 'analyzing' state */}
              <ThinkingIndicator
                isActive={isSending}
                state={thinkingState === 'idle' ? 'analyzing' : thinkingState}
                toolName={activeToolName}
                className="absolute bottom-4 left-4 right-4"
              />
            </div>
          </div>

          {/* File browser sidebar - collapsible with slide animation */}
          <div
            className={cn(
              'flex-shrink-0 border-l border-gray-800 p-4 overflow-hidden',
              'transition-all duration-300 ease-in-out',
              isFilePanelOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 border-l-0 p-0'
            )}
          >
            <FileBrowser
              files={files}
              currentPath={currentPath}
              isLoading={false}
              onDownload={handleDownload}
              onRefresh={handleRefresh}
              onSelect={handleSelect}
              onNavigate={handleNavigate}
              className="h-full"
            />
          </div>
        </main>
      </div>

      {/* Fixed Input area at bottom */}
      <div
        className={cn(
          'fixed bottom-0 right-0 z-20 border-t border-gray-800 bg-background/95 backdrop-blur-xl',
          'transition-all duration-300 ease-in-out',
          isSidebarCollapsed ? 'left-0' : 'left-[280px]'
        )}
      >
        <div
          className={cn(
            'transition-all duration-300 ease-in-out',
            isFilePanelOpen ? 'mr-80' : 'mr-0'
          )}
        >
          <div className="p-4 max-w-4xl mx-auto">
            <ChatInput
              value={message}
              onChange={setMessage}
              onSubmit={handleSubmit}
              onStop={handleStop}
              onFileUpload={handleFileUpload}
              disabled={isSending}
              isLoading={isSending}
              placeholder={isSending ? '处理中...' : '输入消息...'}
              mode={currentMode}
              onModeChange={handleModeChange}
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              按 Enter 发送，Shift+Enter 换行
            </p>
          </div>
        </div>
      </div>

      {/* File Preview Panel */}
      {previewFile && (
        <FilePreview
          sessionId={sessionId}
          filePath={previewFile.path}
          fileName={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Data Source Market Modal */}
      <DataSourceModal
        isOpen={isDataSourceModalOpen}
        onClose={() => setIsDataSourceModalOpen(false)}
        token={token || ''}
      />
    </div>
  )
}
