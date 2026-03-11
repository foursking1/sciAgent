"""
API tests for authentication endpoints.
"""

from httpx import AsyncClient


class TestAuthAPI:
    """Tests for auth API endpoints"""

    async def test_register_user(self, api_client: AsyncClient):
        """Test user registration"""
        response = await api_client.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securepassword123",
                "full_name": "New User",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["full_name"] == "New User"
        assert "id" in data

    async def test_register_duplicate_email(self, api_client: AsyncClient, test_user):
        """Test registration with duplicate email fails"""
        response = await api_client.post(
            "/api/auth/register",
            json={
                "email": test_user.email,
                "password": "anotherpassword",
                "full_name": "Duplicate User",
            },
        )
        assert response.status_code == 400

    async def test_login_success(self, api_client: AsyncClient, async_session, test_user):
        """Test successful login"""
        # Update user password hash
        from backend.services.auth import get_password_hash

        test_user.password_hash = get_password_hash("testpassword123")
        async_session.add(test_user)
        await async_session.commit()

        response = await api_client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": "testpassword123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, api_client: AsyncClient, async_session, test_user):
        """Test login with wrong password"""
        # Update user with valid password hash
        from backend.services.auth import get_password_hash

        test_user.password_hash = get_password_hash("correctpassword")
        async_session.add(test_user)
        await async_session.commit()

        response = await api_client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": "wrongpassword"},
        )
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, api_client: AsyncClient):
        """Test login with nonexistent user"""
        response = await api_client.post(
            "/api/auth/login",
            json={"email": "nonexistent@example.com", "password": "anypassword"},
        )
        assert response.status_code == 401
