"""
API tests for public session endpoints.
"""

from backend.db.models.session import Session
from httpx import AsyncClient


class TestPublicSessionsAPI:
    """Tests for public sessions API endpoints"""

    async def test_list_public_sessions_empty(self, api_client: AsyncClient):
        """Test listing public sessions when none exist"""
        response = await api_client.get("/api/sessions/public")
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        assert "total" in data
        assert data["total"] == 0

    async def test_list_public_sessions_with_data(
        self, api_client: AsyncClient, async_session, test_user
    ):
        """Test listing public sessions"""
        # Create a public session
        from backend.services.session_manager import session_manager

        session = await session_manager.create_session(
            user_id=test_user.id,
            agent_type="claude_code",
            db=async_session,
        )

        # Make it public
        session.is_public = True
        await async_session.commit()

        response = await api_client.get("/api/sessions/public")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    async def test_get_public_session_not_found(self, api_client: AsyncClient):
        """Test getting non-existent public session"""
        response = await api_client.get("/api/sessions/public/non-existent-id")
        assert response.status_code == 404

    async def test_get_public_session_not_public(
        self, api_client: AsyncClient, test_session: Session
    ):
        """Test getting private session via public endpoint"""
        response = await api_client.get(f"/api/sessions/public/{test_session.id}")
        assert response.status_code == 404

    async def test_toggle_session_public(
        self,
        authenticated_client: AsyncClient,
        test_session: Session,
    ):
        """Test toggling session public status"""
        # Make session public
        response = await authenticated_client.patch(
            f"/api/sessions/{test_session.id}/public",
            json={"is_public": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_public"] is True

        # Make it private again
        response = await authenticated_client.patch(
            f"/api/sessions/{test_session.id}/public",
            json={"is_public": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_public"] is False
