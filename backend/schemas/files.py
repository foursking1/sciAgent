"""
File schemas for request/response validation.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class FileInfo(BaseModel):
    """File info schema"""
    id: int
    session_id: str
    filename: str
    file_path: str
    file_size: int
    content_type: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileListResponse(BaseModel):
    """Response for listing files"""
    files: list[FileInfo]
    total: int
    current_path: str = ""


class FileUploadResponse(BaseModel):
    """Response for file upload"""
    success: bool
    filename: str
    file_path: str
    file_size: int
    message: str
