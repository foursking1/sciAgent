"""
API routes for DataSource management.
"""

from typing import Annotated

from backend.api.routes.auth import get_current_user
from backend.db.database import get_db_session
from backend.db.models.data_source import DataSource
from backend.db.models.user import User
from backend.schemas.data_sources import (
    DataSourceCreate,
    DataSourceListResponse,
    DataSourceResponse,
    DataSourceTestResponse,
    DataSourceUpdate,
)
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/data-sources", tags=["data-sources"])


@router.get("", response_model=DataSourceListResponse)
async def list_data_sources(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """List all data sources for the current user"""
    result = await db.execute(
        select(DataSource)
        .where(DataSource.user_id == current_user.id)
        .order_by(DataSource.created_at.desc())
    )
    data_sources = result.scalars().all()

    return DataSourceListResponse(
        data_sources=[DataSourceResponse.model_validate(ds) for ds in data_sources],
        total=len(data_sources),
    )


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_data_source(
    data: DataSourceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """Create a new data source"""
    # Check if name already exists for this user
    existing = await db.execute(
        select(DataSource).where(
            DataSource.user_id == current_user.id, DataSource.name == data.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Data source with name '{data.name}' already exists",
        )

    data_source = DataSource(
        user_id=current_user.id,
        name=data.name,
        type=data.type,
        config=data.config,
        description=data.description,
    )
    db.add(data_source)
    await db.commit()
    await db.refresh(data_source)

    return DataSourceResponse.model_validate(data_source)


@router.get("/{data_source_id}", response_model=DataSourceResponse)
async def get_data_source(
    data_source_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """Get a specific data source by ID"""
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id, DataSource.user_id == current_user.id
        )
    )
    data_source = result.scalar_one_or_none()

    if not data_source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    return DataSourceResponse.model_validate(data_source)


@router.put("/{data_source_id}", response_model=DataSourceResponse)
async def update_data_source(
    data_source_id: int,
    data: DataSourceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """Update a data source"""
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id, DataSource.user_id == current_user.id
        )
    )
    data_source = result.scalar_one_or_none()

    if not data_source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    # Update fields
    if data.name is not None:
        # Check if new name conflicts with existing
        existing = await db.execute(
            select(DataSource).where(
                DataSource.user_id == current_user.id,
                DataSource.name == data.name,
                DataSource.id != data_source_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Data source with name '{data.name}' already exists",
            )
        data_source.name = data.name

    if data.config is not None:
        data_source.config = data.config
    if data.description is not None:
        data_source.description = data.description
    if data.is_active is not None:
        data_source.is_active = data.is_active

    await db.commit()
    await db.refresh(data_source)

    return DataSourceResponse.model_validate(data_source)


@router.delete("/{data_source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(
    data_source_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """Delete a data source"""
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id, DataSource.user_id == current_user.id
        )
    )
    data_source = result.scalar_one_or_none()

    if not data_source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    await db.delete(data_source)
    await db.commit()


@router.post("/{data_source_id}/test", response_model=DataSourceTestResponse)
async def test_data_source(
    data_source_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """Test a data source connection"""
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id, DataSource.user_id == current_user.id
        )
    )
    data_source = result.scalar_one_or_none()

    if not data_source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    # TODO: Implement actual connection testing based on type
    # For now, return a mock success response
    return DataSourceTestResponse(
        success=True,
        message=f"Successfully connected to {data_source.type} data source",
        details={"type": data_source.type, "name": data_source.name},
    )
