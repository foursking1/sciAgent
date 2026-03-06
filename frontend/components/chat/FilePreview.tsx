'use client'

import React, { useEffect, useState } from 'react'
import { X, FileText, Image as ImageIcon, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filesApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

interface FilePreviewProps {
  sessionId: string
  filePath: string
  fileName: string
  onClose: () => void
}

interface PreviewData {
  type: 'text' | 'image' | 'binary'
  filename: string
  extension: string
  size: number
  content?: string
  url?: string
  message?: string
}

export function FilePreview({ sessionId, filePath, fileName, onClose }: FilePreviewProps) {
  const { token } = useAuth()
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    const loadPreview = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await filesApi.preview(token, sessionId, filePath)
        setPreview(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview')
      } finally {
        setLoading(false)
      }
    }

    loadPreview()
  }, [token, sessionId, filePath])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let unitIndex = 0
    let size = bytes
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  const getLanguage = (ext: string): string => {
    const langMap: Record<string, string> = {
      'py': 'python',
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'json': 'json',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'md': 'markdown',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'csv': 'csv',
    }
    return langMap[ext] || 'text'
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Preview Panel */}
      <div className="relative w-full max-w-2xl bg-surface border-l border-gray-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-surface-200">
          <div className="flex items-center gap-3 min-w-0">
            {preview?.type === 'image' ? (
              <ImageIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
            ) : preview?.type === 'text' ? (
              <FileText className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-gray-100 truncate" title={fileName}>
                {fileName}
              </h3>
              {preview && (
                <p className="text-xs text-gray-500">
                  {formatFileSize(preview.size)} • {preview.extension.toUpperCase()}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading preview...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                  <X className="w-6 h-6 text-red-400" />
                </div>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          ) : preview?.type === 'text' ? (
            <div className="p-4">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words bg-surface-200/50 rounded-lg p-4 overflow-x-auto">
                <code>{preview.content}</code>
              </pre>
            </div>
          ) : preview?.type === 'image' ? (
            <div className="h-full flex items-center justify-center p-4 bg-surface-200/30">
              {preview.url && (
                <img
                  src={preview.url}
                  alt={preview.filename}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center">
                <File className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-sm text-gray-400">{preview?.message || 'Binary file'}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Download the file to view its contents
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FilePreview
