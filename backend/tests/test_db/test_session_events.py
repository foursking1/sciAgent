"""
Tests for SessionEvent model and cleanup functionality.
"""

import pytest
from datetime import datetime, timedelta

from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.session import Session
from backend.db.models.session_event import SessionEvent, SessionEventType
from backend.services.cleanup import SessionEventsCleanup, get_cleanup_service, _cleanup_service


@pytest.mark.asyncio
async def test_create_session_event(db: AsyncSession, test_session: Session):
    """Test creating a session event."""
    event_data = {
        "type": "message",
        "content": "Test message",
        "timestamp": datetime.utcnow().isoformat(),
    }

    event = SessionEvent(
        session_id=test_session.id,
        event_type=SessionEventType.MESSAGE,
        event_data=event_data,
    )

    db.add(event)
    await db.commit()
    await db.refresh(event)

    assert event.id is not None
    assert event.session_id == test_session.id
    assert event.event_type == SessionEventType.MESSAGE
    assert event.event_data == event_data
    assert event.created_at is not None


@pytest.mark.asyncio
async def test_session_event_to_event_dict(db: AsyncSession, test_session: Session):
    """Test converting SessionEvent to event dict."""
    event_data = {
        "type": "function_call",
        "name": "test_function",
        "arguments": {"param1": "value1"},
    }

    event = SessionEvent(
        session_id=test_session.id,
        event_type=SessionEventType.FUNCTION_CALL,
        event_data=event_data,
    )

    db.add(event)
    await db.commit()
    await db.refresh(event)

    # Convert to event dict
    event_dict = event.to_event_dict()

    assert event_dict["type"] == "function_call"
    assert event_dict["name"] == "test_function"
    assert event_dict["arguments"] == {"param1": "value1"}
    assert "timestamp" in event_dict


@pytest.mark.asyncio
async def test_session_event_types(db: AsyncSession, test_session: Session):
    """Test all valid session event types."""
    valid_types = [
        SessionEventType.USER_MESSAGE,
        SessionEventType.MESSAGE,
        SessionEventType.FUNCTION_CALL,
        SessionEventType.FUNCTION_RESPONSE,
        SessionEventType.STARTED,
        SessionEventType.STATUS,
        SessionEventType.USAGE,
        SessionEventType.COMPLETED,
        SessionEventType.ERROR,
        SessionEventType.CANCELLED,
    ]

    for event_type in valid_types:
        event = SessionEvent(
            session_id=test_session.id,
            event_type=event_type,
            event_data={"type": event_type, "timestamp": datetime.utcnow().isoformat()},
        )
        db.add(event)

    await db.commit()

    # Verify all events were created
    result = await db.execute(
        select(SessionEvent).where(SessionEvent.session_id == test_session.id)
    )
    events = result.scalars().all()

    assert len(events) == len(valid_types)
    assert {e.event_type for e in events} == set(valid_types)


@pytest.mark.asyncio
async def test_session_event_with_json_data(db: AsyncSession, test_session: Session):
    """Test session event with complex JSON data."""
    complex_data = {
        "type": "usage",
        "timestamp": datetime.utcnow().isoformat(),
        "usage": {
            "total_input_tokens": 1000,
            "cached_input_tokens": 100,
            "output_tokens": 500,
        },
        "model": "claude-3-opus-20240229",
    }

    event = SessionEvent(
        session_id=test_session.id,
        event_type=SessionEventType.USAGE,
        event_data=complex_data,
    )

    db.add(event)
    await db.commit()
    await db.refresh(event)

    assert event.event_data == complex_data
    assert event.event_data["usage"]["total_input_tokens"] == 1000


@pytest.mark.asyncio
async def test_get_old_events_count(db: AsyncSession, test_session: Session):
    """Test counting old events for cleanup."""
    # Create old events (35 days ago)
    old_date = datetime.utcnow() - timedelta(days=35)
    for i in range(5):
        old_event = SessionEvent(
            session_id=test_session.id,
            event_type=SessionEventType.MESSAGE,
            event_data={"type": "message", "content": f"Old message {i}"},
            created_at=old_date,
        )
        # Manually set created_at to avoid auto-update
        db.add(old_event)

    # Create recent events (5 days ago)
    recent_date = datetime.utcnow() - timedelta(days=5)
    for i in range(3):
        recent_event = SessionEvent(
            session_id=test_session.id,
            event_type=SessionEventType.MESSAGE,
            event_data={"type": "message", "content": f"Recent message {i}"},
            created_at=recent_date,
        )
        db.add(recent_event)

    await db.commit()

    # Count old events (retention: 30 days)
    cleanup = SessionEventsCleanup(retention_days=30)
    old_count = await cleanup.get_old_events_count(db)

    assert old_count == 5  # Only the 5 old events


@pytest.mark.asyncio
async def test_delete_old_events(db: AsyncSession, test_session: Session):
    """Test deleting old events."""
    # Create old events
    old_date = datetime.utcnow() - timedelta(days=35)
    for i in range(5):
        old_event = SessionEvent(
            session_id=test_session.id,
            event_type=SessionEventType.MESSAGE,
            event_data={"type": "message", "content": f"Old message {i}"},
            created_at=old_date,
        )
        db.add(old_event)

    # Create recent events
    recent_date = datetime.utcnow() - timedelta(days=5)
    for i in range(3):
        recent_event = SessionEvent(
            session_id=test_session.id,
            event_type=SessionEventType.MESSAGE,
            event_data={"type": "message", "content": f"Recent message {i}"},
            created_at=recent_date,
        )
        db.add(recent_event)

    await db.commit()

    # Verify initial count
    result = await db.execute(
        select(func.count(SessionEvent.id)).where(
            SessionEvent.session_id == test_session.id
        )
    )
    initial_count = result.scalar() or 0
    assert initial_count == 8

    # Run cleanup
    cleanup = SessionEventsCleanup(retention_days=30)
    stats = await cleanup.delete_old_events(db, dry_run=False)

    # Verify cleanup stats
    assert stats["deleted_count"] == 5
    assert stats["batches"] > 0

    # Verify final count
    result = await db.execute(
        select(func.count(SessionEvent.id)).where(
            SessionEvent.session_id == test_session.id
        )
    )
    final_count = result.scalar() or 0
    assert final_count == 3  # Only recent events remain


@pytest.mark.asyncio
async def test_cleanup_dry_run(db: AsyncSession, test_session: Session):
    """Test cleanup dry run mode."""
    # Create old events
    old_date = datetime.utcnow() - timedelta(days=35)
    for i in range(3):
        old_event = SessionEvent(
            session_id=test_session.id,
            event_type=SessionEventType.MESSAGE,
            event_data={"type": "message", "content": f"Old message {i}"},
            created_at=old_date,
        )
        db.add(old_event)

    await db.commit()

    # Run cleanup in dry run mode
    cleanup = SessionEventsCleanup(retention_days=30)
    stats = await cleanup.delete_old_events(db, dry_run=True)

    # Verify dry run doesn't delete
    assert stats["deleted_count"] == 0
    assert "would_delete" in stats
    assert stats["would_delete"] == 3

    # Verify events still exist
    result = await db.execute(
        select(func.count(SessionEvent.id)).where(
            SessionEvent.session_id == test_session.id
        )
    )
    count = result.scalar() or 0
    assert count == 3


@pytest.mark.asyncio
async def test_get_cleanup_stats(db: AsyncSession, test_session: Session):
    """Test getting cleanup statistics."""
    # Create mix of old and recent events
    old_date = datetime.utcnow() - timedelta(days=35)
    recent_date = datetime.utcnow() - timedelta(days=5)

    for i in range(5):
        old_event = SessionEvent(
            session_id=test_session.id,
            event_type=SessionEventType.MESSAGE,
            event_data={"type": "message", "content": f"Old message {i}"},
            created_at=old_date,
        )
        db.add(old_event)

    for i in range(3):
        recent_event = SessionEvent(
            session_id=test_session.id,
            event_type=SessionEventType.MESSAGE,
            event_data={"type": "message", "content": f"Recent message {i}"},
            created_at=recent_date,
        )
        db.add(recent_event)

    await db.commit()

    # Get stats
    cleanup = SessionEventsCleanup(retention_days=30)
    stats = await cleanup.get_cleanup_stats(db)

    assert stats["total_events"] == 8
    assert stats["old_events"] == 5
    assert stats["retention_days"] == 30
    assert "cutoff_date" in stats


@pytest.mark.asyncio
async def test_get_cleanup_service_singleton(db: AsyncSession):
    """Test that get_cleanup_service returns a singleton."""
    # First call
    service1 = get_cleanup_service(retention_days=30)
    assert service1.retention_days == 30
    assert service1 is _cleanup_service

    # Second call with same retention should return same instance
    service2 = get_cleanup_service(retention_days=30)
    assert service2 is service1

    # Call with different retention should create new instance
    service3 = get_cleanup_service(retention_days=60)
    assert service3.retention_days == 60
    assert service3 is not service1
