# 🚀 Production Deployment Guide

Complete guide for deploying Bulgarian Voice Coach to production environments.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [AWS Deployment](#aws-deployment)
- [Google Cloud Platform](#google-cloud-platform)
- [Azure Deployment](#azure-deployment)
- [Docker Deployment](#docker-deployment)
- [SSL/TLS Setup](#ssltls-setup)
- [CDN Configuration](#cdn-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

```bash
# Check required tools
docker --version          # Docker 20.10+
docker-compose --version  # Docker Compose 2.0+
git --version            # Git 2.30+
curl --version           # curl 7.68+

# Cloud CLI tools (choose your platform)
aws --version            # AWS CLI 2.0+
gcloud --version         # Google Cloud SDK 400+
az --version             # Azure CLI 2.40+
```

### Domain & DNS

1. Register a domain (e.g., `bulgarian-voice.com`)
2. Configure DNS with your provider
3. Set up these records:
   ```dns
   A     @              → Your server IP
   A     api            → Your server IP
   CNAME www            → @
   CNAME cdn            → Your CDN endpoint
   ```

### SSL Certificates

Options:

- **Let's Encrypt** (free, automated)
- **CloudFlare** (free with proxy)
- **AWS Certificate Manager** (free for AWS resources)
- **Commercial CA** (for enterprise)

## Deployment Options

### Quick Comparison

| Platform              | Best For         | Pros                    | Cons                  | Estimated Cost |
| --------------------- | ---------------- | ----------------------- | --------------------- | -------------- |
| **AWS ECS**           | Enterprise scale | Auto-scaling, managed   | Complex setup         | $50-200/month  |
| **Google Cloud Run**  | Serverless       | Pay-per-use, simple     | Cold starts           | $10-100/month  |
| **Azure App Service** | Microsoft stack  | Easy deploy, integrated | Limited customization | $30-150/month  |
| **VPS + Docker**      | Full control     | Flexible, cheap         | Manual management     | $10-50/month   |
| **Kubernetes**        | Large scale      | Scalable, resilient     | Complex               | $100-500/month |

## AWS Deployment

### Option 1: AWS ECS with Fargate

#### 1. Build and Push Docker Image

```bash
# Configure AWS CLI
aws configure

# Create ECR repository
aws ecr create-repository --repository-name bulgarian-app --region us-east-1

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com

# Build and tag image
docker build -t bulgarian-app:latest --target production .
docker tag bulgarian-app:latest [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/bulgarian-app:latest

# Push to ECR
docker push [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/bulgarian-app:latest
```

#### 2. Create ECS Task Definition

```json
{
  "family": "bulgarian-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "bulgarian-app",
      "image": "[ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/bulgarian-app:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "HOST", "value": "0.0.0.0" },
        { "name": "PORT", "value": "8000" },
        { "name": "LOG_LEVEL", "value": "info" }
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:[ACCOUNT_ID]:secret:bulgarian-app/openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bulgarian-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### 3. Create ECS Service

```bash
# Create cluster
aws ecs create-cluster --cluster-name bulgarian-app-cluster

# Create service
aws ecs create-service \
  --cluster bulgarian-app-cluster \
  --service-name bulgarian-app-service \
  --task-definition bulgarian-app:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

#### 4. Set Up Application Load Balancer

```bash
# Create target group
aws elbv2 create-target-group \
  --name bulgarian-app-targets \
  --protocol HTTP \
  --port 8000 \
  --vpc-id vpc-xxx \
  --target-type ip \
  --health-check-path /health

# Create load balancer
aws elbv2 create-load-balancer \
  --name bulgarian-app-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

### Option 2: AWS EC2 with Docker

```bash
# Launch EC2 instance (Ubuntu 22.04)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name your-keypair \
  --security-group-ids sg-xxx \
  --subnet-id subnet-xxx

# SSH into instance
ssh -i your-keypair.pem ubuntu@[INSTANCE_IP]

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Clone repository
git clone https://github.com/yourusername/bulgarian-app.git
cd bulgarian-app

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
LLM_PROVIDER=openai
EOF

# Run with Docker Compose
docker-compose up -d
```

## Google Cloud Platform

### Cloud Run Deployment

```bash
# Set up project
gcloud config set project your-project-id
gcloud config set run/region us-central1

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com

# Build and push image
gcloud builds submit --tag gcr.io/your-project-id/bulgarian-app

# Deploy to Cloud Run
gcloud run deploy bulgarian-app \
  --image gcr.io/your-project-id/bulgarian-app \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 100 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars "LOG_LEVEL=info,LLM_PROVIDER=openai" \
  --set-secrets "OPENAI_API_KEY=openai-key:latest"

# Get service URL
gcloud run services describe bulgarian-app --format 'value(status.url)'
```

### GKE Deployment

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bulgarian-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bulgarian-app
  template:
    metadata:
      labels:
        app: bulgarian-app
    spec:
      containers:
        - name: bulgarian-app
          image: gcr.io/your-project-id/bulgarian-app:latest
          ports:
            - containerPort: 8000
          env:
            - name: HOST
              value: "0.0.0.0"
            - name: PORT
              value: "8000"
          envFrom:
            - secretRef:
                name: bulgarian-app-secrets
          resources:
            requests:
              memory: "1Gi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: bulgarian-app-service
spec:
  selector:
    app: bulgarian-app
  ports:
    - port: 80
      targetPort: 8000
  type: LoadBalancer
```

Deploy to GKE:

```bash
# Create cluster
gcloud container clusters create bulgarian-app-cluster \
  --num-nodes=3 \
  --machine-type=n1-standard-2

# Deploy application
kubectl apply -f kubernetes/deployment.yaml

# Get external IP
kubectl get service bulgarian-app-service
```

## Azure Deployment

### Azure App Service

```bash
# Create resource group
az group create --name bulgarian-app-rg --location eastus

# Create App Service plan
az appservice plan create \
  --name bulgarian-app-plan \
  --resource-group bulgarian-app-rg \
  --sku B2 \
  --is-linux

# Create web app
az webapp create \
  --resource-group bulgarian-app-rg \
  --plan bulgarian-app-plan \
  --name bulgarian-app \
  --deployment-container-image-name bulgarian-app:latest

# Configure environment
az webapp config appsettings set \
  --resource-group bulgarian-app-rg \
  --name bulgarian-app \
  --settings \
    HOST=0.0.0.0 \
    PORT=8000 \
    LOG_LEVEL=info

# Set secrets from Key Vault
az webapp config appsettings set \
  --resource-group bulgarian-app-rg \
  --name bulgarian-app \
  --settings OPENAI_API_KEY="@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/openai-key/)"
```

### Azure Container Instances

```bash
# Create container instance
az container create \
  --resource-group bulgarian-app-rg \
  --name bulgarian-app \
  --image bulgarian-app:latest \
  --dns-name-label bulgarian-app \
  --ports 8000 \
  --cpu 2 \
  --memory 4 \
  --environment-variables \
    HOST=0.0.0.0 \
    PORT=8000 \
  --secure-environment-variables \
    OPENAI_API_KEY=$OPENAI_API_KEY
```

## Docker Deployment

### Single Server with Docker Compose

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  app:
    image: bulgarian-app:production
    container_name: bulgarian-app
    restart: always
    ports:
      - "8000:8000"
    environment:
      - HOST=0.0.0.0
      - PORT=8000
      - LOG_LEVEL=info
    env_file:
      - .env.production
    volumes:
      - ./logs:/app/logs
      - ./models:/app/models
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./static:/usr/share/nginx/html:ro
    depends_on:
      - app
```

### Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:8000;
    }

    server {
        listen 80;
        server_name bulgarian-voice.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name bulgarian-voice.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        client_max_body_size 10M;

        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }

        location /api {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /ws {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

## SSL/TLS Setup

### Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d bulgarian-voice.com -d www.bulgarian-voice.com

# Auto-renewal
sudo certbot renew --dry-run
```

### CloudFlare SSL

1. Add your domain to CloudFlare
2. Update nameservers at your registrar
3. Enable "Full (strict)" SSL mode
4. Create Origin Certificate:
   ```bash
   # Download CloudFlare Origin CA certificate
   curl -O https://developers.cloudflare.com/ssl/static/origin_ca_rsa_root.pem
   ```

## CDN Configuration

### CloudFront (AWS)

```bash
# Create distribution
aws cloudfront create-distribution \
  --origin-domain-name bulgarian-app-alb.elb.amazonaws.com \
  --default-root-object index.html
```

### CloudFlare CDN

1. Enable CloudFlare proxy (orange cloud)
2. Configure caching rules:
   ```text
   Cache Level: Standard
   Browser Cache TTL: 1 month
   Edge Cache TTL: 1 month
   ```
3. Create page rules:
   ```text
   *.bulgarian-voice.com/api/* - Cache Level: Bypass
   *.bulgarian-voice.com/ws/* - Cache Level: Bypass
   *.bulgarian-voice.com/static/* - Cache Level: Cache Everything
   ```

## Monitoring & Logging

### Application Monitoring

```bash
# Install monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d
```

```yaml
# docker-compose.monitoring.yml
version: "3.8"

services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

  loki:
    image: grafana/loki
    ports:
      - "3100:3100"

  promtail:
    image: grafana/promtail
    volumes:
      - ./logs:/var/log
      - ./promtail.yml:/etc/promtail/promtail.yml
```

### Error Tracking with Sentry

```python
# server/app.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,
    environment=os.getenv("ENVIRONMENT", "production")
)
```

### Health Checks

```bash
# Basic health check
curl https://api.bulgarian-voice.com/health

# Detailed health check
curl https://api.bulgarian-voice.com/health/detailed
```

## Backup & Recovery

### Automated Backups

```bash
#!/bin/bash
# backup.sh

# Backup configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup Docker volumes
docker run --rm \
  -v bulgarian-app_models:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/models_$DATE.tar.gz /data

# Backup logs
tar czf $BACKUP_DIR/logs_$DATE.tar.gz /app/logs

# Upload to S3
aws s3 cp $BACKUP_DIR/models_$DATE.tar.gz s3://bulgarian-app-backups/
aws s3 cp $BACKUP_DIR/logs_$DATE.tar.gz s3://bulgarian-app-backups/

# Clean old backups (keep last 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

### Disaster Recovery

```bash
# Restore from backup
DATE="20250908_120000"  # Specify backup date

# Download from S3
aws s3 cp s3://bulgarian-app-backups/models_$DATE.tar.gz /tmp/

# Restore Docker volume
docker run --rm \
  -v bulgarian-app_models:/data \
  -v /tmp:/backup \
  alpine tar xzf /backup/models_$DATE.tar.gz -C /
```

## Troubleshooting

### Common Issues

#### 1. High Memory Usage

```bash
# Check memory usage
docker stats bulgarian-app

# Limit memory in docker-compose
services:
  app:
    mem_limit: 2g
    memswap_limit: 2g
```

#### 2. WebSocket Connection Issues

```nginx
# Nginx WebSocket config
location /ws {
    proxy_pass http://app;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;  # 24 hours
}
```

#### 3. Model Loading Slow

```bash
# Pre-download models during build
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu')"
```

#### 4. CORS Errors

```python
# server/app.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Performance Optimization

#### 1. Enable Caching

```python
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache
from fastapi_cache.backends.redis import RedisBackend

@app.on_event("startup")
async def startup():
    redis = aioredis.from_url("redis://localhost")
    FastAPICache.init(RedisBackend(redis), prefix="bulgarian-app-cache")

@app.get("/content/grammar/{item_id}")
@cache(expire=3600)
async def get_grammar_item(item_id: str):
    # Cached for 1 hour
    return load_grammar_item(item_id)
```

#### 2. Use CDN for Static Assets

```javascript
// client/vite.config.js
export default {
  base: process.env.NODE_ENV === "production" ? "https://cdn.bulgarian-voice.com/" : "/",
};
```

#### 3. Enable Compression

```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

### Scaling Strategies

#### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  app:
    image: bulgarian-app:production
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "1.0"
          memory: 2G
```

```bash
# Scale with Docker Swarm
docker swarm init
docker stack deploy -c docker-compose.scale.yml bulgarian-app
docker service scale bulgarian-app_app=5
```

#### Load Balancing

```nginx
upstream app {
    least_conn;  # Use least connections algorithm
    server app1:8000 weight=3;
    server app2:8000 weight=2;
    server app3:8000 weight=1;
    keepalive 32;
}
```

## Security Hardening

### Production Checklist

- [ ] Enable HTTPS everywhere
- [ ] Set secure headers (HSTS, CSP, X-Frame-Options)
- [ ] Implement rate limiting
- [ ] Enable WAF (Web Application Firewall)
- [ ] Regular security updates
- [ ] Implement DDoS protection
- [ ] Enable audit logging
- [ ] Encrypt sensitive data at rest
- [ ] Use secrets management service
- [ ] Implement intrusion detection

### Security Headers

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from secure import SecureHeaders

secure_headers = SecureHeaders()

@app.middleware("http")
async def set_secure_headers(request, call_next):
    response = await call_next(request)
    secure_headers.framework.fastapi(response)
    return response

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["bulgarian-voice.com", "*.bulgarian-voice.com"]
)
```

---

_Last updated: 2025-09-08_
