"""
Session schemas for request/response validation.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# Session mode types
SessionMode = Literal[
    "data-question", "scientific-experiment", "data-extraction", "paper-writing"
]


class SessionCreate(BaseModel):
    """Schema for creating a new session"""

    agent_type: Optional[str] = Field(
        default="claude_code", description="Type of agent to use"
    )
    mode: Optional[SessionMode] = Field(
        default="data-question", description="Session mode"
    )


class SessionResponse(BaseModel):
    """Session response schema"""

    id: str
    user_id: int
    working_dir: str
    title: Optional[str] = None
    agent_type: Optional[str] = None
    current_mode: str = "data-question"
    is_public: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    preview: Optional[str] = None  # Last message preview

    model_config = ConfigDict(from_attributes=True)


class PublicSessionResponse(BaseModel):
    """Public session response for landing page"""

    id: str
    title: Optional[str] = None
    current_mode: str = "data-question"
    created_at: datetime
    preview_image: Optional[str] = None  # Path to preview image
    pdf_path: Optional[str] = None  # Path to generated PDF

    model_config = ConfigDict(from_attributes=True)


class PublicSessionListResponse(BaseModel):
    """Response for listing public sessions"""

    sessions: list[PublicSessionResponse]
    total: int


class PublicSessionDetail(BaseModel):
    """Detailed public session with messages"""

    id: str
    title: Optional[str] = None
    current_mode: str = "data-question"
    created_at: datetime
    messages: list["MessageResponse"]
    is_owner: bool = False  # True if current user owns this session

    model_config = ConfigDict(from_attributes=True)


class SessionListResponse(BaseModel):
    """Response for listing sessions"""

    sessions: list[SessionResponse]
    total: int


class ModeUpdate(BaseModel):
    """Schema for updating session mode"""

    mode: SessionMode = Field(..., description="New mode")


class PublicUpdate(BaseModel):
    """Schema for updating session public status"""

    is_public: bool = Field(..., description="Whether session is public")


class MessageCreate(BaseModel):
    """Schema for creating a new message"""

    content: str = Field(..., min_length=1, description="Message content")


class MessageResponse(BaseModel):
    """Message response schema"""

    id: int
    session_id: str
    content: str
    role: str
    is_stopped: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskResponse(BaseModel):
    """Response for task submission"""

    task_id: str
    session_id: str
    status: str


class TaskStatusResponse(BaseModel):
    """Response for task status"""

    task_id: str
    session_id: str
    message: str
    user_id: int
    status: str
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    result: Optional[str] = None
