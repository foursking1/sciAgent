FROM docker.1ms.run/library/python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y \
    git \
    curl \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user if not exists
RUN id -u appuser &>/dev/null || useradd -m -u 1000 appuser && \
    echo "appuser ALL=(ALL) NOPASSWD: /bin/chown" >> /etc/sudoers

# Create non-root user for running Claude Code
RUN useradd -m -u 1000 appuser

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip install --no-cache-dir -r requirements.txt

# Install agentic-data-scientist from Gitee
RUN pip install --no-cache-dir git+https://gitee.com/foursking1/agentic-data-scientist.git

# Copy application code
COPY backend ./backend

# Copy scientific skills
COPY scientific-skills /app/scientific-skills

# Create workspace directory with proper permissions
RUN mkdir -p /workspaces && chown -R appuser:appuser /workspaces

# Switch to non-root user
USER appuser

# Set PYTHONPATH to include the app directory
ENV PYTHONPATH=/app:$PYTHONPATH

# Expose port
EXPOSE 8000

# Run with start.sh script
CMD ["bash", "./backend/start.sh"]
