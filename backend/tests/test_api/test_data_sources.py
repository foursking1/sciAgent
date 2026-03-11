"""
API tests for data source endpoints.
"""

from httpx import AsyncClient


class TestDataSourcesAPI:
    """Tests for data sources API endpoints"""

    async def test_list_data_sources_empty(self, authenticated_client: AsyncClient):
        """Test listing data sources when none exist"""
        response = await authenticated_client.get("/api/data-sources")
        assert response.status_code == 200
        data = response.json()
        assert "data_sources" in data
        assert "total" in data

    async def test_create_database_data_source(self, authenticated_client: AsyncClient):
        """Test creating a database data source"""
        response = await authenticated_client.post(
            "/api/data-sources",
            json={
                "name": "Test Database",
                "type": "database",
                "config": {
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "user",
                },
                "description": "A test database",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Database"
        assert data["type"] == "database"
        assert "id" in data

    async def test_create_vector_store_data_source(
        self, authenticated_client: AsyncClient
    ):
        """Test creating a vector store data source"""
        response = await authenticated_client.post(
            "/api/data-sources",
            json={
                "name": "Test Vector Store",
                "type": "vector_store",
                "config": {
                    "collection": "test_collection",
                    "embedding_model": "text-embedding-ada-002",
                },
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "vector_store"

    async def test_create_skill_data_source(self, authenticated_client: AsyncClient):
        """Test creating a skill data source"""
        response = await authenticated_client.post(
            "/api/data-sources",
            json={
                "name": "Test Skill",
                "type": "skill",
                "config": {
                    "skill_name": "data_analysis",
                    "endpoint": "http://localhost:8080/skill",
                },
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "skill"

    async def test_get_data_source(self, authenticated_client: AsyncClient):
        """Test getting a specific data source"""
        # Create one first
        create_response = await authenticated_client.post(
            "/api/data-sources",
            json={
                "name": "Test DS",
                "type": "database",
                "config": {"host": "localhost"},
            },
        )
        data_source_id = create_response.json()["id"]

        # Get it
        response = await authenticated_client.get(f"/api/data-sources/{data_source_id}")

        assert response.status_code == 200
        assert response.json()["id"] == data_source_id

    async def test_update_data_source(self, authenticated_client: AsyncClient):
        """Test updating a data source"""
        # Create one first
        create_response = await authenticated_client.post(
            "/api/data-sources",
            json={
                "name": "Original Name",
                "type": "database",
                "config": {"host": "localhost"},
            },
        )
        data_source_id = create_response.json()["id"]

        # Update it
        response = await authenticated_client.put(
            f"/api/data-sources/{data_source_id}",
            json={
                "name": "Updated Name",
                "description": "Updated description",
            },
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    async def test_delete_data_source(self, authenticated_client: AsyncClient):
        """Test deleting a data source"""
        # Create one first
        create_response = await authenticated_client.post(
            "/api/data-sources",
            json={
                "name": "To Delete",
                "type": "database",
                "config": {"host": "localhost"},
            },
        )
        data_source_id = create_response.json()["id"]

        # Delete it
        response = await authenticated_client.delete(
            f"/api/data-sources/{data_source_id}"
        )

        assert response.status_code == 204

        # Verify it's deleted
        get_response = await authenticated_client.get(
            f"/api/data-sources/{data_source_id}"
        )
        assert get_response.status_code == 404

    async def test_test_data_source_connection(self, authenticated_client: AsyncClient):
        """Test testing a data source connection"""
        # Create one first
        create_response = await authenticated_client.post(
            "/api/data-sources",
            json={
                "name": "Test Connection",
                "type": "database",
                "config": {"host": "localhost"},
            },
        )
        data_source_id = create_response.json()["id"]

        # Test connection
        response = await authenticated_client.post(
            f"/api/data-sources/{data_source_id}/test"
        )

        # Connection test may fail, but endpoint should work
        assert response.status_code in [200, 400]
