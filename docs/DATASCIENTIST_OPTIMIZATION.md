# DataScientist 性能优化笔记

> 记录 DataScientist 模块的性能优化方案和日志增强

**优化日期**: 2026-03-06
**文件位置**: `backend/services/session_manager.py`

---

## 一、优化方案

### 1.1 提前加载模块

**优化前**: 每次调用时才导入 DataScientist 模块，首次调用延迟高

**优化后**: 启动时预加载模块，减少首次调用延迟

```python
class DataScientistPool:
    """DataScientist 实例池，用于预加载和复用实例"""

    async def initialize(self):
        """初始化实例池（预加载 DataScientist）"""
        from agentic_data_scientist.core.api import DataScientist
        logger.info("✅ DataScientist 模块加载成功")
```

**使用方式**:
```python
# 应用启动时预加载
await session_manager.preload_data_scientist()

# 或手动触发
await session_manager._ds_pool.initialize()
```

### 1.2 会话缓存

**优化内容**:
- 活跃会话缓存在内存中
- 自动更新最后访问时间
- 删除会话时自动清理缓存

```python
self._active_sessions: dict[str, Any] = {}

# 缓存命中日志
logger.debug(f"会话 {session_id} 命中缓存")
logger.debug(f"会话 {session_id} 已从数据库加载并缓存")
```

### 1.3 统计信息

**新增功能**: 实时统计请求数据

```python
self._stats = {
    'total_requests': 0,
    'successful_requests': 0,
    'failed_requests': 0,
    'total_duration': 0.0,
}

# 获取统计信息
stats = session_manager.get_stats()
# 返回：
# {
#     'total_requests': 10,
#     'successful_requests': 9,
#     'failed_requests': 1,
#     'total_duration': 123.45,
#     'avg_duration': 12.35,
# }
```

### 1.4 日志增强

**日志级别**: INFO（生产环境推荐）

**日志格式**:
```
2026-03-06 11:33:34 - SessionManager - INFO - 消息内容
```

**关键日志点**:

| 日志点 | 级别 | 说明 |
|--------|------|------|
| SessionManager 初始化 | INFO | 服务启动完成 |
| 预加载 DataScientist | INFO | 模块预热开始/完成 |
| 创建会话 | INFO | 会话 ID、用户 ID、agent 类型 |
| 执行请求 | INFO | 会话 ID、消息内容、模式 |
| 实例创建 | INFO | 创建耗时 |
| 事件流 | DEBUG | 每个事件的类型和内容摘要 |
| 请求完成 | INFO | 总耗时、事件数量、统计 |
| 错误处理 | ERROR | 错误类型、详细信息 |

---

## 二、性能对比

### 2.1 预加载 vs 普通加载

```
测试场景：首次调用 DataScientist

普通加载:
- 模块导入：~0.5s
- 实例创建：~0.1s
- 首次调用总计：~0.6s

预加载:
- 模块导入：~3.0s (启动时完成)
- 实例创建：~0.0s (复用已加载模块)
- 首次调用总计：~0.1s

优化效果：首次调用延迟降低 83%
```

### 2.2 主要耗时分析

```
完整调用流程 (claude_code agent):

1. DataScientist 实例创建：0.00s ✅
2. Agent 初始化：0.01s ✅
3. Git clone skills：60.00s ⚠️ (超时，可优化点)
4. Claude Code 启动：0.24s ✅
5. API 调用：~5-10s (取决于模型和网络)

总耗时：~65-70s

主要瓶颈：Git clone skills (可跳过)
```

### 2.3 优化建议

**方案 1: 跳过 skills 克隆**
```bash
# 设置环境变量
export DS_SKIP_SKILLS_CLONE=1
```

**方案 2: 使用 ADK agent 类型**
```python
# 使用 ADK 而不是 claude_code
session = await manager.create_session(
    user_id=user_id,
    agent_type='adk',  # 更轻量
)
```

**方案 3: 预克隆 skills 到共享目录**
```bash
# 预克隆到固定位置
git clone https://gitee.com/foursking1/claude-scientific-skills \
    /opt/shared/claude-scientific-skills

# 配置环境变量指向该目录
export SCIENTIFIC_SKILLS_PATH=/opt/shared/claude-scientific-skills
```

---

## 三、使用示例

### 3.1 完整调用流程

```python
import asyncio
import time
from services.session_manager import SessionManager

async def main():
    # 1. 创建 SessionManager
    manager = SessionManager(ds_pool_size=2)

    # 2. 预加载 DataScientist (可选，建议应用启动时执行)
    await manager.preload_data_scientist()

    # 3. 创建会话
    session = await manager.create_session(
        user_id=123,
        agent_type='claude_code',
        db=None,
    )

    # 4. 执行请求（流式）
    start = time.time()
    async for event in manager.run_data_scientist(
        session=session,
        message='分析这个数据集',
        stream=True,
    ):
        event_data = json.loads(event['data'])
        print(f"事件：{event_data['type']}")

    elapsed = time.time() - start
    print(f"耗时：{elapsed:.2f}s")

    # 5. 查看统计信息
    stats = manager.get_stats()
    print(f"平均耗时：{stats['avg_duration']:.2f}s")

asyncio.run(main())
```

### 3.2 日志输出示例

```
2026-03-06 11:33:34 - SessionManager - INFO - SessionManager 初始化完成
2026-03-06 11:33:34 - SessionManager - INFO - 开始预加载 DataScientist 模块...
2026-03-06 11:33:37 - SessionManager - INFO - ✅ DataScientist 模块加载成功
2026-03-06 11:33:37 - SessionManager - INFO - ✅ DataScientist 实例池初始化完成，耗时：3.00s
2026-03-06 11:33:37 - SessionManager - INFO - 创建新会话：user_id=123, agent_type=claude_code
2026-03-06 11:33:37 - SessionManager - INFO - ✅ 会话创建完成，耗时：0.004s
2026-03-06 11:33:37 - SessionManager - INFO - ============================================================
2026-03-06 11:33:37 - SessionManager - INFO - 开始执行 DataScientist 请求
2026-03-06 11:33:37 - SessionManager - INFO -   会话 ID: xxx-xxx-xxx
2026-03-06 11:33:37 - SessionManager - INFO -   Agent 类型：claude_code
2026-03-06 11:33:37 - SessionManager - INFO -   流式模式：True
2026-03-06 11:33:37 - SessionManager - INFO -   消息内容：分析这个数据集
2026-03-06 11:33:37 - SessionManager - INFO - 正在创建 DataScientist 实例...
2026-03-06 11:33:37 - SessionManager - INFO - ✅ DataScientist 实例创建成功，耗时：0.00s
2026-03-06 11:33:37 - SessionManager - INFO - 开始流式执行...
2026-03-06 11:33:45 - SessionManager - INFO - ============================================================
2026-03-06 11:33:45 - SessionManager - INFO - ✅ DataScientist 执行完成
2026-03-06 11:33:45 - SessionManager - INFO -   总耗时：8.23s
2026-03-06 11:33:45 - SessionManager - INFO -   事件数量：15
2026-03-06 11:33:45 - SessionManager - INFO -   成功请求：1/1
```

---

## 四、配置文件

### 4.1 环境变量 (.env)

```bash
# DataScientist 配置
CODING_MODEL=qwen3.5-plus
CLAUDECODE=  # 禁用 CLAUDECODE 检查

# 可选：跳过 skills 克隆
DS_SKIP_SKILLS_CLONE=1

# 可选：预克隆 skills 路径
SCIENTIFIC_SKILLS_PATH=/opt/shared/claude-scientific-skills
```

### 4.2 日志配置

```python
# 生产环境：INFO 级别
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 开发环境：DEBUG 级别
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

---

## 五、监控和告警

### 5.1 性能监控

```python
# 定期检查统计信息
async def monitor_performance():
    stats = session_manager.get_stats()

    # 告警条件
    if stats['avg_duration'] > 30:  # 平均耗时 > 30s
        logger.warning(f"DataScientist 平均耗时过长：{stats['avg_duration']:.2f}s")

    if stats['total_requests'] > 0:
        error_rate = stats['failed_requests'] / stats['total_requests']
        if error_rate > 0.1:  # 错误率 > 10%
            logger.error(f"DataScientist 错误率过高：{error_rate:.2%}")
```

### 5.2 健康检查

```python
@app.get("/health")
async def health_check():
    """检查 DataScientist 是否可用"""
    try:
        # 尝试预加载
        await session_manager.preload_data_scientist()
        return {"status": "healthy", "data_scientist": "available"}
    except Exception as e:
        return {"status": "unhealthy", "data_scientist": str(e)}
```

---

## 六、待优化项

| 优化项 | 优先级 | 预计效果 | 状态 |
|--------|--------|----------|------|
| 模块预加载 | 高 | 首次调用延迟 -83% | ✅ 完成 |
| 日志增强 | 高 | 问题排查效率 +50% | ✅ 完成 |
| 会话缓存 | 中 | 数据库查询 -30% | ✅ 完成 |
| 统计信息 | 中 | 性能监控可视化 | ✅ 完成 |
| 跳过 skills 克隆 | 高 | 调用耗时 -60s | ⏳ 待实现 |
| 实例池复用 | 低 | 实例创建 -50% | ⏳ 待实现 |
| 并发请求支持 | 低 | 吞吐量 +100% | ⏳ 待实现 |

---

**最后更新**: 2026-03-06
**维护者**: Development Team
