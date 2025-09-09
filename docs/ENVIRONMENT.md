# 🔧 Environment Configuration Guide

This guide covers all environment variables and configuration options for the Bulgarian Voice Coach application.

## 📋 Table of Contents

- [Environment Files](#environment-files)
- [Backend Configuration](#backend-configuration)
- [Frontend Configuration](#frontend-configuration)
- [Docker Configuration](#docker-configuration)
- [Production Deployment](#production-deployment)
- [Security Considerations](#security-considerations)

## Environment Files

The application uses `.env` files for configuration. Create these files based on the provided templates:

```bash
# Copy templates
cp .env.example .env
cp client/.env.example client/.env.local
```

### File Structure

```text
bulgarian-app/
├── .env                    # Backend configuration
├── .env.example           # Backend template
├── client/
│   ├── .env.local         # Frontend configuration
│   └── .env.example       # Frontend template
└── docker-compose.yml     # Docker environment overrides
```

## Backend Configuration

### Core Settings

```bash
# .env file in project root

# Server Configuration
HOST=0.0.0.0
PORT=8000
WORKERS=4                   # Number of Uvicorn workers (production)
LOG_LEVEL=info             # Options: debug, info, warning, error, critical
RELOAD=false               # Auto-reload on code changes (dev only)

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOW_HEADERS=*

# API Keys (Optional)
OPENAI_API_KEY=sk-...      # For OpenAI LLM provider
ANTHROPIC_API_KEY=sk-...   # For Claude LLM provider
```

### ASR (Speech Recognition) Settings

```bash
# ASR Configuration
ASR_MODEL_SIZE=base        # Options: tiny, base, small, medium, large
ASR_DEVICE=cpu             # Options: cpu, cuda, mps (Apple Silicon)
ASR_COMPUTE_TYPE=float32   # Options: float32, float16, int8
ASR_BATCH_SIZE=16          # Batch size for inference
ASR_NUM_WORKERS=4          # Number of worker threads
ASR_LANGUAGE=bg            # Target language code
ASR_INITIAL_PROMPT=        # Optional prompt to guide ASR

# VAD (Voice Activity Detection)
VAD_AGGRESSIVENESS=2       # 0-3, higher = more aggressive filtering
VAD_FRAME_DURATION=30      # Frame duration in ms (10, 20, or 30)
VAD_SAMPLE_RATE=16000      # Audio sample rate in Hz
```

### TTS (Text-to-Speech) Settings

```bash
# TTS Configuration
TTS_VOICE=bg               # eSpeak NG voice identifier
TTS_SPEED=170              # Speech rate (words per minute)
TTS_PITCH=50               # Voice pitch (0-100)
TTS_AMPLITUDE=100          # Volume (0-200)
TTS_VARIANT=f2             # Voice variant (m1-m6, f1-f4)

# Cloud TTS (Optional - Future Enhancement)
TTS_PROVIDER=espeak        # Options: espeak, elevenlabs, azure
ELEVENLABS_API_KEY=        # ElevenLabs API key
ELEVENLABS_VOICE_ID=       # ElevenLabs voice identifier
AZURE_SPEECH_KEY=          # Azure Speech Services key
AZURE_SPEECH_REGION=       # Azure region (e.g., eastus)
```

### LLM (Language Model) Settings

```bash
# LLM Configuration
LLM_PROVIDER=dummy         # Options: dummy, openai, claude
LLM_MODEL=gpt-4           # Model identifier
LLM_TEMPERATURE=0.7        # Response randomness (0.0-1.0)
LLM_MAX_TOKENS=500         # Maximum response length
LLM_TIMEOUT=30             # Request timeout in seconds

# Provider-Specific Settings
OPENAI_ORG_ID=             # OpenAI organization ID (optional)
OPENAI_BASE_URL=           # Custom OpenAI API endpoint
ANTHROPIC_VERSION=2023-06-01  # Anthropic API version
```

### Pronunciation Scoring (Optional)

```bash
# Pronunciation Scoring
ENABLE_PRONUNCIATION_SCORING=false  # Enable WhisperX pronunciation features
PRONUNCIATION_MODEL=large-v3        # WhisperX model for pronunciation
PRONUNCIATION_DEVICE=cpu            # Device for pronunciation model
PRONUNCIATION_BATCH_SIZE=32         # Batch size for alignment
```

### Telemetry (Optional)

```bash
# OpenTelemetry Configuration
ENABLE_TELEMETRY=false              # Enable telemetry collection
OTEL_SERVICE_NAME=bulgarian-voice-coach
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_EXPORTER_OTLP_HEADERS=
OTEL_RESOURCE_ATTRIBUTES=environment=production
JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

## Frontend Configuration

### Development Settings

```bash
# client/.env.local

# API Configuration
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000

# Feature Flags
VITE_ENABLE_DEBUG=true              # Show debug UI
VITE_ENABLE_ANALYTICS=false         # Enable analytics
VITE_ENABLE_OFFLINE=true            # Enable offline mode

# UI Configuration
VITE_APP_TITLE=Bulgarian Voice Coach
VITE_DEFAULT_LANGUAGE=bg
VITE_SUPPORTED_LANGUAGES=bg,en
VITE_THEME=light                    # Options: light, dark, auto
```

### Production Settings

```bash
# client/.env.production

# API Configuration
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com

# CDN Configuration
VITE_CDN_URL=https://cdn.yourdomain.com
VITE_ASSET_URL=https://assets.yourdomain.com

# Analytics (Optional)
VITE_GA_TRACKING_ID=UA-XXXXXXXXX-X
VITE_MIXPANEL_TOKEN=
VITE_SENTRY_DSN=
```

## Docker Configuration

### Docker Compose Environment

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: production  # Options: production, production-scoring, development
    environment:
      # Override any backend environment variables
      - HOST=0.0.0.0
      - PORT=8000
      - LOG_LEVEL=info
      - ASR_MODEL_SIZE=base
      - TTS_VOICE=bg
      - LLM_PROVIDER=openai
    env_file:
      - .env  # Load from .env file
    ports:
      - "8000:8000"
    volumes:
      - ./models:/app/models  # Model cache directory
      - ./logs:/app/logs      # Application logs
```

### Docker Build Arguments

```bash
# Build with custom arguments
docker build \
  --build-arg PYTHON_VERSION=3.11 \
  --build-arg UV_VERSION=0.4.18 \
  --build-arg NODE_VERSION=20 \
  --target production \
  -t bulgarian-app:latest .
```

## Production Deployment

### Cloud Platform Variables

#### AWS Deployment

```bash
# AWS-specific configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=bulgarian-app-assets
CLOUDFRONT_DISTRIBUTION_ID=E...

# ECS Task Definition Environment
ECS_TASK_MEMORY=2048
ECS_TASK_CPU=1024
ECS_SERVICE_DESIRED_COUNT=2
```

#### Google Cloud Platform

```bash
# GCP-specific configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
GCS_BUCKET_NAME=bulgarian-app-assets
CLOUD_RUN_SERVICE_NAME=bulgarian-voice-coach
CLOUD_RUN_MEMORY=2Gi
CLOUD_RUN_CPU=2
CLOUD_RUN_MAX_INSTANCES=10
```

#### Azure Deployment

```bash
# Azure-specific configuration
AZURE_SUBSCRIPTION_ID=...
AZURE_RESOURCE_GROUP=bulgarian-app-rg
AZURE_REGION=eastus
AZURE_STORAGE_ACCOUNT=bulgarianapp
AZURE_CONTAINER_REGISTRY=bulgarianacr
APP_SERVICE_PLAN=bulgarian-app-plan
```

### Database Configuration (Future)

```bash
# PostgreSQL Configuration (when authentication is added)
DATABASE_URL=postgresql://user:password@localhost:5432/bulgarian_app
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
DB_POOL_TIMEOUT=30

# Redis Configuration (for caching/sessions)
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=
REDIS_MAX_CONNECTIONS=50
```

### SSL/TLS Configuration

```bash
# SSL Configuration
SSL_CERT_FILE=/etc/ssl/certs/cert.pem
SSL_KEY_FILE=/etc/ssl/private/key.pem
SSL_CA_FILE=/etc/ssl/certs/ca-bundle.pem
FORCE_HTTPS=true
HSTS_MAX_AGE=31536000
```

## Security Considerations

### Required in Production

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use secrets management**:
   ```bash
   # AWS Secrets Manager
   AWS_SECRETS_MANAGER_SECRET_ID=bulgarian-app-secrets
   
   # Google Secret Manager
   GCP_SECRET_NAME=bulgarian-app-secrets
   
   # Azure Key Vault
   AZURE_KEY_VAULT_NAME=bulgarian-app-kv
   ```

3. **Rotate API keys regularly**
4. **Use least-privilege IAM roles**
5. **Enable audit logging**

### Environment Variable Validation

```python
# server/config.py
import os
from typing import Optional
from pydantic import BaseSettings, validator

class Settings(BaseSettings):
    """Application settings with validation."""
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"
    
    # API Keys
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    
    # ASR settings
    asr_model_size: str = "base"
    asr_device: str = "cpu"
    
    @validator("log_level")
    def validate_log_level(cls, v):
        valid_levels = ["debug", "info", "warning", "error", "critical"]
        if v.lower() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {valid_levels}")
        return v.lower()
    
    @validator("asr_model_size")
    def validate_model_size(cls, v):
        valid_sizes = ["tiny", "base", "small", "medium", "large"]
        if v not in valid_sizes:
            raise ValueError(f"Invalid model size. Must be one of: {valid_sizes}")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Load and validate settings
settings = Settings()
```

### Logging Configuration

```bash
# Logging Configuration
LOG_FORMAT=json            # Options: json, text
LOG_FILE=/app/logs/app.log
LOG_MAX_SIZE=100M          # Max log file size
LOG_BACKUP_COUNT=10        # Number of backup files
LOG_INCLUDE_TIMESTAMP=true
LOG_INCLUDE_HOSTNAME=true

# Structured Logging Fields
LOG_APP_NAME=bulgarian-voice-coach
LOG_APP_VERSION=1.0.0
LOG_ENVIRONMENT=production
```

## Development vs Production

### Development Defaults

```bash
# .env.development
HOST=127.0.0.1
PORT=8000
RELOAD=true
LOG_LEVEL=debug
CORS_ORIGINS=*
LLM_PROVIDER=dummy
ENABLE_TELEMETRY=false
```

### Production Defaults

```bash
# .env.production
HOST=0.0.0.0
PORT=8000
RELOAD=false
LOG_LEVEL=info
CORS_ORIGINS=https://yourdomain.com
LLM_PROVIDER=openai
ENABLE_TELEMETRY=true
FORCE_HTTPS=true
```

## Testing Configuration

```bash
# .env.test
DATABASE_URL=sqlite:///:memory:
ASR_MODEL_SIZE=tiny        # Use smallest model for tests
LLM_PROVIDER=dummy         # Use mock provider
LOG_LEVEL=warning          # Reduce log noise
ENABLE_TELEMETRY=false     # Disable telemetry in tests
```

## Troubleshooting

### Common Issues

1. **Missing API Keys**
   ```bash
   # Check if keys are set
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY
   ```

2. **CORS Errors**
   ```bash
   # Ensure frontend URL is in CORS_ORIGINS
   CORS_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

3. **Model Download Issues**
   ```bash
   # Pre-download models
   python -c "from faster_whisper import WhisperModel; WhisperModel('base')"
   ```

4. **Docker Environment Not Loading**
   ```bash
   # Verify env file exists and is readable
   docker run --env-file .env bulgarian-app:latest env
   ```

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Enable all debug features
export DEBUG=true
export LOG_LEVEL=debug
export PYTHONUNBUFFERED=1
export PYTHONDEBUG=1

# Run with verbose output
uvicorn server.app:app --reload --log-level debug
```

---

*Last updated: 2025-09-08*