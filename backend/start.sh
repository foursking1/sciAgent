#!/bin/bash
# SciAgent 后端启动脚本

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
    echo "Total skills copied: $(ls -1 "$CLAUDE_AGENTS_DIR" | wc -l)"
}

# Copy skills on startup (for Docker environment)
copy_skills

# Check if running in Docker container (by checking if /app exists)
if [ -d "/app" ] && [ -d "/app/backend" ]; then
    # Docker environment - run uvicorn directly
    echo "Running in Docker environment..."
    exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
    exit 0
fi

# Local development environment
cd "$(dirname "$0")"

echo "============================================================"
echo "SciAgent Backend Server"
echo "============================================================"
echo ""
echo "启动方式:"
echo "  1. 直接运行 (日志输出到控制台和文件)"
echo "     ./start.sh"
echo ""
echo "  2. 后台运行 (日志输出到文件)"
echo "     ./start.sh --daemon"
echo ""
echo "  3. 查看实时日志"
echo "     ./start.sh --logs"
echo ""
echo "============================================================"
echo ""

# 检查参数
if [ "$1" == "--logs" ]; then
    # 查看实时日志
    echo "查看实时日志 (Ctrl+C 退出)..."
    tail -f logs/backend.log
    exit 0
fi

if [ "$1" == "--daemon" ]; then
    # 后台运行
    echo "后台启动服务..."
    nohup uv run uvicorn main:app --host 0.0.0.0 --port 8000 > logs/stdout.log 2>&1 &
    PID=$!
    echo "服务已启动 (PID: $PID)"
    echo ""
    echo "查看日志：./start.sh --logs"
    echo "停止服务：kill $PID"
    exit 0
fi

# 默认：直接运行
echo "启动服务 (日志输出到控制台和 logs/backend.log)..."
echo "按 Ctrl+C 停止服务"
echo ""
uv run uvicorn main:app --host 0.0.0.0 --port 8000
