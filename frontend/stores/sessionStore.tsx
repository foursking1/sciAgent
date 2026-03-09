'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSSE, type StreamEvent, type FileItem } from '@/hooks/useSSE'
import { sessionsApi, filesApi, type Session } from '@/lib/api'

interface SessionState {
  events: StreamEvent[]
  isConnected: boolean
  isSending: boolean
  connectionError: Error | null
  currentTaskId: string | null
  currentMode: 'data-question' | 'scientific-experiment' | 'data-extraction' | 'paper-writing'
  thinkingState: 'idle' | 'analyzing' | 'calling_tools' | 'generating'
  activeToolName?: string
  files: FileItem[]
  currentPath: string
  session: Session | null
}

interface SessionStoreContextValue {
  // Session states
  sessions: Map<string, SessionState>

  // Current active session
  activeSessionId: string | null

  // Actions
  setActiveSession: (sessionId: string) => void
  sendMessage: (sessionId: string, content: string) => Promise<void>
  stopGeneration: (sessionId: string) => Promise<void>
  refreshSession: (sessionId: string) => Promise<void>
  refreshFiles: (sessionId: string, path?: string) => Promise<void>
  getCurrentState: (sessionId: string) => SessionState | undefined
}

const SessionStoreContext = createContext<SessionStoreContextValue | undefined>(undefined)

export function useSessionStore() {
  const context = useContext(SessionStoreContext)
  if (!context) {
    throw new Error('useSessionStore must be used within SessionStoreProvider')
  }
  return context
}

interface SessionStoreProviderProps {
  children: React.ReactNode
  token: string
  apiBaseUrl: string
}

const MODE_CONFIGS = {
  'data-question': 'data-question',
  'scientific-experiment': 'scientific-experiment',
  'data-extraction': 'data-extraction',
  'paper-writing': 'paper-writing',
  'normal': 'data-question',
  'research': 'scientific-experiment',
} as const

export function SessionStoreProvider({ children, token, apiBaseUrl }: SessionStoreProviderProps) {
  const [sessions, setSessions] = useState<Map<string, SessionState>>(new Map())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // Store refs for EventSource connections
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map())
  const router = useRouter()

  // Update session state
  const updateSessionState = useCallback((sessionId: string, updates: Partial<SessionState>) => {
    setSessions(prev => {
      const newMap = new Map(prev)
      const currentState = newMap.get(sessionId)
      if (currentState) {
        newMap.set(sessionId, { ...currentState, ...updates })
      }
      return newMap
    })
  }, [])

  // Add event to session
  const addEvent = useCallback((sessionId: string, event: StreamEvent) => {
    setSessions(prev => {
      const newMap = new Map(prev)
      const state = newMap.get(sessionId)
      if (state) {
        newMap.set(sessionId, { ...state, events: [...state.events, event] })
      }
      return newMap
    })
  }, [])

  // Connect to SSE stream for a session
  const connectToStream = useCallback(async (sessionId: string, messageContent: string) => {
    // Close existing connection for this session
    const existingSource = eventSourcesRef.current.get(sessionId)
    if (existingSource) {
      existingSource.close()
      eventSourcesRef.current.delete(sessionId)
    }

    try {
      // Submit chat request
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

      // Update session state
      updateSessionState(sessionId, {
        currentTaskId: task_id,
        isSending: true,
        isConnected: true,
        connectionError: null,
        thinkingState: 'analyzing',
      })

      // Connect to SSE stream
      const eventsUrl = `${apiBaseUrl}/api/sessions/${sessionId}/events?task_id=${task_id}&token=${token}`
      const eventSource = new EventSource(eventsUrl)
      eventSourcesRef.current.set(sessionId, eventSource)

      // Handle incoming events
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as StreamEvent
          console.log(`[SSE ${sessionId.slice(0, 8)}] Received:`, data.type, data)

          // Add event to session
          addEvent(sessionId, data)

          // Update thinking state based on event
          setSessions(prev => {
            const newMap = new Map(prev)
            const currentState = newMap.get(sessionId)
            if (!currentState) return prev

            let newThinkingState = currentState.thinkingState
            let newActiveToolName = currentState.activeToolName

            switch (data.type) {
              case 'started':
              case 'status':
                newThinkingState = 'analyzing'
                break
              case 'function_call':
                newThinkingState = 'calling_tools'
                if ('name' in data) {
                  newActiveToolName = (data as { name?: string }).name
                }
                break
              case 'function_response':
                newThinkingState = 'generating'
                newActiveToolName = undefined
                break
              case 'message':
                const content = 'content' in data ? data.content : ''
                const isInitMessage = content.includes('Preparing') || content.includes('Starting') || content.includes('(coding mode)')
                if (content.length > 0 && !isInitMessage) {
                  newThinkingState = 'generating'
                }
                break
              case 'completed':
              case 'error':
              case 'cancelled':
                newThinkingState = 'idle'
                newActiveToolName = undefined
                eventSource.close()
                eventSourcesRef.current.delete(sessionId)
                newMap.set(sessionId, {
                  ...currentState,
                  isConnected: false,
                  isSending: false,
                  currentTaskId: null,
                  thinkingState: 'idle',
                  activeToolName: undefined,
                })
                return newMap
            }

            if (newThinkingState !== currentState.thinkingState || newActiveToolName !== currentState.activeToolName) {
              newMap.set(sessionId, {
                ...currentState,
                thinkingState: newThinkingState,
                activeToolName: newActiveToolName,
              })
            }
            return newMap
          })
        } catch (e) {
          console.error('Failed to parse SSE message:', e)
        }
      }

      eventSource.onerror = (err) => {
        console.error(`[SSE ${sessionId.slice(0, 8)}] Error:`, err)
        eventSource.close()
        eventSourcesRef.current.delete(sessionId)
        updateSessionState(sessionId, {
          isConnected: false,
          isSending: false,
          connectionError: new Error('Connection error'),
        })
      }
    } catch (err) {
      console.error(`[Session ${sessionId.slice(0, 8)}] Error connecting:`, err)
      updateSessionState(sessionId, {
        isConnected: false,
        isSending: false,
        connectionError: err instanceof Error ? err : new Error('Connection failed'),
      })
    }
  }, [token, apiBaseUrl, updateSessionState, addEvent])

  // Stop generation
  const stopGeneration = useCallback(async (sessionId: string) => {
    const state = sessions.get(sessionId)
    if (!state || !state.currentTaskId) return

    try {
      await sessionsApi.cancelTask(token, sessionId, state.currentTaskId)

      // Close EventSource
      const eventSource = eventSourcesRef.current.get(sessionId)
      if (eventSource) {
        eventSource.close()
        eventSourcesRef.current.delete(sessionId)
      }

      updateSessionState(sessionId, {
        isConnected: false,
        isSending: false,
        currentTaskId: null,
        thinkingState: 'idle',
      })
    } catch (err) {
      console.error('Error cancelling task:', err)
    }
  }, [token, sessions, updateSessionState])

  // Refresh session info
  const refreshSession = useCallback(async (sessionId: string) => {
    console.log('[sessionStore] refreshSession called for:', sessionId)
    try {
      const sessionData = await sessionsApi.get(token, sessionId)
      console.log('[sessionStore] Session data loaded:', sessionData)

      // Update or create session state
      setSessions(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(sessionId)
        if (existing) {
          console.log('[sessionStore] Updating existing session state')
          newMap.set(sessionId, { ...existing, session: sessionData })
        } else {
          console.log('[sessionStore] Creating new session state')
          // Create new session state
          newMap.set(sessionId, {
            events: [],
            isConnected: false,
            isSending: false,
            connectionError: null,
            currentTaskId: null,
            currentMode: 'data-question',
            thinkingState: 'idle',
            files: [],
            currentPath: '',
            session: sessionData,
          })
        }
        console.log('[sessionStore] Session state set, total sessions:', newMap.size)
        return newMap
      })
    } catch (err) {
      console.error('[sessionStore] Failed to refresh session:', err)
      // Create empty session state on error
      setSessions(prev => {
        const newMap = new Map(prev)
        if (!newMap.has(sessionId)) {
          console.log('[sessionStore] Creating error session state with null session')
          newMap.set(sessionId, {
            events: [],
            isConnected: false,
            isSending: false,
            connectionError: null,
            currentTaskId: null,
            currentMode: 'data-question',
            thinkingState: 'idle',
            files: [],
            currentPath: '',
            session: null,
          })
        }
        return newMap
      })
    }
  }, [token])

  // Refresh files for a session
  const refreshFiles = useCallback(async (sessionId: string, path: string = '') => {
    try {
      console.log('[sessionStore] refreshFiles called for:', sessionId, 'path:', path)
      const fileRecords = await filesApi.list(token, sessionId, path)

      // Convert FileRecord[] to FileItem[]
      const fileItems: FileItem[] = fileRecords.map(record => ({
        name: record.filename,
        path: record.file_path,
        size: record.file_size,
        type: record.content_type === 'directory' ? 'directory' : 'file',
        createdAt: record.created_at,
        itemCount: record.item_count,
      }))

      console.log('[sessionStore] Processed file items:', fileItems.map(f => ({ name: f.name, type: f.type })))

      // Update session state with new files
      setSessions(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(sessionId)
        if (existing) {
          console.log('[sessionStore] Updating files in session state, count:', fileItems.length)
          newMap.set(sessionId, {
            ...existing,
            files: fileItems,
            currentPath: path,
          })
        } else {
          console.log('[sessionStore] Session not found, creating with files')
          // Create session state if it doesn't exist
          newMap.set(sessionId, {
            events: [],
            isConnected: false,
            isSending: false,
            connectionError: null,
            currentTaskId: null,
            currentMode: 'data-question',
            thinkingState: 'idle',
            files: fileItems,
            currentPath: path,
            session: null,
          })
        }
        return newMap
      })
    } catch (err) {
      console.error('[sessionStore] Failed to refresh files:', err)
    }
  }, [token])

  // Send message
  const sendMessage = useCallback(async (sessionId: string, content: string) => {
    if (!content.trim()) return

    // Ensure session state exists (using refreshSession)
    await refreshSession(sessionId)

    // Add user message
    const userEvent: StreamEvent = {
      type: 'user_message',
      content: content,
      timestamp: new Date().toISOString(),
    }
    addEvent(sessionId, userEvent)

    // Update sending state
    updateSessionState(sessionId, { isSending: true })

    // Connect to stream
    await connectToStream(sessionId, content)
  }, [refreshSession, addEvent, updateSessionState, connectToStream])

  // Get current state for a session
  // Note: This function reads from the current sessions Map, not a cached version
  const getCurrentState = useCallback((sessionId: string): SessionState | undefined => {
    return sessions.get(sessionId)
  }, [sessions])

  // Set active session
  const setActiveSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Close all EventSource connections
      eventSourcesRef.current.forEach((source) => source.close())
      eventSourcesRef.current.clear()
    }
  }, [])

  const value: SessionStoreContextValue = {
    sessions,
    activeSessionId,
    setActiveSession,
    sendMessage,
    stopGeneration,
    refreshSession,
    refreshFiles,
    getCurrentState,
  }

  return (
    <SessionStoreContext.Provider value={value}>
      {children}
    </SessionStoreContext.Provider>
  )
}
