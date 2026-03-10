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

const STATE_MESSAGES: Record<ThinkingState, { text: string; icon?: string }> = {
  idle: { text: 'Ready' },
  analyzing: { text: '正在思考' },
  calling_tools: { text: '正在使用工具' },
  generating: { text: '正在输出' },
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
  const [fadeIn, setFadeIn] = useState(false)

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
        'flex gap-3 animate-fade-in',
        'transition-all duration-300',
        fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        className
      )}
    >
      {/* Bot Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500/20 flex items-center justify-center border border-accent-500/30">
        <svg
          className="w-5 h-5 text-accent-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v4" />
          <line x1="8" y1="16" x2="8" y2="16" />
          <line x1="16" y1="16" x2="16" y2="16" />
        </svg>
      </div>

      {/* Message bubble with typing indicator */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-200">Assistant</span>
        </div>

        <div className="inline-flex items-center gap-3 px-4 py-3 bg-surface-200 rounded-2xl rounded-tl-none">
          {/* Animated dots */}
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>

          {/* Status text */}
          <span className="text-sm text-gray-300">
            {stateInfo.text}
            {toolName && state === 'calling_tools' && (
              <span className="text-gray-400 ml-1">({toolName})</span>
            )}
          </span>
        </div>
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
    switch (event.type) {
      case 'started':
      case 'status':
        setThinkingState('analyzing')
        break
      case 'function_call':
        setThinkingState('calling_tools')
        if (event.name) {
          setActiveToolName(event.name)
        }
        break
      case 'function_response':
        setThinkingState('generating')
        setActiveToolName(undefined)
        break
      case 'message':
        const content = event.content || ''
        const isInitMessage = content.includes('Preparing') || content.includes('Starting') || content.includes('(coding mode)')
        if (content.length > 0 && !isInitMessage) {
          setThinkingState('generating')
        }
        break
      case 'completed':
      case 'error':
      case 'cancelled':
        setThinkingState('idle')
        setActiveToolName(undefined)
        break
      default:
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
