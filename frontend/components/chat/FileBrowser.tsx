'use client'

import React, { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export interface FileItem {
  name: string
  path: string
  size?: number
  type?: 'file' | 'directory'
  createdAt?: string
  modifiedAt?: string
}

export interface FileBrowserProps {
  files?: FileItem[]
  isLoading?: boolean
  onDownload?: (file: FileItem) => void
  onRefresh?: () => void
  onSelect?: (file: FileItem) => void
  className?: string
  emptyMessage?: string
}

// Icon components
const FileIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

const CodeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const ImageIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)

const JsonIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

/**
 * Get file icon based on file type/extension
 */
const getFileIcon = (fileName: string, type?: 'file' | 'directory') => {
  if (type === 'directory') {
    return FolderIcon
  }

  const ext = fileName.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'py':
    case 'rs':
    case 'go':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
      return CodeIcon
    case 'json':
      return JsonIcon
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
      return ImageIcon
    default:
      return FileIcon
  }
}

/**
 * Format file size to human-readable format
 */
const formatFileSize = (bytes?: number): string => {
  if (bytes === undefined) return ''

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0
  let size = bytes

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * FileBrowser component - displays workspace files
 * Supports file list with icons, download, refresh, and empty state
 */
export const FileBrowser: React.FC<FileBrowserProps> = ({
  files = [],
  isLoading = false,
  onDownload,
  onRefresh,
  onSelect,
  className,
  emptyMessage = 'No files in workspace',
}) => {
  const handleDownload = useCallback(
    (file: FileItem) => {
      onDownload?.(file)
    },
    [onDownload]
  )

  const handleSelect = useCallback(
    (file: FileItem) => {
      onSelect?.(file)
    },
    [onSelect]
  )

  const containerClasses = cn(
    'flex flex-col h-full',
    'bg-surface-200 border border-gray-800 rounded-xl',
    'overflow-hidden',
    className
  )

  if (isLoading) {
    return (
      <div className={containerClasses}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-sm font-medium text-gray-200">Files</h3>
          <RefreshIcon className="w-4 h-4 text-gray-500 animate-spin" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading files...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h3 className="text-sm font-medium text-gray-200">Workspace Files</h3>
        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="p-1.5 h-auto"
            aria-label="Refresh files"
          >
            <RefreshIcon className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-surface border border-gray-800 flex items-center justify-center mb-4">
              <FolderIcon className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gray-400">{emptyMessage}</p>
            <p className="text-xs text-gray-500 mt-1">
              Files created during your session will appear here
            </p>
          </div>
        ) : (
          /* File list */
          <ul className="divide-y divide-gray-800">
            {files.map((file, index) => {
              const IconComponent = getFileIcon(file.name, file.type)

              return (
                <li
                  key={file.path || index}
                  className={cn(
                    'group flex items-center gap-3 p-3 hover:bg-surface transition-colors cursor-pointer',
                    onSelect && 'hover:bg-surface'
                  )}
                  onClick={() => handleSelect(file)}
                >
                  {/* File icon */}
                  <div
                    className={cn(
                      'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                      'bg-surface border border-gray-800',
                      'group-hover:border-gray-700 transition-colors'
                    )}
                  >
                    <IconComponent className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>
                    {file.path && file.path !== file.name && (
                      <p className="text-xs text-gray-500 truncate font-mono">{file.path}</p>
                    )}
                  </div>

                  {/* File size */}
                  {file.size && (
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  )}

                  {/* Download button */}
                  {onDownload && file.type !== 'directory' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(file)
                      }}
                      className="flex-shrink-0 p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      aria-label={`Download ${file.name}`}
                      title="Download"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer with file count */}
      {files.length > 0 && (
        <div className="p-3 border-t border-gray-800 bg-surface/50">
          <p className="text-xs text-gray-500 text-center">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </p>
        </div>
      )}
    </div>
  )
}

export default FileBrowser
