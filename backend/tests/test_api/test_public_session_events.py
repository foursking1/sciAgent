"""
API tests for public session event endpoints.
"""

from datetime import datetime

from backend.db.models.session_event import SessionEvent, SessionEventType
from httpx import AsyncClient


class TestPublicSessionEventsAPI:
    """Tests for public session event history API."""

    async def test_get_public_session_events_returns_historical_events(
        self,
        api_client: AsyncClient,
        async_session,
        test_session,
    ):
        test_session.is_public = True
        event = SessionEvent(
            session_id=test_session.id,
            event_type=SessionEventType.FUNCTION_CALL,
            event_data={
                "type": "function_call",
                "name": "python",
                "arguments": {"code": "print('hello')"},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        async_session.add(event)
        await async_session.commit()

        response = await api_client.get(
            f"/api/sessions/public/{test_session.id}/events"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["events"][0]["type"] == "function_call"
        assert data["events"][0]["name"] == "python"

    async def test_get_public_session_events_rejects_private_session(
        self,
        api_client: AsyncClient,
        test_session,
    ):
        response = await api_client.get(
            f"/api/sessions/public/{test_session.id}/events"
        )

        assert response.status_code == 404
