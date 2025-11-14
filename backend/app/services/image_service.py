# backend/app/services/image_service.py
from app.clients.openai_client import client
from app.schemas.chat import ChatRequest
from app.services.image_storage_service import store_image
import logging
import base64

logger = logging.getLogger(__name__)

def get_image_response(request: ChatRequest) -> str:
    """Generate image using GPT-4o-image"""
    logger.info("🎨 Starting image generation...")
    logger.info(f"🔍 DEBUG: Full user input for image generation: '{request.user_input}'")
    logger.info(f"📏 DEBUG: User input length: {len(request.user_input)} characters")
    
    try:
        # Build complete context from conversation history
        # Extract the actual math problem from conversation history
        math_problem = None
        context_parts = []
        
        for msg in request.conversation_history:
            content = getattr(msg, 'content', '') or ''
            role = getattr(msg, 'role', 'unknown')
            
            # Look for word problems (questions with numbers)
            if '?' in content and any(ch.isdigit() for ch in content):
                # This looks like a math problem
                if not math_problem or len(content) > len(math_problem):
                    math_problem = content
            
            context_parts.append(f"{role}: {content}")
        
        context = "\n".join(context_parts)
        
        # Use the math problem if found, otherwise use current request
        target_problem = math_problem if math_problem else request.user_input
        
        prompt = f"""Create a clear, educational mathematical visualization for this word problem:

Problem: {target_problem}

User's request: {request.user_input}

Create a detailed, mathematically precise visual illustration. The image should:
- Clearly show all numbers, objects, and relationships mentioned in the problem
- Be suitable for primary/elementary level mathematics education
- Use clear visual representations to accurately represent the mathematical scenario described in the math problem, with adecuate visual elements and optionally correct text hints.
- Show quantities through visual counting (e.g., show 10 basketballs visually if it is the case)

Generate the visualization now:"""
        
        logger.info(f"🖼️ DEBUG: Image prompt prepared: {len(prompt)} characters")
        logger.info(f"🎨 DEBUG: Generating mathematical visualization...")        
        logger.info(f"🤖 DEBUG: Using model 'gpt-image-1' for image generation...")
        logger.info("=" * 80)
        logger.info("🚀 CALLING OPENAI IMAGES.GENERATE API NOW (with streaming)")
        logger.info(f"📝 Prompt preview: {prompt[:200]}...")
        logger.info("=" * 80)
        
        # Use streaming API with partial images for better UX
        response = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            n=1,
            size="1024x1024",
            stream=True,
            partial_images=2  # Get 2 partial images before final
        )

        # Process streaming response - collect final image
        final_image_base64 = None
        
        logger.info("🌊 Processing streaming image generation...")
        partial_count = 0
        for event in response:
            event_type = getattr(event, 'type', None)
            logger.info(f"📦 Event type: {event_type}")
            
            if event_type == "image_generation.partial_image":
                partial_idx = getattr(event, 'partial_image_index', None)
                partial_b64 = getattr(event, 'b64_json', None)
                if partial_b64:
                    partial_count += 1
                    logger.info(f"📸 Received partial image {partial_idx} ({len(partial_b64)} chars)")
            elif event_type == "image_generation.completed":
                final_b64 = getattr(event, 'b64_json', None)
                if final_b64:
                    final_image_base64 = final_b64
                    logger.info(f"✅ Received final image (base64 length: {len(final_b64)} chars) after {partial_count} partial images")
                    break
        
        if final_image_base64:
            data_url = f"data:image/png;base64,{final_image_base64}"
            logger.info(f"✅ Image generated successfully (base64 format): {len(final_image_base64)} chars")
            # Store the base64 image locally and return our backend URL
            backend_url = store_image(data_url)
            logger.info(f"🔗 Stored base64 image, returning backend URL: {backend_url}")
            return backend_url
        else:
            logger.error("❌ No final image received from streaming response")
            return ""
    except Exception as e:
        logger.error(f"❌ Image generation failed: {type(e).__name__}: {e}")
        return ""

def get_image_response_stream(request: ChatRequest):
    """
    Stream image generation with partial images for better UX.
    Yields partial images and final image as they arrive.
    """
    logger.info("🌊 Starting streaming image generation...")
    
    # Build prompt (same as non-streaming version)
    math_problem = None
    context_parts = []
    
    for msg in request.conversation_history:
        content = getattr(msg, 'content', '') or ''
        role = getattr(msg, 'role', 'unknown')
        
        if '?' in content and any(ch.isdigit() for ch in content):
            if not math_problem or len(content) > len(math_problem):
                math_problem = content
        
        context_parts.append(f"{role}: {content}")
    
    context = "\n".join(context_parts)
    target_problem = math_problem if math_problem else request.user_input
    
    prompt = f"""Create a clear, educational mathematical visualization for this word problem:

Problem: {target_problem}

User's request: {request.user_input}

Create a detailed, mathematically precise visual illustration. The image should:
- Clearly show all numbers, objects, and relationships mentioned in the problem
- Be suitable for primary/elementary level mathematics education
- Use clear visual representations to accurately represent the mathematical scenario described in the math problem, with adecuate visual elements and optionally correct text hints.
- Show quantities through visual counting (e.g., show 10 basketballs visually if it is the case)

Generate the visualization now:"""
    
    logger.info(f"🌊 Streaming image generation with prompt ({len(prompt)} chars)...")
    
    try:
        # Use streaming API
        response = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            n=1,
            size="1024x1024",
            stream=True,
            partial_images=2  # Get 2 partial images before final
        )
        
        partial_count = 0
        for event in response:
            event_type = getattr(event, 'type', None)
            
            if event_type == "image_generation.partial_image":
                partial_idx = getattr(event, 'partial_image_index', None)
                partial_b64 = getattr(event, 'b64_json', None)
                if partial_b64:
                    partial_count += 1
                    logger.info(f"📸 Yielding partial image {partial_idx}")
                    yield {
                        'type': 'partial_image',
                        'index': partial_idx,
                        'image_b64': partial_b64
                    }
            elif event_type == "image_generation.completed":
                final_b64 = getattr(event, 'b64_json', None)
                if final_b64:
                    logger.info(f"✅ Yielding final image after {partial_count} partial images")
                    # Store final image
                    data_url = f"data:image/png;base64,{final_b64}"
                    backend_url = store_image(data_url)
                    yield {
                        'type': 'completed',
                        'image_url': backend_url
                    }
                    break
    except Exception as e:
        logger.error(f"❌ Streaming image generation failed: {type(e).__name__}: {e}")
        yield {
            'type': 'error',
            'message': str(e)
        }

