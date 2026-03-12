"""
Pytest configuration and fixtures for database testing.
"""

import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import patch

import pytest
import pytest_asyncio
from backend.db.database import Base, get_db_session
from backend.db.models.session import Session
from backend.db.models.user import User
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

# Test database URL using SQLite for faster in-memory testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def api_client(async_session: AsyncSession):
    """Create a test client for API testing"""
    from backend.api.routes.auth import get_current_user_optional
    from backend.main import app
    from httpx import ASGITransport, AsyncClient

    # Override database session
    async def override_get_db():
        yield async_session

    app.dependency_overrides[get_db_session] = override_get_db

    # Override optional auth to return None (not authenticated)
    async def override_get_current_user_optional():
        return None

    app.dependency_overrides[get_current_user_optional] = override_get_current_user_optional

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    # Cleanup overrides
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def authenticated_client(async_session: AsyncSession, test_user: User):
    """Create an authenticated test client"""
    from backend.api.routes.auth import get_current_user
    from backend.main import app
    from httpx import ASGITransport, AsyncClient

    # Override database session
    async def override_get_db():
        yield async_session

    app.dependency_overrides[get_db_session] = override_get_db

    # Override auth to return test user
    async def override_get_current_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def use_test_settings():
    """Use test settings for all tests"""
    with patch("backend.core.config.settings.SECRET_KEY", "test-secret-key-for-testing-only"):
        with patch("backend.core.config.settings.ALGORITHM", "HS256"):
            with patch("backend.core.config.settings.DATABASE_URL", TEST_DATABASE_URL):
                yield


@pytest_asyncio.fixture(scope="function")
async def async_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create an async engine for testing"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def async_session(
    async_engine: AsyncEngine,
) -> AsyncGenerator[AsyncSession, None]:
    """Create an async session for testing"""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session_maker() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def test_user(async_session: AsyncSession) -> User:
    """Create a test user fixture"""
    user = User(
        email="test@example.com",
        password_hash="hashed_password_value",
        full_name="Test User",
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def test_session(async_session: AsyncSession, test_user: User) -> Session:
    """Create a test session fixture"""
    session = Session(id="session_test_123", user_id=test_user.id, working_dir="/tmp/test_session")
    async_session.add(session)
    await async_session.commit()
    await async_session.refresh(session)
    return session


@pytest_asyncio.fixture(scope="function")
async def db_session(async_session: AsyncSession) -> AsyncGenerator[AsyncSession, None]:
    """Override get_db_session for API tests"""

    def override_get_db_session():
        return async_session

    with patch("backend.db.database.get_db_session", override_get_db_session):
        yield async_session


@pytest.fixture(scope="function")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for each test case"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
