# backend/app/schemas/research.py
from pydantic import BaseModel
from typing import List, Optional

# Research Study Schemas
class ParticipantCreate(BaseModel):
    participant_id: str

class ParticipantResponse(BaseModel):
    participant_id: str
    start_time: str
    status: str
    current_phase: str
    completed_phases: List[str]

class ConsentSubmission(BaseModel):
    participant_id: str
    agreed: bool
    signature_data: str

class DemographicSubmission(BaseModel):
    participant_id: str
    country: str
    city: str
    age: int
    gender: str
    teaching_level: str
    teaching_years: int  # Years of teaching experience
    teaching_subject: List[str]  # Changed to list for multiple subjects
    teaching_language: str
    use_visuals_frequency: int  # Changed to int for slider
    ai_experience: int  # Changed to int for slider
    text_to_image_familiarity: int
    text_to_image_usage_frequency: int  # Changed to int for slider

class TaskSubmission(BaseModel):
    participant_id: str
    task_type: str  # "closed" or "open"
    task_id: Optional[str] = None
    problem_text: Optional[str] = None
    task_description: Optional[str] = None
    user_message: str
    ai_response: str
    user_rating: Optional[int] = None

class SurveySubmission(BaseModel):
    participant_id: str
    usability_rating: int
    effectiveness_rating: int
    satisfaction_rating: int
    would_use_again: str
    feedback: str

class SessionUpdate(BaseModel):
    participant_id: str
    current_phase: str

