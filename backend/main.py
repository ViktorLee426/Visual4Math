"""
Visual4Math Backend API Server

FastAPI application serving the Visual4Math user study platform.
Handles chat interactions, image generation, and research data collection.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import pathlib

from app.api import router as api_router
from app.database.db import init_db

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

env_path = pathlib.Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path), override=False)
else:
    load_dotenv(override=False)

init_db()

app = FastAPI(
    title="Visual4Math Backend",
    description="API for Visual4Math user study experiment",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

static_assets_path = "static/assets"
static_index_path = "static/index.html"
static_favicon_path = "static/favicon.png"
static_videos_path = "static/videos"

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

if os.path.exists(static_assets_path):
    app.mount("/assets", StaticFiles(directory=static_assets_path), name="assets")

if os.path.exists(static_videos_path):
    app.mount("/videos", StaticFiles(directory=static_videos_path), name="videos")

if os.path.exists(static_favicon_path):
    @app.get("/favicon.png")
    async def favicon():
        return FileResponse(static_favicon_path)

if os.path.exists(static_index_path):
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith(("api", "docs", "redoc", "chat", "image", "research")):
            raise HTTPException(status_code=404)
        return FileResponse(static_index_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
