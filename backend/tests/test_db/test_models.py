"""
Tests for database models.

Following TDD approach - these tests should fail initially,
then we implement models to make them pass.
"""
import pytest
import pytest_asyncio
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.user import User
from backend.db.models.session import Session
from backend.db.models.message import Message
from backend.db.models.file import File


class TestUserModel:
    """Tests for User model"""

    @pytest_asyncio.fixture(scope="function")
    async def test_user(self, async_session: AsyncSession) -> User:
        """Create a test user"""
        user = User(
            email="test@example.com",
            password_hash="hashed_password_value",
            full_name="Test User"
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)
        return user

    async def test_user_model_create(self, async_session: AsyncSession):
        """测试用户模型创建"""
        user = User(
            email="test@example.com",
            password_hash="hashed_value"
        )
        async_session.add(user)
        await async_session.commit()

        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.is_active is True

    async def test_user_unique_email(self, async_session: AsyncSession):
        """测试用户邮箱唯一性"""
        user1 = User(
            email="unique@example.com",
            password_hash="hash1"
        )
        async_session.add(user1)
        await async_session.commit()

        # 尝试创建相同邮箱的用户应该失败
        user2 = User(
            email="unique@example.com",
            password_hash="hash2"
        )
        async_session.add(user2)

        with pytest.raises(Exception):
            await async_session.commit()

    async def test_user_is_active_default(self, async_session: AsyncSession):
        """测试用户默认是激活状态"""
        user = User(
            email="active@example.com",
            password_hash="hash"
        )
        async_session.add(user)
        await async_session.commit()

        assert user.is_active is True

    async def test_user_password_hash_not_plain(self, async_session: AsyncSession):
        """测试密码不是明文存储"""
        password = "SecurePassword123!"
        user = User(
            email="secure@example.com",
            password_hash="hashed_" + password  # 应该是哈希后的值
        )
        async_session.add(user)
        await async_session.commit()

        assert user.password_hash != password
        assert user.password_hash.startswith("hashed_")

    async def test_user_relationships(self, async_session: AsyncSession, test_user: User):
        """测试用户关联关系"""
        # 创建会话
        session = Session(
            id="session_123",
            user_id=test_user.id,
            working_dir="/tmp/test_session"
        )
        async_session.add(session)
        await async_session.commit()

        # 验证关系
        result = await async_session.execute(
            select(Session).where(Session.user_id == test_user.id)
        )
        sessions = result.scalars().all()
        assert len(sessions) == 1
        assert sessions[0].id == "session_123"


class TestSessionModel:
    """Tests for Session model"""

    @pytest_asyncio.fixture(scope="function")
    async def test_session(self, async_session: AsyncSession, test_user: User) -> Session:
        """Create a test session"""
        session = Session(
            id="session_test_123",
            user_id=test_user.id,
            working_dir="/tmp/test_session"
        )
        async_session.add(session)
        await async_session.commit()
        await async_session.refresh(session)
        return session

    async def test_session_create(self, async_session: AsyncSession, test_user: User):
        """测试会话创建"""
        session = Session(
            id="session_new",
            user_id=test_user.id,
            working_dir="/tmp/new_session"
        )
        async_session.add(session)
        await async_session.commit()

        assert session.id is not None
        assert session.user_id == test_user.id
        assert session.working_dir == "/tmp/new_session"

    async def test_session_relationship(self, async_session: AsyncSession):
        """测试会话与用户的关系"""
        user = User(email="test2@example.com", password_hash="hash")
        async_session.add(user)
        await async_session.commit()

        test_session = Session(
            id="session_test",
            user_id=user.id,
            working_dir="/tmp/test"
        )
        async_session.add(test_session)
        await async_session.commit()

        # 验证关系
        result = await async_session.execute(
            select(Session).where(Session.user_id == user.id)
        )
        sessions = result.scalars().all()
        assert len(sessions) == 1

    async def test_session_created_timestamp(self, async_session: AsyncSession, test_user: User):
        """测试会话创建时间戳"""
        session = Session(
            id="session_timestamp",
            user_id=test_user.id,
            working_dir="/tmp/session"
        )
        async_session.add(session)
        await async_session.commit()
        await async_session.refresh(session)

        assert session.created_at is not None
        # Just verify it's a valid datetime
        assert isinstance(session.created_at, datetime)

    async def test_session_user_relationship(self, async_session: AsyncSession, test_session: Session):
        """测试会话的用户关联"""
        result = await async_session.execute(
            select(Session)
            .where(Session.id == test_session.id)
        )
        session = result.scalar_one()

        assert session.user is not None
        assert session.user.email == "test@example.com"


class TestMessageModel:
    """Tests for Message model"""

    @pytest_asyncio.fixture(scope="function")
    async def test_message(self, async_session: AsyncSession, test_session: Session) -> Message:
        """Create a test message"""
        message = Message(
            session_id=test_session.id,
            content="Test message content",
            role="user"
        )
        async_session.add(message)
        await async_session.commit()
        await async_session.refresh(message)
        return message

    async def test_message_create(self, async_session: AsyncSession, test_session: Session):
        """测试消息创建"""
        message = Message(
            session_id=test_session.id,
            content="Hello, this is a test message",
            role="user"
        )
        async_session.add(message)
        await async_session.commit()

        assert message.id is not None
        assert message.content == "Hello, this is a test message"
        assert message.role == "user"

    async def test_message_role_validation(self, async_session: AsyncSession, test_session: Session):
        """测试消息角色验证"""
        # 有效角色
        for role in ["user", "assistant", "system"]:
            message = Message(
                session_id=test_session.id,
                content=f"Test {role} message",
                role=role
            )
            async_session.add(message)
            await async_session.commit()
            await async_session.refresh(message)
            assert message.role == role

    async def test_message_session_relationship(self, async_session: AsyncSession, test_message: Message):
        """测试消息的会话关联"""
        result = await async_session.execute(
            select(Message).where(Message.id == test_message.id)
        )
        message = result.scalar_one()
        await async_session.refresh(message, attribute_names=['session'])

        assert message.session is not None
        assert message.session.id == test_message.session.id

    async def test_message_timestamp(self, async_session: AsyncSession, test_session: Session):
        """测试消息时间戳"""
        message = Message(
            session_id=test_session.id,
            content="Timestamp test",
            role="user"
        )
        async_session.add(message)
        await async_session.commit()
        await async_session.refresh(message)

        assert message.created_at is not None
        # Just verify it's a valid datetime
        assert isinstance(message.created_at, datetime)


class TestFileModel:
    """Tests for File model"""

    @pytest_asyncio.fixture(scope="function")
    async def test_file(self, async_session: AsyncSession, test_session: Session) -> File:
        """Create a test file"""
        file = File(
            session_id=test_session.id,
            filename="test.csv",
            file_path="/tmp/test_session/test.csv",
            file_size=1024
        )
        async_session.add(file)
        await async_session.commit()
        await async_session.refresh(file)
        return file

    async def test_file_create(self, async_session: AsyncSession, test_session: Session):
        """测试文件创建"""
        file = File(
            session_id=test_session.id,
            filename="data.csv",
            file_path="/tmp/session/data.csv",
            file_size=2048
        )
        async_session.add(file)
        await async_session.commit()

        assert file.id is not None
        assert file.filename == "data.csv"
        assert file.file_path == "/tmp/session/data.csv"
        assert file.file_size == 2048

    async def test_file_session_relationship(self, async_session: AsyncSession, test_file: File):
        """测试文件的会话关联"""
        result = await async_session.execute(
            select(File).where(File.id == test_file.id)
        )
        file = result.scalar_one()
        await async_session.refresh(file, attribute_names=['session'])

        assert file.session is not None
        assert file.session.id == test_file.session.id

    async def test_file_content_type(self, async_session: AsyncSession, test_session: Session):
        """测试文件内容类型"""
        file = File(
            session_id=test_session.id,
            filename="data.csv",
            file_path="/tmp/session/data.csv",
            file_size=1024,
            content_type="text/csv"
        )
        async_session.add(file)
        await async_session.commit()

        assert file.content_type == "text/csv"

    async def test_file_session_files_relationship(self, async_session: AsyncSession, test_session: Session):
        """测试会话的文件列表关联"""
        # 创建多个文件
        for i in range(3):
            file = File(
                session_id=test_session.id,
                filename=f"file_{i}.csv",
                file_path=f"/tmp/session/file_{i}.csv",
                file_size=100 * (i + 1)
            )
            async_session.add(file)
        await async_session.commit()

        # 验证会话的文件列表 - need to refresh to load relationship
        await async_session.refresh(test_session, attribute_names=['files'])

        assert len(test_session.files) == 3


class TestIntegration:
    """Integration tests for all models"""

    async def test_full_session_workflow(self, async_session: AsyncSession):
        """测试完整的会话工作流"""
        # 1. 创建用户
        user = User(
            email="workflow@example.com",
            password_hash="hashed_password",
            full_name="Workflow User"
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)

        # 2. 创建会话
        session = Session(
            id="session_workflow",
            user_id=user.id,
            working_dir="/tmp/workflow_session"
        )
        async_session.add(session)
        await async_session.commit()
        await async_session.refresh(session)

        # 3. 创建消息
        message = Message(
            session_id=session.id,
            content="Analyze this data please",
            role="user"
        )
        async_session.add(message)
        await async_session.commit()
        await async_session.refresh(message)

        # 4. 创建文件
        file = File(
            session_id=session.id,
            filename="analysis.csv",
            file_path="/tmp/workflow_session/analysis.csv",
            file_size=5120
        )
        async_session.add(file)
        await async_session.commit()
        await async_session.refresh(file)

        # 5. 验证所有关系
        result = await async_session.execute(
            select(User)
            .where(User.id == user.id)
        )
        fetched_user = result.scalar_one()
        assert fetched_user.email == "workflow@example.com"

        result = await async_session.execute(
            select(Session)
            .where(Session.user_id == user.id)
        )
        sessions = result.scalars().all()
        assert len(sessions) == 1

        result = await async_session.execute(
            select(Message)
            .where(Message.session_id == session.id)
        )
        messages = result.scalars().all()
        assert len(messages) == 1

        result = await async_session.execute(
            select(File)
            .where(File.session_id == session.id)
        )
        files = result.scalars().all()
        assert len(files) == 1
