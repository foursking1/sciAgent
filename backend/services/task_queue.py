"""
Task Queue Service

Redis-based task queue for managing long-running agent tasks.

Features:
- Async task submission
- Real-time status tracking
- Event streaming via Redis pub/sub
- Task cancellation support
- Automatic cleanup with TTL
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from enum import Enum
from typing import AsyncGenerator, Optional

import redis.asyncio as redis
from backend.core.config import settings

logger = logging.getLogger("TaskQueue")


class TaskStatus(str, Enum):
    """Task status enumeration"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Task:
    """Task data model"""

    def __init__(
        self,
        task_id: str,
        session_id: str,
        message: str,
        user_id: int,
        status: TaskStatus = TaskStatus.PENDING,
        created_at: Optional[str] = None,
        started_at: Optional[str] = None,
        completed_at: Optional[str] = None,
        error: Optional[str] = None,
        result: Optional[str] = None,
    ):
        self.task_id = task_id
        self.session_id = session_id
        self.message = message
        self.user_id = user_id
        self.status = status
        self.created_at = created_at or datetime.now().isoformat()
        self.started_at = started_at
        self.completed_at = completed_at
        self.error = error
        self.result = result

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "session_id": self.session_id,
            "message": self.message,
            "user_id": str(self.user_id),  # Convert to string for Redis
            "status": self.status.value,
            "created_at": self.created_at or "",
            "started_at": self.started_at or "",
            "completed_at": self.completed_at or "",
            "error": self.error or "",
            "result": self.result or "",
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Task":
        return cls(
            task_id=data["task_id"],
            session_id=data["session_id"],
            message=data["message"],
            user_id=int(data["user_id"]),  # Convert back to int
            status=TaskStatus(data["status"]),
            created_at=data.get("created_at") or None,
            started_at=data.get("started_at") or None,
            completed_at=data.get("completed_at") or None,
            error=data.get("error") or None,
            result=data.get("result") or None,
        )


class TaskQueue:
    """
    Redis-based task queue for async task management.

    Usage:
        queue = TaskQueue(redis_url="redis://localhost:6379")

        # Submit a task
        task = await queue.submit(session_id, message, user_id)

        # Get task status
        status = await queue.get_status(task.task_id)

        # Stream events
        async for event in queue.stream_events(task.task_id):
            print(event)

        # Cancel task
        await queue.cancel(task.task_id)
    """

    # Redis key prefixes
    TASK_PREFIX = "task:"
    QUEUE_KEY = "task:queue"
    EVENT_PREFIX = "task:events:"

    # Default TTL for task data (1 hour)
    TASK_TTL = 3600

    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or settings.effective_redis_url
        self._redis: Optional[redis.Redis] = None
        self._pubsub: Optional[redis.client.PubSub] = None
        self._running_tasks: dict[str, asyncio.Task] = {}

    async def _get_redis(self) -> redis.Redis:
        """Get or create Redis connection"""
        if self._redis is None:
            self._redis = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._redis

    async def close(self):
        """Close Redis connection"""
        if self._pubsub:
            await self._pubsub.close()
            self._pubsub = None
        if self._redis:
            await self._redis.close()
            self._redis = None

    async def submit(
        self,
        session_id: str,
        message: str,
        user_id: int,
    ) -> Task:
        """
        Submit a new task to the queue.

        Args:
            session_id: Session ID for the task
            message: User message to process
            user_id: User ID who submitted the task

        Returns:
            Task object with task_id
        """
        r = await self._get_redis()

        task_id = str(uuid.uuid4())
        task = Task(
            task_id=task_id,
            session_id=session_id,
            message=message,
            user_id=user_id,
        )

        # Store task metadata
        task_key = f"{self.TASK_PREFIX}{task_id}"
        await r.hset(task_key, mapping=task.to_dict())
        await r.expire(task_key, self.TASK_TTL)

        # Add to queue
        await r.rpush(self.QUEUE_KEY, task_id)

        logger.info(f"Task submitted: {task_id} for session {session_id}")

        return task

    async def get_status(self, task_id: str) -> Optional[Task]:
        """
        Get task status.

        Args:
            task_id: Task ID to check

        Returns:
            Task object or None if not found
        """
        r = await self._get_redis()
        task_key = f"{self.TASK_PREFIX}{task_id}"

        data = await r.hgetall(task_key)
        if not data:
            return None

        return Task.from_dict(data)

    async def update_status(
        self,
        task_id: str,
        status: TaskStatus,
        error: Optional[str] = None,
        result: Optional[str] = None,
    ) -> bool:
        """
        Update task status.

        Args:
            task_id: Task ID to update
            status: New status
            error: Error message (if failed)
            result: Result data (if completed)

        Returns:
            True if updated, False if not found
        """
        r = await self._get_redis()
        task_key = f"{self.TASK_PREFIX}{task_id}"

        # Get existing task
        data = await r.hgetall(task_key)
        if not data:
            return False

        # Update fields
        updates = {"status": status.value}

        if status == TaskStatus.RUNNING:
            updates["started_at"] = datetime.now().isoformat()
        elif status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            updates["completed_at"] = datetime.now().isoformat()

        if error:
            updates["error"] = error
        if result:
            updates["result"] = result

        await r.hset(task_key, mapping=updates)

        logger.info(f"Task {task_id} status updated: {status.value}")

        return True

    async def publish_event(self, task_id: str, event: dict):
        """
        Publish an event for a task.

        Args:
            task_id: Task ID
            event: Event data to publish
        """
        r = await self._get_redis()
        channel = f"{self.EVENT_PREFIX}{task_id}"

        await r.publish(channel, json.dumps(event))

    async def stream_events(
        self,
        task_id: str,
        timeout: float = 300.0,
    ) -> AsyncGenerator[dict, None]:
        """
        Stream events for a task via Redis pub/sub.

        Args:
            task_id: Task ID to stream events for
            timeout: Timeout in seconds (default: 5 minutes)

        Yields:
            Event dictionaries
        """
        r = await self._get_redis()
        channel = f"{self.EVENT_PREFIX}{task_id}"

        # Create pubsub connection
        pubsub = r.pubsub()
        try:
            await pubsub.subscribe(channel)

            # Check if task exists
            task = await self.get_status(task_id)
            if not task:
                yield {
                    "type": "error",
                    "message": "Task not found",
                    "timestamp": datetime.now().isoformat(),
                }
                return

            # Yield initial status
            yield {
                "type": "status",
                "task_id": task_id,
                "status": task.status.value,
                "timestamp": datetime.now().isoformat(),
            }

            # If task is already complete, yield result and return
            if task.status in (
                TaskStatus.COMPLETED,
                TaskStatus.FAILED,
                TaskStatus.CANCELLED,
            ):
                if task.result:
                    yield {
                        "type": "result",
                        "content": task.result,
                        "timestamp": datetime.now().isoformat(),
                    }
                if task.error:
                    yield {
                        "type": "error",
                        "message": task.error,
                        "timestamp": datetime.now().isoformat(),
                    }
                yield {
                    "type": "completed",
                    "status": task.status.value,
                    "timestamp": datetime.now().isoformat(),
                }
                return

            # Stream events with timeout
            start_time = time.time()

            async for message in pubsub.listen():
                # Check timeout
                if time.time() - start_time > timeout:
                    yield {
                        "type": "timeout",
                        "message": "Stream timeout",
                        "timestamp": datetime.now().isoformat(),
                    }
                    break

                if message["type"] == "message":
                    event = json.loads(message["data"])
                    yield event

                    # Stop streaming on completion events
                    if event.get("type") in ("completed", "error", "cancelled"):
                        break

        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    async def cancel(self, task_id: str) -> bool:
        """
        Cancel a task.

        Args:
            task_id: Task ID to cancel

        Returns:
            True if cancelled, False if not found or already complete
        """
        task = await self.get_status(task_id)
        if not task:
            return False

        if task.status in (
            TaskStatus.COMPLETED,
            TaskStatus.FAILED,
            TaskStatus.CANCELLED,
        ):
            return False

        # Update status
        await self.update_status(task_id, TaskStatus.CANCELLED)

        # Publish cancellation event
        await self.publish_event(
            task_id,
            {
                "type": "cancelled",
                "message": "Task cancelled by user",
                "timestamp": datetime.now().isoformat(),
            },
        )

        # Cancel asyncio task if running
        if task_id in self._running_tasks:
            self._running_tasks[task_id].cancel()

        logger.info(f"Task {task_id} cancelled")

        return True

    async def pop_queue(self, timeout: float = 0) -> Optional[str]:
        """
        Pop a task from the queue (for workers).

        Args:
            timeout: Block timeout in seconds (0 = non-blocking)

        Returns:
            Task ID or None if queue is empty
        """
        r = await self._get_redis()

        if timeout > 0:
            result = await r.blpop(self.QUEUE_KEY, timeout=timeout)
            if result:
                return result[1]
            return None
        else:
            result = await r.lpop(self.QUEUE_KEY)
            return result

    async def get_queue_length(self) -> int:
        """Get the number of tasks in the queue"""
        r = await self._get_redis()
        return await r.llen(self.QUEUE_KEY)

    async def get_active_task(self, session_id: str) -> Optional[Task]:
        """
        Get the currently active (non-completed) task for a session.

        Searches Redis for tasks with status PENDING or RUNNING for the given session.

        Args:
            session_id: Session ID to find active task for

        Returns:
            Task object if found, None otherwise
        """
        r = await self._get_redis()

        # Scan for task keys
        async for key in r.scan_iter(f"{self.TASK_PREFIX}*"):
            data = await r.hgetall(key)
            if not data:
                continue

            # Check if this task belongs to the session and is still active
            if data.get("session_id") == session_id:
                status = data.get("status")
                if status in (TaskStatus.PENDING.value, TaskStatus.RUNNING.value):
                    return Task.from_dict(data)

        return None


# Global instance
task_queue = TaskQueue()
