# ── Stage 1: Frontend Build ──
FROM node:20-alpine AS builder

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ .
RUN npm run build

# ── Stage 2: Python Runtime ──
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt \
    && pip install --no-cache-dir uvicorn[standard] fastapi \
    && rm -rf /root/.cache/pip

# Copy backend & core source
COPY backend/ backend/
COPY core/ core/

# Copy frontend build artifacts from Stage 1
COPY --from=builder /build/dist frontend/dist

# Expose port (Railway sets PORT env var)
EXPOSE ${PORT:-8000}

CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
