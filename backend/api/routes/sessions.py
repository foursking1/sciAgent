"""
Session API routes.
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

from backend.db.database import get_db_session
from backend.db.models.session import Session
from backend.db.models.message import Message, MessageRole
from backend.schemas.sessions import (
    SessionCreate,
    SessionResponse,
    SessionListResponse,
    MessageCreate,
    MessageResponse,
)
from backend.schemas.auth import TokenData
from backend.api.routes.auth import get_current_user
from backend.services.session_manager import session_manager
from backend.db.models.user import User

router = APIRouter()


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Session:
    """
    Create a new session.

    - **agent_type**: Type of agent to use (default: "claude_code")
    """
    session = await session_manager.create_session(
        user_id=current_user.id,
        agent_type=session_data.agent_type,
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Stream events from DataScientist for a session.

    This is the main SSE endpoint for real-time chat responses.

    Query parameters:
    - **message**: The message to send to the agent
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

    # This endpoint is called via EventSource, which doesn't support POST with body
    # The message should be passed via query parameter or the frontend should use
    # a separate POST endpoint to initiate the conversation

    async def event_generator():
        """Generate SSE events"""
        # For now, yield a simple message - the actual integration requires
        # the message to be passed differently
        yield f"data: {json.dumps({'type': 'info', 'message': 'SSE connection established'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@router.post("/{session_id}/chat")
async def chat(
    session_id: str,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Send a chat message and stream the response.

    This is the main endpoint for interactive chat.
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

    async def event_generator():
        """Generate SSE events from DataScientist"""
        # Collect AI response content
        ai_response_parts = []

        try:
            # Store user message event
            user_event = {
                'type': 'user_message',
                'content': message_data.content,
                'timestamp': user_message.created_at.isoformat(),
            }
            yield f"data: {json.dumps(user_event)}\n\n"

            # Stream from DataScientist
            async for event_wrapper in session_manager.run_data_scientist(
                session=session,
                message=message_data.content,
                stream=True,
            ):
                # Extract the actual event data
                if isinstance(event_wrapper, dict) and 'data' in event_wrapper:
                    event_data = json.loads(event_wrapper['data'])
                else:
                    event_data = event_wrapper

                # Collect AI message content for saving to database
                if isinstance(event_data, dict) and event_data.get('type') == 'message':
                    content = event_data.get('content', '')
                    if content and not event_data.get('is_thinking'):
                        ai_response_parts.append(content)

                # Yield to client
                if isinstance(event_wrapper, dict) and 'data' in event_wrapper:
                    yield f"data: {event_wrapper['data']}\n\n"
                else:
                    yield f"data: {json.dumps(event_wrapper)}\n\n"

            # Mark as complete
            yield f"data: {json.dumps({'type': 'completed', 'timestamp': 'now'})}\n\n"

            # Save AI response to database
            if ai_response_parts:
                full_response = '\n'.join(ai_response_parts)
                logger.info(f"Saving AI response to database, length={len(full_response)}")
                try:
                    ai_message = await session_manager.add_message(
                        session_id=session_id,
                        content=full_response,
                        role=MessageRole.ASSISTANT,
                        db=db,
                    )
                    logger.info(f"AI message saved successfully, id={ai_message.id}")
                except Exception as e:
                    logger.error(f"Failed to save AI message: {e}")
                    raise

        except Exception as e:
            error_event = {
                'type': 'error',
                'message': str(e),
                'timestamp': 'now',
            }
            yield f"data: {json.dumps(error_event)}\n\n"
        # Note: Don't close db here - let FastAPI manage the connection lifecycle

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
