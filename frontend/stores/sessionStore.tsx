'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSSE, type StreamEvent, type FileItem } from '@/hooks/useSSE'
import { sessionsApi, filesApi, type Session } from '@/lib/api'
import { createLogger } from '@/lib/logger'

const logger = createLogger('sessionStore')

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
  loadHistoricalEvents: (sessionId: string) => Promise<StreamEvent[]>
  getCurrentState: (sessionId: string) => SessionState | undefined
  updateSessionData: (sessionId: string, sessionData: Session) => void
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
    logger.debug('updateSessionState for', sessionId.slice(0, 8), ':', updates)
    setSessions(prev => {
      const newMap = new Map(prev)
      const currentState = newMap.get(sessionId)
      if (currentState) {
        const newState = { ...currentState, ...updates }
        logger.debug('- Before update: events.length =', currentState.events.length, ', isSending =', currentState.isSending)
        logger.debug('- After update: events.length =', newState.events.length, ', isSending =', newState.isSending)
        newMap.set(sessionId, newState)
      } else {
        logger.debug('- No current state, skipping update')
      }
      return newMap
    })
  }, [])

  // Update session data (e.g., title, is_public)
  const updateSessionData = useCallback((sessionId: string, sessionData: Session) => {
    setSessions(prev => {
      const newMap = new Map(prev)
      const currentState = newMap.get(sessionId)
      if (currentState) {
        newMap.set(sessionId, { ...currentState, session: sessionData })
      }
      return newMap
    })
  }, [])

  // Add event to session
  const addEvent = useCallback((sessionId: string, event: StreamEvent) => {
    logger.debug('addEvent for', sessionId.slice(0, 8), ': type =', event.type)
    setSessions(prev => {
      const newMap = new Map(prev)
      const state = newMap.get(sessionId)
      if (state) {
        const newEvents = [...state.events, event]
        logger.debug('- Adding event, new total events:', newEvents.length)
        newMap.set(sessionId, { ...state, events: newEvents })
      } else {
        logger.debug('- No state found, creating new state with this event')
        // Create minimal state if none exists
        newMap.set(sessionId, {
          events: [event],
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
      const eventsUrl = `${apiBaseUrl}/api/sessions/${sessionId}/events?task_id=${task_id}&token=${encodeURIComponent(token)}`
      const eventSource = new EventSource(eventsUrl)
      eventSourcesRef.current.set(sessionId, eventSource)

      // Handle incoming events
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as StreamEvent
          logger.debug(`SSE ${sessionId.slice(0, 8)}] Received:`, data.type, data)

          // Update thinking state and add event in a single setSessions call
          setSessions(prev => {
            const newMap = new Map(prev)
            const currentState = newMap.get(sessionId)
            if (!currentState) {
              logger.debug(`SSE ${sessionId.slice(0, 8)}] No state found, skipping event`)
              return prev
            }

            let newThinkingState: SessionState['thinkingState'] = currentState.thinkingState
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
                // Add the completed event and update state in one operation
                const updatedState = {
                  ...currentState,
                  events: [...currentState.events, data],
                  isConnected: false,
                  isSending: false,
                  currentTaskId: null,
                  thinkingState: 'idle',
                  activeToolName: undefined,
                }
                logger.debug(`SSE ${sessionId.slice(0, 8)}] Task ${data.type}, total events:`, updatedState.events.length)
                newMap.set(sessionId, updatedState)

                // Dispatch event to notify other components (sidebar, chat page)
                // that the session has been updated (title may have changed)
                window.dispatchEvent(new CustomEvent('session-updated', { detail: { sessionId } }))

                return newMap
            }

            // For non-completion events, add event and update state
            const updatedState = {
              ...currentState,
              events: [...currentState.events, data],
              ...(newThinkingState !== currentState.thinkingState || newActiveToolName !== currentState.activeToolName
                ? { thinkingState: newThinkingState, activeToolName: newActiveToolName }
                : {})
            }
            newMap.set(sessionId, updatedState)
            return newMap
          })
        } catch (e) {
          console.error('Failed to parse SSE message:', e)
        }
      }

      eventSource.onerror = (err) => {
        const readyState = eventSource.readyState
        logger.error(`SSE ${sessionId.slice(0, 8)}] Error:`, err, `readyState: ${readyState}`)

        // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED
        if (readyState === EventSource.CLOSED) {
          // Connection was closed, update state
          eventSource.close()
          eventSourcesRef.current.delete(sessionId)
          updateSessionState(sessionId, {
            isConnected: false,
            isSending: false,
            connectionError: new Error('Connection closed'),
          })
        }
        // If CONNECTING, don't close - let it retry
      }
    } catch (err) {
      console.error(`[Session ${sessionId.slice(0, 8)}] Error connecting:`, err)
      updateSessionState(sessionId, {
        isConnected: false,
        isSending: false,
        connectionError: err instanceof Error ? err : new Error('Connection failed'),
      })
    }
  }, [token, apiBaseUrl, updateSessionState])

  // Reconnect to an existing SSE stream (for page refresh recovery)
  const reconnectToStream = useCallback(async (sessionId: string, taskId: string) => {
    logger.debug('reconnectToStream:', sessionId.slice(0, 8), 'taskId:', taskId)

    // Close existing connection for this session
    const existingSource = eventSourcesRef.current.get(sessionId)
    if (existingSource) {
      existingSource.close()
      eventSourcesRef.current.delete(sessionId)
    }

    try {
      // Update session state to reflect reconnection
      updateSessionState(sessionId, {
        currentTaskId: taskId,
        isSending: true,
        isConnected: true,
        connectionError: null,
        thinkingState: 'analyzing',
      })

      // Connect to SSE stream
      const eventsUrl = `${apiBaseUrl}/api/sessions/${sessionId}/events?task_id=${taskId}&token=${encodeURIComponent(token)}`
      const eventSource = new EventSource(eventsUrl)
      eventSourcesRef.current.set(sessionId, eventSource)

      logger.debug('Reconnected to SSE stream for task:', taskId)

      // Handle incoming events (same logic as connectToStream)
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as StreamEvent
          logger.debug(`SSE ${sessionId.slice(0, 8)}] Received:`, data.type, data)

          // Update thinking state and add event in a single setSessions call
          setSessions(prev => {
            const newMap = new Map(prev)
            const currentState = newMap.get(sessionId)
            if (!currentState) {
              logger.debug(`SSE ${sessionId.slice(0, 8)}] No state found, skipping event`)
              return prev
            }

            let newThinkingState: SessionState['thinkingState'] = currentState.thinkingState
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
                // Add the completed event and update state in one operation
                const updatedState = {
                  ...currentState,
                  events: [...currentState.events, data],
                  isConnected: false,
                  isSending: false,
                  currentTaskId: null,
                  thinkingState: 'idle',
                  activeToolName: undefined,
                }
                logger.debug(`SSE ${sessionId.slice(0, 8)}] Task ${data.type}, total events:`, updatedState.events.length)
                newMap.set(sessionId, updatedState)

                // Dispatch event to notify other components (sidebar, chat page)
                // that the session has been updated (title may have changed)
                window.dispatchEvent(new CustomEvent('session-updated', { detail: { sessionId } }))

                return newMap
            }

            // For non-completion events, add event and update state
            const updatedState = {
              ...currentState,
              events: [...currentState.events, data],
              ...(newThinkingState !== currentState.thinkingState || newActiveToolName !== currentState.activeToolName
                ? { thinkingState: newThinkingState, activeToolName: newActiveToolName }
                : {})
            }
            newMap.set(sessionId, updatedState)
            return newMap
          })
        } catch (e) {
          console.error('Failed to parse SSE message:', e)
        }
      }

      eventSource.onerror = (err) => {
        const readyState = eventSource.readyState
        logger.error(`SSE ${sessionId.slice(0, 8)}] Error:`, err, `readyState: ${readyState}`)

        // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED
        if (readyState === EventSource.CLOSED) {
          // Connection was closed, update state
          eventSource.close()
          eventSourcesRef.current.delete(sessionId)
          updateSessionState(sessionId, {
            isConnected: false,
            isSending: false,
            connectionError: new Error('Connection closed'),
          })
        }
        // If CONNECTING, don't close - let it retry
      }
    } catch (err) {
      console.error(`[Session ${sessionId.slice(0, 8)}] Error reconnecting:`, err)
      updateSessionState(sessionId, {
        isConnected: false,
        isSending: false,
        connectionError: err instanceof Error ? err : new Error('Reconnection failed'),
      })
    }
  }, [token, apiBaseUrl, updateSessionState])

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
      logger.error('Error cancelling task:', err)
    }
  }, [token, sessions, updateSessionState])

  // Convert database Message to StreamEvent
  const convertMessageToEvent = useCallback((message: any): StreamEvent => {
    if (message.role === 'user') {
      return {
        type: 'user_message',
        content: message.content,
        timestamp: message.created_at,
      }
    } else {
      return {
        type: 'message',
        content: message.content,
        timestamp: message.created_at,
        is_stopped: message.is_stopped,
      }
    }
  }, [])

  // Load historical events for a session (all event types, not just messages)
  const loadHistoricalEvents = useCallback(async (sessionId: string): Promise<StreamEvent[]> => {
    try {
      logger.debug('Loading historical events for:', sessionId)
      const { events } = await sessionsApi.getEvents(token, sessionId)
      logger.debug('Historical events loaded:', events.length)
      // The API already returns events in the correct format (StreamEvent)
      return events as StreamEvent[]
    } catch (err) {
      logger.error('Failed to load historical events:', err)
      // Fallback to loading just messages if events API fails
      logger.info('Falling back to loading messages only')
      const messages = await sessionsApi.getMessages(token, sessionId)
      return messages.map(convertMessageToEvent)
    }
  }, [token, convertMessageToEvent])

  // Refresh session info
  const refreshSession = useCallback(async (sessionId: string) => {
    logger.debug('===== refreshSession START =====')
    logger.debug('sessionId:', sessionId)

    try {
      const sessionData = await sessionsApi.get(token, sessionId)
      logger.debug('API returned session data')

      // Load historical events (all event types, not just messages)
      const historicalEvents = await loadHistoricalEvents(sessionId)
      logger.debug('Historical events from DB:', historicalEvents.length)

      // Check for active task (for page refresh recovery)
      // Use try-catch specifically for getActiveTask to avoid breaking entire refresh
      let activeTask = null
      try {
        activeTask = await sessionsApi.getActiveTask(token, sessionId)
        logger.debug('Active task check:', activeTask ? `task_id=${activeTask.task_id}, status=${activeTask.status}` : 'No active task')
      } catch (taskErr) {
        // getActiveTask failed (404 is expected for sessions without active tasks)
        // Log but don't fail the entire refresh
        logger.debug('getActiveTask failed (expected for sessions without active tasks):', taskErr instanceof Error ? taskErr.message : taskErr)
        activeTask = null
      }

      // Update or create session state using functional update
      // CRITICAL: Always preserve current events if they exist
      setSessions(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(sessionId)

        logger.debug('Inside setSessions - existing:', existing ? 'YES' : 'NO')
        if (existing) {
          logger.debug('- existing.events.length:', existing.events.length)
          logger.debug('- historicalEvents.length:', historicalEvents.length)

          if (existing.events.length > 0) {
            // IMPORTANT: Always preserve current events, don't replace with DB messages
            // Current events include: user_message, function_call, function_response, message, etc.
            // DB messages only include: user_message, message
            logger.debug('✓ PRESERVING', existing.events.length, 'current events')
            logger.debug('Current event types:', [...new Set(existing.events.map(e => e.type))])
            newMap.set(sessionId, {
              ...existing,
              session: sessionData,
            })
          } else {
            // No current events - use historical events from DB
            logger.debug('Using', historicalEvents.length, 'historical events from DB')
            newMap.set(sessionId, {
              ...existing,
              session: sessionData,
              events: historicalEvents,
            })
          }
        } else {
          // No existing state at all - create with historical events
          logger.debug('Creating new state with', historicalEvents.length, 'historical events')
          newMap.set(sessionId, {
            events: historicalEvents,
            isConnected: false,
            isSending: false,
            connectionError: null,
            currentTaskId: null,
            currentMode: (sessionData.current_mode as any) || 'data-question',
            thinkingState: 'idle',
            files: [],
            currentPath: '',
            session: sessionData,
          })
        }
        return newMap
      })

      // If there's an active task, reconnect to the SSE stream
      if (activeTask && (activeTask.status === 'pending' || activeTask.status === 'running')) {
        logger.debug('Found active task, reconnecting to SSE stream...')
        await reconnectToStream(sessionId, activeTask.task_id)
      }

      logger.debug('===== refreshSession END =====')
    } catch (err) {
      logger.error('Failed to refresh session:', err)
      logger.debug('===== refreshSession END (ERROR) =====')

      // Even on error, try to get session data to create a minimal working state
      // This prevents the "Session not found" UI when there's a transient error
      try {
        // Try to at least get the session data
        const sessionData = await sessionsApi.get(token, sessionId)
        setSessions(prev => {
          const newMap = new Map(prev)
          if (!newMap.has(sessionId)) {
            logger.debug('Creating minimal state with session data after error')
            newMap.set(sessionId, {
              events: [],
              isConnected: false,
              isSending: false,
              connectionError: err instanceof Error ? err : new Error('Failed to load session'),
              currentTaskId: null,
              currentMode: (sessionData.current_mode as any) || 'data-question',
              thinkingState: 'idle',
              files: [],
              currentPath: '',
              session: sessionData,
            })
          }
          return newMap
        })
      } catch (getSessionErr) {
        // If even getting session data fails, create state without session
        logger.error('Failed to get session data after error:', getSessionErr)
        setSessions(prev => {
          const newMap = new Map(prev)
          if (!newMap.has(sessionId)) {
            logger.debug('Creating minimal state without session data')
            newMap.set(sessionId, {
              events: [],
              isConnected: false,
              isSending: false,
              connectionError: err instanceof Error ? err : new Error('Failed to load session'),
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
    }
  }, [token, loadHistoricalEvents, reconnectToStream])

  // Refresh files for a session
  const refreshFiles = useCallback(async (sessionId: string, path: string = '') => {
    try {
      logger.debug('refreshFiles called for:', sessionId, 'path:', path)
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

      logger.debug('Processed file items:', fileItems.map(f => ({
        name: f.name,
        type: f.type,
        itemCount: f.itemCount
      })))

      // Update session state with new files
      setSessions(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(sessionId)
        if (existing) {
          logger.debug('Updating files in session state, count:', fileItems.length)
          newMap.set(sessionId, {
            ...existing,
            files: fileItems,
            currentPath: path,
          })
        } else {
          logger.debug('Session not found, creating with files')
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
      logger.error('Failed to refresh files:', err)
    }
  }, [token])

  // Send message
  const sendMessage = useCallback(async (sessionId: string, content: string) => {
    if (!content.trim()) return

    // Ensure session state exists (load session data if not already loaded)
    const currentState = sessions.get(sessionId)
    if (!currentState || !currentState.session) {
      logger.debug('sendMessage: Session state not found, loading session data')
      try {
        const sessionData = await sessionsApi.get(token, sessionId)
        const historicalEvents = await loadHistoricalEvents(sessionId)

        setSessions(prev => {
          const newMap = new Map(prev)
          newMap.set(sessionId, {
            events: historicalEvents,
            isConnected: false,
            isSending: false,
            connectionError: null,
            currentTaskId: null,
            currentMode: (sessionData.current_mode as any) || 'data-question',
            thinkingState: 'idle',
            files: [],
            currentPath: '',
            session: sessionData,
          })
          return newMap
        })
      } catch (err) {
        logger.error('Failed to load session data:', err)
        return
      }
    }

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
  }, [sessions, token, loadHistoricalEvents, updateSessionState, connectToStream])

  // Get current state for a session
  // Note: This function reads from the current sessions Map
  const getCurrentState = useCallback((sessionId: string): SessionState | undefined => {
    if (!sessionId) return undefined
    return sessions.get(sessionId)
  }, [sessions])

  // Set active session
  const setActiveSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
  }, [])

  // Handle page visibility change
  // When user returns to the tab, check if SSE connections are still alive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.debug('Page became visible, checking SSE connections')
        // Check all active sessions with EventSource connections
        eventSourcesRef.current.forEach((eventSource, sessionId) => {
          const state = sessions.get(sessionId)
          if (state && state.isSending) {
            // Check if EventSource is still open
            if (eventSource.readyState === EventSource.CLOSED) {
              logger.debug(`EventSource for ${sessionId.slice(0, 8)} is closed, updating state`)
              updateSessionState(sessionId, {
                isConnected: false,
                isSending: false,
                connectionError: new Error('Connection was closed'),
              })
            } else if (eventSource.readyState === EventSource.CONNECTING) {
              logger.debug(`EventSource for ${sessionId.slice(0, 8)} is connecting`)
            } else {
              logger.debug(`EventSource for ${sessionId.slice(0, 8)} is still open`)
            }
          }
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sessions, updateSessionState])

  // Periodic health check for SSE connections
  // This ensures long-running connections are detected if they silently fail
  useEffect(() => {
    const interval = setInterval(() => {
      // Only check if page is visible
      if (document.visibilityState !== 'visible') return

      eventSourcesRef.current.forEach((eventSource, sessionId) => {
        const state = sessions.get(sessionId)
        if (state && state.isSending && eventSource.readyState === EventSource.CLOSED) {
          logger.debug(`Health check: EventSource for ${sessionId.slice(0, 8)} is closed, updating state`)
          updateSessionState(sessionId, {
            isConnected: false,
            isSending: false,
            connectionError: new Error('Connection was closed'),
          })
        }
      })
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [sessions, updateSessionState])

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
    loadHistoricalEvents,
    getCurrentState,
    updateSessionData,
  }

  return (
    <SessionStoreContext.Provider value={value}>
      {children}
    </SessionStoreContext.Provider>
  )
}
