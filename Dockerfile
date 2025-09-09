# =============================================================================
# Multi-stage Dockerfile for Bulgarian Voice Coach
# Using official Bun image and Wolfi-based Python for security and efficiency
# =============================================================================

# Build stage for frontend using official Bun Alpine image
FROM oven/bun:1.1.38-alpine AS frontend-builder

WORKDIR /app/client

# Copy package files
COPY client/package.json client/bun.lock ./

# Install dependencies with frozen lockfile
RUN bun install --frozen-lockfile

# Copy source code
COPY client/ .

# Build frontend
RUN bun run build

# =============================================================================
# Base production stage - common setup for all production variants
# Using bookworm (Debian 12) for glibc 2.36 compatibility with ctranslate2
FROM python:3.11-slim-bookworm AS production-base

# Set shell with pipefail
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    UV_SYSTEM_PYTHON=1

# Install system dependencies
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    libasound2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for Python package management (specific version)
RUN curl -LsSf https://astral.sh/uv/0.4.18/install.sh | sh && \
    mv /root/.cargo/bin/uv /usr/local/bin/ && \
    rm -rf /root/.cargo

# Create app directory
WORKDIR /app

# Copy Python dependencies
COPY pyproject.toml uv.lock* ./

# =============================================================================
# Lean production image - core functionality only (~500MB)
FROM production-base AS production

# Install only core dependencies (no optional features)
RUN uv venv .venv && \
    uv sync --no-dev && \
    uv cache clean

# Copy server code
COPY server/ ./server/
COPY content/ ./content/

# Copy built frontend from build stage
COPY --from=frontend-builder /app/client/dist ./client/dist

# Create non-root user and set permissions
RUN useradd -m -d /app -s /bin/bash app && \
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

# Set Python path for module imports
ENV PYTHONPATH="/app/server:${PYTHONPATH}"

# Default command
CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]

# =============================================================================
# Production image with pronunciation scoring (~2.5GB)
FROM production-base AS production-scoring

# Install core + pronunciation scoring dependencies
RUN uv venv .venv && \
    uv sync --no-dev --extra pronunciation && \
    uv cache clean

# Copy server code
COPY server/ ./server/
COPY content/ ./content/

# Copy built frontend from build stage
COPY --from=frontend-builder /app/client/dist ./client/dist

# Create non-root user and set permissions
RUN useradd -m -d /app -s /bin/bash app && \
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

# Set Python path for module imports
ENV PYTHONPATH="/app/server:${PYTHONPATH}" \
    ENABLE_PRONUNCIATION_SCORING=true

# Default command
CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]

# =============================================================================
# Full production image with all features (~3.5GB)
FROM production-base AS production-full

# Install all dependencies (core + pronunciation + telemetry)
RUN uv venv .venv && \
    uv sync --no-dev --extra full && \
    uv cache clean

# Copy server code
COPY server/ ./server/
COPY content/ ./content/

# Copy built frontend from build stage
COPY --from=frontend-builder /app/client/dist ./client/dist

# Create non-root user and set permissions
RUN useradd -m -d /app -s /bin/bash app && \
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

# Set Python path for module imports
ENV PYTHONPATH="/app/server:${PYTHONPATH}" \
    ENABLE_PRONUNCIATION_SCORING=true \
    ENABLE_TELEMETRY=true

# Default command
CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]

# =============================================================================
# Development stage using official Bun image with Python
FROM oven/bun:1.1.38-debian AS development

# Set shell with pipefail for better error handling
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/usr/local/bin:/app/.venv/bin:$PATH" \
    UV_SYSTEM_PYTHON=1

# Install Python and system dependencies
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    espeak-ng \
    espeak-ng-data \
    alsa-utils \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv for Python package management
RUN curl -LsSf https://astral.sh/uv/0.4.18/install.sh | sh && \
    mv /root/.cargo/bin/uv /usr/local/bin/ && \
    rm -rf /root/.cargo

WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock* ./
COPY client/package.json client/bun.lock ./client/

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