"""
Tests for DataSource tools.
"""

import pytest_asyncio
from backend.db.models.data_source import DataSource
from backend.db.models.user import User
from backend.services.data_source_tools import (
    DataSourceTools,
    get_database_schema_tool_description,
    get_skill_tool_description,
    get_tool_descriptions_for_data_sources,
    get_user_data_sources,
    get_vector_store_tool_description,
)
from sqlalchemy.ext.asyncio import AsyncSession


class TestDataSourceTools:
    """Tests for DataSource tools"""

    @pytest_asyncio.fixture(scope="function")
    async def test_user(self, async_session: AsyncSession) -> User:
        """Create a test user"""
        user = User(email="tools_test@example.com", password_hash="hashed_password")
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)
        return user

    @pytest_asyncio.fixture(scope="function")
    async def test_data_sources(
        self, async_session: AsyncSession, test_user: User
    ) -> list[DataSource]:
        """Create test data sources"""
        sources = [
            DataSource(
                user_id=test_user.id,
                name="Test DB",
                type="database",
                config={"host": "localhost", "port": 5432, "database": "test"},
                is_active=True,
            ),
            DataSource(
                user_id=test_user.id,
                name="Test Vector Store",
                type="vector_store",
                config={
                    "collection": "docs",
                    "embedding_model": "text-embedding-3-small",
                },
                is_active=True,
            ),
            DataSource(
                user_id=test_user.id,
                name="Test Skill",
                type="skill",
                config={"skill_name": "weather", "endpoint": "https://api.weather.com"},
                is_active=False,  # Inactive
            ),
        ]
        for source in sources:
            async_session.add(source)
        await async_session.commit()

        for source in sources:
            await async_session.refresh(source)
        return sources

    async def test_get_user_data_sources(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_data_sources: list[DataSource],
    ):
        """测试获取用户数据源"""
        sources = await get_user_data_sources(async_session, test_user.id)
        assert len(sources) == 2  # Only active ones

    async def test_get_user_data_sources_all(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_data_sources: list[DataSource],
    ):
        """测试获取所有用户数据源（包括非活跃）"""
        sources = await get_user_data_sources(
            async_session, test_user.id, active_only=False
        )
        assert len(sources) == 3

    async def test_get_database_schema_tool_description(
        self, test_data_sources: list[DataSource]
    ):
        """测试数据库工具描述生成"""
        db_source = test_data_sources[0]
        description = get_database_schema_tool_description(db_source)

        assert "Test DB" in description
        assert "localhost" in description
        assert "test" in description  # database name

    async def test_get_vector_store_tool_description(
        self, test_data_sources: list[DataSource]
    ):
        """测试向量库工具描述生成"""
        vs_source = test_data_sources[1]
        description = get_vector_store_tool_description(vs_source)

        assert "Test Vector Store" in description
        assert "docs" in description

    async def test_get_skill_tool_description(
        self, test_data_sources: list[DataSource]
    ):
        """测试Skill工具描述生成"""
        skill_source = test_data_sources[2]
        description = get_skill_tool_description(skill_source)

        assert "Test Skill" in description
        assert "weather" in description

    async def test_get_tool_descriptions_for_data_sources(
        self, test_data_sources: list[DataSource]
    ):
        """测试组合工具描述生成"""
        active_sources = [ds for ds in test_data_sources if ds.is_active]
        descriptions = get_tool_descriptions_for_data_sources(active_sources)

        assert "Test DB" in descriptions
        assert "Test Vector Store" in descriptions

    async def test_get_tool_definitions(self, test_data_sources: list[DataSource]):
        """测试工具定义生成"""
        active_sources = [ds for ds in test_data_sources if ds.is_active]
        tools = DataSourceTools.get_tool_definitions(active_sources)

        assert len(tools) == 2

        # Check database tool
        db_tool = next(t for t in tools if "query_database" in t["name"])
        assert "query" in db_tool["parameters"]["properties"]

        # Check vector store tool
        vs_tool = next(t for t in tools if "search_vector_store" in t["name"])
        assert "query" in vs_tool["parameters"]["properties"]
        assert "top_k" in vs_tool["parameters"]["properties"]
