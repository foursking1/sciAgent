"""
Session API routes.
"""

import json
import logging
from pathlib import Path

from backend.api.routes.auth import get_current_user, get_current_user_for_sse
from backend.db.database import get_db_session
from backend.db.models.message import Message, MessageRole
from backend.db.models.session import Session
from backend.db.models.user import User
from backend.schemas.sessions import (
    MessageCreate,
    MessageResponse,
    ModeUpdate,
    PublicSessionDetail,
    PublicSessionListResponse,
    PublicSessionResponse,
    PublicUpdate,
    SessionCreate,
    SessionListResponse,
    SessionResponse,
    TaskResponse,
    TaskStatusResponse,
)
from backend.services.session_manager import session_manager
from backend.services.task_queue import task_queue
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter()

# Security for optional auth
security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db_session),
) -> User | None:
    """Get current user if authenticated, otherwise return None"""
    if credentials is None:
        return None

    try:
        from backend.services.auth import verify_token

        token_data = verify_token(credentials.credentials)
        if token_data is None:
            return None

        result = await db.execute(select(User).where(User.id == token_data.user_id))
        return result.scalar_one_or_none()
    except Exception:
        return None


# ============ Helper functions ============


async def _find_preview_image(working_dir: str) -> str | None:
    """Find the first image file in workspace for preview"""
    workspace = Path(working_dir)
    if not workspace.exists():
        return None

    image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

    # Look in common output directories
    search_paths = [workspace / "outputs", workspace / "figures", workspace]

    for search_path in search_paths:
        if not search_path.exists():
            continue
        for file in search_path.rglob("*"):
            if file.is_file() and file.suffix.lower() in image_extensions:
                return str(file.relative_to(workspace))

    return None


async def _find_pdf(working_dir: str) -> str | None:
    """Find PDF file in workspace"""
    workspace = Path(working_dir)
    if not workspace.exists():
        return None

    # Look for PDFs
    for file in workspace.rglob("*.pdf"):
        return str(file.relative_to(workspace))

    return None


# ============ Public Session Endpoints (must come before /{session_id}) ============


@router.get("/public", response_model=PublicSessionListResponse)
async def list_public_sessions(
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    List all public sessions (no authentication required).
    Returns sessions with preview image and PDF paths.
    """
    result = await db.execute(
        select(Session)
        .where(Session.is_public.is_(True))
        .order_by(Session.created_at.desc())
    )
    sessions = result.scalars().all()

    public_sessions = []
    for session in sessions:
        # Find preview image and PDF in workspace
        preview_image = await _find_preview_image(session.working_dir)
        pdf_path = await _find_pdf(session.working_dir)

        public_sessions.append(
            PublicSessionResponse(
                id=session.id,
                title=session.title,
                current_mode=session.current_mode,
                created_at=session.created_at,
                preview_image=preview_image,
                pdf_path=pdf_path,
            )
        )

    return {
        "sessions": public_sessions,
        "total": len(public_sessions),
    }


@router.get("/public/{session_id}", response_model=PublicSessionDetail)
async def get_public_session(
    session_id: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Get a public session with messages (no authentication required).
    """
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.is_public.is_(True))
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or not public",
        )

    # Get messages
    messages = await session_manager.get_messages(
        session_id=session_id,
        db=db,
    )

    # Check if current user is owner
    is_owner = current_user is not None and current_user.id == session.user_id

    return PublicSessionDetail(
        id=session.id,
        title=session.title,
        current_mode=session.current_mode,
        created_at=session.created_at,
        messages=messages,
        is_owner=is_owner,
    )


# ============ Authenticated Session Endpoints ============


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Session:
    """
    Create a new session.

    - **agent_type**: Type of agent to use (default: "claude_code")
    - **mode**: Session mode: 'data-question', 'scientific-experiment', 'data-extraction', 'paper-writing' (default: "data-question")
    """
    session = await session_manager.create_session(
        user_id=current_user.id,
        agent_type=session_data.agent_type,
        mode=session_data.mode,
        db=db,
    )
    return session


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    List all sessions for the current user.
    """
    sessions = await session_manager.list_sessions(
        user_id=current_user.id,
        db=db,
    )
    return {
        "sessions": sessions,
        "total": len(sessions),
    }


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Session:
    """
    Get a specific session by ID.
    """
    session = await session_manager.get_session(
        session_id=session_id,
        user_id=current_user.id,
        db=db,
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a session.
    """
    deleted = await session_manager.delete_session(
        session_id=session_id,
        user_id=current_user.id,
        db=db,
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )


@router.patch("/{session_id}/mode", response_model=SessionResponse)
async def switch_session_mode(
    session_id: str,
    mode_data: ModeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Session:
    """
    Switch session mode.

    Available modes:
    - data-question: 数据问题 - 数据查询与分析
    - scientific-experiment: 科学实验 - 实验设计与分析
    - data-extraction: 数据抽取 - 数据提取与清洗
    - paper-writing: 论文写作 - 学术写作助手
    """
    try:
        session = await session_manager.switch_mode(
            session_id=session_id,
            new_mode=mode_data.mode,
            user_id=current_user.id,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return session


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[Message]:
    """
    Get messages for a session.
    """
    # Verify session ownership
    session = await session_manager.get_session(
        session_id=session_id,
        user_id=current_user.id,
        db=db,
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    messages = await session_manager.get_messages(
        session_id=session_id,
        db=db,
    )

    return messages


@router.post("/{session_id}/messages", response_model=MessageResponse)
async def send_message(
    session_id: str,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Message:
    """
    Send a message to a session (non-streaming).

    This stores the user message and returns it.
    For streaming responses, use the /events endpoint.
    """
    # Verify session ownership
    session = await session_manager.get_session(
        session_id=session_id,
        user_id=current_user.id,
        db=db,
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Store user message
    user_message = await session_manager.add_message(
        session_id=session_id,
        content=message_data.content,
        role=MessageRole.USER,
        db=db,
    )

    return user_message


@router.get("/{session_id}/events")
async def stream_events(
    session_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user_for_sse),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Stream events from a task via Server-Sent Events (SSE).

    Query parameters:
    - **task_id**: The task ID returned from /chat endpoint

    This endpoint streams real-time events from the agent execution.
    """
    # Verify session ownership
    session = await session_manager.get_session(
        session_id=session_id,
        user_id=current_user.id,
        db=db,
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Verify task belongs to this session
    task = await task_queue.get_status(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    if task.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Task does not belong to this session",
        )

    async def event_generator():
        """Generate SSE events from Redis pub/sub"""
        try:
            async for event in task_queue.stream_events(task_id, timeout=300.0):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            logger.error(f"Error streaming events for task {task_id}: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@router.post("/{session_id}/chat", response_model=TaskResponse)
async def chat(
    session_id: str,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Send a chat message and get a task ID for streaming.

    This is the main endpoint for interactive chat. It returns immediately
    with a task_id that can be used to stream events via the /events endpoint.

    Returns:
        task_id: ID to use for streaming events
        session_id: Session ID
        status: Initial task status (pending)
    """
    # Verify session ownership
    session = await session_manager.get_session(
        session_id=session_id,
        user_id=current_user.id,
        db=db,
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Submit task to queue
    task = await task_queue.submit(
        session_id=session_id,
        message=message_data.content,
        user_id=current_user.id,
    )

    logger.info(f"Chat task submitted: {task.task_id}")

    return {
        "task_id": task.task_id,
        "session_id": task.session_id,
        "status": task.status.value,
    }


@router.get("/{session_id}/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    session_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Get the status of a task.

    Returns:
        task_id: Task ID
        session_id: Session ID
        status: Current task status
        created_at: Task creation time
        started_at: Task start time (if started)
        completed_at: Task completion time (if completed)
        error: Error message (if failed)
    """
    # Verify session ownership
    session = await session_manager.get_session(
        session_id=session_id,
        user_id=current_user.id,
        db=db,
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Get task status
    task = await task_queue.get_status(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    if task.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Task does not belong to this session",
        )

    return task.to_dict()


@router.post("/{session_id}/tasks/{task_id}/cancel", response_model=TaskStatusResponse)
async def cancel_task(
    session_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Cancel a running task.

    Returns:
        task_id: Task ID
        status: Updated task status (cancelled)
    """
    # Verify session ownership
    session = await session_manager.get_session(
        session_id=session_id,
        user_id=current_user.id,
        db=db,
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Get task
    task = await task_queue.get_status(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    if task.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Task does not belong to this session",
        )

    # Cancel the task
    cancelled = await task_queue.cancel(task_id)
    if not cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task cannot be cancelled (already complete or not found)",
        )

    # Get updated status
    task = await task_queue.get_status(task_id)
    return task.to_dict()


@router.patch("/{session_id}/public", response_model=SessionResponse)
async def toggle_session_public(
    session_id: str,
    public_data: PublicUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Session:
    """
    Toggle session public status (owner only).
    """
    # Query session directly from database
    result = await db.execute(
        select(Session).where(
            Session.id == session_id, Session.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Update public status
    session.is_public = public_data.is_public
    await db.commit()
    await db.refresh(session)

    return session
