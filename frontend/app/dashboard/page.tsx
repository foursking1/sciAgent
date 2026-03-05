'use client';

import { useAuth, useUserSessions } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, Clock, MessageSquare, Activity } from 'lucide-react';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const { sessions, isLoading: sessionsLoading, error } = useUserSessions();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

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
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">{user.full_name}</h1>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn-ghost flex items-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold gradient-text mb-2">
            Welcome back, {user.full_name.split(' ')[0]}!
          </h2>
          <p className="text-gray-400">
            Manage your sessions and start new conversations
          </p>
        </div>

        {/* New Session Button */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/session/new')}
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
              {sessionsLoading ? 'Loading...' : `${sessions.length} sessions`}
            </span>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {sessionsLoading ? (
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
                onClick={() => router.push('/session/new')}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Start your first session</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SessionCard({ session }: { session: { id: string; title: string; created_at: string; updated_at: string } }) {
  const router = useRouter();

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

  return (
    <button
      onClick={() => router.push(`/session/${session.id}`)}
      className="w-full data-card flex items-center gap-4 group"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center border border-primary-500/30 group-hover:border-primary-500 transition-colors">
        <MessageSquare className="w-5 h-5 text-primary-400" />
      </div>
      <div className="flex-1 text-left">
        <h4 className="font-medium text-gray-100 group-hover:text-primary-400 transition-colors truncate">
          {session.title || 'Untitled Session'}
        </h4>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
          <Clock className="w-3 h-3" />
          <span>Updated {formatDate(session.updated_at)}</span>
        </div>
      </div>
      <div className="text-gray-600 group-hover:text-primary-400 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
