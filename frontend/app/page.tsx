'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { publicApi, PublicSession, filesApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await publicApi.listSessions();
        setSessions(data);
      } catch (err) {
        console.error('Failed to load public sessions:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSessions();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold gradient-text">SciAgent</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard" className="btn-primary">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">
                  Sign in
                </Link>
                <Link href="/register" className="btn-primary">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-accent-500/10" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="gradient-text">Scientific Research</span>
            <br />
            <span className="text-white">Assistant</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            AI-driven scientific research automation. From data analysis to report generation,
            accelerate your research workflow.
          </p>
          <div className="flex justify-center gap-4">
            <Link href={isAuthenticated ? "/dashboard" : "/register"} className="btn-primary text-lg px-8 py-3">
              Get Started Free
            </Link>
            <Link href="#examples" className="btn-secondary text-lg px-8 py-3">
              View Examples
            </Link>
          </div>
        </div>
      </section>

      {/* Examples Section */}
      <section id="examples" className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-2">Example Analyses</h2>
          <p className="text-gray-400 mb-8">
            Explore what SciAgent can do with real research examples
          </p>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass rounded-xl border border-gray-800 overflow-hidden animate-pulse">
                  <div className="aspect-video bg-gray-800" />
                  <div className="p-4 space-y-2">
                    <div className="h-5 bg-gray-800 rounded w-3/4" />
                    <div className="h-4 bg-gray-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-gray-400 mb-4">No public examples yet</p>
              <p className="text-gray-500 text-sm">Check back later for example analyses</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map((session) => (
                <ExampleCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>SciAgent - Scientific Research Automation Platform</p>
        </div>
      </footer>
    </div>
  );
}

function ExampleCard({ session }: { session: PublicSession }) {
  const imageUrl = session.preview_image
    ? filesApi.getPublicFileUrl(session.id, session.preview_image)
    : null;
  const pdfUrl = session.pdf_path
    ? filesApi.getPublicFileUrl(session.id, session.pdf_path)
    : null;

  return (
    <div className="glass rounded-xl border border-gray-800 overflow-hidden group hover:border-primary-500/50 transition-all duration-300">
      {/* Image */}
      <Link href={`/session/public/${session.id}`} className="block">
        <div className="aspect-video bg-surface relative overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={session.title || 'Session preview'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500/20 to-accent-500/20">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <Link href={`/session/public/${session.id}`}>
          <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors mb-2 line-clamp-1">
            {session.title || `Analysis ${session.id.slice(0, 8)}`}
          </h3>
        </Link>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <span className="px-2 py-0.5 rounded bg-surface border border-gray-700">
            {session.current_mode}
          </span>
          <span>{new Date(session.created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/session/public/${session.id}`}
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            View Session
          </Link>
          {pdfUrl && (
            <>
              <span className="text-gray-700">|</span>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Download PDF
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
