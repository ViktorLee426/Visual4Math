# backend/app/api/routes/chat.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.conversation_service import process_conversation
from app.services.chat_service import get_text_response_stream
from app.services.intent_service import analyze_intent
from app.services.image_storage_service import store_image
from app.services.image_service import get_image_response_stream
from app.services.image_modification_service import edit_image_region_stream
import json
import logging

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """Main chat endpoint that handles text and images"""
    logger.info(f"Chat request received - input length: {len(request.user_input)}, history: {len(request.conversation_history)} messages")
    
    is_image_edit = request.image_region and request.image_region.image_url
    
    if not is_image_edit:
        for i, msg in enumerate(request.conversation_history):
            if msg.image_url:
                is_base64 = (msg.image_url.startswith('data:image') or 
                            (not msg.image_url.startswith('/') and 
                             not msg.image_url.startswith('http') and 
                             len(msg.image_url) > 100))
                
                if is_base64:
                    try:
                        image_url = store_image(msg.image_url)
                        msg.image_url = image_url
                        logger.debug(f"Converted history[{i}] image to URL")
                    except Exception as e:
                        logger.warning(f"Failed to convert history[{i}] image: {e}")
    
    if request.image_region and request.image_region.image_url:
        image_region_url = request.image_region.image_url
        if image_region_url.startswith('data:image') or (
            not image_region_url.startswith('/') and 
            not image_region_url.startswith('http') and 
            len(image_region_url) > 100
        ):
            try:
                request.image_region.image_url = store_image(image_region_url)
                logger.debug("Converted image_region URL")
            except Exception as e:
                logger.warning(f"Failed to convert image_region URL: {e}")
    
    try:
        response = process_conversation(request)
        logger.info(f"Chat request completed - type: {response.type}")
        return response
    except Exception as e:
        logger.error(f"Chat request failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stream")
async def chat_with_ai_stream(request: ChatRequest):
    """Streaming chat endpoint for text and image responses"""
    logger.info(f"Streaming chat request - input length: {len(request.user_input)}")
    
    try:
        intent = analyze_intent(request)
        logger.debug(f"Streaming intent: {intent}")
        
        if intent == "text_solo":
            def generate():
                chunk_count = 0
                for chunk in get_text_response_stream(request):
                    chunk_count += 1
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                logger.debug(f"Text streaming completed: {chunk_count} chunks")
            
            return StreamingResponse(generate(), media_type="text/plain")
        elif intent == "image_solo":
            is_image_edit = request.image_region and request.image_region.image_url
            
            if is_image_edit:
                logger.debug("Image editing stream requested")
                def generate():
                    for event in edit_image_region_stream(request):
                        if event['type'] == 'status':
                            yield f"data: {json.dumps({'type': 'status', 'message': event['message']})}\n\n"
                        elif event['type'] == 'partial_image':
                            yield f"data: {json.dumps({'type': 'partial_image', 'index': event['index'], 'image_b64': event['image_b64']})}\n\n"
                        elif event['type'] == 'completed':
                            yield f"data: {json.dumps({'type': 'image_solo', 'content': 'Edited', 'image_url': event['image_url']})}\n\n"
                            yield f"data: {json.dumps({'type': 'done'})}\n\n"
                            break
                        elif event['type'] == 'error':
                            yield f"data: {json.dumps({'type': 'error', 'message': event['message']})}\n\n"
                            yield f"data: {json.dumps({'type': 'done'})}\n\n"
                            break
                return StreamingResponse(generate(), media_type="text/plain")
            else:
                logger.debug("Image generation stream requested")
                def generate():
                    yield f"data: {json.dumps({'type': 'status', 'message': 'Generating image, may take a moment...'})}\n\n"
                    
                    for event in get_image_response_stream(request):
                        if event['type'] == 'partial_image':
                            yield f"data: {json.dumps({'type': 'partial_image', 'index': event['index'], 'image_b64': event['image_b64']})}\n\n"
                        elif event['type'] == 'completed':
                            yield f"data: {json.dumps({'type': 'image_solo', 'content': 'Generated', 'image_url': event['image_url']})}\n\n"
                            yield f"data: {json.dumps({'type': 'done'})}\n\n"
                            break
                        elif event['type'] == 'error':
                            yield f"data: {json.dumps({'type': 'error', 'message': event['message']})}\n\n"
                            yield f"data: {json.dumps({'type': 'done'})}\n\n"
                            break
                
                return StreamingResponse(generate(), media_type="text/plain")
        else:
            logger.debug("Both intent detected, using regular endpoint")
            response = process_conversation(request, intent)
            def generate():
                yield f"data: {json.dumps(response.dict())}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return StreamingResponse(generate(), media_type="text/plain")
            
    except Exception as e:
        logger.error(f"Streaming chat failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Visual4Math Chat API"}

