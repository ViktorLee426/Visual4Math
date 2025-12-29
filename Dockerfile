# Use nikolaik/python-nodejs base image (same as handbook example)
# This image includes both Python and Node.js, avoiding separate installation
# It's more reliable and matches the lab's proven deployment setup
FROM nikolaik/python-nodejs:latest

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Set the working directory in the container
WORKDIR /app

# Install system dependencies (matching handbook pattern)
RUN set -eux; \
    for file in /etc/apt/sources.list /etc/apt/sources.list.d/*; do \
        if [ -f "$file" ]; then \
            sed -i 's|http://|https://|g' "$file"; \
        fi; \
    done; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        gcc \
        g++; \
    rm -rf /var/lib/apt/lists/*

# Verify installation of node and npm (base image already includes Node.js)
RUN node -v && npm -v

# Install a specific version of Node.js (Node 20.19.0+ required for Vite 7)
RUN npm install -g n
RUN n 20.19.0

# Configure npm for better network reliability (timeouts and retries)
RUN npm config set fetch-timeout 300000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5

# Copy frontend package files first (for better Docker layer caching)
COPY frontend/package*.json /app/frontend/

# Install frontend dependencies with verbose logging for debugging
RUN cd /app/frontend && npm install --verbose

# Copy frontend code to /app/frontend (matching handbook structure)
COPY frontend /app/frontend

# Build the React app with empty API base URL (relative URLs for production)
# Vite needs VITE_ prefixed env vars at build time
ENV VITE_API_BASE_URL=""

# Build the React app (default: relative API URLs in production)
RUN cd /app/frontend && npm run build

# Copy backend requirements first (for better Docker layer caching)
COPY backend/requirements.txt /app/backend/requirements.txt

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend code to /app/backend
COPY backend /app/backend

# Copy icon directories (needed for manipulatives generation)
COPY my_icons /app/my_icons
COPY additional_icons /app/additional_icons
COPY math2visual_repo /app/math2visual_repo

# Ship the built frontend with the backend (serve static files from backend)
# Create static directory and copy built frontend files
RUN mkdir -p /app/backend/static && cp -r /app/frontend/dist/* /app/backend/static/

# Create data directories for persistent storage
RUN mkdir -p /app/data /app/cached_images

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Set working directory to backend for running the app
WORKDIR /app/backend

# Run uvicorn when the container launches
# --log-level info ensures all INFO logs (including our detailed timing logs) are shown
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]