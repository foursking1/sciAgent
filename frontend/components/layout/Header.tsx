import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

/**
 * Environment badge component - shows current environment
 */
const EnvironmentBadge: React.FC = () => {
  // Check if we're in development mode
  const isDev = process.env.NODE_ENV === 'development' ||
                process.env.NEXT_PUBLIC_ENVIRONMENT === 'development'

  if (!isDev) return null

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-1.5 animate-pulse"></span>
        DEV
      </span>
    </div>
  )
}

export interface User {
  name: string
  email: string
  avatar?: string
}

export interface HeaderProps {
  user?: User
  onSignIn?: () => void
  onSignOut?: () => void
  onDashboard?: () => void
  onSettings?: () => void
  className?: string
}

/**
 * UserMenu component - dropdown menu for user actions
 */
interface UserMenuProps {
  user: User
  onSignOut?: () => void
  onDashboard?: () => void
  onSettings?: () => void
}

const UserMenu: React.FC<UserMenuProps> = ({
  user,
  onSignOut,
  onDashboard,
  onSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const getUserInitials = () => {
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg',
          'hover:bg-surface-200 transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary-500'
        )}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="User menu"
        onKeyDown={handleKeyDown}
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div
            className={cn(
              'w-8 h-8 rounded-full',
              'bg-gradient-to-br from-primary-500 to-accent-500',
              'flex items-center justify-center',
              'text-white text-sm font-semibold'
            )}
            aria-hidden="true"
          >
            {getUserInitials()}
          </div>
        )}
        <span className="text-sm font-medium text-gray-200 hidden sm:block">
          {user.name}
        </span>
        <svg
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 mt-2 w-56',
            'bg-surface border border-gray-800 rounded-xl',
            'shadow-xl shadow-black/50',
            'py-2 z-50',
            'animate-fade-in'
          )}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu"
        >
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{user.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {onDashboard && (
              <button
                onClick={() => {
                  onDashboard()
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2',
                  'text-left text-sm text-gray-300 hover:text-white',
                  'hover:bg-surface-200 transition-colors duration-150',
                  'focus:outline-none focus:bg-surface-200'
                )}
                role="menuitem"
              >
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
                Dashboard
              </button>
            )}
            {onSettings && (
              <button
                onClick={() => {
                  onSettings()
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2',
                  'text-left text-sm text-gray-300 hover:text-white',
                  'hover:bg-surface-200 transition-colors duration-150',
                  'focus:outline-none focus:bg-surface-200'
                )}
                role="menuitem"
              >
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </button>
            )}
          </div>

          {/* Sign out */}
          <div className="py-1 border-t border-gray-800">
            <button
              onClick={() => {
                onSignOut?.()
                setIsOpen(false)
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2',
                'text-left text-sm text-red-400 hover:text-red-300',
                'hover:bg-surface-200 transition-colors duration-150',
                'focus:outline-none focus:bg-surface-200'
              )}
              role="menuitem"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Header component with logo and user menu
 * Provides navigation and user authentication status
 */
export const Header: React.FC<HeaderProps> = ({
  user,
  onSignIn,
  onSignOut,
  onDashboard,
  onSettings,
  className,
}) => {
  const headerClasses = cn(
    'sticky top-0 z-40 w-full',
    'glass border-b border-gray-800/50',
    'backdrop-blur-xl',
    className
  )

  const innerClasses = cn(
    'flex items-center justify-between h-16',
    'px-4 sm:px-6 lg:px-8'
  )

  return (
    <header className={headerClasses}>
      <div className={innerClasses}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onDashboard}
            className={cn(
              'flex items-center gap-3',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg',
              'transition-colors duration-200'
            )}
            aria-label="GeoGPT Home"
          >
            <div
              className={cn(
                'w-8 h-8 rounded-lg',
                'bg-gradient-to-br from-primary-500 to-accent-500',
                'flex items-center justify-center',
                'shadow-lg shadow-primary-500/30'
              )}
              aria-hidden="true"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-lg font-semibold text-white hidden sm:block">
              GeoGPT
            </span>
          </button>
          <EnvironmentBadge />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu
              user={user}
              onSignOut={onSignOut}
              onDashboard={onDashboard}
              onSettings={onSettings}
            />
          ) : (
            <Button variant="primary" size="sm" onClick={onSignIn}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
