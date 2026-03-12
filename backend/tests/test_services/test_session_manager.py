"""
Tests for SessionManager and DataScientist integration.
"""

import os
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from backend.db.models.message import MessageRole
from backend.db.models.session import Session
from backend.services.session_manager import SessionManager
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def temp_workspace():
    """Create a temporary workspace directory for testing"""
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("backend.core.config.settings.WORKSPACE_BASE", tmpdir):
            yield tmpdir


@pytest.fixture
def session_manager_instance(temp_workspace):
    """Create a fresh SessionManager instance for testing"""
    return SessionManager()


class TestSessionManagerBasic:
    """Test basic SessionManager functionality without DataScientist"""

    @pytest_asyncio.fixture
    async def test_session_obj(self, session_manager_instance, test_user) -> Session:
        """Create a test session"""
        session = await session_manager_instance.create_session(
            user_id=test_user.id,
            agent_type="claude_code",
            db=None,  # No database for basic tests
        )
        yield session
        # Cleanup
        if os.path.exists(session.working_dir):
            import shutil

            shutil.rmtree(session.working_dir, ignore_errors=True)

    async def test_create_session(self, session_manager_instance, test_user):
        """Test session creation creates workspace directory"""
        session = await session_manager_instance.create_session(
            user_id=test_user.id,
            agent_type="claude_code",
            db=None,
        )

        assert session.id is not None
        assert session.user_id == test_user.id
        assert session.agent_type == "claude_code"
        assert os.path.exists(session.working_dir)

        # Cleanup
        import shutil

        shutil.rmtree(session.working_dir, ignore_errors=True)

    async def test_get_session_no_db(self, session_manager_instance, test_user):
        """Test get_session returns None without database"""
        session = await session_manager_instance.get_session(
            session_id="nonexistent",
            user_id=test_user.id,
            db=None,
        )
        assert session is None

    async def test_add_message_no_db(self, session_manager_instance):
        """Test add_message returns None without database"""
        message = await session_manager_instance.add_message(
            session_id="test_session",
            content="Test message",
            role=MessageRole.USER,
            db=None,
        )
        assert message is None


class TestDataScientistIntegration:
    """Test DataScientist integration with mocking"""

    @pytest.fixture
    def mock_data_scientist(self):
        """Mock DataScientist class for testing"""

        # Create mock async iterator
        async def mock_stream_iterator(*args, **kwargs):
            events = [
                {"type": "assistant_message", "content": "Hello from DataScientist!"},
                {"type": "completed", "status": "done"},
            ]
            for event in events:
                yield event

        # Create mock DataScientist instance
        mock_ds_instance = MagicMock()
        mock_ds_instance.run_async = AsyncMock(
            side_effect=lambda msg, stream=True: (
                mock_stream_iterator() if stream else {"result": "success"}
            )
        )

        # Create mock module structure
        mock_core = MagicMock()
        mock_core.api.DataScientist = mock_ds_instance
        mock_module = MagicMock()
        mock_module.core = mock_core

        # Patch sys.modules to mock the import
        with patch.dict(
            "sys.modules",
            {
                "agentic_data_scientist": mock_module,
                "agentic_data_scientist.core": mock_core,
                "agentic_data_scientist.core.api": mock_core.api,
            },
        ):
            yield mock_ds_instance

    @pytest_asyncio.fixture
    async def ds_test_session(self, session_manager_instance, test_user) -> Session:
        """Create a test session for DataScientist tests"""
        session = await session_manager_instance.create_session(
            user_id=test_user.id,
            agent_type="claude_code",
            db=None,
        )
        yield session
        # Cleanup
        if os.path.exists(session.working_dir):
            import shutil

            shutil.rmtree(session.working_dir, ignore_errors=True)

    async def test_run_data_scientist_streaming(
        self,
        session_manager_instance,
        ds_test_session,
        mock_data_scientist,
    ):
        """Test streaming DataScientist response"""
        events = []
        async for event in session_manager_instance.run_data_scientist(
            session=ds_test_session,
            message="Analyze this data",
            stream=True,
        ):
            events.append(event)

        assert len(events) > 0
        # Check that events have 'data' key with JSON string
        for event in events:
            assert "data" in event
            import json

            event_data = json.loads(event["data"])
            assert "type" in event_data or "content" in event_data

    async def test_run_data_scientist_non_streaming(
        self,
        session_manager_instance,
        ds_test_session,
        mock_data_scientist,
    ):
        """Test non-streaming DataScientist response"""
        events = []
        async for event in session_manager_instance.run_data_scientist(
            session=ds_test_session,
            message="Analyze this data",
            stream=False,
        ):
            events.append(event)

        assert len(events) == 1
        import json

        result = json.loads(events[0]["data"])
        assert result is not None

    async def test_run_data_scientist_import_error(
        self, session_manager_instance, ds_test_session
    ):
        """Test error handling when DataScientist is not available"""
        with patch.dict("sys.modules", {"agentic_data_scientist.core.api": None}):
            events = []
            async for event in session_manager_instance.run_data_scientist(
                session=ds_test_session,
                message="Test message",
                stream=True,
            ):
                events.append(event)

        # Should return error event
        assert len(events) > 0
        import json

        error_event = json.loads(events[0]["data"])
        assert error_event["type"] == "error"
        assert "DataScientist" in error_event["message"]


class TestSessionManagerWithDatabase:
    """Test SessionManager with database integration"""

    async def test_create_session_with_db(
        self,
        session_manager_instance,
        test_user,
        async_session: AsyncSession,
    ):
        """Test session creation with database"""
        session = await session_manager_instance.create_session(
            user_id=test_user.id,
            agent_type="claude_code",
            db=async_session,
        )

        assert session.id is not None
        assert session.user_id == test_user.id

        # Verify in database
        from backend.db.models.session import Session
        from sqlalchemy import select

        result = await async_session.execute(
            select(Session).where(Session.id == session.id)
        )
        db_session = result.scalar_one_or_none()
        assert db_session is not None
        assert db_session.working_dir == session.working_dir

    async def test_get_session_with_db(
        self,
        session_manager_instance,
        test_user,
        test_session,
        async_session: AsyncSession,
    ):
        """Test getting session from database"""
        session = await session_manager_instance.get_session(
            session_id=test_session.id,
            user_id=test_user.id,
            db=async_session,
        )

        assert session is not None
        assert session.id == test_session.id
        assert session.user_id == test_user.id

    async def test_list_sessions(
        self,
        session_manager_instance,
        test_user,
        async_session: AsyncSession,
    ):
        """Test listing user sessions"""
        # Create multiple sessions
        await session_manager_instance.create_session(
            user_id=test_user.id,
            agent_type="claude_code",
            db=async_session,
        )
        await session_manager_instance.create_session(
            user_id=test_user.id,
            agent_type="adk",
            db=async_session,
        )

        sessions = await session_manager_instance.list_sessions(
            user_id=test_user.id,
            db=async_session,
        )

        assert len(sessions) >= 2

    async def test_delete_session(
        self,
        session_manager_instance,
        test_user,
        async_session: AsyncSession,
    ):
        """Test session deletion"""
        # Create session
        session = await session_manager_instance.create_session(
            user_id=test_user.id,
            agent_type="claude_code",
            db=async_session,
        )

        # Delete session
        deleted = await session_manager_instance.delete_session(
            session_id=session.id,
            user_id=test_user.id,
            db=async_session,
            cleanup_workspace=True,
        )

        assert deleted is True

        # Verify deleted from database
        from backend.db.models.session import Session
        from sqlalchemy import select

        result = await async_session.execute(
            select(Session).where(Session.id == session.id)
        )
        assert result.scalar_one_or_none() is None

    async def test_add_message_with_db(
        self,
        session_manager_instance,
        test_session,
        async_session: AsyncSession,
    ):
        """Test adding message with database"""
        message = await session_manager_instance.add_message(
            session_id=test_session.id,
            content="Test message content",
            role=MessageRole.USER,
            db=async_session,
        )

        assert message is not None
        assert message.content == "Test message content"
        assert message.role == MessageRole.USER
        assert message.session_id == test_session.id

    async def test_get_messages(
        self,
        session_manager_instance,
        test_session,
        async_session: AsyncSession,
    ):
        """Test getting messages for a session"""
        # Add messages
        await session_manager_instance.add_message(
            session_id=test_session.id,
            content="Hello",
            role=MessageRole.USER,
            db=async_session,
        )
        await session_manager_instance.add_message(
            session_id=test_session.id,
            content="Hi there",
            role=MessageRole.ASSISTANT,
            db=async_session,
        )

        messages = await session_manager_instance.get_messages(
            session_id=test_session.id,
            db=async_session,
        )

        assert len(messages) >= 2
