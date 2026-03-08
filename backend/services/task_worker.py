"""
Task Worker Service

Background worker that processes tasks from the queue.

Features:
- Concurrent task processing
- Event streaming to Redis
- Error handling and retry logic
- Graceful shutdown
- Real-time message saving (saves every message event)
"""
import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.services.task_queue import TaskQueue, TaskStatus, task_queue
from backend.services.session_manager import session_manager
from backend.db.database import async_session_maker
from backend.db.models.message import Message, MessageRole

logger = logging.getLogger('TaskWorker')


class TaskWorker:
    """
    Background worker for processing agent tasks.

    Usage:
        worker = TaskWorker()
        await worker.start()

        # Later...
        await worker.stop()
    """

    def __init__(
        self,
        max_concurrent_tasks: int = 3,
        poll_interval: float = 1.0,
    ):
        self.max_concurrent_tasks = max_concurrent_tasks
        self.poll_interval = poll_interval
        self._running = False
        self._active_tasks: dict[str, asyncio.Task] = {}
        self._task_queue = task_queue

    async def start(self):
        """Start the worker loop"""
        if self._running:
            return

        self._running = True
        logger.info(f"TaskWorker started (max_concurrent={self.max_concurrent_tasks})")

        # Start the polling loop
        asyncio.create_task(self._poll_loop())

    async def stop(self):
        """Stop the worker and cancel active tasks"""
        logger.info("Stopping TaskWorker...")
        self._running = False

        # Cancel all active tasks
        for task_id, task in list(self._active_tasks.items()):
            logger.info(f"Cancelling task {task_id}...")
            task.cancel()

        # Wait for tasks to complete
        if self._active_tasks:
            await asyncio.gather(*self._active_tasks.values(), return_exceptions=True)

        logger.info("TaskWorker stopped")

    async def _poll_loop(self):
        """Main polling loop"""
        while self._running:
            try:
                # Check if we have capacity
                if len(self._active_tasks) >= self.max_concurrent_tasks:
                    await asyncio.sleep(self.poll_interval)
                    continue

                # Try to get a task from the queue
                task_id = await self._task_queue.pop_queue(timeout=1.0)

                if task_id:
                    # Start processing the task
                    asyncio.create_task(self._process_task_wrapper(task_id))

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in poll loop: {e}")
                await asyncio.sleep(self.poll_interval)

    async def _process_task_wrapper(self, task_id: str):
        """Wrapper to track and handle task processing"""
        task = asyncio.current_task()
        self._active_tasks[task_id] = task

        try:
            await self._process_task(task_id)
        except asyncio.CancelledError:
            logger.info(f"Task {task_id} was cancelled")
            await self._task_queue.update_status(
                task_id, TaskStatus.CANCELLED, error="Task cancelled"
            )
        except Exception as e:
            logger.error(f"Error processing task {task_id}: {e}")
            await self._task_queue.update_status(
                task_id, TaskStatus.FAILED, error=str(e)
            )
        finally:
            del self._active_tasks[task_id]

    async def _process_task(self, task_id: str):
        """
        Process a single task.

        This runs the DataScientist agent and streams events to Redis.
        AI response is saved in real-time (every message event updates the database).
        """
        # Get task info
        task = await self._task_queue.get_status(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return

        # Check if cancelled
        if task.status == TaskStatus.CANCELLED:
            return

        # Update status to running
        await self._task_queue.update_status(task_id, TaskStatus.RUNNING)

        # Publish start event
        await self._task_queue.publish_event(task_id, {
            "type": "started",
            "task_id": task_id,
            "session_id": task.session_id,
            "timestamp": datetime.now().isoformat(),
        })

        logger.info(f"Processing task {task_id} for session {task.session_id}")

        # Get session from database
        async with async_session_maker() as db:
            try:
                from backend.db.models.session import Session

                result = await db.execute(
                    select(Session).where(Session.id == task.session_id)
                )
                session = result.scalar_one_or_none()

                if not session:
                    raise ValueError(f"Session {task.session_id} not found")

                # Store user message
                user_message = Message(
                    session_id=task.session_id,
                    content=task.message,
                    role=MessageRole.USER,
                )
                db.add(user_message)
                await db.commit()

                # Set session title if this is the first message
                if not session.title:
                    # Truncate title to 100 chars
                    title = task.message[:100] + ('...' if len(task.message) > 100 else '')
                    session.title = title
                    await db.commit()
                    logger.info(f"Set session {task.session_id} title: {title}")

            except Exception as e:
                await self._task_queue.update_status(
                    task_id, TaskStatus.FAILED, error=str(e)
                )
                await self._task_queue.publish_event(task_id, {
                    "type": "error",
                    "message": str(e),
                    "timestamp": datetime.now().isoformat(),
                })
                return

        # Track AI response content and message ID for real-time saving
        ai_response_parts: list[str] = []
        ai_message_id: Optional[int] = None

        async def save_response(is_stopped: bool = False):
            """Save current AI response to database"""
            nonlocal ai_message_id
            if not ai_response_parts:
                return

            content = '\n'.join(ai_response_parts)

            async with async_session_maker() as db:
                try:
                    if ai_message_id is None:
                        # Create new message
                        message = Message(
                            session_id=task.session_id,
                            content=content,
                            role=MessageRole.ASSISTANT,
                            is_stopped=is_stopped,
                        )
                        db.add(message)
                        await db.commit()
                        await db.refresh(message)
                        ai_message_id = message.id
                        logger.debug(f"Created AI message {ai_message_id}")
                    else:
                        # Update existing message
                        await db.execute(
                            update(Message)
                            .where(Message.id == ai_message_id)
                            .values(content=content, is_stopped=is_stopped)
                        )
                        await db.commit()
                        logger.debug(f"Updated AI message {ai_message_id}")
                except Exception as e:
                    logger.error(f"Error saving AI response: {e}")
                    await db.rollback()

        try:
            # Disable CLAUDECODE check
            os.environ['CLAUDECODE'] = ''

            async for event in session_manager.run_data_scientist(
                session=session,
                message=task.message,
                stream=True,
            ):
                # Check if task was cancelled
                current_task = await self._task_queue.get_status(task_id)
                if current_task and current_task.status == TaskStatus.CANCELLED:
                    logger.info(f"Task {task_id} cancelled during execution")
                    # Save current progress with is_stopped=True before returning
                    await save_response(is_stopped=True)
                    # Publish cancelled event
                    await self._task_queue.publish_event(task_id, {
                        "type": "cancelled",
                        "message": "Generation stopped by user",
                        "timestamp": datetime.now().isoformat(),
                    })
                    return

                # Filter out initialization messages
                should_filter = False
                if isinstance(event, dict):
                    event_type = event.get('type', 'unknown')
                    if event_type == 'message':
                        content = event.get('content', '')
                        # Filter out agent initialization messages
                        if content and any(
                            pattern in content
                            for pattern in [
                                'Preparing Claude Agent',
                                'Starting Claude Agent',
                                '(coding mode)',
                            ]
                        ):
                            should_filter = True
                            logger.debug(f"Filtered initialization message: {content[:50]}...")

                if should_filter:
                    continue

                # Collect and save AI response content in real-time
                if isinstance(event, dict):
                    event_type = event.get('type', 'unknown')
                    if event_type == 'message':
                        content = event.get('content', '')
                        # ADK uses 'is_thought', claude_code uses 'is_thinking'
                        is_thinking = event.get('is_thought', False) or event.get('is_thinking', False)
                        if content and not is_thinking:
                            ai_response_parts.append(content)
                            # Save every message event
                            await save_response()

                # Publish event to Redis
                logger.debug(f"Publishing event to Redis: type={event.get('type', 'unknown')}")
                await self._task_queue.publish_event(task_id, event)

            # Update status to completed
            await self._task_queue.update_status(task_id, TaskStatus.COMPLETED)

            # Publish completion event
            await self._task_queue.publish_event(task_id, {
                "type": "completed",
                "task_id": task_id,
                "timestamp": datetime.now().isoformat(),
            })

            logger.info(f"Task {task_id} completed successfully")

        except Exception as e:
            logger.error(f"Error in task {task_id}: {e}")

            # Save current progress
            await save_response()

            # Update status to failed
            await self._task_queue.update_status(
                task_id, TaskStatus.FAILED, error=str(e)
            )

            # Publish error event
            await self._task_queue.publish_event(task_id, {
                "type": "error",
                "message": str(e),
                "timestamp": datetime.now().isoformat(),
            })


# Global worker instance
task_worker: Optional[TaskWorker] = None


async def start_task_worker(max_concurrent: int = 3):
    """Start the global task worker"""
    global task_worker
    if task_worker is None:
        task_worker = TaskWorker(max_concurrent_tasks=max_concurrent)
    await task_worker.start()


async def stop_task_worker():
    """Stop the global task worker"""
    global task_worker
    if task_worker:
        await task_worker.stop()
        task_worker = None
