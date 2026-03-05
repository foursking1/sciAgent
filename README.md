# K-Dense Web Clone

> AI 驱动的研究自动化平台 - 从问题到解决方案的端到端自动化

## 产品定位

类似 [K-Dense Web](https://www.k-dense.ai/) 的 AI 研究代理平台，集成 [agentic-data-scientist](https://github.com/K-Dense-AI/agentic-data-scientist) 框架，提供：

- 🔬 **科学数据分析** - 支持 200+ 科学数据格式
- 🤖 **多 Agent 工作流** - Planning → Execution → Summary
- 📊 **可视化输出** - 图表、报告、论文生成
- 🔌 **插件扩展** - 250+ 数据库连接器

## 技术栈

### 后端
- **框架**: FastAPI 0.115
- **数据库**: MySQL 8.0 + aiomysql
- **缓存**: Redis 7
- **核心引擎**: agentic-data-scientist >= 0.2.0
- **认证**: JWT + bcrypt

### 前端
- **框架**: Next.js 14 + TypeScript
- **样式**: TailwindCSS (科技简约设计)
- **通信**: HTTP + SSE (Server-Sent Events)

### 测试
- **单元测试**: pytest + pytest-asyncio
- **端到端**: Playwright

## 快速开始

### 1. 环境准备

```bash
# 克隆仓库
git clone <repo-url>
cd k-dense-clone

# 复制环境变量
cp .env.example .env
# 编辑 .env 填入 API keys
```

### 2. 启动服务

```bash
# Docker Compose 一键启动
docker-compose up -d

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 3. 访问应用

- **前端**: http://localhost:3000
- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs

## 项目结构

```
k-dense-clone/
├── backend/
│   ├── api/routes/        # API 路由 (auth, sessions, files)
│   ├── db/models/         # 数据模型 (MySQL)
│   ├── services/          # 业务逻辑 (auth, session_manager)
│   └── tests/             # 测试用例
├── frontend/
│   ├── app/               # Next.js 页面
│   ├── components/        # UI 组件
│   └── styles/            # 设计系统
├── e2e/                   # Playwright 端到端测试
├── workspaces/            # 用户工作区
├── docker-compose.yml
└── DEVELOPMENT_PLAN.md    # 详细开发计划
```

## 核心功能

### 1. 用户认证
- [x] JWT Token 认证
- [x] 用户注册/登录
- [ ] API Key 管理

### 2. 会话管理
- [x] 创建/删除会话
- [x] 会话列表
- [x] 消息历史

### 3. Agentic 分析
- [ ] SSE 流式事件
- [ ] 文件上传/解析
- [ ] 代码执行 (Docker 沙箱)
- [ ] 科学 Skills 集成

### 4. 文件管理
- [ ] 工作区文件浏览器
- [ ] 生成文件下载

## 开发模式

### TDD 工作流

```bash
# 1. 运行测试 (Red)
uv run pytest backend/tests/ -v

# 2. 实现代码让测试通过 (Green)
# 编辑 backend/services/...

# 3. 重构 (Refactor)

# 4. 重复
```

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

### 端到端测试

```bash
npx playwright test
```

## 设计系统

**理念**: 科学 × 简约 × 未来感

- **主色调**: 深空蓝 (#0080ff)
- **强调色**: 量子紫 (#8b5cf6)
- **背景**: 深空灰 (#0a0a0f)
- **字体**: Inter (UI) + JetBrains Mono (代码)

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
OPENROUTER_API_KEY=xxx

# 工作区
WORKSPACE_BASE=./workspaces
```

## API 示例

### 创建会话

```bash
curl -X POST http://localhost:8000/api/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"agent_type": "claude_code"}'
```

### 发送消息 (SSE)

```bash
curl -N "http://localhost:8000/api/sessions/{id}/events?message=Analyze+this+data" \
  -H "Authorization: Bearer <token>"
```

## 测试覆盖率

```bash
# 后端
pytest backend/tests/ --cov=backend --cov-report=html

# 前端
npm test -- --coverage

# 端到端
npx playwright test --reporter=html
```

## 部署

### 生产环境配置

```bash
# docker-compose.prod.yml
# - 启用 HTTPS
# - 配置 Nginx 反向代理
# - 设置数据库备份
# - 配置日志收集
```

## 参考资料

- [agentic-data-scientist 文档](https://github.com/K-Dense-AI/agentic-data-scientist)
- [K-Dense Web](https://www.k-dense.ai/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Next.js 文档](https://nextjs.org/docs)

## License

MIT

## Contributing

欢迎提交 Issue 和 PR！
