'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

// Event types from the agent
export interface UserMessageEvent {
  type: 'user_message'
  content: string
  timestamp: string
}

export interface AgentMessageEvent {
  type: 'message'
  content: string
  timestamp: string
}

export interface FunctionCallEvent {
  type: 'function_call'
  name: string
  arguments: Record<string, unknown>
  id: string
  timestamp: string
}

export interface FunctionResponseEvent {
  type: 'function_response'
  name: string
  response: unknown
  id: string
  timestamp: string
}

export interface CompletedEvent {
  type: 'completed'
  files_created: string[]
  timestamp: string
}

export interface ErrorEvent {
  type: 'error'
  message: string
  code?: string
  timestamp: string
}

export type StreamEvent =
  | UserMessageEvent
  | AgentMessageEvent
  | FunctionCallEvent
  | FunctionResponseEvent
  | CompletedEvent
  | ErrorEvent

export interface FileItem {
  name: string
  path: string
  size?: number
  type?: 'file' | 'directory'
  createdAt?: string
  modifiedAt?: string
}

export interface UseSSEReturn {
  events: StreamEvent[]
  isConnected: boolean
  error: Error | null
  isLoading: boolean
  disconnect: () => void
}

/**
 * Custom hook for Server-Sent Events (SSE) connection management
 * Handles connection, event parsing, error handling, and cleanup
 */
export function useSSE(url: string): UseSSEReturn {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const eventSourceRef = useRef<EventSource | null>(null)
  const urlRef = useRef(url)

  // Keep track of the latest URL
  useEffect(() => {
    urlRef.current = url
  }, [url])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
  }, [])

  useEffect(() => {
    // Don't connect if no URL
    if (!urlRef.current) {
      setIsLoading(false)
      return
    }

    // Create EventSource connection
    const eventSource = new EventSource(urlRef.current, {
      withCredentials: false,
    })

    eventSourceRef.current = eventSource

    // Connection opened
    eventSource.addEventListener('open', () => {
      setIsConnected(true)
      setIsLoading(false)
      setError(null)
    })

    // Generic message handler - parse and dispatch events
    eventSource.addEventListener('message', (event: MessageEvent) => {
      try {
        const parsedEvent = JSON.parse(event.data) as StreamEvent

        if (parsedEvent && typeof parsedEvent === 'object' && 'type' in parsedEvent) {
          setEvents(prev => [...prev, parsedEvent])
        }
      } catch (err) {
        // If JSON parsing fails, create a simple message event
        const fallbackEvent: AgentMessageEvent = {
          type: 'message',
          content: event.data,
          timestamp: new Date().toISOString(),
        }
        setEvents(prev => [...prev, fallbackEvent])
      }
    })

    // Handle specific event types if server sends them with type
    const eventTypes = ['user_message', 'message', 'function_call', 'function_response', 'completed', 'error']

    eventTypes.forEach(eventType => {
      eventSource.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const parsedEvent = JSON.parse(event.data) as StreamEvent
          setEvents(prev => [...prev, parsedEvent])
        } catch (err) {
          console.error(`Error parsing ${eventType} event:`, err)
        }
      })
    })

    // Error handling
    eventSource.addEventListener('error', (event: Event) => {
      setIsConnected(false)
      setIsLoading(false)

      if (eventSource.readyState === EventSource.CLOSED) {
        // Connection was closed intentionally
        setError(null)
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        // Attempting to reconnect
        setError(new Error('Reconnecting...'))
      } else {
        // Connection failed
        setError(new Error('Failed to connect to event stream'))
      }
    })

    // Cleanup on unmount or URL change
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    events,
    isConnected,
    error,
    isLoading,
    disconnect,
  }
}

export default useSSE
