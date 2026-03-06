"""
Session schemas for request/response validation.
"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class SessionCreate(BaseModel):
    """Schema for creating a new session"""
    agent_type: Optional[str] = Field(default="claude_code", description="Type of agent to use")


class SessionResponse(BaseModel):
    """Session response schema"""
    id: str
    user_id: int
    working_dir: str
    agent_type: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SessionListResponse(BaseModel):
    """Response for listing sessions"""
    sessions: list[SessionResponse]
    total: int


class MessageCreate(BaseModel):
    """Schema for creating a new message"""
    content: str = Field(..., min_length=1, description="Message content")


class MessageResponse(BaseModel):
    """Message response schema"""
    id: int
    session_id: str
    content: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
