'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

export type ThinkingState = 'idle' | 'analyzing' | 'calling_tools' | 'generating'

interface ThinkingIndicatorProps {
  isActive: boolean
  state?: ThinkingState
  toolName?: string
  className?: string
}

const STATE_MESSAGES: Record<ThinkingState, { text: string; subtext?: string }> = {
  idle: { text: 'Ready' },
  analyzing: { text: 'Analyzing request', subtext: 'understanding your needs...' },
  calling_tools: { text: 'Calling tools', subtext: 'processing data...' },
  generating: { text: 'Generating response', subtext: 'crafting the answer...' },
}

/**
 * ThinkingIndicator - Dynamic status indicator for agent thinking states
 *
 * Shows animated status messages based on the current agent state.
 * Inspired by Claude Code's thinking indicator.
 */
export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  isActive,
  state = 'analyzing',
  toolName,
  className,
}) => {
  const [dots, setDots] = useState('')
  const [fadeIn, setFadeIn] = useState(false)

  // Debug log
  console.log('[ThinkingIndicator] Render:', { isActive, state, toolName })

  // Animate dots
  useEffect(() => {
    if (!isActive) {
      setDots('')
      return
    }

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return ''
        return prev + '.'
      })
    }, 400)

    return () => clearInterval(interval)
  }, [isActive])

  // Fade in animation
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setFadeIn(true), 50)
      return () => clearTimeout(timer)
    } else {
      setFadeIn(false)
    }
  }, [isActive])

  if (!isActive) {
    return null
  }

  const stateInfo = STATE_MESSAGES[state]

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-3 px-4',
        'transition-all duration-300',
        fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        className
      )}
    >
      {/* Pulsing indicator */}
      <div className="flex-shrink-0 relative">
        <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
        <div className="absolute inset-0 w-2 h-2 bg-primary-400 rounded-full animate-ping opacity-75" />
      </div>

      {/* Status text */}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-200">
          {stateInfo.text}
          <span className="text-gray-500">{dots}</span>
        </span>
        {stateInfo.subtext && (
          <span className="text-xs text-gray-500 mt-0.5">
            {state === 'calling_tools' && toolName ? `using ${toolName}` : stateInfo.subtext}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Hook to determine thinking state from events
 */
export function useThinkingState() {
  const [thinkingState, setThinkingState] = useState<ThinkingState>('idle')
  const [activeToolName, setActiveToolName] = useState<string | undefined>()

  const updateFromEvent = useCallback((event: { type: string; name?: string; content?: string }) => {
    console.log('[ThinkingState] Event:', event.type, event)
    switch (event.type) {
      case 'started':
      case 'status':
        // Initial status or task started
        setThinkingState('analyzing')
        console.log('[ThinkingState] → analyzing')
        break
      case 'function_call':
        setThinkingState('calling_tools')
        if (event.name) {
          setActiveToolName(event.name)
        }
        console.log('[ThinkingState] → calling_tools:', event.name)
        break
      case 'function_response':
        // After tool response, agent is generating
        setThinkingState('generating')
        setActiveToolName(undefined)
        console.log('[ThinkingState] → generating')
        break
      case 'message':
        // When receiving message content, agent is generating
        const content = event.content || ''
        // Check if it's a real message (not initialization or empty)
        const isInitMessage = content.includes('Preparing') || content.includes('Starting') || content.includes('(coding mode)')
        if (content.length > 0 && !isInitMessage) {
          setThinkingState('generating')
          console.log('[ThinkingState] → generating (from message)')
        }
        break
      case 'completed':
      case 'error':
      case 'cancelled':
        setThinkingState('idle')
        setActiveToolName(undefined)
        console.log('[ThinkingState] → idle')
        break
      default:
        // For any other event while processing, assume generating
        console.log('[ThinkingState] Unknown event type:', event.type)
        break
    }
  }, [])

  const reset = useCallback(() => {
    setThinkingState('idle')
    setActiveToolName(undefined)
  }, [])

  return {
    thinkingState,
    activeToolName,
    updateFromEvent,
    reset,
  }
}

export default ThinkingIndicator
