# backend/app/services/chat_service.py
from app.clients.openai_client import client
from app.schemas.chat import ChatRequest, ChatMessage
from app.services.image_storage_service import get_image_path
from typing import List
import logging
import base64

logger = logging.getLogger(__name__)

def _convert_image_url_for_gpt(image_url: str) -> str:
    """
    Convert backend image URL to base64 data URL for GPT.
    GPT can't access our internal URLs, so we need to convert backend URLs to base64.
    External URLs (http/https) are passed through as-is.
    """
    # If it's already an external URL or base64, return as-is
    if image_url.startswith('http://') or image_url.startswith('https://'):
        return image_url
    if image_url.startswith('data:image'):
        return image_url
    
    # If it's a backend URL like /images/{id}, convert to base64
    if image_url.startswith('/images/'):
        image_id = image_url.replace('/images/', '')
        image_path = get_image_path(image_id)
        if image_path:
            try:
                with open(image_path, 'rb') as f:
                    image_bytes = f.read()
                base64_data = base64.b64encode(image_bytes).decode('utf-8')
                data_url = f"data:image/png;base64,{base64_data}"
                logger.info(f"🔄 Converted backend URL to base64 for GPT: {image_id}")
                return data_url
            except Exception as e:
                logger.error(f"❌ Failed to convert image URL to base64: {e}")
                # Fallback: return original URL (GPT might fail, but better than crashing)
                return image_url
    
    # Unknown format, return as-is
    logger.warning(f"⚠️ Unknown image URL format: {image_url[:50]}...")
    return image_url

def build_openai_messages(request: ChatRequest) -> List[dict]:
    """Convert ChatRequest to OpenAI message format.

    Keep the payload lean so OpenAI calls stay responsive:
    - Limit history to the last few turns
    - Attach at most one previous image (as base64) for context
    """
    logger.info("🔧 Building OpenAI messages from conversation history...")
    logger.info(f"📝 Conversation history length: {len(request.conversation_history)} messages")
    
    # Start with a concise system message to set behavior
    messages = [
        {
            "role": "system",
            "content": (
                "You are Visual4Math, an assistant that can generate both text explanations and images. "
                "Never claim you cannot create images. If the user request is vague or lacks a specific math problem, "
                "ask 2-4 concise clarifying questions instead of inventing details. Keep responses short and focused."
            ),
        }
    ]
    
    recent_history = request.conversation_history[-6:] if request.conversation_history else []
    images_added = 0
    max_images_for_context = 1
    
    # Add conversation history
    for i, msg in enumerate(recent_history):
        logger.info(f"📜 Processing history message {i+1}: {msg.role} - {msg.content[:100]}..." + ("" if len(msg.content) <= 100 else "..."))
        if msg.image_url:
            logger.info(f"🖼️ Message {i+1} includes image: {msg.image_url[:50]}...")
            
        if msg.role == "user":
            if msg.image_url:
                if images_added < max_images_for_context:
                    gpt_image_url = _convert_image_url_for_gpt(msg.image_url)
                    messages.append({
                        "role": "user",
                        "content": [
                            {"type": "text", "text": msg.content},
                            {"type": "image_url", "image_url": {"url": gpt_image_url}}
                        ]
                    })
                    images_added += 1
                else:
                    # Skip embedding more images to keep payload small
                    messages.append({"role": "user", "content": msg.content})
            else:
                # User message text only
                messages.append({"role": "user", "content": msg.content})
        else:  # assistant
            # Assistant messages are always text (OpenAI limitation)
            # But if the assistant generated an image, we add it as a "user" message
            # so GPT can see the previously generated image in future conversations
            if msg.image_url:
                messages.append({"role": "assistant", "content": msg.content})
                if images_added < max_images_for_context:
                    gpt_image_url = _convert_image_url_for_gpt(msg.image_url)
                    messages.append({
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "[Previous visual reference from assistant]"},
                            {"type": "image_url", "image_url": {"url": gpt_image_url}}
                        ]
                    })
                    images_added += 1
                    logger.info("🔄 Added assistant image as user context (limited to 1 image)")
            else:
                # Text-only assistant message
                messages.append({"role": "assistant", "content": msg.content})
    
    # Add current user input
    logger.info(f"➕ Adding current user input: {request.user_input[:100]}..." + ("" if len(request.user_input) <= 100 else "..."))
    if request.user_image:
        logger.info(f"📸 Current message includes image: {request.user_image[:50]}...")
        # Convert backend URL to base64 for GPT
        gpt_image_url = _convert_image_url_for_gpt(request.user_image)
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": request.user_input},
                {"type": "image_url", "image_url": {"url": gpt_image_url}}
            ]
        })
    else:
        messages.append({"role": "user", "content": request.user_input})
    
    logger.info(f"✅ Built {len(messages)} messages for OpenAI API")
    return messages

def get_text_response(request: ChatRequest) -> str:
    """Get text response from GPT"""
    logger.info("📝 Generating text response...")
    messages = build_openai_messages(request)
    
    try:
        logger.info(f"🔗 DEBUG: Connecting to OpenAI for text generation...")
        logger.info(f"🤖 DEBUG: Using model 'gpt-4o' for text generation")
        logger.info(f"📊 DEBUG: Sending {len(messages)} messages to OpenAI")
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            stream=False
        )
        text_result = response.choices[0].message.content
        logger.info(f"✅ Text response generated successfully: {len(text_result)} characters")
        logger.info(f"📄 Response preview: {text_result[:200]}..." + ("" if len(text_result) <= 200 else "..."))
        return text_result
    except Exception as e:
        logger.error(f"❌ Text generation failed: {type(e).__name__}: {e}")
        raise e

def get_text_response_stream(request: ChatRequest):
    """Get streaming text response from GPT"""
    logger.info("🌊 Generating streaming text response...")
    messages = build_openai_messages(request)
    
    try:
        logger.info("🔗 DEBUG: Connecting to OpenAI for streaming text generation...")
        logger.info("🤖 DEBUG: Using model 'gpt-4o' for streaming text generation")
        logger.info(f"📊 DEBUG: Sending {len(messages)} messages to OpenAI")
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            stream=True
        )
        
        logger.info("✅ Streaming response started")
        chunk_count = 0
        for chunk in response:
            if chunk.choices[0].delta.content is not None:
                chunk_count += 1
                yield chunk.choices[0].delta.content
        logger.info(f"✅ Streaming complete: {chunk_count} chunks sent")
    except Exception as e:
        logger.error(f"❌ Streaming text generation failed: {type(e).__name__}: {e}")
        raise e

