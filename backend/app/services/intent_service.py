# backend/app/services/intent_service.py
from app.clients.openai_client import client
from app.schemas.chat import ChatRequest
import logging

logger = logging.getLogger(__name__)

def analyze_intent(request: ChatRequest) -> str:
    """Use GPT-4o to determine if user wants text, image, or both.
    Be strict: only classify as image_solo/both when the user explicitly asks
    for an image/diagram/drawing OR when an existing image is being edited.
    """
    logger.info("🧠 Analyzing user intent with GPT-4o...")
    
    # Check if there's an image in conversation history (for modification requests)
    has_image_in_history = False
    if request.conversation_history:
        for msg in request.conversation_history:
            if hasattr(msg, 'image_url') and msg.image_url:
                has_image_in_history = True
                logger.info(f"🖼️ Found image in conversation history - may be modification request")
                break
    
    # Check if there's an image region or referenced image (explicit edit)
    has_explicit_image_edit = bool(
        (request.image_region and request.image_region.image_url) or 
        request.referenced_image_id
    )
    
    if has_explicit_image_edit:
        logger.info("🎨 Explicit image edit detected (mask/reference) - returning image_solo")
        return "image_solo"

    # Build context about recent conversation
    recent_context = ""
    if request.conversation_history:
        recent_messages = request.conversation_history[-3:]  # Last 3 messages for context
        for msg in recent_messages:
            role = getattr(msg, 'role', 'unknown')
            content = getattr(msg, 'content', '')[:100]  # First 100 chars
            has_img = hasattr(msg, 'image_url') and getattr(msg, 'image_url', None)
            recent_context += f"{role}: {content}"
            if has_img:
                recent_context += " [HAS IMAGE]"
            recent_context += "\n"

    analysis_prompt = f"""Analyze this user request and determine the output modality needed.

User input: "{request.user_input}"

Recent conversation context:
{recent_context}

Rules:
- If user says "want an image", "need an image", "create an image", "draw", "show me", "give me an image" → image_solo
- If user provides a specific math word problem with numbers (e.g., "There are 10 basketballs...") → image_solo
- If user asks to modify/change/fix/adjust an existing image → image_solo
- If user asks for explanation only → text_solo
- If user asks for both explanation AND visual → both
- Generic vague requests like "help me create images" WITHOUT a specific problem → text_solo

Respond with exactly one of these three options:

- "text_solo" - if user wants ONLY explanation/answer in text (no visual needed)
- "image_solo" - if user wants visual/diagram OR provides a specific math problem to visualize
- "both" - if user wants BOTH text explanation AND visual/diagram

Good decisions examples:
- "What is a derivative?" → text_solo
- "Draw a graph of y=x^2" → image_solo
- "I want an image for this problem: There are 10 basketballs..." → image_solo
- "Create a visualization of the Pythagorean theorem" → image_solo
- "draw the image for the problem now" → image_solo
- "you are not giving me the image.... draw the image for the problem now" → image_solo
- "i told you that i want an image for this problem: [problem text]" → image_solo
- "Explain derivatives and show me a visual example" → both
- "Make this image bigger" (there is an image in context) → image_solo 
- "I think there are too many basketballs, can you fix it?" (image in context) → image_solo
- "What does this formula mean?" → text_solo

Edge cases that MUST be text_solo:
- "help me to create some images for math word problem" (vague, no specific problem)
- "how can I make images for word problems?" (asking how, not requesting image)

IMPORTANT: If the user provides a specific math word problem with numbers and objects (like basketballs, bags, etc.), return image_solo even if they don't use explicit verbs like "draw" or "create".

Respond with exactly one word: text_solo, image_solo, or both

Output modality:"""

    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            logger.info(f"🔗 DEBUG: Connecting to OpenAI for intent analysis (attempt {attempt + 1})...")
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": analysis_prompt}],
                max_tokens=15,
                temperature=0
            )
            
            raw_result = response.choices[0].message.content
            result = raw_result.strip().lower() if raw_result else ""
            
            # Parse result - look for valid intents
            valid_intents = ["text_solo", "image_solo", "both"]
            result_lower = result.lower()
            
            # Try to extract intent from response
            final_intent = None
            for intent in valid_intents:
                if intent in result_lower:
                    final_intent = intent
                    break
            
            # If not found, try partial matches
            if not final_intent:
                if "text" in result_lower and "image" not in result_lower and "both" not in result_lower:
                    final_intent = "text_solo"
                elif "image" in result_lower and "text" not in result_lower and "both" not in result_lower:
                    final_intent = "image_solo"
                elif "both" in result_lower:
                    final_intent = "both"
            
            # Default fallback
            if not final_intent:
                if attempt < max_retries:
                    logger.warning(f"⚠️ Unclear intent result: '{result}', retrying...")
                    continue
                else:
                    logger.warning(f"⚠️ Could not parse intent, defaulting to 'text_solo'. Raw result: '{result}'")
                    final_intent = "text_solo"
            
            logger.info(f"🧠 DEBUG: GPT-4o intent analysis result: '{result}', final intent: '{final_intent}'")
            return final_intent
            
        except Exception as e:
            logger.error(f"❌ Intent analysis failed (attempt {attempt + 1}): {type(e).__name__}: {e}")
            if attempt < max_retries:
                continue
            else:
                logger.info("🔄 Falling back to 'text_solo' intent")
                return "text_solo"

