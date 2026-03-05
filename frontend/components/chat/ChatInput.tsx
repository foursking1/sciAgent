'use client'

import React, { useRef, useCallback, useState, KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onFileUpload?: (files: FileList) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  className?: string
}

/**
 * ChatInput component with auto-resizing textarea
 * Supports file upload, send/cancel actions, and loading states
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  onFileUpload,
  placeholder = 'Type your message...',
  disabled = false,
  isLoading = false,
  className,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

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
    onChange('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [onChange])

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
    disabled && 'opacity-50 cursor-not-allowed',
    className
  )

  return (
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
        disabled={disabled || isLoading || (!value.trim() && !isLoading)}
        className="flex-shrink-0 min-w-[80px]"
      >
        {isLoading ? (
          <>
            <span>Cancel</span>
          </>
        ) : (
          <>
            <span>Send</span>
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
  )
}

export default ChatInput
