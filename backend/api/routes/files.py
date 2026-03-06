"""
File API routes.
"""
import os
import shutil
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.database import get_db_session
from backend.db.models.session import Session
from backend.db.models.file import File as FileModel
from backend.schemas.files import (
    FileResponse,
    FileListResponse,
    FileUploadResponse,
)
from backend.api.routes.auth import get_current_user
from backend.services.session_manager import session_manager
from backend.db.models.user import User

router = APIRouter()


async def _verify_session_access(
    session_id: str,
    user_id: int,
    db: AsyncSession,
) -> Session:
    """Verify user has access to a session"""
    session = await session_manager.get_session(
        session_id=session_id,
        user_id=user_id,
        db=db,
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    return session


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    session_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Upload a file to a session.

    - **session_id**: Target session ID
    - **file**: The file to upload (multipart/form-data)
    """
    # Verify session access
    session = await _verify_session_access(session_id, current_user.id, db)

    # Create file path in workspace
    file_path = os.path.join(session.working_dir, file.filename or "unknown")

    # Ensure directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    # Save file
    file_size = 0
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
            file_size = len(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}",
        )

    # Create database record
    file_record = FileModel(
        session_id=session_id,
        filename=file.filename or "unknown",
        file_path=file_path,
        file_size=file_size,
        content_type=file.content_type,
    )

    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)

    return {
        "success": True,
        "filename": file.filename or "unknown",
        "file_path": file_path,
        "file_size": file_size,
        "message": "File uploaded successfully",
    }


@router.get("/{session_id}", response_model=FileListResponse)
async def list_files(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    List files in a session.
    Scans the actual working directory to show all files and directories.
    """
    # Verify session access
    session = await _verify_session_access(session_id, current_user.id, db)

    workspace_path = Path(session.working_dir)

    # Ensure workspace exists
    if not workspace_path.exists():
        return {
            "files": [],
            "total": 0,
        }

    files = []

    # Scan the workspace directory
    def scan_directory(path: Path, relative_path: str = ""):
        for item in path.iterdir():
            item_relative_path = os.path.join(relative_path, item.name) if relative_path else item.name

            if item.is_dir():
                # Add directory
                files.append({
                    "id": len(files),
                    "session_id": session_id,
                    "filename": item.name,
                    "file_path": item_relative_path,
                    "file_size": 0,
                    "content_type": "directory",
                    "created_at": datetime.fromtimestamp(item.stat().st_ctime).isoformat(),
                })
                # Recursively scan subdirectory
                scan_directory(item, item_relative_path)
            else:
                # Add file
                stat = item.stat()
                files.append({
                    "id": len(files),
                    "session_id": session_id,
                    "filename": item.name,
                    "file_path": item_relative_path,
                    "file_size": stat.st_size,
                    "content_type": None,
                    "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                })

    scan_directory(workspace_path)

    # Sort: directories first, then files, both alphabetically
    files.sort(key=lambda f: (f["content_type"] != "directory", f["filename"]))

    return {
        "files": files,
        "total": len(files),
    }


@router.get("/{session_id}/{file_path:path}")
async def download_file(
    session_id: str,
    file_path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Download a file from a session.
    """
    # Verify session access
    session = await _verify_session_access(session_id, current_user.id, db)

    # Construct full file path
    full_path = os.path.join(session.working_dir, file_path)

    # Security check: ensure file is within workspace
    workspace_base = session.working_dir
    if not os.path.abspath(full_path).startswith(os.path.abspath(workspace_base)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: file path traversal detected",
        )

    if not os.path.exists(full_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    return FileResponse(
        path=full_path,
        filename=os.path.basename(file_path),
    )


@router.delete("/{file_path:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_path: str,
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a file from a session.
    """
    # Verify session access
    session = await _verify_session_access(session_id, current_user.id, db)

    # Construct full file path
    full_path = os.path.join(session.working_dir, file_path)

    # Security check: ensure file is within workspace
    workspace_base = session.working_dir
    if not os.path.abspath(full_path).startswith(os.path.abspath(workspace_base)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: file path traversal detected",
        )

    if not os.path.exists(full_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    # Delete file from filesystem
    try:
        os.remove(full_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}",
        )

    # Delete from database
    result = await db.execute(
        select(FileModel).where(FileModel.file_path == full_path)
    )
    file_record = result.scalar_one_or_none()

    if file_record:
        await db.delete(file_record)
        await db.commit()
