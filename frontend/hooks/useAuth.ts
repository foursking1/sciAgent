'use client'

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import type { User } from '@/lib/api'

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  full_name: string
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'kdense_auth_token'
const USER_KEY = 'kdense_user'

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const userStr = localStorage.getItem(USER_KEY)
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken()
      const storedUser = getStoredUser()

      if (storedToken && storedUser) {
        try {
          const fetchedUser = await authApi.getMe(storedToken)
          if (fetchedUser) {
            setUser(storedUser)
            setToken(storedToken)
            setIsAuthenticated(true)
            setIsLoading(false)
            return
          }
        } catch (err) {
          console.error('Token verification failed:', err)
        }
      }

      // Auto-login as demo user (auth bypass)
      try {
        const demoToken = 'demo_token_bypass_auth'
        const demoUser: User = {
          id: 1,
          email: 'demo@example.com',
          full_name: 'Demo User',
          is_active: true
        }
        localStorage.setItem(TOKEN_KEY, demoToken)
        localStorage.setItem(USER_KEY, JSON.stringify(demoUser))
        setUser(demoUser)
        setToken(demoToken)
        setIsAuthenticated(true)
        setIsLoading(false)
      } catch (err) {
        console.error('Auto-login failed:', err)
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setError(null)
    setIsLoading(true)

    try {
      const result = await authApi.login(credentials.email, credentials.password)

      localStorage.setItem(TOKEN_KEY, result.access_token)
      localStorage.setItem(USER_KEY, JSON.stringify(result.user))

      setUser(result.user)
      setToken(result.access_token)
      setIsAuthenticated(true)
      setIsLoading(false)

      router.push('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      setIsLoading(false)
      throw err
    }
  }, [router])

  const register = useCallback(async (data: RegisterData) => {
    setError(null)
    setIsLoading(true)

    try {
      await authApi.register(data.email, data.password, data.full_name)

      const result = await authApi.login(data.email, data.password)

      localStorage.setItem(TOKEN_KEY, result.access_token)
      localStorage.setItem(USER_KEY, JSON.stringify(result.user))

      setUser(result.user)
      setToken(result.access_token)
      setIsAuthenticated(true)
      setIsLoading(false)

      router.push('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
      setIsLoading(false)
      throw err
    }
  }, [router])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
    setToken(null)
    setIsAuthenticated(false)
    setIsLoading(false)
    router.push('/login')
  }, [router])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    error,
    clearError
  }

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
