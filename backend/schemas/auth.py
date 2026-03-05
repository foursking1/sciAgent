"""
Authentication schemas for request/response validation.
"""
from pydantic import BaseModel, EmailStr, ConfigDict


class TokenData(BaseModel):
    """Token payload data"""
    username: str | None = None
    user_id: int | None = None


class Token(BaseModel):
    """Authentication token response"""
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """JWT token payload structure"""
    sub: str | None = None
    exp: int | None = None


class UserCreate(BaseModel):
    """User registration schema"""
    email: EmailStr
    password: str
    full_name: str | None = None


class UserLogin(BaseModel):
    """User login schema"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User response schema (excludes password)"""
    id: int
    email: EmailStr
    full_name: str | None = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)
