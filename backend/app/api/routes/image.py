# backend/app/api/routes/image.py
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from app.services.image_service import get_image_response, get_image_response_stream
from app.services.image_storage_service import store_metadata
from app.schemas.chat import ChatRequest
import json
import logging
import io

logger = logging.getLogger(__name__)
router = APIRouter()

class ImagePrompt(BaseModel):
    prompt: str
    layout_info: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

@router.post("/generate-image")
async def generate_image_from_prompt(data: ImagePrompt):
    try:
        # Create a simple ChatRequest for image generation
        request = ChatRequest(
            user_input=data.prompt,
            user_image=None,
            conversation_history=[]
        )
        
        # Generate image
        image_url = get_image_response(request)
        
        # Check if image generation succeeded (image_url should not be empty)
        if not image_url or image_url == "":
            logger.error("❌ Image generation returned empty URL")
            raise HTTPException(status_code=500, detail="Image generation failed: No image URL returned")
        
        # Extract image_id from URL (e.g., "/images/abc123" -> "abc123")
        # Handle different URL formats
        if image_url.startswith("/images/"):
            image_id = image_url.replace("/images/", "")
        elif image_url.startswith("/image-proxy/"):
            image_id = image_url.replace("/image-proxy/", "")
        else:
            # Fallback: try to extract ID from any URL format
            image_id = image_url.split("/")[-1] if "/" in image_url else image_url
        
        # Clean up image_id (remove any query params or fragments)
        image_id = image_id.split("?")[0].split("#")[0]
        
        # Validate image_id is not empty
        if not image_id or image_id == "":
            logger.error(f"❌ Could not extract valid image_id from URL: {image_url}")
            raise HTTPException(status_code=500, detail="Image generation failed: Invalid image URL format")
        
        # Prepare metadata
        metadata = {
            "timestamp": datetime.now().isoformat(),
            "prompt": data.prompt,
            "layout_info": data.layout_info or {},
            "image_id": image_id,
            "image_url": image_url,
            **(data.metadata or {})
        }
        
        # Store metadata alongside image (only if image generation succeeded)
        try:
            store_metadata(image_id, metadata)
            logger.info(f"✅ Metadata stored successfully for image: {image_id}")
        except Exception as meta_error:
            logger.warning(f"⚠️ Failed to store metadata (non-critical): {meta_error}")
            # Continue even if metadata storage fails
        
        return {"image_url": image_url}
    except Exception as e:
        logger.error(f"❌ Image generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-image-stream")
async def generate_image_from_prompt_stream(
    prompt: str = Form(...),
    layout_image: Optional[UploadFile] = File(None),
    layout_info: Optional[str] = Form(None),
    metadata: Optional[str] = Form(None)
):
    """Stream image generation with partial images. Supports both FormData (with layout image) and JSON fallback."""
    try:
        # Parse layout_info and metadata if provided as JSON strings
        layout_info_dict = None
        if layout_info:
            try:
                layout_info_dict = json.loads(layout_info)
            except json.JSONDecodeError:
                logger.warning("Failed to parse layout_info JSON")
        
        metadata_dict = None
        if metadata:
            try:
                metadata_dict = json.loads(metadata)
            except json.JSONDecodeError:
                logger.warning("Failed to parse metadata JSON")
        
        # Read layout image if provided
        layout_image_bytes = None
        if layout_image:
            layout_image_bytes = await layout_image.read()
            logger.info(f"📸 Received layout image: {len(layout_image_bytes)} bytes")
        
        # Create a simple ChatRequest for image generation
        request = ChatRequest(
            user_input=prompt,
            user_image=layout_image_bytes,  # Pass image bytes
            conversation_history=[]
        )
        
        async def generate():
            try:
                for event in get_image_response_stream(request):
                    if event['type'] == 'partial_image':
                        # Yield partial image as base64 data URL
                        yield f"data: {json.dumps({'type': 'partial_image', 'index': event['index'], 'image_b64': event['image_b64']})}\n\n"
                    elif event['type'] == 'completed':
                        # Extract image_id from URL
                        image_url = event['image_url']
                        if image_url.startswith("/images/"):
                            image_id = image_url.replace("/images/", "")
                        elif image_url.startswith("/image-proxy/"):
                            image_id = image_url.replace("/image-proxy/", "")
                        else:
                            image_id = image_url.split("/")[-1] if "/" in image_url else image_url
                        image_id = image_id.split("?")[0].split("#")[0]
                        
                        # Prepare metadata
                        metadata_obj = {
                            "timestamp": datetime.now().isoformat(),
                            "prompt": prompt,
                            "layout_info": layout_info_dict or {},
                            "image_id": image_id,
                            "image_url": image_url,
                            **(metadata_dict or {})
                        }
                        
                        # Store metadata
                        try:
                            store_metadata(image_id, metadata_obj)
                        except Exception:
                            pass
                        
                        yield f"data: {json.dumps({'type': 'completed', 'image_url': image_url})}\n\n"
                    elif event['type'] == 'error':
                        yield f"data: {json.dumps({'type': 'error', 'message': event['message']})}\n\n"
            except Exception as e:
                logger.error(f"❌ Streaming error: {e}")
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"❌ Image generation streaming failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
