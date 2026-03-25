'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { publicApi, filesApi, PublicSessionDetail, sessionsApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { FileBrowser, type FileItem } from '@/components/chat/FileBrowser';
import { FilePreview } from '@/components/chat/FilePreview';
import { EventStream } from '@/components/chat/EventStream';
import type { StreamEvent } from '@/hooks/useSSE';
import { cn, formatDateTime } from '@/lib/utils';
import { ArrowLeft, Check, Clock, Copy, Globe, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface PublicSessionPageProps {
  params: {
    id: string;
  };
}

export default function PublicSessionPage({ params }: PublicSessionPageProps) {
  const { token, isAuthenticated } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<PublicSessionDetail | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [isFilePanelOpen, setIsFilePanelOpen] = useState(true);
  const [filePanelWidth, setFilePanelWidth] = useState(320);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Handle create new session
  const handleCreateSession = async () => {
    if (!token) return;
    setIsCreating(true);
    try {
      const newSession = await sessionsApi.create(token);
      router.push(`/session/${newSession.id}`);
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const loadFiles = useCallback(async (path = '') => {
    if (!token) {
      setFiles([]);
      setCurrentPath(path);
      return;
    }

    try {
      const fileRecords = await filesApi.list(token, params.id, path);
      setFiles(
        fileRecords.map((record) => ({
          name: record.filename,
          path: record.file_path,
          size: record.file_size,
          type: record.content_type === 'directory' ? 'directory' : 'file',
          createdAt: record.created_at,
          itemCount: record.item_count,
        }))
      );
      setCurrentPath(path);
    } catch (err) {
      console.error('Failed to load files:', err);
      setFiles([]);
    }
  }, [params.id, token]);

  const handleRefreshFiles = useCallback(async () => {
    await loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  const handleNavigate = useCallback(async (path: string) => {
    await loadFiles(path);
  }, [loadFiles]);

  const handleFilePanelResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = filePanelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(640, Math.max(240, startWidth - (moveEvent.clientX - startX)));
      setFilePanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [filePanelWidth]);

  const handleSelectFile = useCallback((file: FileItem) => {
    if (file.type !== 'directory') {
      setPreviewFile(file);
    }
  }, []);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setIsLoading(true);
        const [sessionData, eventData] = await Promise.all([
          publicApi.getSession(params.id, token || undefined),
          publicApi.getSessionEvents(params.id),
        ]);
        setSession(sessionData);
        setEvents(eventData as StreamEvent[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, [params.id, token]);

  useEffect(() => {
    if (!isLoading && session) {
      loadFiles('');
    }
  }, [isLoading, loadFiles, session]);

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
    <div className="h-screen bg-background overflow-hidden flex">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex-shrink-0 border-b border-gray-800 bg-surface/50 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" aria-label="Back to home">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-100 truncate">
                  {session.title || `Analysis ${session.id.slice(0, 8)}`}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                  <span className="w-2 h-2 rounded-full bg-primary-500" aria-hidden="true" />
                  <span>Public example</span>
                  <span className="px-2 py-0.5 rounded bg-primary-500/10 text-primary-300 border border-primary-500/20">
                    {session.current_mode}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(session.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="p-2 text-gray-500 hover:text-white transition-colors"
                aria-label="复制公开链接"
                title="复制公开链接"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsFilePanelOpen(!isFilePanelOpen)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isFilePanelOpen
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
                aria-label={isFilePanelOpen ? '关闭文件面板' : '打开文件面板'}
                title={isFilePanelOpen ? '关闭文件面板' : '打开文件面板'}
              >
                {isFilePanelOpen ? (
                  <PanelRightClose className="w-5 h-5" />
                ) : (
                  <PanelRightOpen className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto pb-[160px]">
              <EventStream events={events} className="min-h-full" />
            </div>
          </div>

          {isFilePanelOpen && (
            <div
              role="separator"
              aria-label="调整文件面板宽度"
              aria-orientation="vertical"
              onMouseDown={handleFilePanelResizeStart}
              className="w-1.5 cursor-col-resize bg-transparent hover:bg-primary-500/30 transition-colors"
            />
          )}
          <div
            className={cn(
              'flex-shrink-0 border-l border-gray-800 p-4 overflow-hidden',
              'transition-all duration-300 ease-in-out',
              isFilePanelOpen ? 'opacity-100' : 'w-0 opacity-0 border-l-0 p-0'
            )}
            style={isFilePanelOpen ? { width: `${filePanelWidth}px` } : undefined}
          >
            <FileBrowser
              files={files}
              currentPath={currentPath}
              isLoading={false}
              onRefresh={handleRefreshFiles}
              onSelect={handleSelectFile}
              onNavigate={handleNavigate}
              emptyMessage={token ? 'No files in this folder' : 'Sign in to browse workspace files'}
              className="h-full"
            />
          </div>
        </main>
      </div>

      {previewFile && (
        <FilePreview
          sessionId={session.id}
          filePath={previewFile.path}
          fileName={previewFile.name}
          isPublic={true}
          onClose={() => setPreviewFile(null)}
        />
      )}

      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-20 border-t border-gray-800 bg-background/95 backdrop-blur-xl',
          'transition-all duration-300 ease-in-out'
        )}
        style={isFilePanelOpen ? { paddingRight: `${filePanelWidth}px` } : { paddingRight: 0 }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="rounded-2xl border border-primary-500/10 bg-surface/60 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Globe className="w-4 h-4 text-primary-400" />
                  <span>Public example</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Like this workflow? Start your own research session and continue from your own workspace.
                </p>
              </div>

              {session.is_owner ? (
                <Link href={`/session/${session.id}`} className="btn-primary whitespace-nowrap">
                  Continue Editing
                </Link>
              ) : isAuthenticated ? (
                <button
                  onClick={handleCreateSession}
                  disabled={isCreating}
                  className="btn-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : '开始你的研究'}
                </button>
              ) : (
                <button
                  onClick={() => router.push('/session/new')}
                  className="btn-primary whitespace-nowrap"
                >
                  开始你的研究
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
