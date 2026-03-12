'use client'

import React, { memo, useImperativeHandle, forwardRef } from 'react'
import { cn, formatDateTime } from '@/lib/utils'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { Button } from '@/components/ui/Button'
import type {
  StreamEvent,
  UserMessageEvent,
  AgentMessageEvent,
  FunctionCallEvent,
  FunctionResponseEvent,
  CompletedEvent,
  CancelledEvent,
  ErrorEvent,
} from '@/hooks/useSSE'

// Icon components
const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const BotIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
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
)

const FunctionIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const AlertCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
)

const FileIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

interface EventMessageProps {
  event: UserMessageEvent
}

const UserMessage: React.FC<EventMessageProps> = ({ event }) => {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center border border-primary-500/30">
        <UserIcon className="w-5 h-5 text-primary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-200">You</span>
          <span className="text-xs text-gray-500">
            {formatDateTime(event.timestamp)}
          </span>
        </div>
        <div className="bg-surface-200 rounded-2xl rounded-tl-none px-4 py-3 inline-block max-w-full">
          <p className="text-gray-100 whitespace-pre-wrap break-words">{event.content}</p>
        </div>
      </div>
    </div>
  )
}

interface AgentMessageProps {
  event: AgentMessageEvent
}

const AgentMessage: React.FC<AgentMessageProps> = memo(({ event }) => {
  // Check if content is a code block
  const codeBlockMatch = event.content.match(/^```(\w+)?\n([\s\S]*?)```$/)

  if (codeBlockMatch) {
    const [, language, code] = codeBlockMatch
    return (
      <div className="flex gap-3 animate-fade-in">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500/20 flex items-center justify-center border border-accent-500/30">
          <BotIcon className="w-5 h-5 text-accent-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-200">Assistant</span>
            <span className="text-xs text-gray-500">
              {formatDateTime(event.timestamp)}
            </span>
          </div>
          <CodeBlock code={code.trim()} language={language || 'text'} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500/20 flex items-center justify-center border border-accent-500/30">
        <BotIcon className="w-5 h-5 text-accent-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-200">Assistant</span>
          <span className="text-xs text-gray-500">
            {formatDateTime(event.timestamp)}
          </span>
        </div>
        <div className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
          {event.content}
          {event.is_stopped && (
            <span className="inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded-full border border-yellow-500/20">
              <StopIcon className="w-3 h-3" />
              Stopped
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

AgentMessage.displayName = 'AgentMessage'

interface FunctionCallProps {
  event: FunctionCallEvent
}

const FunctionCall: React.FC<FunctionCallProps> = ({ event }) => {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const argsString = JSON.stringify(event.arguments, null, 2)

  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
        <FunctionIcon className="w-5 h-5 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-purple-300">Calling: {event.name}</span>
          <span className="text-xs text-gray-500">
            {formatDateTime(event.timestamp)}
          </span>
        </div>
        <div className="bg-surface-200/50 rounded-lg border border-purple-500/20 overflow-hidden">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-surface-200 transition-colors"
          >
            <span className="text-sm text-gray-400">
              {Object.keys(event.arguments).length} arguments
            </span>
            <svg
              className={cn(
                'w-4 h-4 text-gray-500 transition-transform',
                isExpanded && 'rotate-180'
              )}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {isExpanded && (
            <div className="px-4 pb-4">
              <CodeBlock code={argsString} language="json" showLineNumbers={false} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface FunctionResponseProps {
  event: FunctionResponseEvent
}

const FunctionResponse: React.FC<FunctionResponseProps> = ({ event }) => {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const responseString = typeof event.response === 'string'
    ? event.response
    : JSON.stringify(event.response, null, 2)

  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
        <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-emerald-300">
            Response from: {event.name}
          </span>
          <span className="text-xs text-gray-500">
            {formatDateTime(event.timestamp)}
          </span>
        </div>
        <div className="bg-surface-200/50 rounded-lg border border-emerald-500/20 overflow-hidden">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-surface-200 transition-colors"
          >
            <span className="text-sm text-gray-400">
              {typeof event.response === 'string' ? 'View response' : 'View JSON response'}
            </span>
            <svg
              className={cn(
                'w-4 h-4 text-gray-500 transition-transform',
                isExpanded && 'rotate-180'
              )}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {isExpanded && (
            <div className="px-4 pb-4">
              {typeof event.response === 'string' ? (
                <div className="text-sm text-gray-300 whitespace-pre-wrap">{responseString}</div>
              ) : (
                <CodeBlock code={responseString} language="json" showLineNumbers={false} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface CompletedProps {
  event: CompletedEvent
}

const Completed: React.FC<CompletedProps> = ({ event }) => {
  if (!event.files_created || event.files_created.length === 0) {
    return (
      <div className="flex gap-3 animate-fade-in">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
          <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-emerald-300">Task completed successfully</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatDateTime(event.timestamp)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
        <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-emerald-300">Task completed</span>
          <span className="text-xs text-gray-500">
            {formatDateTime(event.timestamp)}
          </span>
        </div>
        <div className="bg-emerald-500/10 rounded-lg border border-emerald-500/20 p-4 mt-2">
          <p className="text-sm text-emerald-200 mb-3 flex items-center gap-2">
            <FileIcon className="w-4 h-4" />
            Files created: {event.files_created.length}
          </p>
          <ul className="space-y-1.5">
            {event.files_created.map((file, index) => (
              <li
                key={index}
                className="flex items-center gap-2 text-sm text-gray-300 bg-surface-200/50 rounded px-3 py-2"
              >
                <FileIcon className="w-4 h-4 text-gray-500" />
                <span className="font-mono">{file}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

interface ErrorProps {
  event: ErrorEvent
}

const Error: React.FC<ErrorProps> = ({ event }) => {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
        <AlertCircleIcon className="w-5 h-5 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-red-300">Error</span>
          {event.code && (
            <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded font-mono">
              {event.code}
            </span>
          )}
          <span className="text-xs text-gray-500">
            {formatDateTime(event.timestamp)}
          </span>
        </div>
        <div className="bg-red-500/10 rounded-lg border border-red-500/20 px-4 py-3 mt-2">
          <p className="text-sm text-red-200">{event.message}</p>
        </div>
      </div>
    </div>
  )
}

interface CancelledProps {
  event: CancelledEvent
}

const Cancelled: React.FC<CancelledProps> = ({ event }) => {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
        <StopIcon className="w-5 h-5 text-yellow-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-yellow-300">Stopped</span>
          <span className="text-xs text-gray-500">
            {formatDateTime(event.timestamp)}
          </span>
        </div>
        <div className="bg-yellow-500/10 rounded-lg border border-yellow-500/20 px-4 py-3 mt-2">
          <p className="text-sm text-yellow-200">{event.message}</p>
        </div>
      </div>
    </div>
  )
}

interface EventStreamProps {
  events: StreamEvent[]
  className?: string
  children?: React.ReactNode
}

export interface EventStreamRef {
  scrollToBottom: () => void
}

/**
 * EventStream component - renders different event types from the agent
 * Auto-scrolls to latest message and supports all stream event types
 */
export const EventStream = forwardRef<EventStreamRef, EventStreamProps>(({ events, className, children }, ref) => {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = React.useState(true)

  // Expose scrollToBottom method via ref
  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        })
        setAutoScroll(true)
      }
    }
  }))

  // Auto-scroll to bottom when new events arrive
  React.useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events, autoScroll])

  // Handle scroll to detect manual scrolling
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setAutoScroll(isNearBottom)
    }
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
      setAutoScroll(true)
    }
  }

  const renderEvent = (event: StreamEvent, index: number) => {
    const eventWith_type = event as { type: string }

    switch (eventWith_type.type) {
      case 'user_message':
        return <UserMessage key={index} event={event as UserMessageEvent} />
      case 'message':
        return <AgentMessage key={index} event={event as AgentMessageEvent} />
      case 'function_call':
        return <FunctionCall key={index} event={event as FunctionCallEvent} />
      case 'function_response':
        return <FunctionResponse key={index} event={event as FunctionResponseEvent} />
      case 'completed':
        return <Completed key={index} event={event as CompletedEvent} />
      case 'cancelled':
        return <Cancelled key={index} event={event as CancelledEvent} />
      case 'error':
        return <Error key={index} event={event as ErrorEvent} />
      case 'status':
      case 'usage':
      case 'started':
        // Skip status/usage events in the message list
        return null
      default:
        // Log unknown events for debugging but don't render them
        console.log('[EventStream] Skipping unknown event type:', eventWith_type.type)
        return null
    }
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-4 px-4 py-4 scroll-smooth"
      >
        {events.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BotIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm mt-2">Send a message to begin</p>
            </div>
          </div>
        ) : (
          <>
            {events.map(renderEvent)}
            {children}
          </>
        )}
      </div>

      {!autoScroll && events.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 px-3 py-1.5 bg-surface-200 border border-gray-700 rounded-full text-sm text-gray-400 hover:bg-surface hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          New messages
        </button>
      )}
    </div>
  )
})

EventStream.displayName = 'EventStream'

export default EventStream
