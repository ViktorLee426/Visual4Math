# backend/app/api/routes/chat.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.openai_service import process_conversation, get_text_response_stream, analyze_intent
import json

router = APIRouter()

@router.post("/", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """Main chat endpoint that handles text and images"""
    try:
        response = process_conversation(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stream")
async def chat_with_ai_stream(request: ChatRequest):
    """Streaming chat endpoint for text responses"""
    try:
        intent = analyze_intent(request)
        
        if intent == "text":
            def generate():
                for chunk in get_text_response_stream(request):
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
            return StreamingResponse(generate(), media_type="text/plain")
        else:
            # For image/both responses, fall back to regular endpoint
            response = process_conversation(request)
            def generate():
                yield f"data: {json.dumps(response.dict())}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return StreamingResponse(generate(), media_type="text/plain")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Visual4Math Chat API"}

