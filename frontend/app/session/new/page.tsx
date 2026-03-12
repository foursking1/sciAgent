'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { sessionsApi } from '@/lib/api';

export default function NewSessionPage() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = async () => {
    if (!token) return;

    setIsCreating(true);
    try {
      const session = await sessionsApi.create(token);
      router.push(`/session/${session.id}`);
    } catch (err) {
      alert('Failed to create session');
    } finally {
      setIsCreating(false);
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

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
          <h1 className="text-3xl font-bold gradient-text">New Session</h1>
          <p className="text-gray-400 mt-2">
            Start a new conversation with our AI assistant
          </p>
        </div>

        {/* Session Start Card */}
        <div className="glass rounded-2xl border border-gray-800 p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center mx-auto mb-6 border border-primary-500/30">
            <MessageSquare className="w-10 h-10 text-primary-400" />
          </div>

          <h2 className="text-xl font-semibold text-white mb-3">
            Ready to start a new conversation?
          </h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Our AI assistant is ready to help you with any questions or tasks you might have.
          </p>

          <button
            onClick={handleCreateSession}
            disabled={isCreating}
            className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <MessageSquare className="w-5 h-5" />
            )}
            <span>{isCreating ? 'Creating...' : 'Start Chatting'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
