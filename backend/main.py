"""
SciAgent FastAPI Application

Main entry point for the backend server.
"""
import logging
import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from backend.core.config import settings
from backend.db.database import create_db_and_tables
from backend.api.routes import auth, sessions, files, data_sources


# 配置日志
import os
os.makedirs('/tmp/logs', exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),  # 输出到控制台
        logging.FileHandler('/tmp/logs/backend.log', mode='a', encoding='utf-8'),  # 输出到文件
    ]
)
logger = logging.getLogger('SciAgent')

# 降低第三方库的日志级别
logging.getLogger('agentic_data_scientist').setLevel(logging.WARNING)
logging.getLogger('google_adk').setLevel(logging.WARNING)
logging.getLogger('claude_agent_sdk').setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Runs on startup and shutdown.
    """
    # Startup
    logger.info("=" * 60)
    logger.info("Starting SciAgent backend...")
    logger.info(f"  Database: Creating tables...")
    await create_db_and_tables()
    logger.info(f"  Database: Tables created")
    logger.info(f"  Preloading DataScientist module...")

    # 预加载 DataScientist
    try:
        from backend.services.session_manager import session_manager
        await session_manager.preload_data_scientist()
        logger.info(f"  DataScientist: Preloaded successfully")
    except Exception as e:
        logger.warning(f"  DataScientist: Preload failed: {e}")

    # 启动 Task Worker
    try:
        from backend.services.task_worker import start_task_worker
        await start_task_worker(max_concurrent=3)
        logger.info(f"  TaskWorker: Started successfully")
    except Exception as e:
        logger.warning(f"  TaskWorker: Start failed: {e}")

    logger.info("SciAgent backend is ready!")
    logger.info("=" * 60)
    yield
    # Shutdown
    logger.info("=" * 60)
    logger.info("Shutting down SciAgent backend...")

    # 停止 Task Worker
    try:
        from backend.services.task_worker import stop_task_worker
        await stop_task_worker()
        logger.info("  TaskWorker: Stopped")
    except Exception as e:
        logger.warning(f"  TaskWorker: Stop failed: {e}")

    # 关闭 Task Queue Redis 连接
    try:
        from backend.services.task_queue import task_queue
        await task_queue.close()
        logger.info("  TaskQueue: Closed")
    except Exception as e:
        logger.warning(f"  TaskQueue: Close failed: {e}")

    logger.info("=" * 60)


# Create FastAPI application
app = FastAPI(
    title="SciAgent",
    description="Scientific Data Analysis Agent with Claude Code integration",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS Configuration
# Development: Allow all origins for easier debugging
# Production: Should restrict to specific domains
if settings.ENVIRONMENT == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow all origins in development
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unhandled exceptions"""
    print(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "error": str(exc) if settings.DEBUG else "An error occurred"},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle validation errors"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": exc.errors()},
    )


# Include API routers
app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["Authentication"],
)

app.include_router(
    sessions.router,
    prefix="/api/sessions",
    tags=["Sessions"],
)

app.include_router(
    files.router,
    prefix="/api/files",
    tags=["Files"],
)

app.include_router(
    data_sources.router,
    tags=["DataSources"],
)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint.

    Returns server status.
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,
    }


# Stats endpoint
@app.get("/stats", tags=["Stats"])
async def get_stats():
    """
    Get DataScientist cache statistics.
    """
    from backend.services.session_manager import session_manager
    return session_manager.get_stats()


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint.

    Returns API information.
    """
    return {
        "name": settings.APP_NAME,
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
