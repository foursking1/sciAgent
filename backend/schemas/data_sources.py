"""
Pydantic schemas for DataSource API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DataSourceBase(BaseModel):
    """Base schema for DataSource"""

    name: str = Field(..., min_length=1, max_length=100, description="Data source name")
    type: str = Field(
        ..., pattern="^(database|vector_store|skill)$", description="Data source type"
    )
    config: dict = Field(..., description="Configuration for the data source")
    description: Optional[str] = Field(None, description="Optional description")


class DataSourceCreate(DataSourceBase):
    """Schema for creating a new DataSource"""

    pass


class DataSourceUpdate(BaseModel):
    """Schema for updating a DataSource"""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    config: Optional[dict] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DataSourceResponse(DataSourceBase):
    """Schema for DataSource response"""

    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DataSourceListResponse(BaseModel):
    """Schema for list of DataSources"""

    data_sources: list[DataSourceResponse]
    total: int


class DataSourceTestRequest(BaseModel):
    """Schema for testing a DataSource connection"""

    pass


class DataSourceTestResponse(BaseModel):
    """Schema for DataSource test result"""

    success: bool
    message: str
    details: Optional[dict] = None
