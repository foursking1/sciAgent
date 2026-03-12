# DataScientist 集成测试记录

> 记录将 `agentic-data-scientist` 集成到 SciAgent 项目中的完整过程和解决方案

**测试日期**: 2026-03-06
**项目**: SciAgent (原 k-dense-clone)
**DataScientist 版本**: 0.2.2 (git+https://gitee.com/foursking1/agentic-data-scientist)

---

## 一、环境配置

### 1.1 Python 版本要求

```bash
# DataScientist 需要 Python 3.12+
python3.12 --version  # Python 3.12.13
```

### 1.2 使用 uv 管理依赖

```bash
# 进入 backend 目录
cd /home/foursking/Documents/projects/sci-agent/backend

# 初始化 uv 项目 (如果还没有)
uv init --name sciagent-backend

# 设置 Python 版本
echo "3.12" > .python-version

# 同步依赖
uv sync --python 3.12
```

### 1.3 pyproject.toml 配置

```toml
[project]
name = "sciagent-backend"
version = "0.1.0"
description = "SciAgent Backend - AI-driven scientific research automation"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "python-multipart>=0.0.20",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.6.0",
    "sqlalchemy[asyncio]>=2.0.36",
    "aiomysql>=0.2.0",
    "redis>=5.2.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "bcrypt>=4.2.0",
    "httpx>=0.27.2",
    "aiohttp>=3.11.0",
    "pytest>=8.3.4",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=6.0.0",
    "pytest-mock>=3.14.0",
    "aiosqlite>=0.22.1",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.3.4",
    "pytest-asyncio>=0.24.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
pythonpath = ["."]
```

### 1.4 安装 agentic-data-scientist

```bash
cd backend
uv pip install "agentic-data-scientist @ git+https://gitee.com/foursking1/agentic-data-scientist"
```

### 1.5 环境变量配置 (.env)

```bash
# Anthropic API 配置 (使用阿里云 DashScope 代理)
ANTHROPIC_BASE_URL=https://coding.dashscope.aliyuncs.com/apps/anthropic
ANTHROPIC_API_KEY=sk-sp-0134cf73dd28424c908f6f115bbd26b9
CODING_MODEL=qwen3.5-plus

# OpenRouter API 配置 (用于 ADK agents)
OPENROUTER_API_KEY=sk-8Ys4yWKAkwGDi1k8Q2QlUlylWqloirFDZbKrz45Cp6E8mUtF
OPENROUTER_API_BASE=https://openai.sohoyo.io/v1

# 工作区配置
WORKSPACE_BASE=./workspaces

# 禁用 CLAUDECODE 检查 (在 Claude Code 环境中运行时需要)
CLAUDECODE=
```

---

## 二、问题与解决方案

### 问题 1: Python 版本不兼容

**错误信息**:
```
No solution found when resolving dependencies:
Because the current Python version (3.11.7) does not satisfy
Python>=3.12,<3.13 and agentic-data-scientist==0.2.2 depends on
Python>=3.12,<3.13
```

**解决方案**:
```bash
# 使用系统已安装的 Python 3.12
uv sync --python 3.12

# 或更新 .python-version 文件
echo "3.12" > backend/.python-version
```

### 问题 2: 测试导入路径问题

**错误信息**:
```
ModuleNotFoundError: No module named 'backend'
```

**原因**: 在 `backend/` 目录下运行 pytest 时，`backend` 包不在 Python 路径中。

**解决方案 1** - 从项目根目录运行并设置 PYTHONPATH:
```bash
cd /home/foursking/Documents/projects/sci-agent
PYTHONPATH=. backend/.venv/bin/python -m pytest backend/tests/ -v
```

**解决方案 2** - 在 pyproject.toml 中配置 pythonpath:
```toml
[tool.pytest.ini_options]
pythonpath = ["."]
```

### 问题 3: 缺少 aiosqlite 依赖

**错误信息**:
```
ModuleNotFoundError: No module named 'aiosqlite'
```

**解决方案**:
```bash
cd backend
uv add aiosqlite
```

### 问题 4: CLAUDECODE 环境检查

**错误信息**:
```
Error: Claude Code cannot be launched inside another Claude Code session.
Nested sessions share runtime resources and will crash all active sessions.
To bypass this check, unset the CLAUDECODE environment variable.
```

**原因**: 当前在 Claude Code 环境中运行，DataScientist 尝试启动另一个 Claude Code 实例被阻止。

**解决方案**:
```bash
# 在运行测试前清空 CLAUDECODE 环境变量
export CLAUDECODE=''

# 或在测试脚本中设置
os.environ['CLAUDECODE'] = ''
```

### 问题 5: 模型配置错误

**错误信息**:
```
API Error: 400 {"error":{"code":"invalid_parameter_error",
"message":"model `claude-sonnet-4-5-20250929` is not supported."}}
```

**原因**: DashScope 代理不支持默认的 claude-sonnet 模型名称。

**解决方案**: 使用 `CODING_MODEL` 环境变量指定模型:
```bash
# .env 文件配置
CODING_MODEL=qwen3.5-plus
```

### 问题 6: DataScientist 不支持 model 参数

**错误信息**:
```
DataScientist.__init__() got an unexpected keyword argument 'model'
```

**原因**: DataScientist 类不接受 `model` 参数，模型配置通过环境变量读取。

**正确的初始化方式**:
```python
from agentic_data_scientist.core.api import DataScientist

# 模型通过 CODING_MODEL 环境变量配置
ds = DataScientist(
    agent_type="claude_code",
    working_dir="/path/to/workspace",
    auto_cleanup=False,
)
```

---

## 三、测试脚本

### 3.1 单元测试 (Mock 模式)

**文件**: `backend/tests/test_services/test_session_manager.py`

**运行命令**:
```bash
cd /home/foursking/Documents/projects/sci-agent
PYTHONPATH=. backend/.venv/bin/python -m pytest backend/tests/test_services/test_session_manager.py -v
```

**测试覆盖**:
- SessionManager 基础功能 (创建会话、获取会话、添加消息)
- DataScientist 集成 (使用 mock)
- 数据库集成测试

### 3.2 实际调用测试

**文件**: `backend/test_data_scientist.py`

**运行命令**:
```bash
cd /home/foursking/Documents/projects/sci-agent
PYTHONPATH=. backend/.venv/bin/python backend/test_data_scientist.py
```

**测试内容**:
1. 创建会话
2. 流式模式调用 DataScientist
3. 非流式模式调用 DataScientist

---

## 四、测试结果

### 4.1 单元测试结果

```
============================= test session starts ==============================
collected 12 items

backend/tests/test_services/test_session_manager.py::TestSessionManagerBasic::test_create_session PASSED
backend/tests/test_services/test_session_manager.py::TestSessionManagerBasic::test_get_session_no_db PASSED
backend/tests/test_services/test_session_manager.py::TestSessionManagerBasic::test_add_message_no_db PASSED
backend/tests/test_services/test_session_manager.py::TestDataScientistIntegration::test_run_data_scientist_streaming PASSED
backend/tests/test_services/test_session_manager.py::TestDataScientistIntegration::test_run_data_scientist_non_streaming PASSED
backend/tests/test_services/test_session_manager.py::TestDataScientistIntegration::test_run_data_scientist_import_error PASSED
backend/tests/test_services/test_session_manager.py::TestSessionManagerWithDatabase::test_create_session_with_db PASSED
backend/tests/test_services/test_session_manager.py::TestSessionManagerWithDatabase::test_get_session_with_db PASSED
backend/tests/test_services/test_session_manager.py::TestSessionManagerWithDatabase::test_list_sessions PASSED
backend/tests/test_services/test_session_manager.py::TestSessionManagerWithDatabase::test_delete_session PASSED
backend/tests/test_services/test_session_manager.py::TestSessionManagerWithDatabase::test_add_message_with_db PASSED
backend/tests/test_services/test_session_manager.py::TestSessionManagerWithDatabase::test_get_messages PASSED

============================== 12 passed in 0.27s ==============================
```

### 4.2 实际调用测试结果

```
======================================================================
DataScientist 实际调用测试
======================================================================

当前配置:
  ANTHROPIC_BASE_URL: https://coding.dashscope.aliyuncs.com/apps/anthropic
  ANTHROPIC_MODEL: qwen3.5-plus
  CLAUDECODE: ''

[步骤 1] 创建会话...
    ✅ 会话 ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    ✅ 工作目录：./workspaces/99999/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    ✅ Agent 类型：claude_code

[步骤 2] 调用 DataScientist (流式模式)...
    发送消息："你好，请简单介绍一下你自己。"

    --- 事件流 ---
    [message] Preparing Claude Agent (coding mode)...
    [message] Starting Claude Agent (coding mode) with model: qwen3.5-plus
    [message] 用户用中文询问我的身份...
    [message] 你好！我是 Claude，一个由 Anthropic 开发的人工智能助手...
    [message] === Task Completed Successfully ===
    [completed]

    ✅ 共收到 6 个事件

[步骤 3] 调用 DataScientist (非流式模式)...
    发送消息："2+2 等于几？"

    结果：
    - status: completed
    - response: 2+2 等于 4
    - duration: 76.5 秒
    - files_created: pyproject.toml, README.md

======================================================================
✅ 测试完成!
======================================================================
```

---

## 五、核心代码示例

### 5.1 SessionManager 集成 DataScientist

```python
# backend/services/session_manager.py

from agentic_data_scientist.core.api import DataScientist

class SessionManager:
    async def run_data_scientist(
        self,
        session: Session,
        message: str,
        stream: bool = True,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Run DataScientist for a session."""
        try:
            # Create DataScientist instance
            ds = DataScientist(
                agent_type=session.agent_type or "claude_code",
                working_dir=session.working_dir,
                auto_cleanup=False,
            )

            if stream:
                # Stream events
                stream_iterator = await ds.run_async(message, stream=True)
                async for event in stream_iterator:
                    if isinstance(event, dict):
                        event_dict = event
                    elif hasattr(event, 'to_dict'):
                        event_dict = event.to_dict()
                    elif hasattr(event, '__dict__'):
                        event_dict = event.__dict__
                    else:
                        event_dict = {'type': 'message', 'content': str(event)}
                    yield {"data": json.dumps(event_dict)}
            else:
                # Non-streaming mode
                result = await ds.run_async(message, stream=False)
                if isinstance(result, dict):
                    result_dict = result
                elif hasattr(result, 'to_dict'):
                    result_dict = result.to_dict()
                elif hasattr(result, '__dict__'):
                    result_dict = result.__dict__
                else:
                    result_dict = {'type': 'result', 'content': str(result)}
                yield {"data": json.dumps(result_dict)}

        except ImportError as e:
            error_event = {
                "type": "error",
                "message": f"DataScientist not available: {str(e)}",
                "timestamp": datetime.now().isoformat(),
            }
            yield {"data": json.dumps(error_event)}

        except Exception as e:
            error_event = {
                "type": "error",
                "message": f"Error running DataScientist: {str(e)}",
                "timestamp": datetime.now().isoformat(),
            }
            yield {"data": json.dumps(error_event)}
```

### 5.2 API 路由调用

```python
# backend/api/routes/sessions.py

@router.post("/{session_id}/chat")
async def chat(session_id: str, message_data: MessageCreate, ...):
    """Send a chat message and stream the response."""

    async def event_generator():
        # Store user message
        user_message = await session_manager.add_message(...)

        # Stream from DataScientist
        async for event in session_manager.run_data_scientist(
            session=session,
            message=message_data.content,
            stream=True,
        ):
            yield f"{event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
```

---

## 六、快速开始

### 6.1 环境准备

```bash
# 1. 克隆项目
cd /home/foursking/Documents/projects/sci-agent

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API keys

# 3. 安装依赖
cd backend
uv sync --python 3.12
uv pip install "agentic-data-scientist @ git+https://gitee.com/foursking1/agentic-data-scientist"
```

### 6.2 运行测试

```bash
# 单元测试
cd /home/foursking/Documents/projects/sci-agent
PYTHONPATH=. backend/.venv/bin/python -m pytest backend/tests/test_services/test_session_manager.py -v

# 实际调用测试
PYTHONPATH=. backend/.venv/bin/python backend/test_data_scientist.py
```

### 6.3 启动服务

```bash
# 后端服务
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 前端服务
cd frontend
npm run dev
```

---

## 七、注意事项

1. **Claude Code 环境限制**: 在 Claude Code 中运行测试时，必须设置 `CLAUDECODE=''` 才能启动嵌套的 Claude Code 实例。

2. **DashScope 代理配置**: 使用阿里云 DashScope 作为 Anthropic 代理时，需要设置:
   - `ANTHROPIC_BASE_URL`
   - `CODING_MODEL` (不是 `ANTHROPIC_MODEL`)

3. **工作区隔离**: 每个会话有独立的工作目录 `/workspaces/{user_id}/{session_id}/`，用于文件隔离。

4. **流式 vs 非流式**:
   - 流式模式 (`stream=True`): 实时返回事件，适合聊天界面
   - 非流式模式 (`stream=False`): 等待完成后返回结果，适合简单查询

5. **错误处理**: DataScientist 调用可能失败 (API 错误、网络问题等)，需要捕获异常并返回友好的错误信息。

---

## 八、参考链接

- [agentic-data-scientist GitHub](https://gitee.com/foursking1/agentic-data-scientist)
- [SciAgent 项目](https://github.com/K-Dense-AI/sci-agent)
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk)
- [DashScope 文档](https://help.aliyun.com/zh/dashscope/)

---

**最后更新**: 2026-03-06
**维护者**: Development Team
