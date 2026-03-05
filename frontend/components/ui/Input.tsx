import React, { forwardRef, InputHTMLAttributes, useId } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
}

/**
 * Input component with label, error messages, and required indicator
 * Supports keyboard navigation and accessibility attributes
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      required,
      fullWidth = true,
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const hintId = `${inputId}-hint`

    const inputClasses = cn(
      'w-full px-4 py-2.5',
      'bg-surface border rounded-lg',
      'text-gray-100 placeholder-gray-500',
      'transition-colors duration-200',
      'focus:outline-none focus:ring-1 focus:ring-primary-500',
      error
        ? 'border-red-500 focus:border-red-500'
        : 'border-gray-700 focus:border-primary-500',
      'disabled:bg-surface/50 disabled:text-gray-500 disabled:cursor-not-allowed',
      fullWidth && 'w-full',
      className
    )

    const renderLabel = () => {
      if (!label) return null

      return (
        <label
          htmlFor={inputId}
          className={cn(
            'block text-sm font-medium mb-1.5',
            'text-gray-300',
            required && 'after:content-["*"] after:ml-1 after:text-red-500'
          )}
        >
          {label}
        </label>
      )
    }

    const renderError = () => {
      if (!error) return null

      return (
        <p
          id={errorId}
          className="mt-1.5 text-sm text-red-500 flex items-center gap-1.5"
          role="alert"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )
    }

    const renderHint = () => {
      if (!hint || error) return null

      return (
        <p
          id={hintId}
          className="mt-1.5 text-sm text-gray-500"
        >
          {hint}
        </p>
      )
    }

    return (
      <div className={cn(fullWidth && 'w-full')}>
        {renderLabel()}
        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          required={required}
          aria-invalid={error ? 'true' : ariaInvalid}
          aria-describedby={
            error ? errorId : hint ? hintId : ariaDescribedBy
          }
          {...props}
        />
        {renderError()}
        {renderHint()}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
