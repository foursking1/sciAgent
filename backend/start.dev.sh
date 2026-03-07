#!/bin/bash
# SciAgent 后端开发环境启动脚本 - 支持热重载

set -e

# Function to copy skills to Claude agents directory
copy_skills() {
    echo "Copying scientific skills to Claude agents directory..."

    # Define source and destination
    SKILLS_SOURCE="/app/scientific-skills"
    CLAUDE_AGENTS_DIR="/home/appuser/.claude/agents"

    # Check if source directory exists
    if [ ! -d "$SKILLS_SOURCE" ]; then
        echo "Warning: Scientific skills directory not found at $SKILLS_SOURCE"
        return 0
    fi

    # Create Claude agents directory if it doesn't exist
    mkdir -p "$CLAUDE_AGENTS_DIR"

    # Copy all skill directories
    for skill_dir in "$SKILLS_SOURCE"/*/; do
        if [ -d "$skill_dir" ]; then
            skill_name=$(basename "$skill_dir")
            echo "  Copying skill: $skill_name"
            cp -r "$skill_dir" "$CLAUDE_AGENTS_DIR/"
        fi
    done

    echo "Skills copied successfully to $CLAUDE_AGENTS_DIR"
    echo "Total skills copied: $(ls -1 "$CLAUDE_AGENTS_DIR" 2>/dev/null | wc -l)"
}

# Copy skills on startup (for Docker environment)
copy_skills

# Check if running in Docker container
if [ -d "/app" ] && [ -d "/app/backend" ]; then
    echo "============================================================"
    echo "SciAgent Backend - DEVELOPMENT MODE"
    echo "Hot reload enabled: Changes to backend code will auto-reload"
    echo "============================================================"
    echo ""

    # Development mode with hot reload
    exec uvicorn backend.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload \
        --reload-dir /app/backend \
        --log-level debug
fi

# Local development environment with uv
cd "$(dirname "$0")"

echo "============================================================"
echo "SciAgent Backend Server - DEVELOPMENT MODE"
echo "Hot reload enabled"
echo "============================================================"
echo ""

# Default: run with uv and hot reload
uv run uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level debug
