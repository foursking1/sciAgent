# SciAgent

> AI 驱动的科学研究自动化平台 - 从问题到解决方案的端到端自动化

## 产品功能

SciAgent 是一个面向科研人员的 AI 助手平台，通过多 Agent 协作实现科学研究的自动化工作流。

### 核心能力

- 🔬 **数据分析** - 支持 200+ 科学数据格式，自动分析并生成可视化图表
- 📝 **论文写作** - 学术写作助手，支持多种论文模板和引用格式
- 🧪 **实验设计** - 科学实验方案设计与分析
- 📊 **数据抽取** - 数据提取、清洗与转换

### 工作模式

平台提供 4 种专业工作模式，针对不同研究场景优化：

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **data-question** | 数据问题 | 数据查询、统计分析、可视化 |
| **scientific-experiment** | 科学实验 | 实验设计、假设验证、结果分析 |
| **data-extraction** | 数据抽取 | 数据提取、格式转换、清洗 |
| **paper-writing** | 论文写作 | 学术写作、文献综述、论文润色 |

### 会话管理

- 创建/删除/查看会话
- 会话公开分享（支持预览图和 PDF 下载）
- 消息历史记录
- 实时 SSE 流式响应
- 任务队列系统（支持取消、状态查询）

## 技术栈

### 后端
- **框架**: FastAPI 0.115
- **数据库**: MySQL 8.0 + SQLAlchemy 2.0 (async)
- **缓存**: Redis 7
- **核心引擎**: agentic-data-scientist >= 0.2.2
- **认证**: JWT + bcrypt

### 前端
- **框架**: Next.js 14 + TypeScript
- **样式**: TailwindCSS (科技简约设计)
- **通信**: HTTP + SSE (Server-Sent Events)

### 测试
- **单元测试**: pytest + pytest-asyncio
- **端到端**: Playwright

## 快速开始

### 开发环境

```bash
# 克隆仓库
git clone https://gitee.com/foursking1/sci-agent.git
cd sci-agent

# 克隆核心引擎（开发环境需要）
git clone https://gitee.com/foursking1/agentic-data-scientist.git

# 复制环境变量
cp .env.example .env
# 编辑 .env 填入 API keys

# 启动开发环境（热重载）
docker compose -f docker-compose.dev.yml up -d

# 查看日志
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend
```

### 生产环境

```bash
# 启动生产环境
docker compose up -d

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend
```

### 访问应用

- **前端**: http://localhost:3000
- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs

## 项目结构

```
sciagent/
├── backend/
│   ├── api/routes/        # API 路由 (auth, sessions, files, data_sources)
│   ├── db/models/         # SQLAlchemy 数据模型
│   ├── services/          # 业务逻辑 (auth, session_manager, task_queue)
│   └── tests/             # pytest 测试用例
├── frontend/
│   ├── app/               # Next.js 页面
│   ├── components/        # UI 组件 (chat, layout, ui)
│   └── lib/               # API 客户端、工具函数
├── scientific-skills/     # 科学分析技能包
├── workspaces/            # 用户工作区
└── docker-compose.yml
```

## 环境配置

```bash
# .env
# MySQL
MYSQL_ROOT_PASSWORD=your-root-password
MYSQL_PASSWORD=your-db-password

# JWT
JWT_SECRET=your-secret-key

# API Keys (必需)
ANTHROPIC_API_KEY=sk-ant-xxx
LITELLM_API_KEY=xxx
LITELLM_API_BASE=https://openrouter.ai/api/v1

# Model Configuration
DEFAULT_MODEL=google/gemini-2.5-pro
REVIEW_MODEL=google/gemini-2.5-pro
CODING_MODEL=claude-sonnet-4-5-20250929
```

完整配置请参考 [.env.example](./.env.example)。

## API 示例

### 创建会话

```bash
curl -X POST http://localhost:8000/api/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"mode": "data-question"}'
```

### 发送消息并获取任务 ID

```bash
curl -X POST http://localhost:8000/api/sessions/{id}/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "分析这个数据集并生成可视化图表"}'
```

### 流式获取事件 (SSE)

```bash
curl -N "http://localhost:8000/api/sessions/{id}/events?task_id={task_id}" \
  -H "Authorization: Bearer <token>"
```

## 开发指南

详细开发文档请参考 [DEVELOPMENT.md](./DEVELOPMENT.md)。

### 本地开发

```bash
# 后端
cd backend
uv sync
uv run uvicorn backend.main:app --reload

# 前端
cd frontend
npm install
npm run dev

# 测试
uv run pytest backend/tests/ -v
```

## 设计系统

**理念**: 科学 × 简约 × 未来感

- **主色调**: 深空蓝 (#0080ff)
- **强调色**: 量子紫 (#8b5cf6)
- **背景**: 深空灰 (#0a0a0f)
- **字体**: Inter (UI) + JetBrains Mono (代码)

## 参考资料

- [agentic-data-scientist](https://github.com/K-Dense-AI/agentic-data-scientist)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Next.js 文档](https://nextjs.org/docs)

## License

MIT
