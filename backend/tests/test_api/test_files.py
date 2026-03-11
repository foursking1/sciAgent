"""
API tests for file endpoints.
"""

from backend.db.models.session import Session
from httpx import AsyncClient


class TestFilesAPI:
    """Tests for files API endpoints"""

    async def test_list_files_authenticated(
        self, authenticated_client: AsyncClient, test_session: Session
    ):
        """Test listing files for a session"""
        response = await authenticated_client.get(f"/api/files/{test_session.id}")
        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        assert "total" in data
        assert isinstance(data["files"], list)

    async def test_list_files_invalid_session(self, authenticated_client: AsyncClient):
        """Test listing files for non-existent session"""
        response = await authenticated_client.get("/api/files/invalid-session-id")
        assert response.status_code == 404

    async def test_upload_file(
        self,
        authenticated_client: AsyncClient,
        test_session: Session,
        async_session,
        test_user,
    ):
        """Test file upload to a session"""
        # Create a test file
        test_content = b"test file content"

        response = await authenticated_client.post(
            f"/api/files/upload?session_id={test_session.id}",
            files={"files": ("test.txt", test_content, "text/plain")},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["files"]) == 1
        assert data["files"][0]["filename"] == "test.txt"
        assert data["files"][0]["success"] is True

    async def test_upload_multiple_files(
        self,
        authenticated_client: AsyncClient,
        test_session: Session,
    ):
        """Test uploading multiple files"""
        files = [
            ("files", ("file1.txt", b"content1", "text/plain")),
            ("files", ("file2.txt", b"content2", "text/plain")),
        ]

        response = await authenticated_client.post(
            f"/api/files/upload?session_id={test_session.id}",
            files=files,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["files"]) == 2

    async def test_upload_file_invalid_session(self, authenticated_client: AsyncClient):
        """Test uploading to non-existent session"""
        response = await authenticated_client.post(
            "/api/files/upload?session_id=invalid-session",
            files={"files": ("test.txt", b"content", "text/plain")},
        )
        assert response.status_code == 404

    async def test_preview_text_file(
        self,
        authenticated_client: AsyncClient,
        test_session: Session,
    ):
        """Test previewing a text file"""
        # First upload a file
        test_content = b"Hello, this is a test file content."
        await authenticated_client.post(
            f"/api/files/upload?session_id={test_session.id}",
            files={"files": ("test.txt", test_content, "text/plain")},
        )

        # Preview the file
        response = await authenticated_client.get(
            f"/api/files/{test_session.id}/preview/test.txt"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "text"
        assert data["filename"] == "test.txt"
        assert "content" in data

    async def test_delete_file(
        self,
        authenticated_client: AsyncClient,
        test_session: Session,
    ):
        """Test deleting a file"""
        # First upload a file
        await authenticated_client.post(
            f"/api/files/upload?session_id={test_session.id}",
            files={"files": ("to_delete.txt", b"content", "text/plain")},
        )

        # Delete the file
        response = await authenticated_client.delete(
            f"/api/files/{test_session.id}/to_delete.txt"
        )

        assert response.status_code == 204

    async def test_download_public_file_not_public(
        self, api_client: AsyncClient, test_session: Session
    ):
        """Test downloading file from non-public session"""
        response = await api_client.get(f"/api/files/public/{test_session.id}/test.txt")
        assert response.status_code == 404
