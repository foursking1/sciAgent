# 开发环境指南

本项目提供了支持热重载的开发环境，修改代码后无需重新构建 Docker 镜像。

## 快速开始

### 方式一：开发环境（推荐用于开发）

```bash
# 启动开发环境（支持热重载）
docker compose -f docker-compose.dev.yml up -d

# 查看日志
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend

# 停止开发环境
docker compose -f docker-compose.dev.yml down
```

### 方式二：生产环境（用于部署）

```bash
# 启动生产环境
docker compose up -d

# 停止生产环境
docker compose down
```

## 开发环境特性

### 后端热重载

- 修改 `backend/` 目录下的代码会自动触发服务重启
- 使用 Uvicorn 的 `--reload` 模式
- 日志级别设置为 `debug` 便于调试

### 前端热重载

- 修改 `frontend/` 目录下的代码会自动刷新浏览器
- 使用 Next.js 的开发模式
- 支持 React Fast Refresh

## 目录结构

```
sci-agent/
├── docker-compose.yml          # 生产环境配置
├── docker-compose.dev.yml      # 开发环境配置（新增）
├── backend/
│   ├── Dockerfile              # 生产环境 Dockerfile
│   ├── Dockerfile.dev          # 开发环境 Dockerfile（新增）
│   ├── start.sh                # 生产环境启动脚本
│   └── start.dev.sh            # 开发环境启动脚本（新增）
└── frontend/
    ├── Dockerfile              # 生产环境 Dockerfile
    └── Dockerfile.dev          # 开发环境 Dockerfile（新增）
```

## 开发工作流

1. 启动开发环境：
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

2. 修改代码：
   - 后端：编辑 `backend/` 下的文件
   - 前端：编辑 `frontend/` 下的文件

3. 观察自动重载：
   - 后端：控制台会显示 "Reloading..."
   - 前端：浏览器会自动刷新

4. 查看日志：
   ```bash
   # 后端日志
   docker compose -f docker-compose.dev.yml logs -f backend

   # 前端日志
   docker compose -f docker-compose.dev.yml logs -f frontend
   ```

## 常见问题

### 前端热重载不生效？

确保 `docker-compose.dev.yml` 中的 volume 挂载正确：
- `./frontend:/app:delegated` - 挂载源代码
- `/app/node_modules` - 排除 node_modules
- `/app/.next` - 排除构建缓存

### 后端修改后没有重启？

检查：
1. 是否使用了 `docker-compose.dev.yml`
2. 日志中是否有 "Reloading..." 输出
3. 修改的文件是否在 `backend/` 目录下

### 如何切换回生产环境？

```bash
# 停止开发环境
docker compose -f docker-compose.dev.yml down

# 启动生产环境
docker compose up -d
```

### 需要重新构建开发镜像吗？

只有在以下情况需要重新构建：
- 修改了 `requirements.txt`（Python 依赖）
- 修改了 `package.json`（Node 依赖）
- 修改了 `Dockerfile.dev`

重新构建命令：
```bash
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml up -d
```
