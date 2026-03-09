"""
Authentication Service

Handles password hashing, JWT token creation and validation,
and user authentication dependencies.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from backend.core.config import settings
from backend.schemas.auth import TokenData


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: Plain text password to hash

    Returns:
        Hashed password string
    """
    # Truncate password to 72 bytes (bcrypt limit)
    password_bytes = password[:72].encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password to check against

    Returns:
        True if password matches, False otherwise
    """
    # Truncate password to 72 bytes (bcrypt limit)
    password_bytes = plain_password[:72].encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.

    Args:
        data: Data to encode in the token (should include 'sub' for user identifier)
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string to decode

    Returns:
        Decoded payload dict if valid, None if invalid or expired
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except (JWTError, jwt.ExpiredSignatureError, jwt.JWTClaimsError):
        return None


def get_current_user(token: Optional[str] = None) -> TokenData:
    """
    Get the current user from a JWT token.

    This is used as a FastAPI dependency to protect routes.

    Args:
        token: JWT token string (typically from Authorization header)

    Returns:
        TokenData with user information

    Raises:
        Exception: If token is invalid, expired, or missing
    """
    if token is None:
        raise Exception("Could not validate credentials")

    payload = decode_token(token)

    if payload is None:
        raise Exception("Could not validate credentials")

    username: str = payload.get("sub")
    if username is None:
        raise Exception("Could not validate credentials")

    return TokenData(username=username)
