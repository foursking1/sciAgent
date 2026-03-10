'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, Clock, MessageSquare, Activity, Trash2, Globe, Lock, Copy, Check, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sessionsApi, type Session } from '@/lib/api';

interface SessionWithMeta extends Session {
  messageCount?: number;
}

export default function DashboardPage() {
  const { user, logout, isAuthenticated, isLoading, token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load sessions
  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    const loadSessions = async () => {
      try {
        setIsLoadingSessions(true);
        setError(null);
        const data = await sessionsApi.list(token);
        setSessions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadSessions();
  }, [isAuthenticated, token]);

  // Handle session deletion
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!token) return;

    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      await sessionsApi.delete(token, sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      alert('Failed to delete session');
    }
  };

  // Handle toggle public status
  const handleTogglePublic = async (e: React.MouseEvent, sessionId: string, isPublic: boolean) => {
    e.stopPropagation();
    if (!token) return;

    try {
      const updated = await sessionsApi.setPublic(token, sessionId, !isPublic);
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, is_public: updated.is_public } : s));
    } catch (err) {
      alert('Failed to update session visibility');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left: Logo */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">SciAgent</span>
          </button>

          {/* Right: User info + Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm">
                {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold text-white">{user.full_name || 'User'}</h1>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="btn-ghost flex items-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold gradient-text mb-2">
            Welcome back, {user.full_name?.split(' ')[0] || user.email.split('@')[0]}!
          </h2>
          <p className="text-gray-400">
            Manage your sessions and start new conversations
          </p>
        </div>

        {/* New Session Button */}
        <div className="mb-8">
          <button
            onClick={async () => {
              if (!token) return;
              try {
                const session = await sessionsApi.create(token);
                router.push(`/session/${session.id}`);
              } catch (err) {
                alert('Failed to create session');
              }
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>New Session</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="glass rounded-2xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary-400" />
              Your Sessions
            </h3>
            <span className="text-sm text-gray-400">
              {isLoadingSessions ? 'Loading...' : `${sessions.length} sessions`}
            </span>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {isLoadingSessions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 bg-surface rounded-lg animate-pulse"
                >
                  <div className="w-10 h-10 bg-gray-700 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No sessions yet</p>
              <button
                onClick={async () => {
                  if (!token) return;
                  try {
                    const session = await sessionsApi.create(token);
                    router.push(`/session/${session.id}`);
                  } catch (err) {
                    alert('Failed to create session');
                  }
                }}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Start your first session</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onDelete={handleDeleteSession}
                  onTogglePublic={handleTogglePublic}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SessionCard({
  session,
  onDelete,
  onTogglePublic,
}: {
  session: Session;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onTogglePublic: (e: React.MouseEvent, id: string, isPublic: boolean) => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/session/public/${session.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={() => router.push(`/session/${session.id}`)}
      className="w-full data-card flex items-center gap-4 group cursor-pointer relative"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center border border-primary-500/30 group-hover:border-primary-500 transition-colors">
        <MessageSquare className="w-5 h-5 text-primary-400" />
      </div>
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-100 group-hover:text-primary-400 transition-colors truncate">
            {session.title || `Session ${session.id.slice(0, 8)}...`}
          </h4>
          {session.is_public && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary-500/20 text-primary-400 border border-primary-500/30">
              <Globe className="w-3 h-3" />
              Public
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
          <Clock className="w-3 h-3" />
          <span>Created {formatDate(session.created_at)}</span>
        </div>
      </div>

      {/* Share button */}
      <button
        onClick={(e) => onTogglePublic(e, session.id, session.is_public || false)}
        className={`p-2 transition-colors ${session.is_public ? 'text-primary-400 hover:text-primary-300' : 'text-gray-500 hover:text-white'}`}
        aria-label={session.is_public ? 'Make private' : 'Make public'}
        title={session.is_public ? 'Make private' : 'Make public'}
      >
        {session.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
      </button>

      {/* Copy link button (only show if public) */}
      {session.is_public && (
        <button
          onClick={handleCopyLink}
          className="p-2 text-gray-500 hover:text-white transition-colors"
          aria-label="Copy public link"
          title="Copy public link"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      )}

      {/* Delete button */}
      <button
        onClick={(e) => onDelete(e, session.id)}
        className="p-2 text-gray-500 hover:text-red-400 transition-colors"
        aria-label="Delete session"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="text-gray-600 group-hover:text-primary-400 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
