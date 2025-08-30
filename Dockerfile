# =============================================================================
# Multi-stage Dockerfile for Bulgarian Voice Coach
# =============================================================================

# Build stage for frontend
FROM node:20-slim AS frontend-builder

# Install Bun
RUN npm install -g bun

WORKDIR /app/client

# Copy package files
COPY client/package.json client/bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY client/ .

# Build frontend
RUN bun run build

# =============================================================================
# Production stage
FROM python:3.11-slim AS production

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PATH="/root/.local/bin:$PATH"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    espeak-ng \
    espeak-ng-data \
    alsa-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Create app directory
WORKDIR /app

# Copy Python dependencies
COPY pyproject.toml uv.lock* ./

# Install Python dependencies
RUN uv sync --locked --no-dev

# Copy server code
COPY server/ ./server/

# Copy built frontend from build stage
COPY --from=frontend-builder /app/client/dist ./client/dist

# Create non-root user
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# Create directories for models and data
RUN mkdir -p /app/data/models /app/data/logs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command
CMD ["uv", "run", "uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]

# =============================================================================
# Development stage  
FROM python:3.11-slim AS development

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PATH="/root/.local/bin:$PATH"

# Install system dependencies + development tools
RUN apt-get update && apt-get install -y \
    espeak-ng \
    espeak-ng-data \
    alsa-utils \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js and Bun for frontend development
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g bun

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock* ./
COPY client/package.json client/bun.lockb ./client/

# Install dependencies
RUN uv sync --dev
RUN cd client && bun install

# Create directories
RUN mkdir -p /app/data/models /app/data/logs

# Expose ports (backend and frontend)
EXPOSE 8000 5173

# Development command
CMD ["sh", "-c", "cd client && bun run dev & cd server && uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000 & wait"]