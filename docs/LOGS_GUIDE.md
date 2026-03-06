# 运行日志查看指南

## 一、日志位置

### 1.1 日志文件

```
backend/logs/backend.log    # 主日志文件
backend/logs/stdout.log     # 后台运行时的标准输出
```

### 1.2 日志格式

```
2026-03-06 11:33:34 - SessionManager - INFO - 消息内容
```

- **时间戳**: `2026-03-06 11:33:34`
- **模块名**: `SessionManager`, `DataScientist`, etc.
- **级别**: `INFO`, `DEBUG`, `ERROR`, `WARNING`
- **消息**: 具体内容

---

## 二、启动服务查看日志

### 2.1 使用启动脚本

```bash
cd /home/foursking/Documents/projects/sci-agent/backend

# 方式 1: 前台运行 (日志输出到控制台 + 文件)
./start.sh

# 方式 2: 后台运行 (日志只输出到文件)
./start.sh --daemon

# 方式 3: 查看实时日志
./start.sh --logs
```

### 2.2 直接运行

```bash
cd backend

# 前台运行，日志输出到控制台
uv run uvicorn main:app --host 0.0.0.0 --port 8000

# 或输出到文件
uv run uvicorn main:app --host 0.0.0.0 --port 8000 2>&1 | tee logs/backend.log
```

---

## 三、实时查看日志

### 3.1 使用 tail 命令

```bash
# 实时查看最新日志 (Ctrl+C 退出)
tail -f backend/logs/backend.log

# 查看最新 100 行 + 实时跟踪
tail -n 100 -f backend/logs/backend.log
```

### 3.2 使用 start.sh 脚本

```bash
cd backend
./start.sh --logs
```

---

## 四、日志级别过滤

### 4.1 查看特定级别日志

```bash
# 只看 ERROR 日志
grep "ERROR" backend/logs/backend.log

# 只看 WARNING 及以上
grep -E "(ERROR|WARNING|CRITICAL)" backend/logs/backend.log

# 排除 DEBUG 日志
grep -v "DEBUG" backend/logs/backend.log
```

### 4.2 查看特定模块日志

```bash
# SessionManager 相关
grep "SessionManager" backend/logs/backend.log

# DataScientist 相关
grep "DataScientist" backend/logs/backend.log

# 特定会话日志
grep "会话 ID" backend/logs/backend.log
```

---

## 五、运行测试查看日志

### 5.1 DataScientist 测试

```bash
cd /home/foursking/Documents/projects/sci-agent

# 运行测试，日志输出到控制台
PYTHONPATH=. backend/.venv/bin/python backend/test_data_scientist.py
```

### 5.2 单元测试

```bash
cd /home/foursking/Documents/projects/sci-agent

# 运行单元测试
PYTHONPATH=. backend/.venv/bin/python -m pytest backend/tests/test_services/test_session_manager.py -v

# 运行并捕获日志
PYTHONPATH=. backend/.venv/bin/python -m pytest backend/tests/ -v 2>&1 | tee test.log
```

---

## 六、日志示例

### 6.1 启动日志

```
============================================================
2026-03-06 11:33:34 - SciAgent - INFO - Starting SciAgent backend...
2026-03-06 11:33:34 - SciAgent - INFO -   Database: Creating tables...
2026-03-06 11:33:35 - SciAgent - INFO -   Database: Tables created
2026-03-06 11:33:35 - SciAgent - INFO -   Preloading DataScientist module...
2026-03-06 11:33:37 - SessionManager - INFO - ✅ DataScientist 预加载完成，耗时：3.00s
2026-03-06 11:33:37 - SciAgent - INFO -   DataScientist: Preloaded successfully
2026-03-06 11:33:37 - SciAgent - INFO - SciAgent backend is ready!
============================================================
```

### 6.2 请求日志

```
============================================================
2026-03-06 11:35:40 - SessionManager - INFO - 开始执行 DataScientist 请求
2026-03-06 11:35:40 - SessionManager - INFO -   会话 ID: 6607a549-b476-49ca-87c0-a45beee4127d
2026-03-06 11:35:40 - SessionManager - INFO -   Agent 类型：claude_code
2026-03-06 11:35:40 - SessionManager - INFO -   流式模式：True
2026-03-06 11:35:40 - SessionManager - INFO -   消息内容：你好，请简单介绍一下你自己。
2026-03-06 11:35:40 - SessionManager - INFO - 正在创建 DataScientist 实例...
2026-03-06 11:35:40 - SessionManager - INFO - ✅ DataScientist 实例创建成功，耗时：0.00s
2026-03-06 11:35:40 - SessionManager - INFO - 开始流式执行...
...
2026-03-06 11:36:40 - SessionManager - INFO - ✅ DataScientist 执行完成
2026-03-06 11:36:40 - SessionManager - INFO -   总耗时：60.24s
2026-03-06 11:36:40 - SessionManager - INFO -   事件数量：4
============================================================
```

### 6.3 错误日志

```
============================================================
2026-03-06 11:36:40 - SessionManager - ERROR - ❌ DataScientist 执行错误
2026-03-06 11:36:40 - SessionManager - ERROR -   错误类型：ProcessError
2026-03-06 11:36:40 - SessionManager - ERROR -   错误信息：Command failed with exit code 1
2026-03-06 11:36:40 - SessionManager - ERROR -   耗时：60.24s
============================================================
```

---

## 七、日志轮转 (生产环境)

### 7.1 使用 logrotate

创建 `/etc/logrotate.d/sciagent`:

```
/home/foursking/Documents/projects/sci-agent/backend/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 foursking foursking
}
```

### 7.2 定时清理日志

```bash
# 只保留最近 7 天的日志
find backend/logs/ -name "*.log" -mtime +7 -delete
```

---

## 八、快速参考

| 命令 | 说明 |
|------|------|
| `./start.sh` | 前台启动服务 |
| `./start.sh --daemon` | 后台启动服务 |
| `./start.sh --logs` | 查看实时日志 |
| `tail -f logs/backend.log` | 实时跟踪日志 |
| `grep "ERROR" logs/backend.log` | 查找错误日志 |
| `grep "SessionManager" logs/backend.log` | 查找特定模块日志 |

---

**最后更新**: 2026-03-06
**维护者**: Development Team
