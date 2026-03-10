"""
API tests for session endpoints.
"""
import pytest
from httpx import AsyncClient


class TestSessionsAPI:
    """Tests for sessions API endpoints"""

    async def test_list_sessions_unauthenticated(self, api_client: AsyncClient):
        """Test listing sessions without auth returns empty or error"""
        response = await api_client.get("/api/sessions")
        # In dev mode, auto-login is enabled, so it returns 200
        assert response.status_code in [200, 401]

    async def test_list_sessions_authenticated(self, authenticated_client: AsyncClient):
        """Test listing sessions for authenticated user"""
        response = await authenticated_client.get("/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "sessions" in data
        assert "total" in data

    async def test_create_session(self, authenticated_client: AsyncClient):
        """Test creating a new session"""
        response = await authenticated_client.post(
            "/api/sessions",
            json={}
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data

    async def test_get_session_events_unauthenticated(self, api_client: AsyncClient):
        """Test getting session events without auth"""
        response = await api_client.get("/api/sessions/fake-id/events?task_id=fake-task")
        assert response.status_code in [401, 404]
