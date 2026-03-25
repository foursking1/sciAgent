import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import SessionPage from '@/components/chat/SessionChat'

const sendMessageMock = vi.fn()
const refreshSessionMock = vi.fn()
const refreshFilesMock = vi.fn()
const setActiveSessionMock = vi.fn()
const stopGenerationMock = vi.fn()
const updateSessionDataMock = vi.fn()
const getCurrentStateMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: () => ({
    sessions: new Map(),
    activeSessionId: 'session-1',
    setActiveSession: setActiveSessionMock,
    sendMessage: sendMessageMock,
    stopGeneration: stopGenerationMock,
    refreshSession: refreshSessionMock,
    refreshFiles: refreshFilesMock,
    getCurrentState: getCurrentStateMock,
    updateSessionData: updateSessionDataMock,
  }),
}))

vi.mock('@/components/chat/EventStream', () => ({
  EventStream: React.forwardRef(() => <div data-testid="event-stream" />),
}))

vi.mock('@/components/chat/ChatInput', () => ({
  ChatInput: ({ onSubmit }: { onSubmit: (value: string) => void }) => (
    <button onClick={() => onSubmit('提取样本量和结局指标')}>submit</button>
  ),
  SessionMode: {},
  MODE_CONFIGS: {},
}))

vi.mock('@/components/chat/FileBrowser', () => ({
  FileBrowser: () => <div data-testid="file-browser" />,
}))

vi.mock('@/components/chat/FilePreview', () => ({
  FilePreview: () => <div data-testid="file-preview" />,
}))

vi.mock('@/components/chat/SessionSidebar', () => ({
  SessionSidebar: () => <div data-testid="session-sidebar" />,
}))

vi.mock('@/components/chat/ThinkingIndicator', () => ({
  ThinkingIndicator: () => <div data-testid="thinking-indicator" />,
}))

vi.mock('@/components/data-sources/DataSourceModal', () => ({
  DataSourceModal: () => null,
}))

vi.mock('@/lib/api', () => ({
  sessionsApi: {
    togglePublic: vi.fn(),
  },
  filesApi: {
    getFileUrl: vi.fn(),
    download: vi.fn(),
    preview: vi.fn(),
  },
}))

describe('SessionChat data extraction prompt', () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
    refreshSessionMock.mockReset()
    refreshFilesMock.mockReset()
    setActiveSessionMock.mockReset()
    stopGenerationMock.mockReset()
    updateSessionDataMock.mockReset()
    getCurrentStateMock.mockReset()

    refreshSessionMock.mockResolvedValue(undefined)
    refreshFilesMock.mockResolvedValue(undefined)
    sendMessageMock.mockResolvedValue(undefined)

    getCurrentStateMock.mockReturnValue({
      events: [],
      isConnected: false,
      isSending: false,
      connectionError: null,
      currentTaskId: null,
      currentMode: 'data-extraction',
      thinkingState: 'idle',
      currentPath: '',
      files: [
        {
          name: 'paper.pdf',
          path: 'dataset/papers/paper.pdf',
          type: 'file',
        },
      ],
      session: {
        id: 'session-1',
        title: 'Test Session',
        created_at: '2026-03-25T10:00:00.000Z',
        is_public: false,
      },
    })
  })

  it('uses built-in sciminer wording without exposing workspace path', async () => {
    render(<SessionPage sessionId="session-1" />)

    await waitFor(() => {
      expect(screen.getByText('submit')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('submit'))

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledTimes(1)
    })

    const [, prompt] = sendMessageMock.mock.calls[0]
    expect(prompt).toContain('必须使用内置 sciminer skill')
    expect(prompt).not.toContain('./scientific-skills/sciminer')
    expect(prompt).not.toContain('工作区内的 sciminer')
    expect(prompt).not.toContain('它已经被同步到当前工作区')
  })
})
