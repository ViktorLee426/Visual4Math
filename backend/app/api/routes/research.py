# backend/app/api/routes/research.py
from fastapi import APIRouter, HTTPException, Request
from typing import List, Dict, Any
from app.schemas.chat import (
    ParticipantCreate, ParticipantResponse, ConsentSubmission,
    DemographicSubmission, TaskSubmission, SurveySubmission, SessionUpdate
)
from app.models.simple_storage import storage
import json
from datetime import datetime
import uuid

router = APIRouter()

@router.post("/participants", response_model=ParticipantResponse)
async def create_participant(participant: ParticipantCreate):
    """Create a new participant (simplified - no duplicate check)"""
    try:
        # Always create new participant - no duplicate check
        participant_data = storage.create_participant(participant.participant_id)
        return ParticipantResponse(
            participant_id=participant_data["participant_id"],
            start_time=participant_data["start_time"],
            status=participant_data["status"],
            current_phase="welcome",
            completed_phases=[]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating participant: {str(e)}")

@router.get("/participants/{participant_id}", response_model=ParticipantResponse)
async def get_participant(participant_id: str):
    """Get participant details"""
    participant = storage.get_participant(participant_id)
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    
    # Get session to determine current phase
    session = storage.get_session(participant_id)
    current_phase = session["current_phase"] if session else "welcome"
    
    # Determine completed phases based on data presence
    completed_phases = []
    if storage.consent_data.get(participant_id):
        completed_phases.append("consent")
    if storage.demographics.get(participant_id):
        completed_phases.append("demographics")
    if storage.closed_tasks.get(participant_id):
        completed_phases.append("closed-tasks")
    if storage.open_tasks.get(participant_id):
        completed_phases.append("open-tasks")
    if storage.final_surveys.get(participant_id):
        completed_phases.append("final-survey")
    
    return ParticipantResponse(
        participant_id=participant["participant_id"],
        start_time=participant["start_time"],
        status=participant["status"],
        current_phase=current_phase,
        completed_phases=completed_phases
    )

@router.post("/consent")
async def submit_consent(consent: ConsentSubmission):
    """Submit consent form"""
    try:
        print(f"🔍 Attempting to submit consent for participant: {consent.participant_id}")
        
        # Verify participant exists
        participant = storage.get_participant(consent.participant_id)
        if not participant:
            print(f"❌ Participant {consent.participant_id} not found in storage")
            print(f"📋 Available participants: {list(storage.participants.keys())}")
            raise HTTPException(status_code=404, detail="Participant not found")
        
        print(f"✅ Participant {consent.participant_id} found, proceeding with consent submission")
        
        # Store consent data
        consent_data = storage.create_consent(
            consent.participant_id,
            consent.agreed,
            consent.signature_data
        )
        
        print(f"✅ Consent data stored successfully")
        
        # Update session phase
        storage.create_session(consent.participant_id, "demographics")
        
        print(f"✅ Session updated to demographics phase")
        
        return {"message": "Consent submitted successfully", "consent_id": consent.participant_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"💥 Error in consent submission: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error submitting consent: {str(e)}")

@router.post("/demographics")
async def submit_demographics(demographics: DemographicSubmission):
    """Submit demographic information"""
    try:
        # Verify participant exists
        participant = storage.get_participant(demographics.participant_id)
        if not participant:
            raise HTTPException(status_code=404, detail="Participant not found")
        
        # Store demographics data
        demo_data = storage.create_demographics(
            demographics.participant_id,
            demographics.country,
            demographics.city,
            demographics.age,
            demographics.gender,
            demographics.teaching_level,
            demographics.teaching_years,
            demographics.teaching_subject,
            demographics.teaching_language,
            demographics.use_visuals_frequency,
            demographics.ai_experience,
            demographics.text_to_image_familiarity,
            demographics.text_to_image_usage_frequency
        )
        
        # Update session phase
        storage.update_session(demographics.participant_id, "closed-instructions")
        
        return {"message": "Demographics submitted successfully", "demographics_id": demographics.participant_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting demographics: {str(e)}")

@router.post("/tasks")
async def submit_task(task: TaskSubmission):
    """Submit task completion data"""
    try:
        # Verify participant exists
        participant = storage.get_participant(task.participant_id)
        if not participant:
            raise HTTPException(status_code=404, detail="Participant not found")
        
        # Store task data
        if task.task_type == "closed":
            task_data = storage.log_closed_task(
                task.participant_id,
                task.task_id or "unknown",
                task.problem_text or "",
                task.user_message,
                task.ai_response,
                task.user_rating
            )
        else:  # open task
            task_data = storage.log_open_task(
                task.participant_id,
                task.task_description or "",
                task.user_message,
                task.ai_response,
                task.user_rating
            )
        
        # Update session phase based on task type and completion status
        if task.task_type == "closed":
            # Check if this completes the closed tasks phase
            closed_tasks = storage.closed_tasks.get(task.participant_id, [])
            if len(closed_tasks) >= 3:  # Assuming 3 closed tasks
                storage.update_session(task.participant_id, "open-instructions")
        else:  # open task
            # Move to final survey after open tasks
            storage.update_session(task.participant_id, "final-survey")
        
        return {"message": "Task submitted successfully", "task_id": task.task_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting task: {str(e)}")

@router.post("/surveys")
async def submit_survey(survey: SurveySubmission):
    """Submit final survey"""
    try:
        # Verify participant exists
        participant = storage.get_participant(survey.participant_id)
        if not participant:
            raise HTTPException(status_code=404, detail="Participant not found")
        
        # Store survey data
        survey_data = storage.create_final_survey(
            survey.participant_id,
            survey.usability_rating,
            survey.effectiveness_rating,
            survey.satisfaction_rating,
            survey.would_use_again,
            survey.feedback
        )
        
        # Update session phase to completion
        storage.update_session(survey.participant_id, "completion")
        
        return {"message": "Survey submitted successfully", "survey_id": survey.participant_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting survey: {str(e)}")

@router.post("/sessions")
async def update_session(session_update: SessionUpdate):
    """Update participant session phase"""
    try:
        # Verify participant exists
        participant = storage.get_participant(session_update.participant_id)
        if not participant:
            raise HTTPException(status_code=404, detail="Participant not found")
        
        # Update or create session
        session = storage.update_session(session_update.participant_id, session_update.current_phase)
        if not session:
            session = storage.create_session(session_update.participant_id, session_update.current_phase)
        
        return {"message": "Session updated successfully", "current_phase": session["current_phase"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating session: {str(e)}")

@router.get("/sessions/{participant_id}")
async def get_session(participant_id: str):
    """Get participant session"""
    session = storage.get_session(participant_id)
    if not session:
        # Create default session if none exists
        session = storage.create_session(participant_id, "welcome")
    
    return session

# @router.get("/analytics")
# async def get_analytics():
#     """Get research analytics"""
#     try:
#         analytics = storage.get_analytics()
#         return analytics
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error getting analytics: {str(e)}")

# @router.get("/data-export/{participant_id}")
# async def export_participant_data(participant_id: str):
#     """Export all data for a specific participant"""
#     try:
#         # Verify participant exists
#         participant = storage.get_participant(participant_id)
#         if not participant:
#             raise HTTPException(status_code=404, detail="Participant not found")
#         
#         # Collect all data for this participant
#         data = {
#             "participant": participant,
#             "consent": storage.consent_data.get(participant_id),
#             "demographics": storage.demographics.get(participant_id),
#             "closed_tasks": storage.closed_tasks.get(participant_id, []),
#             "open_tasks": storage.open_tasks.get(participant_id, []),
#             "final_survey": storage.final_surveys.get(participant_id),
#             "session": storage.sessions.get(participant_id)
#         }
#         
#         return data
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error exporting data: {str(e)}")

# @router.get("/data-export")
# async def export_all_data():
#     """Export all research data"""
#     try:
#         data = {
#             "participants": storage.participants,
#             "consent_data": storage.consent_data,
#             "demographics": storage.demographics,
#             "closed_tasks": storage.closed_tasks,
#             "open_tasks": storage.open_tasks,
#             "final_surveys": storage.final_surveys,
#             "sessions": storage.sessions,
#             "chat_interactions": storage.chat_interactions,
#             "analytics": storage.get_analytics(),
#             "export_timestamp": datetime.now().isoformat()
#         }
#         
#         return data
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error exporting all data: {str(e)}")
