import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date string to display format: yyyy-mm-dd hh:mm:ss
 * 直接显示服务器返回的时间，不做任何时区转换
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return ''
  }

  // 解析时间
  const date = new Date(dateString)

  // 检查日期是否有效
  if (isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * Format timestamp to Beijing time (GMT+8) in format: yyyy-mm-dd hh:mm:ss
 */
export function formatTimestamp(timestamp: string): string {
  return formatDateTime(timestamp)
}
