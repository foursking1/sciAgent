'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Clock, MessageSquare, Trash2, ChevronLeft, ChevronDown, ChevronRight, Database, Zap, LogOut, User } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { sessionsApi, type Session } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useSessionStore } from '@/stores/sessionStore'

interface SessionSidebarProps {
  token: string
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
  className,
  isCollapsed = false,
  onToggle,
  onOpenDataSourceMarket
}: SessionSidebarProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { getCurrentState, activeSessionId } = useSessionStore()

  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false) // 默认折叠
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Get current session state from store - must be memoized to update when activeSessionId changes
  const currentSessionState = React.useMemo(() => {
    const state = getCurrentState(activeSessionId || '')
    console.log('[SessionSidebar] getCurrentState for', activeSessionId?.slice(0, 8) || 'null', ':', state ? `${state.events.length} events` : 'null')
    return state
  }, [activeSessionId, getCurrentState])

  // 当有当前会话时，自动展开历史列表
  useEffect(() => {
    if (activeSessionId && sessions.some(s => s.id === activeSessionId)) {
      setIsHistoryExpanded(true)
    }
  }, [activeSessionId, sessions])

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isUserMenuOpen])

  // Get user initials
  const getUserInitials = () => {
    if (!user) return ''
    return user.full_name
      ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      : user.email.charAt(0).toUpperCase()
  }

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!token) return

    try {
      setIsLoading(true)
      setError(null)
      const data = await sessionsApi.list(token)
      console.log('[SessionSidebar] Loaded sessions from API:', data.length)
      data.forEach(s => {
        console.log(`[SessionSidebar] Session ${s.id.slice(0, 8)}: title="${s.title}", created_at="${s.created_at}", updated_at="${s.updated_at}"`)
      })
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

  // Reload sessions when current session changes to ensure list is up-to-date
  useEffect(() => {
    if (activeSessionId) {
      loadSessions()
    }
  }, [activeSessionId, loadSessions])

  // Listen for session update events to refresh the list
  useEffect(() => {
    const handleSessionUpdate = () => {
      console.log('[SessionSidebar] Session updated, refreshing list')
      loadSessions()
    }

    window.addEventListener('session-updated', handleSessionUpdate)
    return () => {
      window.removeEventListener('session-updated', handleSessionUpdate)
    }
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

      // If deleted session is current, navigate to a new one or create a new session
      if (sessionId === activeSessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId)
        if (remainingSessions.length > 0) {
          router.push(`/session/${remainingSessions[0].id}`)
        } else {
          // Create a new session if no sessions left
          const newSession = await sessionsApi.create(token)
          router.push(`/session/${newSession.id}`)
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  // Calculate display times for all sessions - use unified time source (API data)
  const sessionDisplayTimes = React.useMemo(() => {
    const times: Record<string, string> = {}

    console.log('[SessionSidebar] ===== Calculating session times =====')
    console.log('[SessionSidebar] sessions count:', sessions.length)

    sessions.forEach(session => {
      // All sessions use the same logic: updated_at if available and different from created_at, otherwise created_at
      const timeToUse = session.updated_at && session.updated_at !== session.created_at
        ? session.updated_at
        : session.created_at
      const formatted = formatDateTime(timeToUse)
      times[session.id] = formatted

      console.log(`[SessionSidebar] Session ${session.id.slice(0, 8)}: ${timeToUse} -> ${formatted}`)
    })

    console.log('[SessionSidebar] ===== Final times:', times)
    return times
  }, [sessions])

  // Get the display time for a session
  const getSessionDisplayTime = (session: Session) => {
    return sessionDisplayTimes[session.id] || ''
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
                    'group relative px-3 py-2 rounded-lg cursor-pointer transition-all',
                    'hover:bg-surface',
                    session.id === activeSessionId
                      ? 'bg-primary-500/10 border border-primary-500/30'
                      : 'border border-transparent'
                  )}
                >
                  {/* Title */}
                  <h4 className={cn(
                    'font-medium text-sm truncate pr-6',
                    session.id === activeSessionId ? 'text-primary-400' : 'text-gray-200'
                  )}>
                    {getSessionTitle(session)}
                  </h4>

                  {/* Time */}
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-500">{getSessionDisplayTime(session)}</span>
                  </div>

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
                  {session.id === activeSessionId && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary-500 rounded-r-full" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User menu - bottom left */}
      <div className="flex-shrink-0 p-3 border-t border-gray-800">
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {getUserInitials()}
            </div>
            <span className="text-sm text-gray-300 truncate">
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </span>
          </button>

          {isUserMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-56 bg-surface border border-gray-800 rounded-xl shadow-xl py-2 z-50">
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-800">
                <p className="text-sm font-medium text-white">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {user?.email}
                </p>
              </div>

              {/* Logout button */}
              <button
                onClick={() => {
                  logout()
                  setIsUserMenuOpen(false)
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:text-red-300 hover:bg-gray-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>登出</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionSidebar
