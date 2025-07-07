# backend/app/api/__init__.py
from fastapi import APIRouter
from .routes import chat, image

router = APIRouter()
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
router.include_router(image.router, prefix="/image", tags=["Image"])