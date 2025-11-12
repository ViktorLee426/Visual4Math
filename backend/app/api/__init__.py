# backend/app/api/__init__.py
from fastapi import APIRouter
from .routes import chat, image, research
from .routes import image_proxy

router = APIRouter()
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
router.include_router(image.router, prefix="/image", tags=["Image"])
router.include_router(research.router, prefix="/research", tags=["Research"])
router.include_router(image_proxy.router, prefix="/image-proxy", tags=["ImageProxy"])