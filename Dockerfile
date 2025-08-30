# =============================================================================
# Multi-stage Dockerfile for Bulgarian Voice Coach
# Using Wolfi-based minimal images for security and size optimization
# =============================================================================

# Build stage for frontend using Bun with Wolfi
FROM cgr.dev/chainguard/wolfi-base:20240801 AS frontend-builder

# Set shell with pipefail for better error handling
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# Install Bun directly (specific version for reproducibility)
RUN apk add --no-cache curl bash && \
    curl -fsSL https://bun.sh/install | bash -s -- bun-v1.1.22 && \
    mv /root/.bun/bin/bun /usr/local/bin/ && \
    rm -rf /root/.bun

WORKDIR /app/client

# Copy package files
COPY client/package.json client/bun.lockb ./

# Install dependencies with frozen lockfile
RUN bun install --frozen-lockfile

# Copy source code
COPY client/ .

# Build frontend
RUN bun run build

# =============================================================================
# Production stage using Chainguard's Python image
FROM cgr.dev/chainguard/python:3.11-dev AS production

# Set shell with pipefail
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    UV_SYSTEM_PYTHON=1

# Switch to root for package installation
USER root

# Install system dependencies
RUN apk add --no-cache \
    espeak-ng \
    alsa-lib \
    curl \
    bash

# Install uv for Python package management (specific version)
RUN curl -LsSf https://astral.sh/uv/0.4.18/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/ && \
    rm -rf /root/.local

# Create app directory and set up virtual environment
WORKDIR /app

# Copy Python dependencies
COPY pyproject.toml uv.lock* ./

# Install Python dependencies in virtual environment
RUN uv venv .venv && \
    uv sync --locked --no-dev

# Copy server code
COPY server/ ./server/
COPY content/ ./content/

# Copy built frontend from build stage
COPY --from=frontend-builder /app/client/dist ./client/dist

# Create non-root user and set permissions
RUN adduser -D -h /app -s /bin/ash app && \
    chown -R app:app /app

# Switch to non-root user
USER app

# Create directories for models and data
RUN mkdir -p /app/data/models /app/data/logs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command
CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]

# =============================================================================
# Development stage using Wolfi-based image
FROM cgr.dev/chainguard/wolfi-base:20240801 AS development

# Set shell with pipefail
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/usr/local/bin:/app/.venv/bin:$PATH" \
    UV_SYSTEM_PYTHON=1

# Install system dependencies and development tools
RUN apk add --no-cache \
    python-3.11 \
    python-3.11-dev \
    py3.11-pip \
    espeak-ng \
    alsa-lib \
    curl \
    bash \
    git \
    build-base

# Install Bun for frontend development (specific version)
RUN curl -fsSL https://bun.sh/install | bash -s -- bun-v1.1.22 && \
    mv /root/.bun/bin/bun /usr/local/bin/ && \
    rm -rf /root/.bun

# Install uv for Python package management
RUN curl -LsSf https://astral.sh/uv/0.4.18/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/ && \
    rm -rf /root/.local

WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock* ./
COPY client/package.json client/bun.lockb ./client/

# Install Python dependencies with dev packages
RUN uv venv .venv && \
    uv sync --dev

# Install frontend dependencies
WORKDIR /app/client
RUN bun install

# Return to app root
WORKDIR /app

# Create directories
RUN mkdir -p /app/data/models /app/data/logs

# Copy source code (for development, we'll mount volumes instead)
COPY server/ ./server/
COPY client/ ./client/
COPY content/ ./content/

# Expose ports (backend and frontend)
EXPOSE 8000 5173

# Development command - run both frontend and backend
CMD ["sh", "-c", "cd /app/client && bun run dev --host 0.0.0.0 & cd /app && uvicorn server.app:app --reload --host 0.0.0.0 --port 8000 & wait"]