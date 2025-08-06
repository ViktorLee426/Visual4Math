# backend/app/schemas/chat.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ChatMessage(BaseModel):
    """Message in conversation history"""
    role: str  # "user" | "assistant"
    content: str  # text content
    image_url: Optional[str] = None  # image URL (users can have images, assistants store generated image URLs)
    timestamp: Optional[datetime] = None

class ChatRequest(BaseModel):
    """User's input to the system"""
    user_input: str  # user's text message
    user_image: Optional[str] = None  # optional image URL from user
    conversation_history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    """System's response to user"""
    type: str  # "text" | "image" | "both" - what the response contains
    content: str  # text response
    image_url: Optional[str] = None  # generated image URL if applicable
