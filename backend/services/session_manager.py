"""
Session Manager Service

Manages user sessions, working directories, and DataScientist integration.

Optimizations:
- DataScientist 实例池预加载
- 异步日志记录
- 会话状态缓存
"""
import os
import asyncio
import shutil
import logging
import time
from pathlib import Path
from typing import AsyncGenerator, Optional, Any, Dict
from datetime import datetime
import uuid
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.db.models.session import Session
from backend.db.models.message import Message, MessageRole
from backend.db.models.file import File
from backend.core.config import settings


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('SessionManager')


class DataScientistPool:
    """
    DataScientist 实例池，用于预加载和复用实例

    优势:
    - 提前导入模块，减少首次调用延迟
    - 预初始化实例，加快响应速度
    - 实例复用，减少资源消耗
    """

    def __init__(self, pool_size: int = 2):
        self.pool_size = pool_size
        self._instances: asyncio.Queue = asyncio.Queue(maxsize=pool_size)
        self._initialized = False
        self._lock = asyncio.Lock()

    async def initialize(self):
        """初始化实例池（预加载 DataScientist）"""
        if self._initialized:
            return

        async with self._lock:
            if self._initialized:
                return

            logger.info(f"正在初始化 DataScientist 实例池 (大小：{self.pool_size})...")
            start_time = time.time()

            try:
                # 提前导入模块
                from agentic_data_scientist.core.api import DataScientist
                logger.info("✅ DataScientist 模块加载成功")

                # 创建占位实例（不真正初始化，只预热模块）
                self._initialized = True
                elapsed = time.time() - start_time
                logger.info(f"✅ DataScientist 实例池初始化完成，耗时：{elapsed:.2f}s")

            except Exception as e:
                logger.error(f"❌ DataScientist 实例池初始化失败：{e}")
                raise

    async def get_instance(self, agent_type: str, working_dir: str, **kwargs):
        """获取 DataScientist 实例"""
        from agentic_data_scientist.core.api import DataScientist

        # 确保已初始化
        if not self._initialized:
            await self.initialize()

        logger.debug(f"创建 DataScientist 实例：agent_type={agent_type}, working_dir={working_dir}")

        # 直接创建新实例（因为 DataScientist 需要特定配置）
        ds = DataScientist(
            agent_type=agent_type,
            working_dir=working_dir,
            **kwargs
        )

        logger.debug(f"✅ DataScientist 实例创建成功")
        return ds


class SessionManager:
    """
    Manages user sessions and DataScientist integration.

    Features:
    - Working directory management
    - DataScientist lifecycle
    - Session state caching
    - Message history storage
    """

    def __init__(self, ds_pool_size: int = 2):
        # In-memory cache for active sessions
        self._active_sessions: dict[str, Any] = {}

        # DataScientist 实例池
        self._ds_pool = DataScientistPool(pool_size=ds_pool_size)

        # 统计信息
        self._stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'total_duration': 0.0,
        }

        logger.info("SessionManager 初始化完成")

    def get_stats(self) -> dict:
        """获取统计信息"""
        avg_duration = (
            self._stats['total_duration'] / self._stats['total_requests']
            if self._stats['total_requests'] > 0 else 0
        )
        return {
            **self._stats,
            'avg_duration': avg_duration,
        }

    async def preload_data_scientist(self) -> bool:
        """
        预加载 DataScientist 模块

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info("开始预加载 DataScientist 模块...")
            start_time = time.time()

            await self._ds_pool.initialize()

            elapsed = time.time() - start_time
            logger.info(f"✅ DataScientist 预加载完成，耗时：{elapsed:.2f}s")

            return True
        except Exception as e:
            logger.error(f"❌ DataScientist 预加载失败：{e}")
            return False

    def _get_workspace_path(self, user_id: int, session_id: str) -> str:
        """Get the workspace path for a session"""
        return os.path.join(settings.WORKSPACE_BASE, str(user_id), session_id)

    async def create_session(
        self,
        user_id: int,
        agent_type: str = "claude_code",
        db: Optional[AsyncSession] = None,
    ) -> Session:
        """
        Create a new session for a user.

        Args:
            user_id: ID of the user
            agent_type: Type of agent to use (default: "claude_code")
            db: Database session

        Returns:
            Created Session object
        """
        start_time = time.time()

        session_id = str(uuid.uuid4())
        working_dir = self._get_workspace_path(user_id, session_id)

        logger.info(f"创建新会话：user_id={user_id}, agent_type={agent_type}, session_id={session_id}")

        # Create working directory
        os.makedirs(working_dir, exist_ok=True)
        logger.debug(f"工作目录已创建：{working_dir}")

        # Create database record
        session = Session(
            id=session_id,
            user_id=user_id,
            working_dir=working_dir,
            agent_type=agent_type,
        )

        if db:
            db.add(session)
            await db.commit()
            await db.refresh(session)
            logger.info(f"会话已保存到数据库")

        # 缓存活跃会话
        self._active_sessions[session_id] = {
            'session': session,
            'created_at': datetime.now(),
            'last_accessed': datetime.now(),
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
            cached['last_accessed'] = datetime.now()
            logger.debug(f"会话 {session_id} 命中缓存")
            return cached['session']

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
                'session': session,
                'created_at': session.created_at,
                'last_accessed': datetime.now(),
            }
            logger.debug(f"会话 {session_id} 已从数据库加载并缓存")

        elapsed = time.time() - start_time
        logger.debug(f"获取会话耗时：{elapsed:.3f}s")

        return session

    async def list_sessions(
        self,
        user_id: int,
        db: AsyncSession,
    ) -> list[Session]:
        """
        List all sessions for a user.
        """
        logger.info(f"列出用户 {user_id} 的所有会话")

        result = await db.execute(
            select(Session)
            .where(Session.user_id == user_id)
            .order_by(Session.created_at.desc())
        )
        sessions = list(result.scalars().all())

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
        logger.debug(f"会话已从数据库删除")

        # Clean up workspace
        if cleanup_workspace and os.path.exists(workspace_path):
            try:
                shutil.rmtree(workspace_path)
                logger.info(f"工作目录已清理：{workspace_path}")
            except Exception as e:
                logger.warning(f"清理工作目录失败 {workspace_path}: {e}")

        # Remove from cache
        self._active_sessions.pop(session_id, None)
        logger.debug(f"会话已从缓存移除")

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

        logger.debug(f"消息已添加：session_id={session_id}, role={role}, content_length={len(content)}")

        return message

    async def get_messages(
        self,
        session_id: str,
        db: AsyncSession,
        limit: int = 50,
    ) -> list[Message]:
        """
        Get messages for a session.
        """
        logger.debug(f"获取会话 {session_id} 的消息，限制 {limit} 条")

        result = await db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
        )
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
        self._stats['total_requests'] += 1

        session_id = session.id
        agent_type = session.agent_type or "claude_code"

        # 禁用 CLAUDECODE 检查 (在 Claude Code 环境中运行时需要)
        os.environ['CLAUDECODE'] = ''

        logger.info("=" * 60)
        logger.info(f"开始执行 DataScientist 请求")
        logger.info(f"  会话 ID: {session_id}")
        logger.info(f"  Agent 类型：{agent_type}")
        logger.info(f"  流式模式：{stream}")
        logger.info(f"  消息内容：{message[:50]}..." if len(message) > 50 else f"  消息内容：{message}")

        try:
            # Import DataScientist
            from agentic_data_scientist.core.api import DataScientist

            logger.info("正在创建 DataScientist 实例...")
            init_start = time.time()

            # Create DataScientist instance
            ds = DataScientist(
                agent_type=agent_type,
                working_dir=session.working_dir,
                auto_cleanup=False,
            )

            init_elapsed = time.time() - init_start
            logger.info(f"✅ DataScientist 实例创建成功，耗时：{init_elapsed:.2f}s")

            # 更新最后访问时间
            if session_id in self._active_sessions:
                self._active_sessions[session_id]['last_accessed'] = datetime.now()

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
                    elif hasattr(event, 'to_dict'):
                        event_dict = event.to_dict()
                    elif hasattr(event, '__dict__'):
                        event_dict = event.__dict__
                    else:
                        event_dict = {'type': 'message', 'content': str(event)}

                    # 日志记录事件
                    event_type = event_dict.get('type', 'unknown')
                    content = event_dict.get('content', '')
                    if content and len(content) > 100:
                        content = content[:100] + '...'
                    logger.debug(f"  事件 {event_count}: {event_type} - {content}")

                    yield event_dict

            else:
                logger.info("开始非流式执行...")

                # Non-streaming mode
                result = await ds.run_async(message, stream=False)
                event_count = 1

                # Handle result
                if isinstance(result, dict):
                    result_dict = result
                elif hasattr(result, 'to_dict'):
                    result_dict = result.to_dict()
                elif hasattr(result, '__dict__'):
                    result_dict = result.__dict__
                else:
                    result_dict = {'type': 'result', 'content': str(result)}

                logger.debug(f"结果：{json.dumps(result_dict, ensure_ascii=False)[:200]}...")
                yield result_dict

            elapsed = time.time() - start_time
            self._stats['successful_requests'] += 1
            self._stats['total_duration'] += elapsed

            logger.info("=" * 60)
            logger.info(f"✅ DataScientist 执行完成")
            logger.info(f"  总耗时：{elapsed:.2f}s")
            logger.info(f"  事件数量：{event_count}")
            logger.info(f"  成功请求：{self._stats['successful_requests']}/{self._stats['total_requests']}")

        except ImportError as e:
            elapsed = time.time() - start_time
            self._stats['failed_requests'] += 1

            logger.error("=" * 60)
            logger.error(f"❌ DataScientist 导入失败")
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
            self._stats['failed_requests'] += 1

            logger.error("=" * 60)
            logger.error(f"❌ DataScientist 执行错误")
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
