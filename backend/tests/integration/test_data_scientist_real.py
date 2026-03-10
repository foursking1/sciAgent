"""
Integration test for actual DataScientist calls.

This test requires:
1. ANTHROPIC_API_KEY environment variable set
2. OPENROUTER_API_KEY environment variable set

Run with:
    uv run --python 3.12 pytest backend/tests/integration/test_data_scientist_real.py -v
"""

import json
import os
import shutil
import tempfile

import pytest
import pytest_asyncio
from backend.db.models.session import Session
from backend.services.session_manager import SessionManager

# Skip all tests in this module if API keys not available
pytestmark = pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="Requires ANTHROPIC_API_KEY to be set",
)


@pytest.fixture(scope="function")
def temp_workspace():
    """Create a temporary workspace directory"""
    tmpdir = tempfile.mkdtemp()
    yield tmpdir
    # Cleanup
    if os.path.exists(tmpdir):
        shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture(scope="function")
def session_manager_instance(temp_workspace):
    """Create a fresh SessionManager instance"""
    os.environ["WORKSPACE_BASE"] = temp_workspace
    return SessionManager()


@pytest_asyncio.fixture
async def test_session(session_manager_instance) -> Session:
    """Create a test session"""
    session = await session_manager_instance.create_session(
        user_id=99999,  # Test user ID
        agent_type="claude_code",
        db=None,
    )
    yield session
    # Cleanup
    if os.path.exists(session.working_dir):
        shutil.rmtree(session.working_dir, ignore_errors=True)


class TestDataScientistRealCalls:
    """Test actual DataScientist calls (requires API keys)"""

    @pytest.mark.asyncio
    async def test_data_scientist_initialization(
        self,
        session_manager_instance,
        test_session,
    ):
        """Test that DataScientist can be initialized"""
        from agentic_data_scientist.core.api import DataScientist

        ds = DataScientist(
            agent_type=test_session.agent_type,
            working_dir=test_session.working_dir,
            auto_cleanup=False,
        )

        assert ds is not None
        assert ds.working_dir == test_session.working_dir

    @pytest.mark.asyncio
    async def test_data_scientist_simple_message(
        self,
        session_manager_instance,
        test_session,
    ):
        """Test DataScientist with a simple message"""
        events = []
        async for event in session_manager_instance.run_data_scientist(
            session=test_session,
            message="Hello, please introduce yourself briefly.",
            stream=True,
        ):
            events.append(event)
            print(f"Received event: {event}")

        # Should have received events
        assert len(events) > 0, "No events received from DataScientist"

        # Check event structure
        for event in events:
            assert "data" in event
            event_data = json.loads(event["data"])
            print(f"Event data: {event_data}")

    @pytest.mark.asyncio
    async def test_data_scientist_code_generation(
        self,
        session_manager_instance,
        test_session,
    ):
        """Test DataScientist with code generation request"""
        events = []
        async for event in session_manager_instance.run_data_scientist(
            session=test_session,
            message="Write a Python function to calculate fibonacci numbers.",
            stream=True,
        ):
            events.append(event)

        # Should have received events
        assert len(events) > 0

    @pytest.mark.asyncio
    async def test_data_scientist_non_streaming(
        self,
        session_manager_instance,
        test_session,
    ):
        """Test DataScientist non-streaming mode"""
        events = []
        async for event in session_manager_instance.run_data_scientist(
            session=test_session,
            message="What is 2+2?",
            stream=False,
        ):
            events.append(event)

        assert len(events) == 1
