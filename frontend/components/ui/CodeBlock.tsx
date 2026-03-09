import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'

export interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  highlightLines?: number[]
  className?: string
  onCopy?: (code: string) => void
}

// Simple syntax highlighting using regex patterns
const highlightSyntax = (code: string, language?: string): string => {
  if (!code) return ''

  let highlighted = code
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Comments (single-line)
  highlighted = highlighted.replace(
    /(\/\/.*$)/gm,
    '<span class="token-comment">$1</span>'
  )

  // Multi-line comments
  highlighted = highlighted.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    '<span class="token-comment">$1</span>'
  )

  // Strings (double quotes)
  highlighted = highlighted.replace(
    /(&quot;[^&]*?&quot;)/g,
    '<span class="token-string">$1</span>'
  )

  // Strings (single quotes)
  highlighted = highlighted.replace(
    /(&#39;[^&]*?&#39;)/g,
    '<span class="token-string">$1</span>'
  )

  // Template literals
  highlighted = highlighted.replace(
    /(`[^`]*?`)/g,
    '<span class="token-string">$1</span>'
  )

  // Numbers
  highlighted = highlighted.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="token-number">$1</span>'
  )

  // Keywords
  const keywords = [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally',
    'throw', 'new', 'class', 'extends', 'import', 'export', 'from', 'default',
    'async', 'await', 'yield', 'typeof', 'instanceof', 'in', 'of', 'void',
    'this', 'super', 'null', 'undefined', 'true', 'false', 'interface',
    'type', 'implements', 'public', 'private', 'protected', 'readonly',
    'as', 'keyof', 'typeof', 'infer', 'extends', 'namespace', 'declare',
    'enum', 'module', 'require', 'module', 'exports', 'package', 'import',
    'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in',
    'import', 'from', 'with', 'as', 'lambda', 'yield', 'raise', 'except',
    'try', 'finally', 'pass', 'break', 'continue', 'not', 'and', 'or',
    'True', 'False', 'None', 'pub', 'fn', 'let', 'mut', 'ref', 'struct',
    'impl', 'trait', 'use', 'mod', 'self', 'Self', 'unsafe', 'extern', 'crate'
  ]

  const keywordPattern = new RegExp(
    `\\b(${keywords.join('|')})\\b`,
    'g'
  )
  highlighted = highlighted.replace(
    keywordPattern,
    '<span class="token-keyword">$1</span>'
  )

  // Function names
  highlighted = highlighted.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g,
    '<span class="token-function">$1</span>'
  )

  // Operators
  highlighted = highlighted.replace(
    /([+\-*/%=<>!&|^~?:]+)/g,
    '<span class="token-operator">$1</span>'
  )

  return highlighted
}

/**
 * CodeBlock component with syntax highlighting
 * Supports line numbers, line highlighting, and copy functionality
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'typescript',
  filename,
  showLineNumbers = true,
  highlightLines = [],
  className,
  onCopy,
}) => {
  const lines = useMemo(() => code.split('\n'), [code])

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    onCopy?.(code)
  }

  const codeBlockClasses = cn(
    'relative overflow-hidden rounded-xl',
    'bg-surface-200 border border-gray-800',
    'font-mono text-sm',
    className
  )

  const preClasses = cn(
    'overflow-x-auto p-4',
    !showLineNumbers && 'pl-4'
  )

  const codeClasses = cn(
    'text-gray-100 leading-relaxed',
    showLineNumbers && 'inline-block min-w-full'
  )

  const getLineClasses = (lineNumber: number) => {
    return cn(
      'table-row',
      highlightLines.includes(lineNumber) &&
        'bg-primary-500/10 border-l-2 border-primary-500'
    )
  }

  return (
    <div className={codeBlockClasses}>
      {/* Header */}
      {(filename || onCopy) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-surface/50">
          {filename && (
            <span className="text-xs text-gray-500 font-medium">
              {filename}
              {language && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-gray-800 rounded">
                  {language}
                </span>
              )}
            </span>
          )}
          {onCopy && (
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-gray-800 rounded-md transition-colors"
              title="Copy code"
              aria-label="Copy code to clipboard"
            >
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Code */}
      <pre className={preClasses} tabIndex={0} aria-label={`${language} code block`}>
        <code className={codeClasses}>
          {showLineNumbers ? (
            <div className="table w-full">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className={getLineClasses(index + 1)}
                >
                  <span
                    className={cn(
                      'table-cell text-right pr-4 select-none',
                      'text-gray-600 w-12'
                    )}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span
                    className="table-cell pl-2"
                    dangerouslySetInnerHTML={{
                      __html: highlightSyntax(line, language),
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            lines.map((line, index) => (
              <div
                key={index}
                dangerouslySetInnerHTML={{
                  __html: highlightSyntax(line, language),
                }}
              />
            ))
          )}
        </code>
      </pre>
    </div>
  )
}

export default CodeBlock
