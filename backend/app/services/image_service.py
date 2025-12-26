# backend/app/services/image_service.py
from app.clients.openai_client import client
from app.schemas.chat import ChatRequest
from app.services.image_storage_service import store_image
import logging
import base64
import io

logger = logging.getLogger(__name__)

def get_image_response(request: ChatRequest) -> str:
    """Generate image using GPT-4o-image"""
    logger.info("🎨 Starting image generation...")
    logger.info(f"🔍 DEBUG: Full user input for image generation: '{request.user_input}'")
    logger.info(f"📏 DEBUG: User input length: {len(request.user_input)} characters")
    
    try:
        # Check if user_input already contains a detailed layout prompt
        # (from Tool2LayoutPage buildLayoutPrompt)
        if "=== LAYOUT SPECIFICATION" in request.user_input or "CRITICAL COUNT REQUIREMENTS" in request.user_input:
            # This is a detailed layout prompt from Tool2, use it directly
            prompt = request.user_input
            logger.info("✅ Detected detailed layout prompt from Tool2 - using it directly")
        else:
            # Build prompt from conversation history (for Tool1 chat)
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
        
        # LOG THE COMPLETE PROMPT FOR DEBUGGING
        logger.info("=" * 80)
        logger.info("📋 COMPLETE PROMPT BEING SENT TO GPT:")
        logger.info("=" * 80)
        logger.info(prompt)
        logger.info("=" * 80)
        logger.info(f"📏 Prompt length: {len(prompt)} characters")
        logger.info(f"🤖 DEBUG: Using model 'gpt-image-1.5' for image generation...")
        logger.info("🚀 CALLING OPENAI IMAGES.GENERATE API NOW (with streaming)")
        
        # Use streaming API with partial images for better UX
        response = client.images.generate(
            model="gpt-image-1.5",
            prompt=prompt,
            n=1,
            size="1024x1024",
            stream=True,
            partial_images=2  # Get 2 partial images before final
        )

        # Process streaming response - collect final image
        final_image_base64 = None
        error_message = None
        
        logger.info("🌊 Processing streaming image generation...")
        partial_count = 0
        event_count = 0
        for event in response:
            event_count += 1
            event_type = getattr(event, 'type', None)
            logger.info(f"📦 Event #{event_count} type: {event_type}")
            
            # Log full event for debugging if it's an error or unknown type
            if event_type in (None, "error", "image_generation.error") or event_type not in ("image_generation.partial_image", "image_generation.completed"):
                logger.debug(f"📋 Full event data: {dir(event)}")
                # Try to get all attributes
                for attr in dir(event):
                    if not attr.startswith('_'):
                        try:
                            value = getattr(event, attr)
                            if not callable(value):
                                logger.debug(f"   {attr}: {str(value)[:100]}")
                        except:
                            pass
            
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
                else:
                    logger.warning("⚠️ Completed event received but no b64_json found")
            elif event_type == "error" or event_type == "image_generation.error":
                error_message = getattr(event, 'message', None) or getattr(event, 'error', {}).get('message', 'Unknown error')
                error_code = getattr(event, 'code', None) or getattr(event, 'error', {}).get('code', 'Unknown')
                logger.error(f"❌ Error event received: {error_code} - {error_message}")
                # Try to get more error details
                if hasattr(event, 'error'):
                    logger.error(f"❌ Full error object: {event.error}")
                break
            else:
                # Log unknown event types for debugging
                logger.warning(f"⚠️ Unknown event type: {event_type}, event data: {str(event)[:200]}")
        
        logger.info(f"📊 Stream processing complete. Total events: {event_count}, Partial images: {partial_count}, Final image: {'Yes' if final_image_base64 else 'No'}")
        
        if final_image_base64:
            data_url = f"data:image/png;base64,{final_image_base64}"
            logger.info(f"✅ Image generated successfully (base64 format): {len(final_image_base64)} chars")
            # Store the base64 image locally and return our backend URL
            backend_url = store_image(data_url)
            logger.info(f"🔗 Stored base64 image, returning backend URL: {backend_url}")
            return backend_url
        else:
            error_msg = error_message or "No final image received from streaming response"
            logger.error(f"❌ {error_msg}")
            if error_message:
                raise Exception(f"Image generation failed: {error_message}")
            raise Exception("No final image received from streaming response")
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(f"❌ Image generation failed: {error_type}: {error_msg}")
        
        # Try to get more details from the exception
        if hasattr(e, 'response'):
            logger.error(f"❌ Response status: {getattr(e.response, 'status_code', 'N/A')}")
            logger.error(f"❌ Response body: {getattr(e.response, 'text', 'N/A')[:500]}")
        if hasattr(e, 'body'):
            logger.error(f"❌ Error body: {str(e.body)[:500]}")
        if hasattr(e, 'code'):
            logger.error(f"❌ Error code: {e.code}")
        
        # Re-raise the exception so the route handler can catch it properly
        raise

def get_image_response_stream(request: ChatRequest):
    """
    Stream image generation with partial images for better UX.
    Yields partial images and final image as they arrive.
    """
    logger.info("🌊 Starting streaming image generation...")
    
    # Check if user_input already contains a detailed layout prompt
    if "=== LAYOUT SPECIFICATION" in request.user_input or "CRITICAL COUNT REQUIREMENTS" in request.user_input:
        # This is a detailed layout prompt from Tool2, use it directly
        prompt = request.user_input
        logger.info("✅ Detected detailed layout prompt from Tool2 - using it directly")
    else:
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
    
    # Check if we have a layout image for image-to-image generation
    has_layout_image = request.user_image is not None and len(request.user_image) > 0
    
    if has_layout_image:
        # The prompt from frontend already contains structured sections:
        # - Original problem
        # - Task description (mentioning two inputs)
        # - Layout specification
        # - Generation guidelines
        # We just need to add a brief reminder about the two inputs
        enhanced_prompt = f"""{prompt}

=== REMINDER ===
You are receiving TWO inputs:
1. LAYOUT IMAGE (provided as the image to edit): A diagram showing boxes and text elements
2. LAYOUT PROMPT (this text): Contains the original problem, layout specification, and generation guidelines

Follow the layout specification and generation guidelines above to create the educational visualization."""
    else:
        enhanced_prompt = prompt
    
    # LOG THE COMPLETE PROMPT ONCE (only for debugging)
    logger.info("=" * 80)
    logger.info("📋 COMPLETE PROMPT BEING SENT TO GPT:")
    logger.info("=" * 80)
    logger.info(enhanced_prompt)
    logger.info("=" * 80)
    logger.info(f"📏 Prompt length: {len(enhanced_prompt)} characters")
    logger.info(f"🖼️ Has layout image: {has_layout_image} ({len(request.user_image) if has_layout_image else 0} bytes)")
    logger.info(f"🌊 Streaming: True")
    
    try:
        if has_layout_image:
            # Use images.edit() for image-to-image generation
            # Convert bytes to file-like object
            image_file = io.BytesIO(request.user_image)
            image_file.name = "layout.png"
            
            logger.info(f"🖼️ Calling images.edit() API...")
            
            try:
                response = client.images.edit(
                    model="gpt-image-1.5",
                    image=image_file,
                    prompt=enhanced_prompt,
                    n=1,
                    size="1024x1024",
                    stream=True,
                    partial_images=2  # Get 2 partial images before final
                )
                logger.info(f"✅ images.edit() call completed, got response object: {type(response)}")
            except Exception as edit_error:
                logger.error(f"❌ images.edit() with streaming failed: {edit_error}")
                logger.info("🔄 Falling back to non-streaming images.edit()...")
                # Reset file pointer
                image_file.seek(0)
                # Try non-streaming API
                response = client.images.edit(
                    model="gpt-image-1.5",
                    image=image_file,
                    prompt=enhanced_prompt,
                    n=1,
                    size="1024x1024"
                )
                logger.info(f"✅ Non-streaming images.edit() completed, got response: {type(response)}")
                # Handle non-streaming response
                if hasattr(response, 'data') and response.data and len(response.data) > 0:
                    image_data = response.data[0]
                    if hasattr(image_data, 'b64_json') and image_data.b64_json:
                        logger.info("📸 Got image from non-streaming response (b64_json)")
                        final_b64 = image_data.b64_json
                        data_url = f"data:image/png;base64,{final_b64}"
                        backend_url = store_image(data_url)
                        yield {
                            'type': 'completed',
                            'image_url': backend_url
                        }
                        return
                    elif hasattr(image_data, 'url') and image_data.url:
                        logger.info(f"📸 Got image URL from non-streaming response: {image_data.url}")
                        yield {
                            'type': 'completed',
                            'image_url': image_data.url
                        }
                        return
                logger.error("❌ Non-streaming response has no image data")
                yield {
                    'type': 'error',
                    'message': 'No image data in response'
                }
                return
        else:
            # Use images.generate() for text-to-image generation
            logger.info(f"📝 Calling images.generate() API...")
            logger.info("=" * 80)
            logger.info("📋 FINAL PROMPT SENT TO images.generate() API:")
            logger.info("=" * 80)
            logger.info(enhanced_prompt)
            logger.info("=" * 80)
            
            response = client.images.generate(
                model="gpt-image-1.5",
                prompt=enhanced_prompt,
                n=1,
                size="1024x1024",
                stream=True,
                partial_images=2  # Get 2 partial images before final
            )
            
            logger.info(f"✅ images.generate() call completed, got response object: {type(response)}")
        
        partial_count = 0
        event_count = 0
        
        for event in response:
            event_count += 1
            event_type = getattr(event, 'type', None)
            
            # Handle both image_generation.* and image_edit.* event types
            if event_type in ("image_generation.partial_image", "image_edit.partial_image"):
                partial_idx = getattr(event, 'partial_image_index', None)
                partial_b64 = getattr(event, 'b64_json', None)
                if partial_b64:
                    partial_count += 1
                    logger.info(f"📸 Partial image {partial_idx} received")
                    yield {
                        'type': 'partial_image',
                        'index': partial_idx,
                        'image_b64': partial_b64
                    }
            elif event_type in ("image_generation.completed", "image_edit.completed"):
                final_b64 = getattr(event, 'b64_json', None)
                if final_b64:
                    logger.info(f"✅ Final image received (after {partial_count} partial images)")
                    # Store final image
                    data_url = f"data:image/png;base64,{final_b64}"
                    backend_url = store_image(data_url)
                    logger.info(f"💾 Image saved: {backend_url}")
                    yield {
                        'type': 'completed',
                        'image_url': backend_url
                    }
                    break
            elif event_type == "error" or event_type == "image_generation.error":
                error_msg = getattr(event, 'message', None) or getattr(event, 'error', {}).get('message', 'Unknown error')
                logger.error(f"❌ Error: {error_msg}")
                yield {
                    'type': 'error',
                    'message': error_msg
                }
                break
        
        # If we exit the loop without yielding completed or error, something went wrong
        if event_count == 0:
            logger.error("❌ No events received from streaming response!")
            yield {
                'type': 'error',
                'message': 'No events received from image generation stream'
            }
            
    except Exception as e:
        logger.error(f"❌ Streaming image generation failed: {type(e).__name__}: {e}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        yield {
            'type': 'error',
            'message': str(e)
        }

