'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { EventStream, type EventStreamRef } from '@/components/chat/EventStream'
import { ChatInput, SessionMode, MODE_CONFIGS } from '@/components/chat/ChatInput'
import { FileBrowser } from '@/components/chat/FileBrowser'
import { FilePreview } from '@/components/chat/FilePreview'
import { SessionSidebar } from '@/components/chat/SessionSidebar'
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator'
import { DataSourceModal } from '@/components/data-sources/DataSourceModal'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useSessionStore } from '@/stores/sessionStore'
import { sessionsApi, filesApi, type Session } from '@/lib/api'
import type { FileItem } from '@/components/chat/FileBrowser'
import { PanelRightClose, PanelRightOpen, PanelLeftOpen, Globe, Lock, Copy, Check } from 'lucide-react'

export interface SessionPageProps {
  sessionId: string
  apiBaseUrl?: string
}

/**
 * Session page component - using global session store
 */
export default function SessionPage({ sessionId, apiBaseUrl = '' }: SessionPageProps) {
  const { token } = useAuth()
  const router = useRouter()

  // Use global session store
  const {
    sessions,  // Important: Must destructure sessions to trigger re-renders
    activeSessionId,
    setActiveSession,
    sendMessage,
    stopGeneration,
    refreshSession,
    refreshFiles,
    getCurrentState
  } = useSessionStore()

  // Local UI state
  const [message, setMessage] = useState('')
  const [isFilePanelOpen, setIsFilePanelOpen] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const eventStreamRef = useRef<EventStreamRef>(null)

  // Get current session state from store
  const sessionState = getCurrentState(sessionId)

  // Set active session and load session data on mount
  useEffect(() => {
    setActiveSession(sessionId)

    // Load session data
    const loadSession = async () => {
      try {
        await refreshSession(sessionId)
        // Also load file list
        await refreshFiles(sessionId, '')
      } catch (err) {
        console.error('Failed to load session:', err)
      } finally {
        // Only set loading to false after refreshSession completes
        setIsLoading(false)
      }
    }

    loadSession()
  }, [sessionId, refreshSession, refreshFiles])

  // Watch for session state to be actually created
  useEffect(() => {
    // If we're no longer loading but sessionState is still undefined,
    // it means refreshSession failed silently
    if (!isLoading && !sessionState && activeSessionId === sessionId) {
      console.error('[SessionChat] Session state not found after loading:', sessionId)
    }
  }, [isLoading, sessionState, activeSessionId, sessionId])

  // Auto-scroll when new events arrive
  useEffect(() => {
    if (sessionState && sessionState.events.length > 0 && activeSessionId === sessionId) {
      setTimeout(() => {
        eventStreamRef.current?.scrollToBottom()
      }, 100)
    }
  }, [sessionState?.events, activeSessionId, sessionId])

  // Handle file download
  const handleDownload = useCallback(async (file: any) => {
    if (!token) return

    try {
      const downloadUrl = filesApi.getDownloadUrl(sessionId, file.path)
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to download file')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download file:', err)
    }
  }, [token, sessionId])

  // Handle file refresh
  const handleRefresh = useCallback(async () => {
    await refreshFiles(sessionId, sessionState?.currentPath || '')
  }, [refreshFiles, sessionId, sessionState?.currentPath])

  // Handle file select
  const handleSelect = useCallback((file: any) => {
    setPreviewFile(file)
  }, [])

  // Handle file navigate
  const handleNavigate = useCallback(async (path: string) => {
    console.log('[SessionChat] Navigating to:', path)
    await refreshFiles(sessionId, path)
  }, [refreshFiles, sessionId])

  // Handle file upload
  const handleFileUpload = useCallback(async (uploadedFiles: FileList) => {
    if (!token) return

    console.log('[SessionChat] Uploading files:', uploadedFiles.length)

    try {
      const result = await filesApi.upload(token, sessionId, uploadedFiles)
      console.log('[SessionChat] Upload successful:', result)

      // Check if any files failed to upload
      const failedFiles = result.files.filter(f => !f.success)
      if (failedFiles.length > 0) {
        console.error('[SessionChat] Some files failed to upload:', failedFiles)
      }

      // Refresh file list after upload to show new files
      console.log('[SessionChat] Refreshing file list...')
      await refreshFiles(sessionId, sessionState?.currentPath || '')
      console.log('[SessionChat] File list refreshed')
    } catch (err) {
      console.error('Failed to upload files:', err)
    }
  }, [token, sessionId, refreshFiles, sessionState?.currentPath])

  // Handle send message
  const handleSubmit = useCallback(async (content: string) => {
    await sendMessage(sessionId, content)
    setMessage('')
  }, [sessionId, sendMessage])

  // Handle stop generation
  const handleStop = useCallback(async () => {
    await stopGeneration(sessionId)
  }, [sessionId, stopGeneration])

  // Handle mode change
  const handleModeChange = useCallback(async (mode: SessionMode) => {
    console.log('Mode change:', mode)
  }, [])

  // Handle toggle public
  const handleTogglePublic = useCallback(async () => {
    if (!sessionState?.session || !token) return

    try {
      await sessionsApi.setPublic(token, sessionId, !sessionState.session.is_public)
      await refreshSession(sessionId)
    } catch (err) {
      console.error('Failed to toggle public:', err)
    }
  }, [token, sessionId, sessionState?.session, refreshSession])

  // Handle copy link
  const handleCopyLink = useCallback(async () => {
    const url = `${window.location.origin}/session/public/${sessionId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [sessionId])

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Check for valid session state (state must exist AND session must not be null)
  if (!sessionState || !sessionState.session) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Session not found</p>
          {!sessionState && <p className="text-xs text-gray-600 mt-2">State: undefined</p>}
          {sessionState && !sessionState.session && <p className="text-xs text-gray-600 mt-2">State exists but session is null</p>}
        </div>
      </div>
    )
  }

  const containerClasses = cn(
    'h-screen bg-background overflow-hidden',
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

      {/* Expand button when collapsed */}
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
                  {sessionState.session?.title || `会话 ${sessionId.slice(0, 8)}...`}
                </h1>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      sessionState.isConnected ? 'bg-emerald-500' : sessionState.isSending ? 'bg-yellow-500' : 'bg-gray-500'
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-gray-500">
                    {sessionState.isSending ? '处理中...' : sessionState.isConnected ? '已连接' : '就绪'}
                  </span>
                  <span className={cn(
                    'ml-2 px-2 py-0.5 rounded text-xs font-medium',
                    MODE_CONFIGS[sessionState.currentMode]?.bgColor || 'bg-gray-500/20',
                    MODE_CONFIGS[sessionState.currentMode]?.color || 'text-gray-400'
                  )}>
                    {MODE_CONFIGS[sessionState.currentMode]?.label || sessionState.currentMode}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sessionState.connectionError && (
                <span className="text-sm text-red-400" title={sessionState.connectionError.message}>
                  连接错误
                </span>
              )}
              {/* Toggle public button */}
              <button
                onClick={handleTogglePublic}
                className={cn(
                  'p-2 transition-colors',
                  sessionState.session?.is_public
                    ? 'text-primary-400 hover:text-primary-300'
                    : 'text-gray-500 hover:text-white'
                )}
                aria-label={sessionState.session?.is_public ? '设为私有' : '设为公开'}
                title={sessionState.session?.is_public ? '设为私有' : '设为公开'}
              >
                {sessionState.session?.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </button>
              {/* Copy public link button */}
              {sessionState.session?.is_public && (
                <button
                  onClick={handleCopyLink}
                  className="p-2 text-gray-500 hover:text-white transition-colors"
                  aria-label="复制公开链接"
                  title="复制公开链接"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
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
            {/* Event stream - scrollable area */}
            <div className="flex-1 overflow-y-auto relative pb-[180px]">
              <EventStream ref={eventStreamRef} events={sessionState.events} className="min-h-full">
                {/* Thinking indicator at the end of message stream */}
                {sessionState.isSending && (
                  <ThinkingIndicator
                    isActive={sessionState.isSending}
                    state={sessionState.thinkingState === 'idle' ? 'analyzing' : sessionState.thinkingState}
                    toolName={sessionState.activeToolName}
                    className="mt-4"
                  />
                )}
              </EventStream>
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
              files={sessionState.files}
              currentPath={sessionState.currentPath}
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
          <div className="p-4 pb-6 max-w-4xl mx-auto">
            <ChatInput
              value={message}
              onChange={setMessage}
              onSubmit={handleSubmit}
              onStop={handleStop}
              onFileUpload={handleFileUpload}
              disabled={sessionState.isSending}
              isLoading={sessionState.isSending}
              placeholder={sessionState.isSending ? '处理中...' : '输入消息...'}
              mode={sessionState.currentMode}
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

      {/* Data Source Modal */}
      <DataSourceModal
        isOpen={isDataSourceModalOpen}
        onClose={() => setIsDataSourceModalOpen(false)}
        token={token || ''}
      />
    </div>
  )
}
