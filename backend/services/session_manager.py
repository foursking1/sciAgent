"""
Session Manager Service

Manages user sessions, working directories, and DataScientist integration.

Optimizations:
- DataScientist 实例按 Session 缓存复用
- 空闲实例自动清理 (TTL)
- 模块预加载
"""

import asyncio
import json
import logging
import os
import shutil
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, AsyncGenerator, Dict, Optional

from backend.core.config import settings
from backend.db.models.message import Message, MessageRole
from backend.db.models.session import Session
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("SessionManager")

# Session mode types
VALID_MODES = (
    "data-question",
    "scientific-experiment",
    "data-extraction",
    "paper-writing",
)

# Mode to agent_type mapping
MODE_AGENT_MAP = {
    "data-question": "claude_code",
    "scientific-experiment": "adk",
    "data-extraction": "claude_code",  # disabled for now
    "paper-writing": "claude_code",  # uses claude_code with auto command
}


@dataclass
class CachedDataScientist:
    """缓存的 DataScientist 实例"""

    instance: Any  # DataScientist 实例
    agent_type: str
    working_dir: str
    created_at: datetime
    last_accessed: datetime
    call_count: int = 0


class DataScientistCache:
    """
    DataScientist 实例缓存

    按 session_id 缓存实例，支持：
    - 实例复用（同一 Session 多次请求）
    - TTL 自动清理（默认 30 分钟空闲）
    - 最大实例数限制
    """

    DEFAULT_TTL_MINUTES = 30
    DEFAULT_MAX_INSTANCES = 50

    def __init__(
        self,
        ttl_minutes: int = DEFAULT_TTL_MINUTES,
        max_instances: int = DEFAULT_MAX_INSTANCES,
    ):
        self._cache: Dict[str, CachedDataScientist] = {}
        self._ttl = timedelta(minutes=ttl_minutes)
        self._max_instances = max_instances
        self._module_loaded = False
        self._lock = asyncio.Lock()

        # 统计
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
        }

    async def preload_module(self) -> bool:
        """预加载 DataScientist 模块（不创建实例）"""
        if self._module_loaded:
            return True

        try:
            logger.info("预加载 DataScientist 模块...")
            start_time = time.time()

            self._module_loaded = True

            elapsed = time.time() - start_time
            logger.info(f"✅ DataScientist 模块预加载完成，耗时：{elapsed:.2f}s")
            return True
        except Exception as e:
            logger.error(f"❌ DataScientist 模块预加载失败：{e}")
            return False

    async def get_or_create(
        self,
        session_id: str,
        agent_type: str,
        working_dir: str,
    ) -> Any:
        """
        获取或创建 DataScientist 实例

        Args:
            session_id: 会话 ID
            agent_type: Agent 类型
            working_dir: 工作目录

        Returns:
            DataScientist 实例
        """
        async with self._lock:
            # 检查缓存
            if session_id in self._cache:
                cached = self._cache[session_id]

                # 验证配置是否匹配（防止配置变化）
                if (
                    cached.agent_type == agent_type
                    and cached.working_dir == working_dir
                ):
                    cached.last_accessed = datetime.now()
                    cached.call_count += 1
                    self._stats["hits"] += 1
                    logger.info(
                        f"✅ DataScientist 缓存命中：session={session_id}, 调用次数={cached.call_count}"
                    )
                    return cached.instance
                else:
                    # 配置变化，需要重建
                    logger.info(
                        f"DataScientist 配置变化，重建实例：session={session_id}"
                    )
                    del self._cache[session_id]

            # 缓存未命中，创建新实例
            self._stats["misses"] += 1

            # 检查是否需要清理
            await self._cleanup_if_needed()

            # 创建新实例
            logger.info(
                f"创建新 DataScientist 实例：session={session_id}, agent={agent_type}"
            )
            start_time = time.time()

            from agentic_data_scientist.core.api import DataScientist

            ds = DataScientist(
                agent_type=agent_type,
                working_dir=working_dir,
                auto_cleanup=False,
            )

            elapsed = time.time() - start_time
            logger.info(f"✅ DataScientist 实例创建完成，耗时：{elapsed:.2f}s")

            # 缓存实例
            self._cache[session_id] = CachedDataScientist(
                instance=ds,
                agent_type=agent_type,
                working_dir=working_dir,
                created_at=datetime.now(),
                last_accessed=datetime.now(),
                call_count=1,
            )

            return ds

    async def _cleanup_if_needed(self):
        """清理过期或超量实例"""
        now = datetime.now()

        # 1. 清理过期实例
        expired = [
            sid
            for sid, cached in self._cache.items()
            if now - cached.last_accessed > self._ttl
        ]

        for sid in expired:
            del self._cache[sid]
            self._stats["evictions"] += 1
            logger.info(f"清理过期 DataScientist 实例：session={sid}")

        # 2. 如果仍然超过最大数量，清理最久未访问的
        if len(self._cache) >= self._max_instances:
            # 按 last_accessed 排序，删除最旧的
            sorted_items = sorted(self._cache.items(), key=lambda x: x[1].last_accessed)

            # 删除最旧的一半
            to_remove = sorted_items[: len(sorted_items) // 2]
            for sid, _ in to_remove:
                del self._cache[sid]
                self._stats["evictions"] += 1
                logger.info(f"清理最久未访问 DataScientist 实例：session={sid}")

    def invalidate(self, session_id: str):
        """使指定会话的缓存失效"""
        if session_id in self._cache:
            del self._cache[session_id]
            logger.info(f"使缓存失效：session={session_id}")

    def get_stats(self) -> dict:
        """获取缓存统计"""
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = self._stats["hits"] / total if total > 0 else 0

        return {
            **self._stats,
            "total_requests": total,
            "hit_rate": f"{hit_rate:.1%}",
            "cached_instances": len(self._cache),
        }


class SessionManager:
    """
    Manages user sessions and DataScientist integration.

    Features:
    - Working directory management
    - DataScientist lifecycle (session-scoped caching)
    - Session state caching
    - Message history storage
    """

    def __init__(self, max_ds_instances: int = 50, ds_ttl_minutes: int = 30):
        # In-memory cache for active sessions
        self._active_sessions: dict[str, Any] = {}

        # DataScientist 实例缓存
        self._ds_cache = DataScientistCache(
            ttl_minutes=ds_ttl_minutes,
            max_instances=max_ds_instances,
        )

        # 统计信息
        self._stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_duration": 0.0,
        }

        logger.info(
            f"SessionManager 初始化完成 (max_instances={max_ds_instances}, ttl={ds_ttl_minutes}min)"
        )

    def get_stats(self) -> dict:
        """获取统计信息"""
        avg_duration = (
            self._stats["total_duration"] / self._stats["total_requests"]
            if self._stats["total_requests"] > 0
            else 0
        )
        return {
            **self._stats,
            "avg_duration": avg_duration,
            "ds_cache": self._ds_cache.get_stats(),
        }

    async def preload_data_scientist(self) -> bool:
        """
        预加载 DataScientist 模块

        Returns:
            True if successful, False otherwise
        """
        return await self._ds_cache.preload_module()

    def _get_workspace_path(self, user_id: int, session_id: str) -> str:
        """Get the workspace path for a session"""
        return os.path.join(settings.WORKSPACE_BASE, str(user_id), session_id)

    async def create_session(
        self,
        user_id: int,
        agent_type: str = "claude_code",
        mode: str = "data-question",
        db: Optional[AsyncSession] = None,
    ) -> Session:
        """
        Create a new session for a user.

        Args:
            user_id: ID of the user
            agent_type: Type of agent to use (default: "claude_code")
            mode: Session mode ('data-question', 'scientific-experiment', 'data-extraction', 'paper-writing')
            db: Database session

        Returns:
            Created Session object
        """
        start_time = time.time()

        session_id = str(uuid.uuid4())
        working_dir = self._get_workspace_path(user_id, session_id)

        # Determine agent_type based on mode
        if mode in MODE_AGENT_MAP:
            agent_type = MODE_AGENT_MAP[mode]

        logger.info(
            f"创建新会话：user_id={user_id}, agent_type={agent_type}, mode={mode}, session_id={session_id}"
        )

        # Create working directory
        os.makedirs(working_dir, exist_ok=True)
        logger.debug(f"工作目录已创建：{working_dir}")

        # Create database record
        session = Session(
            id=session_id,
            user_id=user_id,
            working_dir=working_dir,
            agent_type=agent_type,
            current_mode=mode,
        )

        if db:
            db.add(session)
            await db.commit()
            await db.refresh(session)
            logger.info("会话已保存到数据库")

        # 缓存活跃会话
        self._active_sessions[session_id] = {
            "session": session,
            "created_at": datetime.now(),
            "last_accessed": datetime.now(),
        }

        elapsed = time.time() - start_time
        logger.info(f"✅ 会话创建完成，耗时：{elapsed:.3f}s")

        return session

    async def get_session(
        self,
        session_id: str,
        user_id: Optional[int] = None,
        db: Optional[AsyncSession] = None,
    ) -> Optional[Session]:
        """
        Get a session by ID.
        """
        start_time = time.time()

        # 先检查缓存
        if session_id in self._active_sessions:
            cached = self._active_sessions[session_id]
            cached["last_accessed"] = datetime.now()
            logger.debug(f"会话 {session_id} 命中缓存")
            return cached["session"]

        if db is None:
            return None

        query = select(Session).where(Session.id == session_id)

        if user_id is not None:
            query = query.where(Session.user_id == user_id)

        result = await db.execute(query)
        session = result.scalar_one_or_none()

        if session:
            # 缓存会话
            self._active_sessions[session_id] = {
                "session": session,
                "created_at": session.created_at,
                "last_accessed": datetime.now(),
            }
            logger.debug(f"会话 {session_id} 已从数据库加载并缓存")

        elapsed = time.time() - start_time
        logger.debug(f"获取会话耗时：{elapsed:.3f}s")

        return session

    async def switch_mode(
        self,
        session_id: str,
        new_mode: str,
        user_id: int,
        db: AsyncSession,
    ) -> Optional[Session]:
        """
        Switch session mode.

        Available modes:
        - data-question: 数据问题 - uses claude_code agent
        - scientific-experiment: 科学实验 - uses adk agent
        - data-extraction: 数据抽取 - uses claude_code agent
        - paper-writing: 论文写作 - uses adk agent

        Args:
            session_id: Session ID
            new_mode: New mode
            user_id: User ID for authorization
            db: Database session

        Returns:
            Updated Session object or None if not found
        """
        if new_mode not in VALID_MODES:
            raise ValueError(f"Invalid mode: {new_mode}. Valid modes: {VALID_MODES}")

        # Fetch session directly from database (bypass cache to ensure it's attached to this db session)
        query = select(Session).where(
            Session.id == session_id, Session.user_id == user_id
        )
        result = await db.execute(query)
        session = result.scalar_one_or_none()

        if not session:
            return None

        # Update mode and agent_type
        session.current_mode = new_mode
        session.agent_type = MODE_AGENT_MAP.get(new_mode, "claude_code")
        session.updated_at = datetime.now()

        await db.commit()
        await db.refresh(session)

        # Update cache
        if session_id in self._active_sessions:
            self._active_sessions[session_id]["session"] = session

        # 使 DataScientist 缓存失效（因为 agent_type 变化）
        self._ds_cache.invalidate(session_id)

        logger.info(f"Session {session_id} switched to {new_mode} mode")

        return session

    async def list_sessions(
        self,
        user_id: int,
        db: AsyncSession,
    ) -> list[Session]:
        """
        List all sessions for a user with preview of last message.
        """
        logger.info(f"列出用户 {user_id} 的所有会话")

        result = await db.execute(
            select(Session)
            .where(Session.user_id == user_id)
            .order_by(Session.created_at.desc())
        )
        sessions = list(result.scalars().all())

        # Add preview (last message) for each session
        for session in sessions:
            try:
                # Get the last message
                msg_result = await db.execute(
                    select(Message)
                    .where(Message.session_id == session.id)
                    .order_by(Message.created_at.desc())
                    .limit(1)
                )
                last_msg = msg_result.scalar_one_or_none()
                if last_msg:
                    # Truncate preview to 100 chars
                    session.preview = last_msg.content[:100] + (
                        "..." if len(last_msg.content) > 100 else ""
                    )
            except Exception as e:
                logger.warning(f"Failed to get preview for session {session.id}: {e}")

        logger.info(f"找到 {len(sessions)} 个会话")
        return sessions

    async def delete_session(
        self,
        session_id: str,
        user_id: Optional[int] = None,
        db: Optional[AsyncSession] = None,
        cleanup_workspace: bool = True,
    ) -> bool:
        """
        Delete a session and optionally clean up its workspace.
        """
        logger.info(f"删除会话：{session_id}")

        if db is None:
            return False

        session = await self.get_session(session_id, user_id, db)
        if session is None:
            logger.warning(f"会话 {session_id} 不存在")
            return False

        workspace_path = session.working_dir

        # Delete from database
        await db.delete(session)
        await db.commit()
        logger.debug("会话已从数据库删除")

        # Clean up workspace
        if cleanup_workspace and os.path.exists(workspace_path):
            try:
                shutil.rmtree(workspace_path)
                logger.info(f"工作目录已清理：{workspace_path}")
            except Exception as e:
                logger.warning(f"清理工作目录失败 {workspace_path}: {e}")

        # Remove from cache
        self._active_sessions.pop(session_id, None)
        logger.debug("会话已从缓存移除")

        # 使 DataScientist 缓存失效
        self._ds_cache.invalidate(session_id)

        logger.info(f"✅ 会话 {session_id} 删除完成")
        return True

    async def add_message(
        self,
        session_id: str,
        content: str,
        role: str = MessageRole.USER,
        db: Optional[AsyncSession] = None,
    ) -> Optional[Message]:
        """
        Add a message to a session.
        """
        if db is None:
            return None

        message = Message(
            session_id=session_id,
            content=content,
            role=role,
        )

        db.add(message)
        await db.commit()
        await db.refresh(message)

        logger.debug(
            f"消息已添加：session_id={session_id}, role={role}, content_length={len(content)}"
        )

        return message

    async def get_messages(
        self,
        session_id: str,
        db: AsyncSession,
        limit: int | None = None,
    ) -> list[Message]:
        """
        Get messages for a session.
        """
        if limit:
            logger.debug(f"获取会话 {session_id} 的消息，限制 {limit} 条")
        else:
            logger.debug(f"获取会话 {session_id} 的所有消息")

        query = (
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.created_at.asc())
        )
        if limit:
            query = query.limit(limit)

        result = await db.execute(query)
        messages = list(result.scalars().all())

        logger.debug(f"找到 {len(messages)} 条消息")
        return messages

    async def run_data_scientist(
        self,
        session: Session,
        message: str,
        stream: bool = True,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Run DataScientist for a session.

        Args:
            session: Session object
            message: User message to process
            stream: Whether to stream events

        Yields:
            Event dictionaries
        """
        start_time = time.time()
        self._stats["total_requests"] += 1

        session_id = session.id
        agent_type = session.agent_type or "claude_code"

        # 禁用 CLAUDECODE 检查 (在 Claude Code 环境中运行时需要)
        os.environ["CLAUDECODE"] = ""

        logger.info("=" * 60)
        logger.info("开始执行 DataScientist 请求")
        logger.info(f"  会话 ID: {session_id}")
        logger.info(f"  Agent 类型：{agent_type}")
        logger.info(f"  流式模式：{stream}")
        logger.info(
            f"  消息内容：{message[:50]}..."
            if len(message) > 50
            else f"  消息内容：{message}"
        )

        try:
            # 获取或创建 DataScientist 实例（复用缓存）
            ds = await self._ds_cache.get_or_create(
                session_id=session_id,
                agent_type=agent_type,
                working_dir=session.working_dir,
            )

            # 更新最后访问时间
            if session_id in self._active_sessions:
                self._active_sessions[session_id]["last_accessed"] = datetime.now()

            event_count = 0
            if stream:
                logger.info("开始流式执行...")

                # Stream events
                stream_iterator = await ds.run_async(message, stream=True)
                async for event in stream_iterator:
                    event_count += 1

                    # Handle event
                    if isinstance(event, dict):
                        event_dict = event
                    elif hasattr(event, "to_dict"):
                        event_dict = event.to_dict()
                    elif hasattr(event, "__dict__"):
                        event_dict = event.__dict__
                    else:
                        event_dict = {"type": "message", "content": str(event)}

                    # 日志记录事件详情
                    event_type = event_dict.get("type", "unknown")
                    content = event_dict.get("content", "")
                    if content and len(content) > 100:
                        content = content[:100] + "..."

                    # 记录完整的事件结构（调试用）
                    logger.debug(f"  事件 {event_count}: type={event_type}")

                    yield event_dict

            else:
                logger.info("开始非流式执行...")

                # Non-streaming mode
                result = await ds.run_async(message, stream=False)
                event_count = 1

                # Handle result
                if isinstance(result, dict):
                    result_dict = result
                elif hasattr(result, "to_dict"):
                    result_dict = result.to_dict()
                elif hasattr(result, "__dict__"):
                    result_dict = result.__dict__
                else:
                    result_dict = {"type": "result", "content": str(result)}

                logger.debug(
                    f"结果：{json.dumps(result_dict, ensure_ascii=False)[:200]}..."
                )
                yield result_dict

            elapsed = time.time() - start_time
            self._stats["successful_requests"] += 1
            self._stats["total_duration"] += elapsed

            logger.info("=" * 60)
            logger.info("✅ DataScientist 执行完成")
            logger.info(f"  总耗时：{elapsed:.2f}s")
            logger.info(f"  事件数量：{event_count}")
            logger.info(
                f"  成功请求：{self._stats['successful_requests']}/{self._stats['total_requests']}"
            )
            logger.info(f"  缓存统计：{self._ds_cache.get_stats()}")

        except ImportError as e:
            elapsed = time.time() - start_time
            self._stats["failed_requests"] += 1

            logger.error("=" * 60)
            logger.error("❌ DataScientist 导入失败")
            logger.error(f"  错误：{e}")
            logger.error(f"  耗时：{elapsed:.2f}s")

            error_event = {
                "type": "error",
                "message": f"DataScientist not available: {str(e)}",
                "timestamp": datetime.now().isoformat(),
            }
            yield {"data": json.dumps(error_event)}

        except Exception as e:
            elapsed = time.time() - start_time
            self._stats["failed_requests"] += 1

            logger.error("=" * 60)
            logger.error("❌ DataScientist 执行错误")
            logger.error(f"  错误类型：{type(e).__name__}")
            logger.error(f"  错误信息：{str(e)}")
            logger.error(f"  耗时：{elapsed:.2f}s")

            error_event = {
                "type": "error",
                "message": f"Error running DataScientist: {str(e)}",
                "timestamp": datetime.now().isoformat(),
            }
            yield {"data": json.dumps(error_event)}


# Global instance
session_manager = SessionManager()
