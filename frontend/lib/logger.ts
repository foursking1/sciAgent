/**
 * Logger utility for frontend application
 *
 * Provides controlled logging that can be enabled/disabled via environment variable.
 * In production, all debug logs are disabled by default.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  enabled: boolean
  level: LogLevel
  prefix?: string
}

// Default configuration - disabled in production, enabled in development
const isDevelopment = process.env.NODE_ENV === 'development'

const defaultConfig: LoggerConfig = {
  enabled: isDevelopment,
  level: isDevelopment ? 'debug' : 'warn',
}

class Logger {
  private config: LoggerConfig

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.config.level)
    const messageLevelIndex = levels.indexOf(level)

    return messageLevelIndex >= currentLevelIndex
  }

  private formatMessage(level: LogLevel, args: unknown[]): string[] {
    const prefix = this.config.prefix ? `[${this.config.prefix}]` : ''
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    return [`${timestamp} ${prefix} ${level.toUpperCase()}:`, ...args]
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('debug', args))
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(...this.formatMessage('info', args))
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(...this.formatMessage('warn', args))
    }
  }

  error(...args: unknown[]): void {
    // Errors should always be logged
    // eslint-disable-next-line no-console
    console.error(...this.formatMessage('error', args))
  }

  /**
   * Create a child logger with an additional prefix
   */
  withPrefix(prefix: string): Logger {
    const newPrefix = this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix
    return new Logger({ ...this.config, prefix: newPrefix })
  }
}

// Create default logger instance
export const logger = new Logger()

// Create a convenience function to create scoped loggers
export function createLogger(prefix: string): Logger {
  return logger.withPrefix(prefix)
}

// Export default
export default logger
