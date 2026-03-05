'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, type User, type Session } from '@/lib/api';

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'kdense_auth_token';
const USER_KEY = 'kdense_user';

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken();
      const user = getStoredUser();

      if (token && user) {
        // Verify token is still valid
        try {
          const fetchedUser = await authApi.getMe(token);
          if (fetchedUser) {
            setState({
              user,
              token,
              isLoading: false,
              isAuthenticated: true,
            });
            return;
          }
        } catch (err) {
          console.error('Token verification failed:', err);
        }
      }

      // Clear invalid auth state
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      });
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setError(null);
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const data = await authApi.login(credentials.email, credentials.password);

      // Store token and user
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      setState({
        user: data.user,
        token: data.access_token,
        isLoading: false,
        isAuthenticated: true,
      });

      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, [router]);

  const register = useCallback(async (data: RegisterData) => {
    setError(null);
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const result = await authApi.register(data.email, data.password, data.full_name);

      // Store token and user (auto-login)
      localStorage.setItem(TOKEN_KEY, result.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));

      setState({
        user: result.user,
        token: result.access_token,
        isLoading: false,
        isAuthenticated: true,
      });

      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
    router.push('/login');
  }, [router]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for fetching user sessions
export function useUserSessions() {
  const { token, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setIsLoading(false);
      return;
    }

    sessionsApi.list(token)
      .then((data) => {
        setSessions(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token, isAuthenticated]);

  return { sessions, isLoading, error };
}

// Re-export sessionsApi for use in other components
import { sessionsApi } from '@/lib/api';
