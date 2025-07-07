# backend/app/api/routes/image.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.openai_service import generate_image

router = APIRouter()

class ImagePrompt(BaseModel):
    prompt: str

@router.post("/generate-image")
async def generate_image_from_prompt(data: ImagePrompt):
    try:
        image_url = generate_image(data.prompt)
        return {"image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
