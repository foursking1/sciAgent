# SciAgent - 待办工作清单

> 最后更新：2026-03-05
> 当前状态：MVP 核心功能完成，API 层和 agentic 集成待实现

---

## 任务看板

### 🔴 高优先级 (P0) - MVP 必需

#### 1. 实现 API 路由层

**状态**: ⏳ 待开始
**预计工时**: 2-3 天

- [ ] **backend/api/routes/auth.py** - 认证 API
  - [ ] `POST /api/auth/register` - 用户注册
  - [ ] `POST /api/auth/login` - 用户登录
  - [ ] `POST /api/auth/logout` - 用户登出
  - [ ] `GET /api/auth/me` - 获取当前用户信息

- [ ] **backend/api/routes/sessions.py** - 会话 API
  - [ ] `POST /api/sessions` - 创建新会话
  - [ ] `GET /api/sessions` - 获取用户会话列表
  - [ ] `GET /api/sessions/{id}` - 获取会话详情
  - [ ] `DELETE /api/sessions/{id}` - 删除会话
  - [ ] `POST /api/sessions/{id}/messages` - 发送消息 (非流式)
  - [ ] `GET /api/sessions/{id}/events` - SSE 流式事件 ⭐核心功能

- [ ] **backend/api/routes/files.py** - 文件 API
  - [ ] `POST /api/files/upload` - 上传文件
  - [ ] `GET /api/files/{session_id}` - 列出会话文件
  - [ ] `GET /api/files/{session_id}/{path}` - 下载文件
  - [ ] `DELETE /api/files/{path}` - 删除文件

**依赖**:
- ✅ 数据库模型已完成
- ✅ 认证服务已完成
- ⏳ SessionManager 需要集成 agentic-data-scientist

---

#### 2. 实现 SessionManager

**状态**: ⏳ 待开始
**预计工时**: 2-3 天
**核心文件**: `backend/services/session_manager.py`

需要实现的功能:

- [ ] **工作区管理**
  - [ ] 创建用户工作区目录 `/workspaces/{user_id}/{session_id}/`
  - [ ] 工作区清理（可选保留文件）
  - [ ] 工作区文件列表

- [ ] **DataScientist 集成** ⭐核心
  - [ ] 导入 `agentic_data_scientist.core.api.DataScientist`
  - [ ] 创建 DataScientist 实例（指定 working_dir）
  - [ ] 调用 `run_async(message, files, stream=True/False)`
  - [ ] 处理事件流输出

- [ ] **会话状态管理**
  - [ ] 内存缓存活跃会话
  - [ ] 会话持久化到 MySQL
  - [ ] 会话历史消息存储

- [ ] **错误处理**
  - [ ] DataScientist 异常捕获
  - [ ] 工作区目录权限检查
  - [ ] 资源限制（内存、时间）

**参考代码** (来自 agentic-data-scientist):
```python
from agentic_data_scientist.core.api import DataScientist

ds = DataScientist(
    agent_type="claude_code",  # 或 "adk"
    working_dir="/workspaces/user123/session_xxx",
    auto_cleanup=False
)

# 流式模式
async for event in ds.run_async(message="Analyze data", stream=True):
    yield event

# 非流式模式
result = await ds.run_async(message="Analyze data", stream=False)
```

---

#### 3. 实现 FastAPI 主应用

**状态**: ⏳ 待开始
**预计工时**: 1 天
**核心文件**: `backend/main.py`

- [ ] **FastAPI 应用初始化**
  ```python
  from fastapi import FastAPI
  from fastapi.middleware.cors import CORSMiddleware

  app = FastAPI(title="K-Dense Web Clone")

  # CORS 配置
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:3000"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

- [ ] **路由注册**
  ```python
  from backend.api.routes import auth, sessions, files

  app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
  app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
  app.include_router(files.router, prefix="/api/files", tags=["files"])
  ```

- [ ] **全局异常处理**
  ```python
  @app.exception_handler(HTTPException)
  @app.exception_handler(RequestValidationError)
  @app.exception_handler(Exception)
  ```

- [ ] **健康检查端点**
  ```python
  @app.get("/health")
  async def health_check():
      return {"status": "healthy"}
  ```

---

#### 4. 创建 Docker 镜像

**状态**: ⏳ 待开始
**预计工时**: 1 天

- [ ] **backend/Dockerfile**
  ```dockerfile
  FROM python:3.12-slim

  WORKDIR /app
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt

  COPY . .

  # 安装 agentic-data-scientist
  RUN pip install agentic-data-scientist>=0.2.0

  # 安装 Node.js (Claude Code 需要)
  RUN apt-get update && apt-get install -y nodejs npm

  # 安装 Docker CLI (用于沙箱)
  RUN apt-get update && apt-get install -y docker.io

  EXPOSE 8000
  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

- [ ] **frontend/Dockerfile**
  ```dockerfile
  FROM node:20-alpine

  WORKDIR /app
  COPY package*.json ./
  RUN npm ci

  COPY . .
  RUN npm run build

  EXPOSE 3000
  CMD ["npm", "start"]
  ```

- [ ] **更新 docker-compose.yml**
  - 添加健康检查
  - 配置 volume 持久化
  - 设置环境变量

---

### 🟡 中优先级 (P1) - 功能完善

#### 5. agentic-data-scientist 深度集成

**状态**: ⏳ 待开始
**预计工时**: 2-3 天

- [ ] **Skills 自动克隆**
  - [ ] 启动时克隆 `claude-scientific-skills` 到工作区
  - [ ] 支持自定义 skills 目录

- [ ] **MCP 服务器配置**
  - [ ] Context7 MCP 集成
  - [ ] 其他科学数据库 MCP

- [ ] **工具调用可视化**
  - [ ] 前端显示 function_call/function_response
  - [ ] 工具调用历史

- [ ] **文件处理增强**
  - [ ] 大文件分块上传
  - [ ] 科学数据格式解析
  - [ ] 文件预览

---

#### 6. 前端功能完善

**状态**: ⏳ 部分完成
**预计工时**: 2 天

- [ ] **仪表盘增强**
  - [ ] 会话搜索/筛选
  - [ ] 会话统计信息
  - [ ] 最近活动显示

- [ ] **聊天界面增强**
  - [ ] 消息编辑/删除
  - [ ] 对话历史加载更多
  - [ ] 导出会话为 PDF/Markdown

- [ ] **文件浏览器增强**
  - [ ] 文件拖拽上传
  - [ ] 文件夹上传
  - [ ] 文件预览（图片、CSV、JSON）

- [ ] **设置页面**
  - [ ] API Key 管理
  - [ ] 用户资料编辑
  - [ ] 主题切换（深色/浅色）

---

#### 7. 测试完善

**状态**: ⏳ 部分完成
**预计工时**: 2 天

- [ ] **后端 API 集成测试**
  ```python
  # backend/tests/test_api/test_auth.py
  async def test_register_login_flow():
  async def test_create_session_requires_auth():
  async def test_sse_streaming():
  ```

- [ ] **前端组件测试** (Vitest)
  ```typescript
  // frontend/components/chat/EventStream.test.tsx
  describe('EventStream', () => {
    it('renders user messages correctly')
    it('renders agent messages correctly')
    it('handles function_call events')
  })
  ```

- [ ] **端到端测试** (Playwright)
  ```typescript
  // e2e/tests/auth.spec.ts
  test('full registration and login flow')
  test('session creation and messaging')

  // e2e/tests/session.spec.ts
  test('file upload and analysis')
  test('SSE event streaming')
  ```

---

### 🟢 低优先级 (P2) - 优化增强

#### 8. 性能优化

**状态**: ⏳ 待开始
**预计工时**: 1-2 天

- [ ] **数据库优化**
  - [ ] 添加查询索引
  - [ ] 连接池配置优化
  - [ ] 慢查询日志

- [ ] **缓存层**
  - [ ] Redis 缓存会话数据
  - [ ] API 响应缓存
  - [ ] 静态文件 CDN

- [ ] **前端优化**
  - [ ] 代码分割 (lazy loading)
  - [ ] 图片懒加载
  - [ ] Service Worker 缓存

---

#### 9. 安全加固

**状态**: ⏳ 待开始
**预计工时**: 1 天

- [ ] **认证安全**
  - [ ] JWT 刷新 token
  - [ ] 密码强度验证
  - [ ] 登录失败限制

- [ ] **API 安全**
  - [ ] Rate Limiting (限流)
  - [ ] CSRF 保护
  - [ ] SQL 注入防护验证

- [ ] **工作区安全**
  - [ ] 目录遍历防护
  - [ ] 文件上传大小限制
  - [ ] 危险文件类型拦截

---

#### 10. 监控与日志

**状态**: ⏳ 待开始
**预计工时**: 1 天

- [ ] **结构化日志**
  ```python
  import structlog

  logger = structlog.get_logger()
  logger.info("session_created", session_id=xxx, user_id=yyy)
  ```

- [ ] **指标收集**
  - [ ] Prometheus 指标
  - [ ] 请求延迟监控
  - [ ] 错误率监控

- [ ] **告警系统**
  - [ ] 错误率阈值告警
  - [ ] 资源使用告警

---

## 技术债务清单

| 问题 | 描述 | 优先级 | 解决方案 |
|------|------|--------|----------|
| SQLite vs MySQL | 测试用 SQLite，生产用 MySQL | 中 | 统一使用 MySQL Docker 容器测试 |
| 硬编码路径 | 部分路径写死在代码中 | 低 | 改为配置项 |
| 缺少 API 文档 | OpenAPI 文档不完整 | 中 | 完善 FastAPI docstrings |
| 前端类型安全 | 部分组件缺少严格类型 | 低 | 补充 TypeScript 类型定义 |
| 错误处理不统一 | 各模块错误处理不一致 | 中 | 统一异常处理框架 |

---

## 里程碑计划

### Sprint 1 (Week 1-2): API 层完成
- [ ] 实现所有 API 路由
- [ ] 完成 SessionManager 集成
- [ ] Docker 镜像可用
- [ ] 端到端跑通注册→登录→创建会话→发送消息流程

### Sprint 2 (Week 3-4): 测试与优化
- [ ] 补充 API 集成测试
- [ ] Playwright E2E 测试
- [ ] 性能优化
- [ ] 安全加固

### Sprint 3 (Week 5): 部署
- [ ] 生产环境配置
- [ ] CI/CD 流水线
- [ ] 监控告警
- [ ] 文档完善

---

## 相关文件

- **开发计划**: `DEVELOPMENT_PLAN.md`
- **开发总结**: `DEVELOPMENT_SUMMARY.md`
- **README**: `README.md`
- **API 文档**: `backend/docs/API.md` (待创建)
- **部署指南**: `docs/DEPLOYMENT.md` (待创建)

---

## 快速参考

### 运行测试
```bash
cd k-dense-clone
PYTHONPATH=./backend pytest backend/tests/ -v
```

### 启动开发环境
```bash
docker-compose up -d mysql redis
cd backend && uvicorn main:app --reload
cd frontend && npm run dev
```

### 查看项目状态
```bash
git status
git log --oneline
```

---

**最后更新**: 2026-03-05
**维护者**: Development Team
