# Multi-stage Dockerfile: build frontend then build Python backend image

### Stage 1: Build React frontend
FROM node:18-alpine as frontend-builder
WORKDIR /app/frontend
# Copy only package files first for caching
# source paths are relative to the Docker build context (project root)
COPY ASM/frontend/package*.json ./
COPY ASM/frontend/package-lock.json ./
# Install dependencies
RUN npm ci --silent
# Copy the rest of the frontend
COPY ASM/frontend/ .
# Build production frontend
RUN npm run build


### Stage 2: Build Python runtime image and copy frontend build
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
ENV POETRY_VIRTUALENVS_CREATE=false

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/ASM/backend

# Copy backend requirements and install
COPY ASM/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY ASM/backend/ ./

# Copy frontend build from builder into repository expected path (/srv/ASM/frontend/build)
COPY --from=frontend-builder /app/frontend/build /srv/ASM/frontend/build

# Expose port
EXPOSE 8000

# Default command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
