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
    logger.info("=" * 80)
    logger.info("🔥 NEW CHAT REQUEST RECEIVED")
    logger.info(f"👤 User input: {request.user_input}")
    logger.info(f"📷 User image: {'Yes' if request.user_image else 'No'}")
    logger.info(f"📜 History length: {len(request.conversation_history)} messages")
    
    # Check if this is an image editing request - if so, skip history processing for speed
    is_image_edit = request.image_region and request.image_region.image_url
    
    if not is_image_edit:
        # Only convert history images for non-editing requests (text/image generation)
        # For image editing, we don't need history images - just the image being edited
        logger.info("📝 Non-editing request: Converting history images to URLs...")
        for i, msg in enumerate(request.conversation_history):
            if msg.image_url:
                # Check if it's base64 (data URL or long non-URL string)
                is_base64 = (msg.image_url.startswith('data:image') or 
                            (not msg.image_url.startswith('/') and 
                             not msg.image_url.startswith('http') and 
                             len(msg.image_url) > 100))
                
                if is_base64:
                    try:
                        logger.info(f"💾 Converting base64 image in history[{i}] to URL...")
                        image_url = store_image(msg.image_url)
                        msg.image_url = image_url
                        logger.info(f"✅ History[{i}] image converted to URL: {image_url}")
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to convert history[{i}] image: {e}")
                        # Keep original if conversion fails (shouldn't happen normally)
    else:
        logger.info("🎨 Image editing request: Skipping history image conversion for speed")
    
    # Ensure image_region.image_url is a URL (should already be, but verify)
    if request.image_region and request.image_region.image_url:
        image_region_url = request.image_region.image_url
        # If it's base64, convert to URL (shouldn't happen, but handle it)
        if image_region_url.startswith('data:image') or (
            not image_region_url.startswith('/') and 
            not image_region_url.startswith('http') and 
            len(image_region_url) > 100
        ):
            try:
                logger.info("💾 Converting image_region.image_url from base64 to URL...")
                request.image_region.image_url = store_image(image_region_url)
                logger.info(f"✅ Image region URL converted: {request.image_region.image_url}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to convert image_region URL: {e}")
    
    # Log conversation history details
    for i, msg in enumerate(request.conversation_history):
        logger.info(f"📝 History[{i}] {msg.role}: {msg.content[:100]}{'...' if len(msg.content) > 100 else ''}")
        if msg.image_url:
            logger.info(f"🖼️ History[{i}] has image: {msg.image_url[:50]}...")
    
    try:
        logger.info("🔄 Processing conversation... function call from chat.py, with chat with ai()")
        response = process_conversation(request)
        
        logger.info("✅ CHAT REQUEST COMPLETED")
        logger.info(f"📤 Response type: {response.type}")
        logger.info(f"📝 Response content: {response.content[:200]}{'...' if len(response.content) > 200 else ''}")
        logger.info(f"🖼️ Response image: {'Yes' if response.image_url else 'No'}")
        logger.info("=" * 80)
        
        return response
    except Exception as e:
        logger.error(f"❌ CHAT REQUEST FAILED: {type(e).__name__}: {e}")
        logger.error("=" * 80)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stream")
async def chat_with_ai_stream(request: ChatRequest):
    """Streaming chat endpoint for text and image responses"""
    logger.info("🌊 STREAMING CHAT REQUEST RECEIVED")
    logger.info(f"👤 User input: {request.user_input}")
    logger.info(f"📜 History length: {len(request.conversation_history)} messages")
    
    try:
        intent = analyze_intent(request)
        logger.info(f"🧠 Streaming intent: {intent}")
        
        if intent == "text_solo":
            logger.info("📝 Starting text streaming...")
            def generate():
                chunk_count = 0
                for chunk in get_text_response_stream(request):
                    chunk_count += 1
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                logger.info(f"✅ Streaming completed: {chunk_count} chunks sent")
            
            return StreamingResponse(generate(), media_type="text/plain")
        elif intent == "image_solo":
            # Check if this is image editing (has image_region)
            is_image_edit = request.image_region and request.image_region.image_url
            
            if is_image_edit:
                # Image editing - use streaming endpoint with status updates
                logger.info("🎨 Image editing detected, using streaming endpoint...")
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
                # Image generation - use streaming
                logger.info("🎨 Starting image generation streaming...")
                def generate():
                    yield f"data: {json.dumps({'type': 'status', 'message': 'Getting started...'})}\n\n"
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
            # For "both" responses, fall back to regular endpoint
            logger.info(f"🔄 Both intent detected, falling back to regular endpoint...")
            response = process_conversation(request, intent)
            def generate():
                yield f"data: {json.dumps(response.dict())}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return StreamingResponse(generate(), media_type="text/plain")
            
    except Exception as e:
        logger.error(f"❌ STREAMING CHAT FAILED: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    logger.info("💚 Health check requested")
    return {"status": "healthy", "service": "Visual4Math Chat API"}

