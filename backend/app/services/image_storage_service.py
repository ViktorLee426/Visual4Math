# backend/app/services/image_storage_service.py
"""
Service to store images locally and return URLs instead of base64.
This prevents conversation history from growing too large.
"""
import os
import base64
import hashlib
import uuid
import httpx
import logging
import json
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)

# Determine cache directory (same as image_proxy)
cache_dir_env = os.getenv("CACHE_DIR")
if cache_dir_env:
    cache_dir_path = Path(cache_dir_env)
else:
    project_root = Path(__file__).resolve().parents[3]
    cache_dir_path = project_root / "backend" / "cached_images"

cache_dir_path.mkdir(parents=True, exist_ok=True)
CACHE_DIR = cache_dir_path.as_posix()

def _generate_image_id(image_data: bytes) -> str:
    """Generate a unique ID for an image based on its content"""
    return hashlib.sha256(image_data).hexdigest()[:16]

def _save_image(image_data: bytes, image_id: Optional[str] = None) -> str:
    """Save image to disk and return the image ID"""
    if image_id is None:
        image_id = _generate_image_id(image_data)
    
    # Save as PNG
    image_path = os.path.join(CACHE_DIR, f"{image_id}.png")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(image_path), exist_ok=True)
    
    # Save image
    with open(image_path, "wb") as f:
        f.write(image_data)
    
    logger.info(f"💾 Saved image: {image_id}.png ({len(image_data)} bytes)")
    return image_id

def store_image_from_url(url: str) -> str:
    """
    Download image from URL, save locally, and return backend URL.
    Returns URL like: /images/{image_id}
    """
    try:
        logger.info(f"📥 Downloading image from URL: {url[:100]}...")
        
        # Check if URL is already a backend URL
        if url.startswith("/images/") or url.startswith("/image-proxy/"):
            logger.info(f"✅ Image is already a backend URL: {url}")
            return url
        
        # Download image
        with httpx.Client() as client:
            response = client.get(url, timeout=30.0)
            response.raise_for_status()
            image_data = response.content
        
        # Generate ID from content
        image_id = _generate_image_id(image_data)
        image_path = os.path.join(CACHE_DIR, f"{image_id}.png")
        
        # Check if already cached
        if os.path.exists(image_path):
            logger.info(f"📦 Image already cached: {image_id}")
        else:
            # Save image
            _save_image(image_data, image_id)
        
        # Return backend URL (no /api prefix - router is mounted at root)
        backend_url = f"/images/{image_id}"
        logger.info(f"✅ Stored image as: {backend_url}")
        return backend_url
        
    except Exception as e:
        logger.error(f"❌ Failed to store image from URL: {e}")
        raise

def store_image_from_base64(base64_data: str) -> str:
    """
    Convert base64 image to bytes, save locally, and return backend URL.
    Accepts both data URLs (data:image/png;base64,...) and raw base64.
    Returns URL like: /images/{image_id}
    """
    try:
        logger.info(f"📥 Processing base64 image ({len(base64_data)} chars)...")
        
        # Handle data URL format
        if base64_data.startswith('data:image'):
            # Remove data URL prefix
            header, encoded = base64_data.split(',', 1)
            image_bytes = base64.b64decode(encoded)
        else:
            # Raw base64
            image_bytes = base64.b64decode(base64_data)
        
        # Ensure it's valid image data
        try:
            img = Image.open(BytesIO(image_bytes))
            # Convert to RGB if needed
            if img.mode in ('RGBA', 'LA', 'P'):
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = rgb_img
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Save as PNG bytes
            output = BytesIO()
            img.save(output, format='PNG')
            image_bytes = output.getvalue()
        except Exception as e:
            logger.warning(f"⚠️ Could not process image, using raw bytes: {e}")
            # Use raw bytes if PIL processing fails
        
        # Save and return URL (no /api prefix - router is mounted at root)
        image_id = _save_image(image_bytes)
        backend_url = f"/images/{image_id}"
        logger.info(f"✅ Stored base64 image as: {backend_url}")
        return backend_url
        
    except Exception as e:
        logger.error(f"❌ Failed to store base64 image: {e}")
        raise

def store_image(image_url_or_base64: str) -> str:
    """
    Universal function to store an image from either URL or base64.
    Automatically detects format and stores appropriately.
    Returns backend URL like: /api/images/{image_id}
    """
    if not image_url_or_base64:
        raise ValueError("Empty image URL/base64 provided")
    
    # Check if it's base64 (data URL or raw base64)
    if image_url_or_base64.startswith('data:image') or (
        not image_url_or_base64.startswith('http') and 
        not image_url_or_base64.startswith('/') and
        len(image_url_or_base64) > 100  # Base64 strings are typically long
    ):
        return store_image_from_base64(image_url_or_base64)
    else:
        return store_image_from_url(image_url_or_base64)

def get_image_path(image_id: str) -> Optional[str]:
    """Get the file path for an image ID, or None if not found"""
    image_path = os.path.join(CACHE_DIR, f"{image_id}.png")
    if os.path.exists(image_path):
        return image_path
    return None

def store_metadata(image_id: str, metadata: Dict[str, Any]) -> None:
    """
    Store metadata JSON file for an image.
    Metadata should include: timestamp, prompt, layout_info, etc.
    """
    try:
        # Create metadata file path
        metadata_path = os.path.join(CACHE_DIR, f"{image_id}_metadata.json")
        
        # Ensure timestamp is present
        if "timestamp" not in metadata:
            metadata["timestamp"] = datetime.now().isoformat()
        
        # Ensure image_id and URL are in metadata
        metadata["image_id"] = image_id
        if "image_url" not in metadata:
            metadata["image_url"] = f"/images/{image_id}"
        
        # Save metadata as JSON
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False, default=str)
        
        logger.info(f"💾 Saved metadata: {image_id}_metadata.json")
    except Exception as e:
        logger.error(f"❌ Failed to store metadata for {image_id}: {e}")
        # Don't raise - metadata storage failure shouldn't break image generation

