# backend/app/models/tracking.py
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

Base = declarative_base()

# Allowed User IDs
ALLOWED_USER_IDS = {
    # Study participants
    **{f"visual4mathuserstudy{i}": True for i in range(1, 25)},
    # Test users
    **{f"visual4mathtest{i}": True for i in range(1, 13)}
}

# Database Models for Tracking
class UserSession(Base):
    """Tracks user sessions from login to completion"""
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    start_time = Column(DateTime, default=func.now(), nullable=False)
    end_time = Column(DateTime, nullable=True)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class ToolAGeneratedImage(Base):
    """Tracks images generated in Tool A"""
    __tablename__ = "tool_a_generated_images"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    image_url = Column(String, nullable=False)
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    user_input = Column(Text, nullable=True)  # The text input that generated this image
    operation = Column(String, nullable=True)  # addition, subtraction, multiplication, division
    is_final = Column(Boolean, default=False)  # Whether this is marked as final for the operation
    created_at = Column(DateTime, default=func.now())

class ToolBLayoutScreenshot(Base):
    """Tracks layout screenshots in Tool B"""
    __tablename__ = "tool_b_layout_screenshots"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    screenshot_url = Column(String, nullable=False)  # Base64 or URL
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    operation = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())

class ToolBGeneratedImage(Base):
    """Tracks images generated in Tool B"""
    __tablename__ = "tool_b_generated_images"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    image_url = Column(String, nullable=False)
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    layout_screenshot_id = Column(Integer, nullable=True)  # Link to layout screenshot
    operation = Column(String, nullable=True)
    is_final = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

class ToolCCanvasState(Base):
    """Tracks canvas states in Tool C"""
    __tablename__ = "tool_c_canvas_states"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    canvas_data = Column(JSON, nullable=False)  # Serialized canvas state
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    operation = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())

class ToolCGeneratedImage(Base):
    """Tracks images generated/saved in Tool C"""
    __tablename__ = "tool_c_generated_images"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    image_url = Column(String, nullable=False)
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    operation = Column(String, nullable=True)
    is_final = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

class EvaluationResponse(Base):
    """Tracks evaluation responses (Likert scale answers)"""
    __tablename__ = "evaluation_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    tool = Column(String, nullable=False)  # 'tool_a', 'tool_b', 'tool_c'
    task = Column(String, nullable=False)  # Task identifier/question ID
    question = Column(Text, nullable=False)  # The question text
    answer = Column(Integer, nullable=False)  # Likert scale 1-7
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    created_at = Column(DateTime, default=func.now())

# Pydantic Models for API
class UserAuthRequest(BaseModel):
    user_id: str

class UserAuthResponse(BaseModel):
    success: bool
    message: str
    session_id: Optional[int] = None

class SessionEndRequest(BaseModel):
    user_id: str
    session_id: int

class ToolAImageSubmission(BaseModel):
    user_id: str
    session_id: int
    image_url: str
    user_input: Optional[str] = None
    operation: Optional[str] = None
    is_final: bool = False

class ToolBLayoutSubmission(BaseModel):
    user_id: str
    session_id: int
    screenshot_url: str
    operation: Optional[str] = None

class ToolBImageSubmission(BaseModel):
    user_id: str
    session_id: int
    image_url: str
    layout_screenshot_id: Optional[int] = None
    operation: Optional[str] = None
    is_final: bool = False

class ToolCCanvasSubmission(BaseModel):
    user_id: str
    session_id: int
    canvas_data: Dict[str, Any]
    operation: Optional[str] = None

class ToolCImageSubmission(BaseModel):
    user_id: str
    session_id: int
    image_url: str
    operation: Optional[str] = None
    is_final: bool = False

class EvaluationSubmission(BaseModel):
    user_id: str
    session_id: int
    tool: str
    task: str
    question: str
    answer: int  # 1-7 Likert scale

