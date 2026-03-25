import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import PublicSessionPage from '@/app/session/public/[id]/page'

const pushMock = vi.fn()
const getSessionMock = vi.fn()
const getSessionEventsMock = vi.fn()
const listFilesMock = vi.fn()
const createSessionMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    isAuthenticated: true,
  }),
}))

vi.mock('@/components/chat/FilePreview', () => ({
  FilePreview: ({ fileName }: { fileName: string }) => <div>Preview: {fileName}</div>,
}))

vi.mock('@/lib/api', () => ({
  publicApi: {
    getSession: (...args: unknown[]) => getSessionMock(...args),
    getSessionEvents: (...args: unknown[]) => getSessionEventsMock(...args),
  },
  sessionsApi: {
    create: (...args: unknown[]) => createSessionMock(...args),
  },
  filesApi: {
    list: (...args: unknown[]) => listFilesMock(...args),
    preview: vi.fn(),
    getPublicFileUrl: (sessionId: string, filePath: string) => `/api/files/public/${sessionId}/${filePath}`,
  },
  publicFilesApi: {
    preview: vi.fn(),
    getFileUrl: (sessionId: string, filePath: string) => `/api/files/public/${sessionId}/${filePath}`,
  },
}))

describe('PublicSessionPage', () => {
  beforeEach(() => {
    pushMock.mockReset()
    getSessionMock.mockReset()
    getSessionEventsMock.mockReset()
    listFilesMock.mockReset()
    createSessionMock.mockReset()

    getSessionMock.mockResolvedValue({
      id: 'session-123',
      title: 'Sample Research Session',
      current_mode: 'scientific-experiment',
      created_at: '2026-03-24T10:00:00.000Z',
      is_owner: false,
      messages: [
        {
          id: 1,
          session_id: 'session-123',
          role: 'user',
          content: 'Analyze this dataset',
          created_at: '2026-03-24T10:00:00.000Z',
        },
      ],
    })

    getSessionEventsMock.mockResolvedValue([
      {
        type: 'user_message',
        content: 'Analyze this dataset',
        timestamp: '2026-03-24T10:00:00.000Z',
      },
      {
        type: 'status',
        status: '正在检查数据结构',
        timestamp: '2026-03-24T10:00:20.000Z',
      },
      {
        type: 'function_call',
        name: 'python',
        arguments: { code: 'print(1)' },
        timestamp: '2026-03-24T10:00:30.000Z',
      },
      {
        type: 'function_response',
        name: 'python',
        response: '1',
        id: 'tool-1',
        timestamp: '2026-03-24T10:00:31.000Z',
      },
      {
        type: 'message',
        content: 'Here is the analysis summary.',
        timestamp: '2026-03-24T10:01:00.000Z',
      },
      {
        type: 'completed',
        files_created: [],
        timestamp: '2026-03-24T10:01:10.000Z',
      },
    ])

    listFilesMock.mockResolvedValue([
      {
        id: 1,
        session_id: 'session-123',
        filename: 'report.md',
        file_path: 'report.md',
        file_size: 1024,
        created_at: '2026-03-24T10:02:00.000Z',
      },
      {
        id: 2,
        session_id: 'session-123',
        filename: 'chart.png',
        file_path: 'chart.png',
        file_size: 2048,
        created_at: '2026-03-24T10:03:00.000Z',
      },
    ])

    createSessionMock.mockResolvedValue({ id: 'new-session-456' })
  })

  it('creates a new session and navigates to it when authenticated user clicks the bottom CTA', async () => {
    render(<PublicSessionPage params={{ id: 'session-123' }} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始你的研究' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '开始你的研究' }))

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith('test-token')
    })
    expect(pushMock).toHaveBeenCalledWith('/session/new-session-456')
  })

  it('opens preview when clicking a file in the public file panel', async () => {
    render(<PublicSessionPage params={{ id: 'session-123' }} />)

    await waitFor(() => {
      expect(screen.getByText('report.md')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('report.md'))

    expect(screen.getByText('Preview: report.md')).toBeInTheDocument()
  })

  it('shows a resize handle for the workspace files panel', async () => {
    render(<PublicSessionPage params={{ id: 'session-123' }} />)

    await waitFor(() => {
      expect(screen.getByLabelText('调整文件面板宽度')).toBeInTheDocument()
    })
  })
})
