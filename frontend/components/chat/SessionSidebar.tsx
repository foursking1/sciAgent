'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Clock, MessageSquare, Trash2, ChevronLeft, ChevronDown, ChevronRight, Database, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sessionsApi, type Session } from '@/lib/api'

interface SessionSidebarProps {
  token: string
  currentSessionId: string
  className?: string
  isCollapsed?: boolean
  onToggle?: () => void
  onOpenDataSourceMarket?: () => void
}

/**
 * SessionSidebar - Left sidebar displaying session list
 *
 * Features:
 * - Collapsible sidebar (fully hidden when collapsed)
 * - Data source market entry (above history)
 * - Collapsible history tab
 * - Create new session
 * - Delete session
 * - Highlight current session
 */
export function SessionSidebar({
  token,
  currentSessionId,
  className,
  isCollapsed = false,
  onToggle,
  onOpenDataSourceMarket
}: SessionSidebarProps) {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false) // 默认折叠

  // 当有当前会话时，自动展开历史列表
  useEffect(() => {
    if (currentSessionId && sessions.some(s => s.id === currentSessionId)) {
      setIsHistoryExpanded(true)
    }
  }, [currentSessionId, sessions])

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!token) return

    try {
      setIsLoading(true)
      setError(null)
      const data = await sessionsApi.list(token)
      setSessions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Create new session
  const handleCreateSession = async () => {
    if (!token) return

    try {
      const session = await sessionsApi.create(token)
      router.push(`/session/${session.id}`)
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }

  // Delete session
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (!token) return

    if (!confirm('确定要删除这个会话吗？')) return

    try {
      await sessionsApi.delete(token, sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))

      // If deleted session is current, navigate to a new one or dashboard
      if (sessionId === currentSessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId)
        if (remainingSessions.length > 0) {
          router.push(`/session/${remainingSessions[0].id}`)
        } else {
          router.push('/dashboard')
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return '今天'
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days} 天前`
    } else {
      return date.toLocaleDateString('zh-CN')
    }
  }

  // Get session title (use first message or ID)
  const getSessionTitle = (session: Session) => {
    if (session.title) return session.title
    return `会话 ${session.id.slice(0, 8)}...`
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-surface-200 border-r border-gray-800',
        'transition-all duration-300 ease-in-out overflow-hidden',
        isCollapsed ? 'w-0 opacity-0 border-r-0' : 'w-[280px] opacity-100',
        className
      )}
    >
      {/* SciAgent Logo + Collapse Button */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30 flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-lg font-bold text-white truncate">SciAgent</span>
          </button>
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors flex-shrink-0"
              aria-label="折叠侧边栏"
              title="折叠侧边栏"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Header - 新建会话 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800">
        <button
          onClick={handleCreateSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>新建会话</span>
        </button>
      </div>

      {/* 数据源 Market 按钮 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800">
        <button
          onClick={onOpenDataSourceMarket}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-surface hover:bg-gray-700 text-gray-300 text-sm transition-colors border border-gray-700"
        >
          <Database className="w-4 h-4 text-primary-400" />
          <span>数据源 Market</span>
        </button>
      </div>

      {/* 历史会话 Tab */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Tab Header */}
        <button
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-surface transition-colors"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">历史会话</span>
            {sessions.length > 0 && (
              <span className="text-xs text-gray-500">({sessions.length})</span>
            )}
          </div>
          <ChevronRight
            className={cn(
              'w-4 h-4 text-gray-500 transition-transform duration-200',
              isHistoryExpanded && 'rotate-90'
            )}
          />
        </button>

        {/* Session list - 可折叠 */}
        <div
          className={cn(
            'flex-1 overflow-y-auto transition-all duration-300',
            isHistoryExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
          )}
        >
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-700 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={loadSessions}
                className="mt-2 text-sm text-primary-400 hover:text-primary-300"
              >
                重试
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">暂无历史会话</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => router.push(`/session/${session.id}`)}
                  className={cn(
                    'group relative p-3 rounded-lg cursor-pointer transition-all',
                    'hover:bg-surface',
                    session.id === currentSessionId
                      ? 'bg-primary-500/10 border border-primary-500/30'
                      : 'border border-transparent'
                  )}
                >
                  {/* Title */}
                  <h4 className={cn(
                    'font-medium text-sm truncate',
                    session.id === currentSessionId ? 'text-primary-400' : 'text-gray-200'
                  )}>
                    {getSessionTitle(session)}
                  </h4>

                  {/* Time */}
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-500">{formatDate(session.created_at)}</span>
                  </div>

                  {/* Preview */}
                  {session.preview && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {session.preview}
                    </p>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className={cn(
                      'absolute top-2 right-2 p-1.5 rounded-lg transition-all',
                      'text-gray-500 hover:text-red-400 hover:bg-red-500/10',
                      'opacity-0 group-hover:opacity-100'
                    )}
                    aria-label="删除会话"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Active indicator */}
                  {session.id === currentSessionId && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary-500 rounded-r-full" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionSidebar
