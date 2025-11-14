# backend/app/services/conversation_service.py
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.intent_service import analyze_intent
from app.services.chat_service import get_text_response
from app.services.image_service import get_image_response
from app.services.image_modification_service import edit_image_region
import logging
import time

logger = logging.getLogger(__name__)

GENERIC_VAGUE_PHRASES = [
    "help me to create some images",
    "help me create images",
    "create some images",
    "make images",
    "how to create images",
    "how can i make images",
]

def _is_specific_image_request(text: str) -> bool:
    """Heuristic: check if request is specific enough to generate an image.
    Examples that pass: 
    - 'draw a graph of y=x^2' 
    - 'make a number line from -5 to 5'
    - 'i want an image for this problem: There are 10 basketballs...'
    - Any word problem with numbers and specific details
    """
    t = (text or "").lower()
    
    # Check for generic vague phrases first
    if any(p in t for p in GENERIC_VAGUE_PHRASES):
        return False
    
    # Check for image request phrases
    image_request_phrases = [
        "want an image", "want a image", "need an image", "need a image",
        "create an image", "create a image", "make an image", "make a image",
        "draw", "generate", "illustrate", "visualize", "diagram", "show me",
        "give me", "i want", "can you", "please create", "please draw",
        "for this problem", "for the problem", "for this", "of this"
    ]
    has_image_request = any(phrase in t for phrase in image_request_phrases)
    
    # Check for math specificity: numbers, math words, or word problem structure
    math_markers = [
        "graph", "fraction", "number line", "triangle", "rectangle", "area", 
        "equation", "x=", "y=", "plot", "bar chart", "pie chart", "basketball",
        "bag", "total", "has", "how many", "problem", "solve", "word problem"
    ]
    has_numbers = any(ch.isdigit() for ch in t)
    has_math_markers = any(m in t for m in math_markers)
    
    # Word problem indicators (questions with numbers)
    is_word_problem = (
        "?" in text and has_numbers and (
            "how many" in t or "what" in t or "if" in t or
            "total" in t or "has" in t or "are" in t
        )
    )
    
    # If it's a word problem with numbers, it's specific enough
    if is_word_problem and has_numbers:
        logger.info(f"✅ Detected word problem with numbers: {text[:50]}...")
        return True
    
    # Otherwise, need either image request phrase + numbers/markers, or explicit verb + markers
    explicit_verbs = ["draw", "generate", "create", "make", "illustrate", "visualize", "diagram", "show"]
    has_explicit_verb = any(v in t for v in explicit_verbs)
    
    return (has_image_request and (has_numbers or has_math_markers)) or (has_explicit_verb and (has_numbers or has_math_markers))

def process_conversation(request: ChatRequest, intent: str = None) -> ChatResponse:
    """Main function: Process user input and return appropriate response"""
    logger.info("🚀 Starting conversation processing...")
    
    if not request.user_input.strip():
        logger.warning("⚠️ Empty user input received")
        return ChatResponse(
            type="text_solo",
            content="Please provide a message or question.",
            image_url=None
        )
    
    # Check if this is an image editing request (with explicit mask/region)
    if request.image_region and request.image_region.image_url:
        logger.info("🎨 Image editing request detected (with mask/region)...")
        logger.info(f"🖼️ Editing image: {request.image_region.image_url[:50]}...")
        logger.info(f"📝 Edit instruction: {request.user_input}")
        try:
            logger.info("🔗 Calling OpenAI images.edit API...")
            start_time = time.perf_counter()
            edited_image_url = edit_image_region(request)
            duration = time.perf_counter() - start_time
            logger.info(f"⏱️ Image edit completed in {duration:.1f}s")
            result = ChatResponse(
                type="image_solo",
                content=f"Edited in {duration:.1f}s",
                image_url=edited_image_url
            )
            logger.info(f"✅ Image editing complete: {len(edited_image_url)} chars image URL")
            return result
        except Exception as e:
            logger.error(f"❌ Image editing failed: {type(e).__name__}: {e}")
            return ChatResponse(
                type="text_solo",
                content="I encountered an error editing the image. Please try again.",
                image_url=None
            )
    
    # Only analyze intent if not provided
    if intent is None:
        logger.info("🧠 No intent provided, analyzing user intent...")
        intent = analyze_intent(request)
    else:
        logger.info(f"🧠 Using provided intent: {intent}")

    try:
        if intent == "text_solo":
            # Just text response
            logger.info("📝 DEBUG: Processing text-only response...")
            text_content = get_text_response(request)
            result = ChatResponse(
                type="text_solo",
                content=text_content,
                image_url=None
            )
            logger.info(f"✅ DEBUG: Text-only response complete: {len(text_content)} characters")
            return result
        
        elif intent == "image_solo":
            # Check if there's an image in history - might be modification request
            has_image_in_history = False
            last_image_url = None
            if request.conversation_history:
                for msg in reversed(request.conversation_history):  # Check from most recent
                    if hasattr(msg, 'image_url') and getattr(msg, 'image_url', None):
                        has_image_in_history = True
                        last_image_url = getattr(msg, 'image_url', None)
                        logger.info(f"🖼️ Found image in conversation history - treating as modification request")
                        logger.info(f"📝 Modification instruction: {request.user_input}")
                        break
            
            # Check if request is specific enough
            is_specific = _is_specific_image_request(request.user_input)
            
            # Only ask clarifying questions if request is vague AND no image in history
            # If intent is image_solo, it means GPT-4o detected the user wants an image, so trust it
            if not is_specific and not has_image_in_history:
                # But if the user has been asking repeatedly, just generate the image
                # Check if this looks like a repeated request
                user_input_lower = request.user_input.lower()
                is_repeated_request = any(phrase in user_input_lower for phrase in [
                    "i told you", "you are not", "draw the image", "give me the image",
                    "now", "just", "already told"
                ])
                
                if is_repeated_request:
                    logger.info("🔄 Repeated image request detected - generating image despite vague phrasing")
                    # Generate image anyway
                else:
                    logger.info("🛑 Vague image request detected; asking clarifying questions.")
                    questions = (
                        "To create the right visual, could you clarify:\n"
                        "1) What concept/problem should the image show?\n"
                        "2) Any labels, numbers, or constraints to include?\n"
                        "3) Preferred style (diagram, graph, objects, etc.)?"
                    )
                    return ChatResponse(type="text_solo", content=questions, image_url=None)
            
            logger.info("🎨 DEBUG: Processing image-only response...")
            logger.info(f"🔗 Calling OpenAI images.generate API...")
            logger.info(f"📝 User request: {request.user_input}")
            if has_image_in_history:
                logger.info(f"🔄 Generating modified image based on conversation context...")
            start_time = time.perf_counter()
            image_url = get_image_response(request)
            duration = time.perf_counter() - start_time
            logger.info(f"⏱️ Image generation completed in {duration:.1f}s")
            result = ChatResponse(
                type="image_solo",
                content=f"Generated in {duration:.1f}s",
                image_url=image_url
            )
            logger.info(f"✅ DEBUG: Image-only response complete: {len(image_url)} chars image URL")
            return result
        
        elif intent == "both":
            if not _is_specific_image_request(request.user_input):
                logger.info("🛑 Vague 'both' request; returning clarifying questions.")
                questions = (
                    "To help with both explanation and a visual, please specify:\n"
                    "1) The exact math problem or concept\n"
                    "2) Key values/labels to include\n"
                    "3) Desired visual type"
                )
                return ChatResponse(type="text_solo", content=questions, image_url=None)
            logger.info("🔄 DEBUG: Processing both text and image response...")
            # Get text response first
            text_content = get_text_response(request)
            # Then get image response (may reuse conversation context)
            start_time = time.perf_counter()
            image_url = get_image_response(request)
            duration = time.perf_counter() - start_time
            logger.info(f"⏱️ Image generation (both) completed in {duration:.1f}s")
            result = ChatResponse(
                type="both",
                content=f"{text_content}\n\n_Image generated in {duration:.1f}s._",
                image_url=image_url
            )
            logger.info(f"✅ DEBUG: Both text and image response complete")
            return result
        else:
            # Fallback for unexpected intent
            logger.warning(f"⚠️ Unexpected intent: {intent}, defaulting to text_solo")
            text_content = get_text_response(request)
            result = ChatResponse(
                type="text_solo",
                content=text_content,
                image_url=None
            )
            return result
    
    except Exception as e:
        logger.error(f"❌ Error in process_conversation: {type(e).__name__}: {e}")
        logger.error(f"🔍 Full error details: {str(e)}")
        return ChatResponse(
            type="text_solo",
            content="I encountered an error processing your request. Please try again.",
            image_url=None
        )

