# backend/app/api/routes/image_proxy.py
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
import httpx
import asyncio
from typing import Optional
import logging
import hashlib
import os

logger = logging.getLogger(__name__)
router = APIRouter()

# Simple in-memory cache for images
image_cache = {}
CACHE_DIR = "cached_images"

# Create cache directory if it doesn't exist
os.makedirs(CACHE_DIR, exist_ok=True)

@router.get("/proxy")
async def proxy_image(url: str):
    """Proxy external images to avoid CORS issues"""
    try:
        logger.info(f"🖼️ Proxying image URL: {url[:100]}...")
        
        # Create a hash of the URL for caching
        url_hash = hashlib.md5(url.encode()).hexdigest()
        cache_path = os.path.join(CACHE_DIR, f"{url_hash}.png")
        
        # Check if we have it cached
        if os.path.exists(cache_path):
            logger.info(f"📦 Serving cached image: {url_hash}")
            with open(cache_path, "rb") as f:
                image_data = f.read()
            return Response(content=image_data, media_type="image/png")
        
        # Download the image
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            
            image_data = response.content
            content_type = response.headers.get("content-type", "image/png")
            
            # Cache the image
            with open(cache_path, "wb") as f:
                f.write(image_data)
            
            logger.info(f"✅ Downloaded and cached image: {len(image_data)} bytes")
            return Response(content=image_data, media_type=content_type)
            
    except Exception as e:
        logger.error(f"❌ Image proxy error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to proxy image: {str(e)}")
