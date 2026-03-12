"""
Tests for DataSource model.

Following TDD approach - these tests verify the DataSource model works correctly.
"""

from backend.db.models.data_source import DataSource
from backend.db.models.user import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class TestDataSourceModel:
    """Tests for DataSource model"""

    async def test_create_database_data_source(self, async_session: AsyncSession, test_user: User):
        """测试创建数据库类型数据源"""
        ds = DataSource(
            user_id=test_user.id,
            name="Test Database",
            type="database",
            config={"host": "localhost", "port": 5432, "database": "test_db"},
        )
        async_session.add(ds)
        await async_session.commit()
        await async_session.refresh(ds)

        assert ds.id is not None
        assert ds.name == "Test Database"
        assert ds.type == "database"
        assert ds.config["host"] == "localhost"
        assert ds.config["port"] == 5432
        assert ds.is_active is True

    async def test_create_vector_store_data_source(
        self, async_session: AsyncSession, test_user: User
    ):
        """测试创建向量库类型数据源"""
        ds = DataSource(
            user_id=test_user.id,
            name="Test Vector Store",
            type="vector_store",
            config={
                "collection": "documents",
                "embedding_model": "text-embedding-3-small",
            },
        )
        async_session.add(ds)
        await async_session.commit()
        await async_session.refresh(ds)

        assert ds.id is not None
        assert ds.type == "vector_store"
        assert ds.config["collection"] == "documents"

    async def test_create_skill_data_source(self, async_session: AsyncSession, test_user: User):
        """测试创建Skill类型数据源"""
        ds = DataSource(
            user_id=test_user.id,
            name="Test Skill",
            type="skill",
            config={"skill_name": "weather_api", "endpoint": "https://api.weather.com"},
        )
        async_session.add(ds)
        await async_session.commit()
        await async_session.refresh(ds)

        assert ds.id is not None
        assert ds.type == "skill"

    async def test_data_source_user_relationship(
        self, async_session: AsyncSession, test_user: User
    ):
        """测试数据源与用户的关系"""
        ds = DataSource(
            user_id=test_user.id,
            name="Relationship Test",
            type="database",
            config={"host": "localhost"},
        )
        async_session.add(ds)
        await async_session.commit()
        await async_session.refresh(ds)

        # Test forward relationship
        assert ds.user_id == test_user.id

        # Test reverse relationship
        result = await async_session.execute(
            select(DataSource).where(DataSource.user_id == test_user.id)
        )
        data_sources = result.scalars().all()
        assert len(data_sources) == 1
        assert data_sources[0].name == "Relationship Test"

    async def test_data_source_config_json_field(
        self, async_session: AsyncSession, test_user: User
    ):
        """测试config字段存储复杂JSON"""
        complex_config = {
            "host": "localhost",
            "port": 5432,
            "credentials": {"username": "admin", "password": "secret"},
            "options": {"ssl": True, "timeout": 30},
        }
        ds = DataSource(
            user_id=test_user.id,
            name="Complex Config",
            type="database",
            config=complex_config,
        )
        async_session.add(ds)
        await async_session.commit()
        await async_session.refresh(ds)

        assert ds.config["credentials"]["username"] == "admin"
        assert ds.config["options"]["ssl"] is True

    async def test_data_source_default_is_active(
        self, async_session: AsyncSession, test_user: User
    ):
        """测试数据源默认是激活状态"""
        ds = DataSource(user_id=test_user.id, name="Active Test", type="database", config={})
        async_session.add(ds)
        await async_session.commit()
        await async_session.refresh(ds)

        assert ds.is_active is True

    async def test_data_source_can_be_deactivated(
        self, async_session: AsyncSession, test_user: User
    ):
        """测试数据源可以被停用"""
        ds = DataSource(
            user_id=test_user.id,
            name="Deactivate Test",
            type="database",
            config={},
            is_active=False,
        )
        async_session.add(ds)
        await async_session.commit()
        await async_session.refresh(ds)

        assert ds.is_active is False

    async def test_data_source_created_at_timestamp(
        self, async_session: AsyncSession, test_user: User
    ):
        """测试数据源创建时间戳"""
        ds = DataSource(user_id=test_user.id, name="Timestamp Test", type="database", config={})
        async_session.add(ds)
        await async_session.commit()
        await async_session.refresh(ds)

        assert ds.created_at is not None
        from datetime import datetime

        assert isinstance(ds.created_at, datetime)

    async def test_multiple_data_sources_for_user(
        self, async_session: AsyncSession, test_user: User
    ):
        """测试一个用户可以有多个数据源"""
        for i in range(3):
            ds = DataSource(
                user_id=test_user.id,
                name=f"Data Source {i}",
                type="database",
                config={"index": i},
            )
            async_session.add(ds)
        await async_session.commit()

        result = await async_session.execute(
            select(DataSource).where(DataSource.user_id == test_user.id)
        )
        data_sources = result.scalars().all()
        assert len(data_sources) == 3
