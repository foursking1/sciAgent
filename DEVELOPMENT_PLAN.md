# SciAgent 开发计划

## 项目概述

**目标**: 构建类似 K-Dense Web 的 AI 研究自动化平台
**核心集成**: agentic-data-scientist
**部署模式**: 单机 Docker 部署
**开发方法**: TDD（测试驱动开发）

---

## 技术栈

### 后端
- **框架**: FastAPI 0.115
- **数据库**: MySQL 8.0 + aiomysql
- **缓存**: Redis 7
- **核心引擎**: agentic-data-scientist >= 0.2.0
- **认证**: JWT + passlib (bcrypt)

### 前端
- **框架**: Next.js 14 + TypeScript
- **样式**: TailwindCSS
- **状态管理**: SWR + React Context
- **通信**: HTTP + SSE (Server-Sent Events)

### 测试
- **后端**: pytest + pytest-asyncio
- **端到端**: Playwright

---

## TDD 测试金字塔

```
                    ┌───────────┐
                    │  E2E      │  Playwright 测试 (10%)
                    │  Tests    │
                   ┌┴───────────┴┐
                   │ Integration │  API 集成测试 (30%)
                   │   Tests     │
                  ┌┴─────────────┴┐
                  │   Unit Tests  │  单元测试 (60%)
                  └───────────────┘
```

---

## 开发阶段

### Phase 1: 基础架构（Week 1-2）

#### Sprint 1.1: 数据库层（TDD）

**测试文件**: `backend/tests/test_db/test_models.py`

```python
# 先写测试
async def test_user_model_create():
    """测试用户模型创建"""
    async with AsyncSessionLocal() as session:
        user = User(
            email="test@example.com",
            password_hash="hashed_value"
        )
        session.add(user)
        await session.commit()

        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.is_active is True

async def test_session_relationship():
    """测试会话与用户的关系"""
    async with AsyncSessionLocal() as session:
        user = User(email="test@example.com", password_hash="hash")
        session.add(user)
        await session.commit()

        test_session = Session(
            id="session_test",
            user_id=user.id,
            working_dir="/tmp/test"
        )
        session.add(test_session)
        await session.commit()

        # 验证关系
        result = await session.execute(
            select(Session).where(Session.user_id == user.id)
        )
        sessions = result.scalars().all()
        assert len(sessions) == 1
```

**实现文件**: `backend/db/models.py`

**迁移脚本**: `backend/db/migrations/versions/001_initial.py`

---

#### Sprint 1.2: 认证服务（TDD）

**测试文件**: `backend/tests/test_services/test_auth.py`

```python
def test_password_hashing():
    """测试密码哈希"""
    password = "SecurePassword123!"
    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong", hashed)

def test_access_token_creation():
    """测试 JWT token 生成"""
    token = create_access_token({"sub": "user123"})

    assert token is not None
    assert len(token) > 50

    # 验证 token
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    assert payload["sub"] == "user123"

def test_token_expiration():
    """测试 token 过期"""
    token = create_access_token(
        {"sub": "user123"},
        expires_delta=timedelta(seconds=1)
    )

    time.sleep(2)

    with pytest.raises(jwt.ExpiredSignatureError):
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
```

**实现文件**: `backend/services/auth.py`

---

#### Sprint 1.3: 会话管理（TDD）

**测试文件**: `backend/tests/test_services/test_session_manager.py`

```python
async def test_create_session():
    """测试创建会话"""
    manager = SessionManager(workspace_base="/tmp/test_workspaces")

    session = await manager.create_session(
        user_id="test-user-123",
        agent_type="claude_code"
    )

    assert session.id.startswith("session_")
    assert session.agent_type == "claude_code"
    assert Path(session.working_dir).exists()

async def test_get_session():
    """测试获取会话"""
    manager = SessionManager(workspace_base="/tmp/test_workspaces")

    # 创建
    session = await manager.create_session(user_id="user-123")

    # 获取
    ds = manager.get_session(session.id)
    assert ds is not None
    assert isinstance(ds, DataScientist)

async def test_send_message_stream():
    """测试流式消息发送（Mock）"""
    manager = SessionManager(workspace_base="/tmp/test_workspaces")
    session = await manager.create_session(user_id="user-123")

    # Mock DataScientist 响应
    with patch.object(DataScientist, 'run_async') as mock_run:
        mock_run.return_value = AsyncMock()

        result = await manager.send_message(
            session_id=session.id,
            message="Test message",
            stream=True
        )

        assert result is not None
```

**实现文件**: `backend/services/session_manager.py`

---

### Phase 2: API 层（Week 2-3）

#### Sprint 2.1: 认证 API（TDD）

**测试文件**: `backend/tests/test_api/test_auth.py`

```python
async def test_register_user(client):
    """测试用户注册"""
    response = await client.post("/api/auth/register", json={
        "email": "newuser@example.com",
        "password": "SecurePass123!",
        "full_name": "Test User"
    })

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert "id" in data
    assert "password" not in data

async def test_login_success(client):
    """测试登录成功"""
    # 先创建用户
    await client.post("/api/auth/register", json={
        "email": "login@example.com",
        "password": "SecurePass123!"
    })

    # 登录
    response = await client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "SecurePass123!"
    })

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

async def test_login_invalid_password(client):
    """测试登录失败（密码错误）"""
    await client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "correct"
    })

    response = await client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "wrong"
    })

    assert response.status_code == 401
```

**实现文件**: `backend/api/routes/auth.py`

---

#### Sprint 2.2: 会话 API（TDD）

**测试文件**: `backend/tests/test_api/test_sessions.py`

```python
async def test_create_session(auth_client):
    """测试创建会话（需要认证）"""
    response = await auth_client.post("/api/sessions", json={
        "agent_type": "claude_code"
    })

    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert "working_dir" in data

async def test_list_sessions(auth_client):
    """测试列出会话"""
    # 创建几个会话
    await auth_client.post("/api/sessions", json={})
    await auth_client.post("/api/sessions", json={})

    response = await auth_client.get("/api/sessions")

    assert response.status_code == 200
    data = response.json()
    assert len(data["sessions"]) >= 2

async def test_get_session_with_messages(auth_client):
    """测试获取会话详情"""
    # 创建会话
    create_resp = await auth_client.post("/api/sessions", json={})
    session_id = create_resp.json()["session_id"]

    # 发送消息
    await auth_client.post(f"/api/sessions/{session_id}/messages", json={
        "message": "Hello"
    })

    # 获取详情
    response = await auth_client.get(f"/api/sessions/{session_id}")

    assert response.status_code == 200
    data = response.json()
    assert "session" in data
    assert "messages" in data
    assert len(data["messages"]) >= 1

async def test_sse_events(auth_client):
    """测试 SSE 事件流"""
    create_resp = await auth_client.post("/api/sessions", json={})
    session_id = create_resp.json()["session_id"]

    response = await auth_client.get(
        f"/api/sessions/{session_id}/events",
        params={"message": "Test"}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream"
```

**实现文件**: `backend/api/routes/sessions.py`

---

### Phase 3: 前端开发（Week 3-4）

#### Sprint 3.1: 设计系统（frontend-design）

**设计原则**:
- **科技简约**: 干净利落的线条，有限的色彩
- **数据驱动**: 以内容为中心，UI 退居其次
- **响应式**: 适配桌面和平板

**核心组件**:

```typescript
// frontend/components/ui/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        variants[variant],
        sizes[size],
        isLoading && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={isLoading}
      {...props}
    />
  )
}

const variants = {
  primary: 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30',
  secondary: 'bg-surface hover:bg-surface-200 text-gray-200',
  ghost: 'bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}
```

---

#### Sprint 3.2: 登录页面

```typescript
// frontend/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Login failed')
      }

      const data = await response.json()
      localStorage.setItem('token', data.access_token)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-surface to-primary-900/20">
      <div className="w-full max-w-md p-8 space-y-8 bg-surface/50 backdrop-blur-xl rounded-2xl border border-gray-800 shadow-2xl">
        <div className="text-center">
          <Logo className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Welcome to K-Dense</h1>
          <p className="mt-2 text-gray-400">Research. Analyze. Synthesize.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
          />

          <Input
            label="Password"
            name="password"
            type="password"
            required
            placeholder="••••••••"
          />

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-gray-400">
          Don't have an account?{' '}
          <a href="/register" className="text-primary-400 hover:text-primary-300">
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}
```

---

#### Sprint 3.3: 会话聊天界面（核心功能）

```typescript
// frontend/app/session/[id]/page.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { EventStream } from '@/components/chat/EventStream'
import { ChatInput } from '@/components/chat/ChatInput'
import { FileBrowser } from '@/components/chat/FileBrowser'
import { Header } from '@/components/layout/Header'

export default function SessionPage() {
  const params = useParams()
  const sessionId = params.id as string

  const [events, setEvents] = useState<Array<{
    type: string
    content?: string
    author?: string
    timestamp?: string
    files_created?: string[]
  }>>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const streamEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const sendMessage = async (message: string, files?: File[]) => {
    setIsStreaming(true)
    const controller = new AbortController()
    setAbortController(controller)

    // 添加用户消息
    setEvents(prev => [...prev, {
      type: 'user_message',
      content: message,
      timestamp: new Date().toLocaleTimeString()
    }])

    try {
      const queryParams = new URLSearchParams({ message })
      const response = await fetch(
        `/api/sessions/${sessionId}/events?${queryParams}`,
        { signal: controller.signal }
      )

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader!.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              setIsStreaming(false)
              continue
            }

            try {
              const event = JSON.parse(data)
              setEvents(prev => [...prev, { ...event, timestamp: new Date().toLocaleTimeString() }])
            } catch (e) {
              console.error('Failed to parse event:', e)
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setEvents(prev => [...prev, {
          type: 'error',
          content: error.message,
          timestamp: new Date().toLocaleTimeString()
        }])
      }
      setIsStreaming(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* 主聊天区域 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <EventStream events={events} />
            <div ref={streamEndRef} />
          </div>

          <ChatInput
            onSend={sendMessage}
            disabled={isStreaming}
            onCancel={() => abortController?.abort()}
            isStreaming={isStreaming}
          />
        </div>

        {/* 右侧文件浏览器 */}
        <aside className="w-80 border-l border-gray-800 bg-surface/50">
          <FileBrowser sessionId={sessionId} />
        </aside>
      </div>
    </div>
  )
}
```

---

#### Sprint 3.4: 事件流组件

```typescript
// frontend/components/chat/EventStream.tsx
import { cn } from '@/lib/utils'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { FileIcon, CheckCircle, AlertCircle, Activity } from 'lucide-react'

interface Event {
  type: string
  content?: string
  author?: string
  name?: string
  arguments?: any
  response?: any
  files_created?: string[]
  duration?: number
  timestamp?: string
}

export function EventStream({ events }: { events: Event[] }) {
  return (
    <div className="space-y-4">
      {events.map((event, i) => (
        <EventItem key={i} event={event} />
      ))}
    </div>
  )
}

function EventItem({ event }: { event: Event }) {
  switch (event.type) {
    case 'user_message':
      return (
        <div className="flex justify-end">
          <div className="max-w-2xl px-4 py-3 bg-primary-600 text-white rounded-2xl rounded-tr-sm">
            <p className="whitespace-pre-wrap">{event.content}</p>
            <p className="text-xs text-primary-200 mt-1">{event.timestamp}</p>
          </div>
        </div>
      )

    case 'message':
      return (
        <div className="flex justify-start">
          <div className="max-w-2xl px-4 py-3 bg-surface rounded-2xl rounded-tl-sm border border-gray-800">
            {event.author && (
              <p className="text-xs font-medium text-primary-400 mb-1">{event.author}</p>
            )}
            <p className="whitespace-pre-wrap text-gray-200">{event.content}</p>
            <p className="text-xs text-gray-500 mt-1">{event.timestamp}</p>
          </div>
        </div>
      )

    case 'function_call':
      return (
        <div className="flex justify-start">
          <div className="max-w-2xl px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-mono text-yellow-400">{event.name}</span>
            </div>
            {event.arguments && (
              <CodeBlock code={JSON.stringify(event.arguments, null, 2)} language="json" />
            )}
          </div>
        </div>
      )

    case 'function_response':
      return (
        <div className="flex justify-start">
          <div className="max-w-2xl px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm font-mono text-green-400">{event.name}</span>
            </div>
            {event.response && (
              <CodeBlock code={JSON.stringify(event.response, null, 2)} language="json" />
            )}
          </div>
        </div>
      )

    case 'completed':
      return (
        <div className="flex justify-center">
          <div className="px-6 py-4 bg-primary-500/10 border border-primary-500/30 rounded-xl text-center">
            <CheckCircle className="w-6 h-6 text-primary-400 mx-auto mb-2" />
            <p className="text-white font-medium">Analysis Complete</p>
            {event.duration && (
              <p className="text-sm text-gray-400 mt-1">Duration: {event.duration.toFixed(1)}s</p>
            )}
            {event.files_created && event.files_created.length > 0 && (
              <div className="mt-3 text-left">
                <p className="text-xs text-gray-400 mb-1">Files created:</p>
                <ul className="space-y-1">
                  {event.files_created.map((f, j) => (
                    <li key={j} className="text-sm text-primary-300 flex items-center gap-2">
                      <FileIcon className="w-3 h-3" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )

    case 'error':
      return (
        <div className="flex justify-center">
          <div className="px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-red-200 font-medium">Error</p>
            <p className="text-sm text-red-300 mt-1">{event.content}</p>
          </div>
        </div>
      )

    default:
      return null
  }
}
```

---

### Phase 4: 端到端测试（Week 4）

#### Sprint 4.1: Playwright 测试

```typescript
// e2e/tests/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should register a new user', async ({ page }) => {
    await page.goto('/register')

    await page.fill('[name="email"]', 'e2e@test.com')
    await page.fill('[name="password"]', 'TestPass123!')
    await page.fill('[name="full_name"]', 'E2E Test User')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('header')).toContainText('E2E Test User')
  })

  test('should login existing user', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name="email"]', 'existing@test.com')
    await page.fill('[name="password"]', 'TestPass123!')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/dashboard')
  })

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name="email"]', 'wrong@test.com')
    await page.fill('[name="password"]', 'WrongPassword')
    await page.click('button[type="submit"]')

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
  })
})
```

```typescript
// e2e/tests/session.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Session Management', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'TestPass123!')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should create new session', async ({ page }) => {
    await page.click('[data-testid="new-session"]')

    await expect(page).toHaveURL(/\/session\/[a-f0-9-]+/)
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
  })

  test('should send message and receive response', async ({ page }) => {
    // 创建会话
    await page.click('[data-testid="new-session"]')
    await page.waitForSelector('[data-testid="chat-input"]')

    // 发送消息
    await page.fill('[data-testid="chat-input"]', 'Analyze this data')
    await page.keyboard.press('Enter')

    // 等待响应
    await expect(page.locator('[data-testid="event-stream"]')).toContainText('Analyzing')
  })

  test('should upload file', async ({ page }) => {
    await page.click('[data-testid="new-session"]')

    // 上传文件
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles('e2e/fixtures/test.csv')

    await expect(page.locator('[data-testid="file-list"]'))
      .toContainText('test.csv')
  })
})
```

---

## 项目目录结构

```
k-dense-clone/
├── backend/
│   ├── api/
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── sessions.py
│   │       └── files.py
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   ├── db/
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── session.py
│   │   │   ├── message.py
│   │   │   └── file.py
│   │   ├── migrations/
│   │   └── database.py
│   ├── services/
│   │   ├── auth.py
│   │   ├── session_manager.py
│   │   └── file_manager.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   └── session.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_db/
│   │   ├── test_services/
│   │   └── test_api/
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── dashboard/
│   │   ├── session/[id]/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── chat/
│   │   │   ├── EventStream.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── FileBrowser.tsx
│   │   ├── layout/
│   │   │   └── Header.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── CodeBlock.tsx
│   ├── hooks/
│   │   └── useAuth.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── styles/
│   │   └── globals.css
│   ├── package.json
│   └── tailwind.config.ts
├── e2e/
│   ├── tests/
│   │   ├── auth.spec.ts
│   │   └── session.spec.ts
│   └── fixtures/
├── scripts/
│   ├── dev.sh
│   └── test.sh
├── workspaces/
├── docker-compose.yml
├── .env.example
├── .gitignore
└── DEVELOPMENT_PLAN.md
```

---

## 下一步

1. **配置 pytest 和 Playwright**
2. **编写第一个测试（User 模型）**
3. **实现数据库层**
4. **逐步完成 TDD 循环**

是否开始实现？
