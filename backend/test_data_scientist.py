#!/usr/bin/env python
"""
DataScientist 实际调用测试脚本

运行方式:
    uv run python test_data_scientist.py
"""

import asyncio
import json
import logging
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.session_manager import SessionManager

# 配置日志 - 同时输出到控制台和文件
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            log_dir / "test_data_scientist.log", mode="w", encoding="utf-8"
        ),
    ],
)
logger = logging.getLogger("DataScientistTest")


async def test_performance():
    """性能测试：预加载 vs 普通加载"""

    logger.info("=" * 70)
    logger.info("DataScientist 性能测试")
    logger.info("=" * 70)

    # 创建临时工作目录
    tmpdir = tempfile.mkdtemp()
    os.environ["WORKSPACE_BASE"] = tmpdir

    try:
        # 测试 1: 预加载
        logger.info("\n[测试 1] 预加载 DataScientist...")
        manager = SessionManager()

        preload_start = time.time()
        await manager.preload_data_scientist()
        preload_time = time.time() - preload_start
        logger.info(f"    预加载耗时：{preload_time:.2f}s")

        # 创建会话
        session = await manager.create_session(
            user_id=99999,
            agent_type="claude_code",
            db=None,
        )

        # 测试第一次调用（已预加载）
        print("\n[测试 2] 第一次调用 (已预加载)...")
        call1_start = time.time()
        event_count = 0
        async for event in manager.run_data_scientist(
            session=session,
            message="请回答 1+1 等于几，只回答数字。",
            stream=False,
        ):
            event_count += 1
        call1_time = time.time() - call1_start
        print(f"    第一次调用耗时：{call1_time:.2f}s")
        print(f"    收到事件数：{event_count}")

        # 获取统计信息
        stats = manager.get_stats()
        print("\n[统计信息]")
        print(f"    总请求数：{stats['total_requests']}")
        print(f"    成功请求：{stats['successful_requests']}")
        print(f"    平均耗时：{stats['avg_duration']:.2f}s")

        # 清理
        shutil.rmtree(tmpdir, ignore_errors=True)

        print("\n" + "=" * 70)
        print("✅ 性能测试完成!")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ 测试失败：{type(e).__name__}: {e}")
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise

    # 创建临时工作目录
    tmpdir = tempfile.mkdtemp()
    os.environ["WORKSPACE_BASE"] = tmpdir

    try:
        manager = SessionManager()

        # 1. 创建会话
        print("\n[步骤 1] 创建会话...")
        session = await manager.create_session(
            user_id=99999,
            agent_type="claude_code",  # 或者 'adk'
            db=None,
        )
        print(f"    ✅ 会话 ID: {session.id}")
        print(f"    ✅ 工作目录：{session.working_dir}")
        print(f"    ✅ Agent 类型：{session.agent_type}")

        # 2. 调用 DataScientist (流式模式)
        print("\n[步骤 2] 调用 DataScientist (流式模式)...")
        print('    发送消息："你好，请简单介绍一下你自己。"\n')
        print("    --- 事件流 ---")

        event_count = 0
        async for event in manager.run_data_scientist(
            session=session,
            message="你好，请简单介绍一下你自己。",
            stream=True,
        ):
            event_count += 1
            event_data = json.loads(event.get("data", "{}"))
            event_type = event_data.get("type", "unknown")
            content = event_data.get("content", "")

            # 格式化输出
            if content:
                if len(content) > 100:
                    content = content[:100] + "..."
                print(f"    [{event_type}] {content}")
            else:
                print(f"    [{event_type}]")

        print(f"\n    ✅ 共收到 {event_count} 个事件")

        # 3. 非流式模式测试
        print("\n[步骤 3] 调用 DataScientist (非流式模式)...")
        print('    发送消息："2+2 等于几？"\n')

        result_events = []
        async for event in manager.run_data_scientist(
            session=session,
            message="2+2 等于几？请用中文回答。",
            stream=False,
        ):
            result_events.append(event)
            event_data = json.loads(event.get("data", "{}"))
            print(f"    结果：{json.dumps(event_data, ensure_ascii=False, indent=2)}")

        # 清理
        shutil.rmtree(tmpdir, ignore_errors=True)

        print("\n" + "=" * 70)
        print("✅ 测试完成!")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ 测试失败：{type(e).__name__}: {e}")
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise


if __name__ == "__main__":
    # 检查环境变量
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("❌ 错误：需要设置 ANTHROPIC_API_KEY 环境变量")
        print("\n请在 .env 文件中配置或运行:")
        print("    export ANTHROPIC_API_KEY=your-key")
        sys.exit(1)

    asyncio.run(test_performance())
