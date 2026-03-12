# Database Migrations

This document describes how to run database migrations for the SciAgent project.

## Overview

SciAgent uses [Alembic](https://alembic.sqlalchemy.org/) for database migrations. Migrations are managed in the `backend/db/migrations/` directory.

## Prerequisites

Before running migrations, ensure:

1. Database server is running (MySQL 8.0+)
2. Python dependencies are installed (`uv sync`)
3. Environment variables are configured in `.env`

## Migration Files

Migration files are located in `backend/db/migrations/versions/`:

- `001_initial.py` - Initial schema (users, sessions, messages)
- `002_add_session_mode.py` - Add session mode support
- `003_add_message_stopped.py` - Add stopped flag to messages
- `004_add_session_title.py` - Add title field to sessions
- `005_update_session_mode.py` - Update session mode values
- `006_add_session_is_public.py` - Add public flag to sessions
- `006_add_data_sources.py` - Add data_sources table (note: duplicate version number)
- `007_add_session_events.py` - Add session_events table

## Running Migrations

### Development Environment

```bash
# Activate the virtual environment
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Run all pending migrations
uv run alembic upgrade head

# Run specific migration
uv run alembic upgrade +1

# Check current migration version
uv run alembic current

# View migration history
uv run alembic history
```

### Docker Environment

```bash
# For development environment
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head

# For production environment
docker compose exec backend alembic upgrade head
```

### Inside Running Container

```bash
# Enter the backend container
docker compose exec backend bash

# Run migrations
alembic upgrade head
```

## Creating New Migrations

When making database schema changes:

```bash
# Auto-generate migration from model changes
uv run alembic revision --autogenerate -m "description of changes"

# Create empty migration
uv run alembic revision -m "description of changes"
```

Then edit the generated migration file to add upgrade/downgrade logic.

## Rolling Back Migrations

```bash
# Rollback one migration
uv run alembic downgrade -1

# Rollback to specific version
uv run alembic downgrade <revision_id>

# Rollback all migrations (use with caution!)
uv run alembic downgrade base
```

## Troubleshooting

### Migration Conflicts

If you encounter conflicts:

1. Check current version: `alembic current`
2. View history: `alembic history`
3. Identify conflicting revisions
4. Manually edit migration files if needed

### Database Connection Issues

Ensure `.env` file has correct database configuration:

```env
MYSQL_ROOT_PASSWORD=your_password
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=scia gent
MYSQL_HOST=localhost
MYSQL_PORT=3306
```

### Permission Denied Errors

Ensure database user has necessary permissions:

```sql
GRANT ALL PRIVILEGES ON sciagent.* TO 'sciagent'@'%';
FLUSH PRIVILEGES;
```

## Session Events Cleanup

The `session_events` table can grow large over time. A cleanup mechanism is included to automatically remove old events:

- Events older than 30 days are automatically cleaned up
- Cleanup runs via a scheduled background job
- See `backend/services/session_manager.py` for implementation

## Best Practices

1. **Always review auto-generated migrations** before applying
2. **Test migrations on development database first**
3. **Keep migrations reversible** - always implement `downgrade()`
4. **Never modify existing migrations** - create new ones instead
5. **Back up production database** before running migrations

## Reference

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/en/20/)
