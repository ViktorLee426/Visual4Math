# backend/app/api/__init__.py
from fastapi import APIRouter
from .routes import chat

router = APIRouter()
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
