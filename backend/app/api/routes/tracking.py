# backend/app/api/routes/tracking.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.tracking import (
    UserSession, ToolAGeneratedImage, ToolBLayoutScreenshot, ToolBGeneratedImage,
    ToolCCanvasState, ToolCGeneratedImage, EvaluationResponse,
    UserAuthRequest, UserAuthResponse, SessionEndRequest,
    ToolAImageSubmission, ToolBLayoutSubmission, ToolBImageSubmission,
    ToolCCanvasSubmission, ToolCImageSubmission, EvaluationSubmission,
    ALLOWED_USER_IDS
)
from app.services.dataset_storage_service import dataset_storage
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tracking", tags=["Tracking"])

@router.post("/auth", response_model=UserAuthResponse)
async def authenticate_user(auth: UserAuthRequest, db: Session = Depends(get_db)):
    """Authenticate user and create session"""
    user_id = auth.user_id.strip()
    
    # Check if user ID is allowed
    if user_id not in ALLOWED_USER_IDS:
        raise HTTPException(
            status_code=403,
            detail="Invalid user ID. Please check your user ID and try again."
        )
    
    # Create new session in SQLite (for backward compatibility)
    session = UserSession(
        user_id=user_id,
        start_time=datetime.now(),
        completed=False
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Also save to JSON dataset storage
    try:
        dataset_storage.create_session(user_id, session.id)
        logger.info(f"✅ Dataset session created for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to create dataset session: {e}")
    
    logger.info(f"User authenticated: {user_id}, session_id: {session.id}")
    
    return UserAuthResponse(
        success=True,
        message="Authentication successful",
        session_id=session.id
    )

@router.post("/session/end")
async def end_session(request: SessionEndRequest, db: Session = Depends(get_db)):
    """Mark session as completed"""
    session = db.query(UserSession).filter(
        UserSession.id == request.session_id,
        UserSession.user_id == request.user_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.end_time = datetime.now()
    session.completed = True
    db.commit()
    
    # Also update JSON dataset storage
    try:
        dataset_storage.end_session(request.user_id)
        logger.info(f"✅ Dataset session ended for user {request.user_id}")
    except Exception as e:
        logger.error(f"Failed to end dataset session: {e}")
    
    logger.info(f"Session ended: user_id={request.user_id}, session_id={request.session_id}")
    return {"success": True, "message": "Session ended successfully"}

@router.post("/tool-a/image")
async def submit_tool_a_image(submission: ToolAImageSubmission, db: Session = Depends(get_db)):
    """Submit Tool A generated image"""
    try:
        # Save to SQLite (backward compatibility)
        image = ToolAGeneratedImage(
            session_id=submission.session_id,
            user_id=submission.user_id,
            image_url=submission.image_url,
            user_input=submission.user_input,
            operation=submission.operation,
            is_final=submission.is_final,
            timestamp=datetime.now()
        )
        db.add(image)
        db.commit()
        db.refresh(image)
        
        # Also save to JSON dataset storage
        try:
            dataset_storage.add_tool_a_image(
                submission.user_id,
                submission.image_url,
                submission.user_input,
                submission.operation,
                submission.is_final
            )
            logger.info(f"✅ Tool A image saved to dataset for user {submission.user_id}")
        except Exception as e:
            logger.error(f"Failed to save Tool A image to dataset: {e}")
        
        logger.info(f"Tool A image saved: user_id={submission.user_id}, image_id={image.id}")
        return {"success": True, "image_id": image.id}
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving Tool A image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tool-b/layout")
async def submit_tool_b_layout(submission: ToolBLayoutSubmission, db: Session = Depends(get_db)):
    """Submit Tool B layout screenshot"""
    try:
        # Save to SQLite (backward compatibility)
        layout = ToolBLayoutScreenshot(
            session_id=submission.session_id,
            user_id=submission.user_id,
            screenshot_url=submission.screenshot_url,
            operation=submission.operation,
            timestamp=datetime.now()
        )
        db.add(layout)
        db.commit()
        db.refresh(layout)
        
        # Also save to JSON dataset storage
        try:
            dataset_storage.add_tool_b_layout(
                submission.user_id,
                submission.screenshot_url,
                submission.operation
            )
            logger.info(f"✅ Tool B layout saved to dataset for user {submission.user_id}")
        except Exception as e:
            logger.error(f"Failed to save Tool B layout to dataset: {e}")
        
        logger.info(f"Tool B layout saved: user_id={submission.user_id}, layout_id={layout.id}")
        return {"success": True, "layout_id": layout.id}
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving Tool B layout: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tool-b/image")
async def submit_tool_b_image(submission: ToolBImageSubmission, db: Session = Depends(get_db)):
    """Submit Tool B generated image"""
    try:
        # Save to SQLite (backward compatibility)
        image = ToolBGeneratedImage(
            session_id=submission.session_id,
            user_id=submission.user_id,
            image_url=submission.image_url,
            layout_screenshot_id=submission.layout_screenshot_id,
            operation=submission.operation,
            is_final=submission.is_final,
            timestamp=datetime.now()
        )
        db.add(image)
        db.commit()
        db.refresh(image)
        
        # Also save to JSON dataset storage
        try:
            dataset_storage.add_tool_b_image(
                submission.user_id,
                submission.image_url,
                submission.layout_screenshot_id,
                submission.operation,
                submission.is_final
            )
            logger.info(f"✅ Tool B image saved to dataset for user {submission.user_id}")
        except Exception as e:
            logger.error(f"Failed to save Tool B image to dataset: {e}")
        
        logger.info(f"Tool B image saved: user_id={submission.user_id}, image_id={image.id}")
        return {"success": True, "image_id": image.id}
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving Tool B image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tool-c/canvas")
async def submit_tool_c_canvas(submission: ToolCCanvasSubmission, db: Session = Depends(get_db)):
    """Submit Tool C canvas state"""
    try:
        # Save to SQLite (backward compatibility)
        canvas = ToolCCanvasState(
            session_id=submission.session_id,
            user_id=submission.user_id,
            canvas_data=submission.canvas_data,
            operation=submission.operation,
            timestamp=datetime.now()
        )
        db.add(canvas)
        db.commit()
        db.refresh(canvas)
        
        # Also save to JSON dataset storage
        try:
            dataset_storage.add_tool_c_canvas(
                submission.user_id,
                submission.canvas_data,
                submission.operation
            )
            logger.info(f"✅ Tool C canvas saved to dataset for user {submission.user_id}")
        except Exception as e:
            logger.error(f"Failed to save Tool C canvas to dataset: {e}")
        
        logger.info(f"Tool C canvas saved: user_id={submission.user_id}, canvas_id={canvas.id}")
        return {"success": True, "canvas_id": canvas.id}
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving Tool C canvas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tool-c/image")
async def submit_tool_c_image(submission: ToolCImageSubmission, db: Session = Depends(get_db)):
    """Submit Tool C generated/saved image"""
    try:
        # Save to SQLite (backward compatibility)
        image = ToolCGeneratedImage(
            session_id=submission.session_id,
            user_id=submission.user_id,
            image_url=submission.image_url,
            operation=submission.operation,
            is_final=submission.is_final,
            timestamp=datetime.now()
        )
        db.add(image)
        db.commit()
        db.refresh(image)
        
        # Also save to JSON dataset storage
        try:
            dataset_storage.add_tool_c_image(
                submission.user_id,
                submission.image_url,
                submission.operation,
                submission.is_final
            )
            logger.info(f"✅ Tool C image saved to dataset for user {submission.user_id}")
        except Exception as e:
            logger.error(f"Failed to save Tool C image to dataset: {e}")
        
        logger.info(f"Tool C image saved: user_id={submission.user_id}, image_id={image.id}")
        return {"success": True, "image_id": image.id}
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving Tool C image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/evaluation")
async def submit_evaluation(submission: EvaluationSubmission, db: Session = Depends(get_db)):
    """Submit evaluation response"""
    try:
        if not (1 <= submission.answer <= 7):
            raise HTTPException(status_code=400, detail="Answer must be between 1 and 7")
        
        # Save to SQLite (backward compatibility)
        response = EvaluationResponse(
            session_id=submission.session_id,
            user_id=submission.user_id,
            tool=submission.tool,
            task=submission.task,
            question=submission.question,
            answer=submission.answer,
            timestamp=datetime.now()
        )
        db.add(response)
        db.commit()
        db.refresh(response)
        
        # Also save to JSON dataset storage
        try:
            dataset_storage.add_evaluation(
                submission.user_id,
                submission.tool,
                submission.task,
                submission.question,
                submission.answer
            )
            logger.info(f"✅ Evaluation saved to dataset for user {submission.user_id}")
        except Exception as e:
            logger.error(f"Failed to save evaluation to dataset: {e}")
        
        logger.info(f"Evaluation saved: user_id={submission.user_id}, response_id={response.id}")
        return {"success": True, "response_id": response.id}
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving evaluation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

