"""
Authentication Service Tests

Tests for password hashing, JWT token creation, and user authentication.
"""

import time
from datetime import timedelta

import pytest
from backend.schemas.auth import TokenData
from backend.services.auth import (
    create_access_token,
    decode_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from jose import jwt

SECRET_KEY = "test-secret-key-for-testing-only"
ALGORITHM = "HS256"


class TestPasswordHashing:
    """Tests for password hashing functionality"""

    def test_password_hashing(self):
        """Test password hashing"""
        password = "SecurePassword123!"
        hashed = get_password_hash(password)

        assert hashed != password
        assert verify_password(password, hashed)
        assert not verify_password("wrong", hashed)

    def test_password_hash_is_unique(self):
        """Test that same password produces different hashes"""
        password = "SamePassword123!"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        assert hash1 != hash2
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)

    def test_verify_password_with_empty_password(self):
        """Test password verification with empty password"""
        hashed = get_password_hash("notempty")
        assert not verify_password("", hashed)

    def test_verify_password_with_special_characters(self):
        """Test password with special characters"""
        password = "P@$$w0rd!#$%^&*()"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed)

    def test_verify_password_with_unicode(self):
        """Test password with unicode characters"""
        password = "Password\u4e2d\u6587"  # Chinese characters
        hashed = get_password_hash(password)
        assert verify_password(password, hashed)


class TestAccessTokenCreation:
    """Tests for JWT token creation"""

    def test_access_token_creation(self):
        """Test JWT token generation"""
        token = create_access_token({"sub": "user123"})

        assert token is not None
        assert len(token) > 50

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "user123"

    def test_access_token_with_custom_expires_delta(self):
        """Test token creation with custom expiration time"""
        expires_delta = timedelta(minutes=60)
        token = create_access_token({"sub": "user456"}, expires_delta=expires_delta)

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "user456"
        assert "exp" in payload

    def test_token_expiration(self):
        """Test token expiration"""
        token = create_access_token(
            {"sub": "user123"}, expires_delta=timedelta(seconds=1)
        )

        time.sleep(2)

        with pytest.raises(jwt.ExpiredSignatureError):
            jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    def test_token_has_correct_claims(self):
        """Test that token contains required claims"""
        token = create_access_token({"sub": "user789"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        assert "sub" in payload
        assert "exp" in payload
        assert payload["sub"] == "user789"


class TestDecodeToken:
    """Tests for token decoding"""

    def test_decode_valid_token(self):
        """Test decoding a valid token"""
        token = create_access_token({"sub": "testuser"})
        payload = decode_token(token)

        assert payload is not None
        assert payload["sub"] == "testuser"

    def test_decode_invalid_token(self):
        """Test decoding an invalid token"""
        invalid_token = "invalid.token.here"
        payload = decode_token(invalid_token)

        assert payload is None

    def test_decode_expired_token(self):
        """Test decoding an expired token"""
        token = create_access_token(
            {"sub": "user123"}, expires_delta=timedelta(seconds=1)
        )
        time.sleep(2)

        payload = decode_token(token)
        assert payload is None


class TestGetCurrentUser:
    """Tests for get_current_user dependency"""

    def test_get_current_user_with_valid_token(self):
        """Test getting current user with valid token"""
        token = create_access_token({"sub": "current_user"})

        token_data = get_current_user(token)

        assert token_data is not None
        assert isinstance(token_data, TokenData)
        assert token_data.username == "current_user"

    def test_get_current_user_with_invalid_token(self):
        """Test getting current user with invalid token"""
        with pytest.raises(Exception):
            get_current_user("invalid_token")

    def test_get_current_user_with_expired_token(self):
        """Test getting current user with expired token"""
        token = create_access_token(
            {"sub": "expired_user"}, expires_delta=timedelta(seconds=1)
        )
        time.sleep(2)

        with pytest.raises(Exception):
            get_current_user(token)

    def test_get_current_user_raises_exception(self):
        """Test that get_current_user raises appropriate exception"""
        with pytest.raises(Exception, match="Could not validate credentials"):
            get_current_user(None)
