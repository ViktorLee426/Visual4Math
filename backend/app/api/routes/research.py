# backend/app/api/routes/research.py
from fastapi import APIRouter, HTTPException
from app.schemas.research import TaskSubmission, SurveySubmission
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/tasks")
async def submit_task(task: TaskSubmission):
    """Submit task completion data (no-op for now - not saving data)"""
    try:
        logger.info(f"Task submitted (not saved): participant={task.participant_id}, type={task.task_type}")
        # Just return success without saving
        return {"message": "Task submitted successfully", "task_id": task.task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting task: {str(e)}")

@router.post("/surveys")
async def submit_survey(survey: SurveySubmission):
    """Submit final survey (no-op for now - not saving data)"""
    try:
        logger.info(f"Survey submitted (not saved): participant={survey.participant_id}")
        # Just return success without saving
        return {"message": "Survey submitted successfully", "survey_id": survey.participant_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting survey: {str(e)}")
