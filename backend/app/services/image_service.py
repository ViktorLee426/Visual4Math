# backend/app/services/image_service.py
from app.clients.openai_client import client
from app.schemas.chat import ChatRequest
import logging

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
        logger.info("🚀 CALLING OPENAI IMAGES.GENERATE API NOW")
        logger.info(f"📝 Prompt preview: {prompt[:200]}...")
        logger.info("=" * 80)
        
        response = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            n=1,
            size="1024x1024"
        )

        logger.info(f"📦 DEBUG: Response type: {type(response)}")
        logger.info(f"📦 DEBUG: Response data length: {len(response.data) if response.data else 0}")
        
        if response.data and len(response.data) > 0:
            image_data = response.data[0]
            logger.info(f"📦 DEBUG: Received image data: {type(image_data)}")
            
            # GPT-4o-image with URL format - prioritize URL for efficiency
            if hasattr(image_data, 'url') and image_data.url:
                logger.info(f"✅ Image generated successfully (URL format): {image_data.url}")
                return image_data.url
            # Fallback for base64 response (if available)
            elif hasattr(image_data, 'b64_json') and image_data.b64_json:
                base64_data = image_data.b64_json
                data_url = f"data:image/png;base64,{base64_data}"
                logger.info(f"✅ Image generated successfully (base64 format): {len(base64_data)} chars")
                logger.info(f"🔗 DEBUG: Base64 data URL created: data:image/png;base64,{base64_data[:50]}...")
                return data_url
            else:
                logger.error("❌ No image data found in response - missing both url and b64_json")
                logger.info(f"🔍 Available attributes: {dir(image_data)}")
                if hasattr(image_data, '__dict__'):
                    logger.info(f"🔍 Image data dict: {image_data.__dict__}")
                return ""
        else:
            logger.error("❌ No image data in response - empty response.data")
            return ""
            
    except Exception as e:
        logger.error(f"❌ Image generation failed: {type(e).__name__}: {e}")
        logger.error(f"🔍 Full error details: {str(e)}")
        raise e

