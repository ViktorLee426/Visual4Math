# backend/app/schemas/chat.py
from pydantic import BaseModel
from typing import List, Optional, Union
from datetime import datetime

class ImageRegion(BaseModel):
    """Region selection for image editing"""
    image_url: str  # Which image to edit (reference to image in conversation history)
    mask_data: Optional[str] = None  # Base64 encoded mask for the region to edit
    coordinates: Optional[dict] = None  # Optional bounding box coordinates

class ChatMessage(BaseModel):
    """Message in conversation history"""
    role: str  # "user" | "assistant"
    content: str  # text content
    image_url: Optional[str] = None  # image URL (users can have images, assistants store generated image URLs)
    message_id: Optional[str] = None  # Unique ID for referencing this message/image
    timestamp: Optional[datetime] = None

class ChatRequest(BaseModel):
    """User's input to the system"""
    user_input: str  # user's text message
    user_image: Optional[Union[str, bytes]] = None  # optional image URL (str) or image bytes (bytes) for layout image
    conversation_history: List[ChatMessage] = []
    image_region: Optional[ImageRegion] = None  # For image editing with brush selection
    referenced_image_id: Optional[str] = None  # ID of the image user clicked on
    
    class Config:
        arbitrary_types_allowed = True  # Allow bytes type

class ChatResponse(BaseModel):
    """System's response to user"""
    type: str  # "text_solo" | "image_solo" | "both" - what the response contains
    content: str  # text response
    image_url: Optional[str] = None  # generated image URL if applicable
