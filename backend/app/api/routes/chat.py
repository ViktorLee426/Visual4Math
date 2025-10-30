# backend/app/api/routes/chat.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.openai_service import process_conversation, get_text_response_stream, analyze_intent
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
    """Streaming chat endpoint for text responses"""
    logger.info("🌊 STREAMING CHAT REQUEST RECEIVED")
    logger.info(f"👤 User input: {request.user_input}")
    logger.info(f"📜 History length: {len(request.conversation_history)} messages")
    
    try:
        intent = analyze_intent(request)
        logger.info(f"🧠 Streaming intent: {intent}")
        
        if intent == "text":
            logger.info("📝 Starting text streaming...")
            def generate():
                chunk_count = 0
                for chunk in get_text_response_stream(request):
                    chunk_count += 1
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                logger.info(f"✅ Streaming completed: {chunk_count} chunks sent")
            
            return StreamingResponse(generate(), media_type="text/plain")
        else:
            # For image responses, fall back to regular endpoint
            logger.info(f"🔄 Image intent detected, falling back to regular endpoint...")
            # Pass the already analyzed intent to avoid duplicate analysis
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

