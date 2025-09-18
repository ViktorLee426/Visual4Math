# backend/app/api/routes/image.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.openai_service import get_image_response
from app.schemas.chat import ChatRequest
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class ImagePrompt(BaseModel):
    prompt: str

@router.post("/generate-image")
async def generate_image_from_prompt(data: ImagePrompt):
    try:
        # Create a simple ChatRequest for image generation
        request = ChatRequest(
            user_input=data.prompt,
            user_image=None,
            conversation_history=[]
        )
        image_url = get_image_response(request)
        return {"image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
