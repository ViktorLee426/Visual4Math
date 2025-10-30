# backend/app/models/research.py
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

Base = declarative_base()

# Database Models (SQLAlchemy)
class Participant(Base):
    __tablename__ = "participants"
    
    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(String, unique=True, index=True, nullable=False)
    start_time = Column(DateTime, default=func.now())
    end_time = Column(DateTime, nullable=True)
    current_phase = Column(String, default="welcome")
    completed_phases = Column(JSON, default=list)
    session_data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class ConsentRecord(Base):
    __tablename__ = "consent_records"
    
    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(String, nullable=False)
    agreed = Column(Boolean, nullable=False)
    signature_data = Column(Text, nullable=True)  # Base64 signature image
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    timestamp = Column(DateTime, default=func.now())

class DemographicData(Base):
    __tablename__ = "demographic_data"
    
    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(String, nullable=False)
    teaching_experience = Column(String, nullable=True)
    subject_areas = Column(JSON, default=list)  # List of subjects
    tech_comfort = Column(Integer, nullable=True)  # 1-5 scale
    ai_experience = Column(String, nullable=True)
    age_range = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    timestamp = Column(DateTime, default=func.now())

class TaskResponse(Base):
    __tablename__ = "task_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(String, nullable=False)
    task_type = Column(String, nullable=False)  # 'closed' or 'open'
    task_number = Column(Integer, nullable=False)  # 1 or 2
    problem_text = Column(Text, nullable=False)
    target_image_url = Column(String, nullable=True)  # For closed tasks
    conversation_log = Column(JSON, default=list)
    generated_images = Column(JSON, default=list)
    start_time = Column(DateTime, default=func.now())
    end_time = Column(DateTime, nullable=True)
    completion_status = Column(String, default="in_progress")  # in_progress, completed, abandoned

class ConversationLog(Base):
    __tablename__ = "conversation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(String, nullable=False)
    task_id = Column(Integer, nullable=True)  # Links to TaskResponse
    session_id = Column(String, nullable=False)
    message_index = Column(Integer, nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    image_url = Column(String, nullable=True)
    timestamp = Column(DateTime, default=func.now())
    ai_intent = Column(String, nullable=True)  # 'text', 'image', 'both'

class SurveyResponse(Base):
    __tablename__ = "survey_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(String, nullable=False)
    survey_type = Column(String, nullable=False)  # 'final', 'demographic'
    question_id = Column(String, nullable=False)
    question_text = Column(Text, nullable=False)
    response_type = Column(String, nullable=False)  # 'likert', 'text', 'multiple_choice'
    response_value = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=func.now())

# Pydantic Models for API
class ParticipantCreate(BaseModel):
    participant_id: str

class ParticipantResponse(BaseModel):
    id: int
    participant_id: str
    current_phase: str
    completed_phases: List[str]
    start_time: datetime

class ConsentSubmission(BaseModel):
    participant_id: str
    agreed: bool
    signature_data: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class DemographicSubmission(BaseModel):
    participant_id: str
    teaching_experience: Optional[str] = None
    subject_areas: List[str] = []
    tech_comfort: Optional[int] = None
    ai_experience: Optional[str] = None
    age_range: Optional[str] = None
    gender: Optional[str] = None

class TaskSubmission(BaseModel):
    participant_id: str
    task_type: str
    task_number: int
    problem_text: str
    target_image_url: Optional[str] = None
    conversation_log: List[Dict[str, Any]] = []
    generated_images: List[str] = []
    completion_status: str = "completed"

class SurveySubmission(BaseModel):
    participant_id: str
    survey_type: str
    responses: List[Dict[str, Any]]

class SessionUpdate(BaseModel):
    participant_id: str
    current_phase: str
    session_data: Dict[str, Any]
