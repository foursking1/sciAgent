'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { publicApi, filesApi, PublicSessionDetail, Message } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { ArrowLeft, Download, FileText, Clock } from 'lucide-react';

interface PublicSessionPageProps {
  params: {
    id: string;
  };
}

export default function PublicSessionPage({ params }: PublicSessionPageProps) {
  const { token, isAuthenticated } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<PublicSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setIsLoading(true);
        const data = await publicApi.getSession(params.id, token || undefined);
        setSession(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, [params.id, token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Session not found'}</p>
          <Link href="/" className="btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {session.title || `Analysis ${session.id.slice(0, 8)}`}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="px-2 py-0.5 rounded bg-surface border border-gray-700">
                  {session.current_mode}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(session.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session.is_owner ? (
              <Link href={`/session/${session.id}`} className="btn-primary">
                Open in Editor
              </Link>
            ) : isAuthenticated ? (
              <Link href="/dashboard" className="btn-secondary">
                Dashboard
              </Link>
            ) : (
              <Link href="/register" className="btn-primary">
                Get Started
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Read-only banner for non-owners */}
      {!session.is_owner && (
        <div className="bg-primary-500/10 border-b border-primary-500/20 px-4 py-2 text-center text-sm text-primary-300">
          This is a public example. Sign up to create your own analyses.
        </div>
      )}

      {/* Messages */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-32">
        <div className="space-y-4">
          {session.messages.map((message) => (
            <MessageCard key={message.id} message={message} sessionId={session.id} />
          ))}
        </div>
      </main>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-800 bg-background/95 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-center gap-4">
          {session.is_owner ? (
            <Link href={`/session/${session.id}`} className="btn-primary w-full max-w-md">
              Continue Editing
            </Link>
          ) : (
            <Link href="/register" className="btn-primary w-full max-w-md">
              Create Your Own Analysis
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageCard({ message, sessionId }: { message: Message; sessionId: string }) {
  const isUser = message.role === 'user';
  const [showCodeBlocks, setShowCodeBlocks] = useState(true);

  // Parse content for code blocks and images
  const renderContent = (content: string) => {
    // Simple markdown-like rendering
    const parts = content.split(/(```[\s\S]*?```|!\[.*?\]\(.*?\))/g);

    return parts.map((part, index) => {
      // Code block
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3);
        const firstLine = code.split('\n')[0];
        const language = firstLine.match(/^\w+$/) ? firstLine : '';
        const codeContent = language ? code.slice(firstLine.length + 1) : code;

        return (
          <div key={index} className="my-3 rounded-lg overflow-hidden border border-gray-800">
            {language && (
              <div className="bg-surface px-3 py-1 text-xs text-gray-500 border-b border-gray-800">
                {language}
              </div>
            )}
            <pre className="p-4 overflow-x-auto bg-surface/50 text-sm">
              <code className="text-gray-300">{codeContent}</code>
            </pre>
          </div>
        );
      }

      // Image
      const imageMatch = part.match(/!\[.*?\]\((.*?)\)/);
      if (imageMatch) {
        const imagePath = imageMatch[1];
        const imageUrl = imagePath.startsWith('http')
          ? imagePath
          : filesApi.getPublicFileUrl(sessionId, imagePath);
        return (
          <div key={index} className="my-3">
            <img
              src={imageUrl}
              alt="Analysis output"
              className="max-w-full rounded-lg border border-gray-800"
            />
          </div>
        );
      }

      // Regular text
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div
      className={cn(
        'rounded-xl p-4',
        isUser
          ? 'bg-primary-500/10 border border-primary-500/20 ml-8'
          : 'bg-surface border border-gray-800 mr-8'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
            isUser
              ? 'bg-primary-500 text-white'
              : 'bg-gradient-to-br from-primary-500 to-accent-500 text-white'
          )}
        >
          {isUser ? 'U' : 'AI'}
        </div>
        <span className="text-xs text-gray-500">
          {new Date(message.created_at).toLocaleString()}
        </span>
      </div>
      <div className="text-gray-200 whitespace-pre-wrap prose prose-invert max-w-none">
        {renderContent(message.content)}
      </div>
    </div>
  );
}
