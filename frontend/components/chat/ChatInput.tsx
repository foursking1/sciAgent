'use client'

import React, { useRef, useCallback, useState, KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export type SessionMode = 'data-question' | 'scientific-experiment' | 'data-extraction' | 'paper-writing'

export interface ModeConfig {
  id: SessionMode
  label: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
  disabled?: boolean
  disabledReason?: string
  autoCommand?: string  // 自动输入的命令
}

export const MODE_CONFIGS: Record<SessionMode, ModeConfig> = {
  'data-question': {
    id: 'data-question',
    label: '数据问题',
    description: '数据查询与分析',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  'scientific-experiment': {
    id: 'scientific-experiment',
    label: '科学实验',
    description: '实验设计与分析',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/50',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6v2H9z" />
        <path d="M10 5v6l-3 8h10l-3-8V5" />
        <circle cx="12" cy="16" r="1" />
      </svg>
    ),
  },
  'data-extraction': {
    id: 'data-extraction',
    label: '数据抽取',
    description: '即将推出',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/50',
    disabled: true,
    disabledReason: '功能开发中，敬请期待',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  'paper-writing': {
    id: 'paper-writing',
    label: '论文写作',
    description: '学术写作助手',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/50',
    autoCommand: '/scientific-writer:init',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
}

export interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onStop?: () => void
  onFileUpload?: (files: FileList) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  className?: string
  mode?: SessionMode
  onModeChange?: (mode: SessionMode) => void
}

/**
 * ChatInput component with auto-resizing textarea
 * Supports file upload, send/cancel actions, and loading states
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  onStop,
  onFileUpload,
  placeholder = 'Type your message...',
  disabled = false,
  isLoading = false,
  className,
  mode = 'data-question',
  onModeChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  // Normalize mode value (handle legacy modes)
  const normalizedMode = ((mode as string) === 'normal' ? 'data-question' : (mode as string) === 'research' ? 'scientific-experiment' : mode) as SessionMode
  const currentMode = MODE_CONFIGS[normalizedMode] || MODE_CONFIGS['data-question']

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get correct scrollHeight
    textarea.style.height = 'auto'

    // Calculate new height
    const newHeight = Math.min(textarea.scrollHeight, 200) // Max height 200px
    textarea.style.height = `${newHeight}px`
  }, [])

  // Handle value change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    autoResize()
  }

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (value.trim() && !disabled && !isLoading) {
      onSubmit(value.trim())
      onChange('')

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [value, disabled, isLoading, onSubmit, onChange])

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (onStop) {
      onStop()
    }
    onChange('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [onStop, onChange])

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFileUpload) {
      onFileUpload(e.target.files)
      // Reset input value to allow selecting same file again
      e.target.value = ''
    }
  }

  // Trigger file input click
  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Focus effect for border
  const handleFocus = () => setIsFocused(true)
  const handleBlur = () => setIsFocused(false)

  // Auto-resize on mount and when value changes
  React.useEffect(() => {
    autoResize()
  }, [value, autoResize])

  const containerClasses = cn(
    'relative flex items-end gap-2 p-3',
    'bg-surface-200 border rounded-xl',
    'transition-all duration-200',
    isFocused
      ? 'border-primary-500 ring-1 ring-primary-500'
      : 'border-gray-700 hover:border-gray-600',
    disabled && 'opacity-50 cursor-not-allowed'
  )

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Mode selector - inline buttons */}
      {onModeChange && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.values(MODE_CONFIGS).map((modeConfig) => (
            <button
              key={modeConfig.id}
              type="button"
              onClick={() => {
                if (modeConfig.disabled) return
                onModeChange(modeConfig.id)
              }}
              disabled={disabled || isLoading || modeConfig.disabled}
              title={modeConfig.disabled ? modeConfig.disabledReason : modeConfig.description}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200',
                'border',
                modeConfig.disabled
                  ? 'opacity-40 cursor-not-allowed border-gray-700 text-gray-500'
                  : normalizedMode === modeConfig.id
                    ? cn(modeConfig.borderColor, modeConfig.bgColor, modeConfig.color)
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300',
                !modeConfig.disabled && 'hover:opacity-90'
              )}
            >
              {modeConfig.icon}
              <span>{modeConfig.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className={containerClasses}>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* File upload button */}
      {onFileUpload && (
        <button
          type="button"
          onClick={handleFileClick}
          disabled={disabled || isLoading}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Upload files"
          title="Upload files"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </button>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        rows={1}
        className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 resize-none focus:outline-none py-2 px-1 max-h-[200px] overflow-y-auto"
        style={{ minHeight: '24px' }}
      />

      {/* Action button */}
      <Button
        type="button"
        variant={isLoading ? 'secondary' : 'primary'}
        size="sm"
        onClick={isLoading ? handleCancel : handleSubmit}
        disabled={(!isLoading && disabled) || (isLoading && !onStop) || (!value.trim() && !isLoading)}
        className="flex-shrink-0 min-w-[80px]"
      >
        {isLoading ? (
          <>
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span>暂停</span>
          </>
        ) : (
          <>
            <span>发送</span>
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </>
        )}
      </Button>
      </div>
    </div>
  )
}

export default ChatInput
