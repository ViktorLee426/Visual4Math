# backend/app/api/__init__.py
from fastapi import APIRouter
from .routes import chat, image, research, images
from .routes import image_proxy, parse

router = APIRouter()
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
router.include_router(image.router, prefix="/image", tags=["Image"])
router.include_router(research.router, prefix="/research", tags=["Research"])
router.include_router(image_proxy.router, prefix="/image-proxy", tags=["ImageProxy"])
router.include_router(images.router, prefix="/images", tags=["Images"])
router.include_router(parse.router, prefix="/parse", tags=["Parse"])