"""
File API routes.
"""
import os
import shutil
import logging
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse as FastAPIFileResponse

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.database import get_db_session
from backend.db.models.session import Session
from backend.db.models.file import File as FileModel
from backend.schemas.files import (
    FileListResponse,
    FileUploadResponse,
)
from backend.api.routes.auth import get_current_user
from backend.services.session_manager import session_manager
from backend.db.models.user import User

router = APIRouter()


def count_files_recursive(dir_path: Path) -> int:
    """
    Count ALL files in a directory recursively.
    Skips hidden files/directories.
    """
    count = 0
    try:
        for sub_item in dir_path.iterdir():
            if sub_item.name.startswith('.'):
                continue
            if sub_item.is_file():
                count += 1
            elif sub_item.is_dir():
                count += count_files_recursive(sub_item)
    except Exception:
        pass
    return count


# ============ Public File Endpoint ============

@router.get("/public/{session_id}/{file_path:path}")
async def download_public_file(
    session_id: str,
    file_path: str,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Download a file from a public session (no authentication required).
    """
    # Verify session is public
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.is_public == True)
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or not public",
        )

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

    return FastAPIFileResponse(
        path=full_path,
        filename=os.path.basename(file_path),
    )


# ============ Authenticated File Endpoints ============

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
    current_path: str = "",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    List files in a session at a specific path.

    - **current_path**: Relative path within the workspace (e.g., "data/processed")
    """
    # Verify session access
    session = await _verify_session_access(session_id, current_user.id, db)

    # Build full path
    workspace_path = Path(session.working_dir)
    if current_path:
        target_path = workspace_path / current_path
    else:
        target_path = workspace_path

    # Security check: ensure we're within workspace
    try:
        target_path = target_path.resolve()
        workspace_resolved = workspace_path.resolve()
        if not str(target_path).startswith(str(workspace_resolved)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: path outside workspace",
            )
    except Exception as e:
        logger.error(f"Path resolution error: {e}")
        return {"files": [], "total": 0}

    logger.info(f"Scanning path: {target_path}, exists: {target_path.exists()}")

    # Ensure path exists and is a directory
    if not target_path.exists() or not target_path.is_dir():
        return {"files": [], "total": 0}

    files = []

    # Scan the target directory
    try:
        for item in target_path.iterdir():
            # Skip hidden files/directories
            if item.name.startswith('.'):
                continue

            # Build relative path from workspace root
            relative_path = str(item.relative_to(workspace_path))

            logger.debug(f"Found item: {relative_path}, is_dir: {item.is_dir()}")

            if item.is_dir():
                # Count ALL files in this directory recursively
                try:
                    item_count = count_files_recursive(item)
                except Exception:
                    item_count = 0

                files.append({
                    "id": len(files),
                    "session_id": session_id,
                    "filename": item.name,
                    "file_path": relative_path,
                    "file_size": 0,
                    "content_type": "directory",
                    "item_count": item_count,  # Number of items in the directory
                    "created_at": datetime.fromtimestamp(item.stat().st_ctime),
                })
            else:
                stat = item.stat()
                files.append({
                    "id": len(files),
                    "session_id": session_id,
                    "filename": item.name,
                    "file_path": relative_path,
                    "file_size": stat.st_size,
                    "content_type": None,
                    "created_at": datetime.fromtimestamp(stat.st_ctime),
                })
    except Exception as e:
        logger.error(f"Error scanning directory {target_path}: {e}")

    logger.info(f"Found {len(files)} items in {current_path or 'root'}")

    # Sort: directories first, then files
    files.sort(key=lambda f: (f["content_type"] != "directory", f["filename"]))

    return {
        "files": files,
        "total": len(files),
    }


@router.get("/{session_id}/preview/{file_path:path}")
async def preview_file(
    session_id: str,
    file_path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Preview a file's content.
    Returns file content as text for code/text files, or metadata for binary files.

    Supported text formats: txt, md, json, yaml, yml, py, js, ts, jsx, tsx, html, css, sql, csv, log
    Supported images: png, jpg, jpeg, gif, svg, webp
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

    logger.info(f"Previewing file: {full_path}, exists: {os.path.exists(full_path)}")

    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    # Get file info
    file_name = os.path.basename(file_path)
    file_ext = file_name.split('.')[-1].lower() if '.' in file_name else ''
    file_size = os.path.getsize(full_path)

    # Text file extensions
    text_extensions = {
        'txt', 'md', 'markdown', 'json', 'yaml', 'yml', 'py', 'js', 'ts',
        'jsx', 'tsx', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'sql',
        'csv', 'log', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
        'c', 'cpp', 'h', 'hpp', 'java', 'go', 'rs', 'swift', 'kt', 'kts',
        'rb', 'php', 'pl', 'pm', 'lua', 'r', 'm', 'mm', 'scala', 'groovy',
        'dockerfile', 'makefile', 'cmake', 'toml', 'ini', 'cfg', 'conf',
        'properties', 'env', 'gitignore', 'gitattributes', 'editorconfig'
    }

    # Image file extensions
    image_extensions = {'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'}

    try:
        if file_ext in text_extensions:
            # Read as text
            with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            # Limit preview size (100KB max)
            max_size = 100 * 1024
            if len(content) > max_size:
                content = content[:max_size] + '\n\n... [File truncated, too large to preview]'

            return {
                "type": "text",
                "filename": file_name,
                "extension": file_ext,
                "size": file_size,
                "content": content,
            }

        elif file_ext in image_extensions:
            # Return image metadata and download URL
            return {
                "type": "image",
                "filename": file_name,
                "extension": file_ext,
                "size": file_size,
                "url": f"/api/files/{session_id}/{file_path}",
            }

        else:
            # Binary file - return metadata only
            return {
                "type": "binary",
                "filename": file_name,
                "extension": file_ext,
                "size": file_size,
                "message": "Binary file - download to view",
            }

    except Exception as e:
        logger.error(f"Error previewing file {full_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {str(e)}",
        )


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

    return FastAPIFileResponse(
        path=full_path,
        filename=os.path.basename(file_path),
    )


@router.delete("/{session_id}/{file_path:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    session_id: str,
    file_path: str,
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
