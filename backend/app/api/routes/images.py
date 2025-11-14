# backend/app/api/routes/images.py
"""
Endpoint to serve stored images by ID.
This allows frontend to load images using URLs like /images/{image_id}
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.services.image_storage_service import get_image_path
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{image_id}")
async def get_image(image_id: str):
    """Serve a stored image by its ID"""
    try:
        # Validate image_id (should be hex string, no path traversal)
        if not image_id or '/' in image_id or '..' in image_id:
            raise HTTPException(status_code=400, detail="Invalid image ID")
        
        image_path = get_image_path(image_id)
        if not image_path:
            logger.warning(f"⚠️ Image not found: {image_id}")
            raise HTTPException(status_code=404, detail="Image not found")
        
        logger.info(f"📤 Serving image: {image_id}")
        return FileResponse(
            image_path,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=31536000"}  # Cache for 1 year
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error serving image {image_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to serve image: {str(e)}")

