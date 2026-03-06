# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SciAgent - AI-driven scientific research automation platform. End-to-end agent workflow (Planning → Execution → Summary) for scientific data analysis with visualization and report generation.

## Tech Stack

**Backend**: FastAPI 0.115, Python 3.12, SQLAlchemy 2.0 (async), MySQL 8.0, Redis 7, JWT auth, agentic-data-scientist ≥0.2.0

**Frontend**: Next.js 14, TypeScript, TailwindCSS, Vitest, Playwright

**Infrastructure**: Docker Compose, uv for Python dependency management

## Quick Start

```bash
# Start all services (MySQL, Redis, Backend, Frontend)
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

Access: Frontend http://localhost:3000 | API http://localhost:8000 | Docs http://localhost:8000/docs

## Development Commands

### Backend

```bash
cd backend

# Install dependencies
uv sync

# Run tests
uv run pytest backend/tests/ -v

# Run single test
uv run pytest backend/tests/test_services/test_auth.py::test_get_password_hash -v

# Run with coverage
uv run pytest backend/tests/ --cov=backend --cov-report=html

# Start dev server
uv run uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Lint
uv run ruff check .
uv run black . --check
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Dev server
npm run dev

# Run tests
npm test

# E2E tests
npm run test:e2e

# Build
npm run build
```

## Architecture

### Backend Structure

```
backend/
├── api/routes/          # API endpoints (auth, sessions, files)
├── core/config.py       # Settings via pydantic-settings
├── db/
│   ├── models/          # SQLAlchemy models (User, Session, Message, File)
│   ├── migrations/      # Alembic migrations
│   └── database.py      # Async engine & session factory
├── services/
│   ├── auth.py          # Password hashing, JWT create/verify
│   └── session_manager.py  # Session lifecycle, DataScientist integration
├── schemas/             # Pydantic models for API validation
└── tests/               # pytest tests (34 passing)
```

### Frontend Structure

```
frontend/
├── app/
│   ├── (auth)/          # Login, register pages
│   ├── dashboard/       # Session list
│   └── session/[id]/    # Chat interface
├── components/
│   ├── chat/            # SessionChat, EventStream, ChatInput, FileBrowser
│   ├── layout/          # Header
│   └── ui/              # Button, Input, CodeBlock
├── hooks/               # useAuth, useSSE
└── lib/                 # API client, utils
```

### Key Components

- **SessionManager** (`backend/services/session_manager.py`): Manages user sessions, working directories, and DataScientist lifecycle. Uses instance pool for preloading.

- **DataScientist Integration**: Core analysis engine from `agentic-data-scientist`. Supports `claude_code` and `adk` agent types. Streams events via SSE.

- **Auth Flow**: JWT tokens (30min expiry), bcrypt password hashing. `get_current_user` dependency protects routes.

## Environment Variables

Required in `.env`:

```bash
# Database
MYSQL_ROOT_PASSWORD=xxx
MYSQL_PASSWORD=xxx

# JWT
JWT_SECRET=xxx

# API Keys
ANTHROPIC_API_KEY=sk-ant-xxx
OPENROUTER_API_KEY=xxx

# Workspace
WORKSPACE_BASE=./workspaces
```

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns JWT)
- `GET /api/sessions` - List user sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/{id}/events` - SSE stream for agent responses
- `POST /api/files/upload` - Upload file to session

## Testing

All backend tests use `pytest-asyncio` with auto mode. Tests are organized by module:

- `test_db/test_models.py` - Database model tests (18 tests)
- `test_services/test_auth.py` - Authentication service tests (16 tests)

Test pattern: Each test gets a fresh async database session with automatic rollback.

## Design System

- **Colors**: Deep Space Blue (#0080ff), Quantum Purple (#8b5cf6), Deep Space Gray (#0a0a0f)
- **Fonts**: Inter (UI), JetBrains Mono (code)
- **Style**: Scientific minimalism with futuristic elements
