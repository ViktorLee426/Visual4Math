# backend/app/api/routes/chat.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.openai_service import get_openai_response

router = APIRouter()

@router.post("/", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    try:
        reply = get_openai_response(request.user_input)
        return ChatResponse(response=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    return {"filename": file.filename}

