# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # Cross-Origin Resource Sharing
import os
import logging
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Configure logging to show all INFO level logs to stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()  # Output to stdout (visible in docker logs)
    ]
)

# Load .env file from backend directory (don't scan parent directories)
# This prevents slow directory scanning during import
import pathlib
env_path = pathlib.Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path), override=False)
else:
    load_dotenv(override=False)  # Only scan current directory

from app.api import router as api_router
from app.database.db import init_db

# Initialize database on startup
init_db()

#create FastAPI app instance, this is the core backend server
# sets up the web app that will handle all API requests and responses
app = FastAPI(
    title="Visual4Math Backend",
    description="API for Visual4Math user study experiment - includes chat, image generation, and research data collection endpoints",
    version="1.0.0",
    docs_url="/docs",  # Swagger UI at /docs
    redoc_url="/redoc"  # ReDoc at /redoc
)

# Allow frontend to connect - configurable via environment variable
# Default to localhost for development, but should be overridden for deployment
# In production, set ALLOWED_ORIGINS to include the production domain
allowed_origins_str = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173"
)
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)
# connects all API routes like /chat, /image

# Define static file paths (needed before root route)
static_assets_path = "static/assets"
static_index_path = "static/index.html"
static_favicon_path = "static/favicon.png"

# Root endpoint - serve frontend if available, otherwise API info
@app.get("/")
async def root():
    """Root endpoint - serves frontend index.html if available, otherwise API info"""
    if os.path.exists(static_index_path):
        return FileResponse(static_index_path)
    return {
        "message": "Visual4Math Backend API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }

# Serve static assets for the built frontend (only if directory exists)
# This allows local development where frontend runs separately

if os.path.exists(static_assets_path):
    app.mount("/assets", StaticFiles(directory=static_assets_path), name="assets")
    print(f"✅ Static assets mounted from {static_assets_path}")
else:
    print(f"⚠️  Static assets directory not found: {static_assets_path} (frontend not built yet)")

# Serve videos directory (for demo videos)
static_videos_path = "static/videos"
if os.path.exists(static_videos_path):
    app.mount("/videos", StaticFiles(directory=static_videos_path), name="videos")
    print(f"✅ Videos directory mounted from {static_videos_path}")
else:
    print(f"⚠️  Videos directory not found: {static_videos_path}")

# Serve favicon only if it exists
if os.path.exists(static_favicon_path):
    @app.get("/favicon.png")
    async def favicon():
        return FileResponse(static_favicon_path)

# Serve index.html for SPA routing (only if it exists)
# During local dev, frontend runs separately, so this won't be used
# IMPORTANT: This catch-all must be registered AFTER all API routes
# FastAPI matches more specific routes first, so /images/{id} will work
if os.path.exists(static_index_path):
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Exclude API routes and docs - but NOT /images/ since that's a valid API route
        # FastAPI will match /images/{id} before this catch-all due to route specificity
        # Videos and assets are handled by mounts above, so they won't reach here
        if full_path.startswith(("api", "docs", "redoc", "chat", "image", "research")):
            raise HTTPException(status_code=404)
        return FileResponse(static_index_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
