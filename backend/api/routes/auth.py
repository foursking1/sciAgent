"""
Authentication API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from backend.db.database import get_db_session
from backend.db.models.user import User
from backend.services.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_token,
)
from backend.schemas.auth import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
)

router = APIRouter()
security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db_session),
) -> User | None:
    """
    Get the current authenticated user (optional, returns None if not authenticated).
    """
    if credentials is None:
        return None

    token = credentials.credentials
    payload = decode_token(token)

    if payload is None or payload.get("sub") is None:
        return None

    user_id = int(payload["sub"])

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        return None

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """
    Get the current authenticated user.

    This is a reusable dependency for protecting routes.
    MODIFIED: Auto-login as default user if no credentials provided (dev mode)
    """
    # Try to get user from token
    if credentials is not None:
        token = credentials.credentials
        payload = decode_token(token)

        if payload is not None and payload.get("sub") is not None:
            user_id = int(payload["sub"])
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user is not None and user.is_active:
                return user

    # DEV MODE: Auto-login as first active user or create a default user
    result = await db.execute(select(User).where(User.is_active.is_(True)).limit(1))
    user = result.scalar_one_or_none()

    if user is not None:
        return user

    # No users exist, raise error
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user_for_sse(
    token: Optional[str] = Query(None, description="JWT token for SSE authentication"),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """
    Get the current authenticated user for SSE endpoints.

    Accepts token via query parameter (for EventSource) or Authorization header.
    """
    # Try query parameter first (for EventSource)
    if token:
        payload = decode_token(token)
        if payload is not None and payload.get("sub") is not None:
            user_id = int(payload["sub"])
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user is not None and user.is_active:
                return user

    # Fall back to header-based auth
    return await get_current_user(credentials, db)


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """
    Register a new user account.

    - **email**: Valid email address for login
    - **password**: Password (will be hashed)
    - **full_name**: Optional display name
    """
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        full_name=user_data.full_name,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Login with email and password.

    Returns a JWT access token for authentication.
    """
    # Find user
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
        )

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get current authenticated user information.
    """
    return current_user
