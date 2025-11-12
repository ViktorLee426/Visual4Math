# backend/app/services/image_modification_service.py
from app.clients.openai_client import client
from app.schemas.chat import ChatRequest, ImageRegion
import logging
import base64
import requests
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)

def download_image_as_bytes(image_url: str) -> bytes:
    """Download image from URL and return as PNG bytes"""
    try:
        if image_url.startswith('data:image'):
            # Base64 data URL
            header, encoded = image_url.split(',', 1)
            image_bytes = base64.b64decode(encoded)
        else:
            # HTTP URL
            response = requests.get(image_url)
            response.raise_for_status()
            image_bytes = response.content
        
        # Convert to PNG format to ensure compatibility with OpenAI API
        try:
            img = Image.open(BytesIO(image_bytes))
            # Convert to RGB if needed (remove alpha channel for PNG)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = rgb_img
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Save as PNG bytes
            output = BytesIO()
            img.save(output, format='PNG')
            png_bytes = output.getvalue()
            logger.info(f"✅ Converted image to PNG: {len(image_bytes)} -> {len(png_bytes)} bytes")
            return png_bytes
        except Exception as e:
            logger.warning(f"⚠️ Could not convert image to PNG, using original: {e}")
            # If conversion fails, return original bytes (might work if already PNG)
            return image_bytes
    except Exception as e:
        logger.error(f"❌ Failed to download/process image: {e}")
        raise e

def process_mask_data(mask_data: str, target_size: tuple = (1024, 1024)) -> bytes:
    """
    Process mask data from frontend (base64) and return as PNG bytes.
    
    IMPORTANT: OpenAI images.edit API expects:
    - Transparent areas (alpha=0): Regions to be edited/regenerated
    - Opaque areas (alpha=255): Regions to be preserved from original image
    
    Frontend sends: White = brushed (to edit), Black = unbrushed (to preserve)
    We need to invert: Make brushed areas transparent, unbrushed areas opaque
    """
    try:
        if mask_data.startswith('data:image'):
            # Remove data URL prefix
            header, encoded = mask_data.split(',', 1)
            mask_bytes = base64.b64decode(encoded)
        else:
            # Already base64
            mask_bytes = base64.b64decode(mask_data)
        
        # Open image and resize if needed
        img = Image.open(BytesIO(mask_bytes))
        original_size = img.size
        
        # Convert to RGBA to work with alpha channel
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Resize to target size if needed (preserving aspect ratio might be better, but API expects square)
        if img.size != target_size:
            img = img.resize(target_size, Image.Resampling.LANCZOS)
        
        # Invert the mask for OpenAI API using PIL's efficient pixel manipulation:
        # Frontend: White (255,255,255) = brushed area to edit, Black (0,0,0) = unbrushed to preserve
        # OpenAI needs: Transparent (alpha=0) = area to edit, Opaque (alpha=255) = area to preserve
        # So we need to: Make white areas transparent, black areas opaque
        
        # Convert to grayscale to get brightness (faster than manual calculation)
        gray = img.convert('L')
        
        # Create inverted alpha channel using point operation (much faster than pixel-by-pixel)
        # Bright areas (white/brushed, brightness > 128) -> alpha = 0 (transparent, will be edited)
        # Dark areas (black/unbrushed, brightness <= 128) -> alpha = 255 (opaque, will be preserved)
        threshold = 128
        # Use point() function for fast pixel transformation
        # If pixel > threshold (brushed/white), set to 0 (transparent)
        # If pixel <= threshold (unbrushed/black), set to 255 (opaque)
        def invert_alpha(pixel_value):
            return 0 if pixel_value > threshold else 255
        
        new_alpha = gray.point(invert_alpha, mode='L')
        
        # Create new mask image with inverted alpha
        # RGB values don't matter for the mask, but set to black for standard practice
        # Create black RGB channels
        black_rgb = Image.new('L', img.size, 0)
        # Merge into RGBA image
        inverted_mask = Image.merge('RGBA', (black_rgb, black_rgb, black_rgb, new_alpha))
        
        # Save as PNG bytes
        output = BytesIO()
        inverted_mask.save(output, format='PNG')
        mask_bytes_result = output.getvalue()
        
        logger.info(f"✅ Mask processed: {original_size} -> {target_size}, inverted for OpenAI API")
        logger.info(f"   Brushed areas (white) -> transparent (will be edited)")
        logger.info(f"   Unbrushed areas (black) -> opaque (will be preserved)")
        
        return mask_bytes_result
    except Exception as e:
        logger.error(f"❌ Failed to process mask: {e}")
        raise e

def edit_image_region(request: ChatRequest) -> str:
    """Edit image region using OpenAI images.edit API"""
    logger.info("🎨 Starting image region editing...")
    
    if not request.image_region:
        raise ValueError("image_region is required for image editing")
    
    image_region = request.image_region
    
    try:
        # Download original image
        logger.info(f"📥 Downloading original image: {image_region.image_url[:50]}...")
        image_bytes = download_image_as_bytes(image_region.image_url)
        
        # Process and resize image to match mask size (1024x1024)
        # OpenAI API requires image and mask to have same dimensions
        target_size = (1024, 1024)
        img = Image.open(BytesIO(image_bytes))
        original_image_size = img.size
        logger.info(f"📐 Original image size: {original_image_size}")
        
        # Resize image to target size (square, 1024x1024) to match mask
        if img.size != target_size:
            # Use LANCZOS resampling for high quality
            img = img.resize(target_size, Image.Resampling.LANCZOS)
            logger.info(f"📐 Resized image to: {target_size}")
        
        # Ensure image is RGB (required by OpenAI API)
        if img.mode != 'RGB':
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparency
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = rgb_img
            else:
                img = img.convert('RGB')
        
        # Save resized image as PNG bytes
        image_output = BytesIO()
        img.save(image_output, format='PNG')
        image_bytes = image_output.getvalue()
        logger.info(f"✅ Image processed: {original_image_size} -> {target_size}, {len(image_bytes)} bytes")
        
        # Process mask
        logger.info("🎭 Processing mask data...")
        mask_bytes = None
        if image_region.mask_data:
            # Use provided mask (will be resized and inverted to match image)
            mask_bytes = process_mask_data(image_region.mask_data, target_size)
        else:
            # If no mask provided, create a default one (editing whole image = all transparent)
            # This shouldn't happen in practice, but handle it gracefully
            logger.warning("⚠️ No mask provided, creating default mask (entire image will be edited)")
            mask = Image.new('RGBA', target_size, (0, 0, 0, 0))  # Fully transparent = edit everything
            output = BytesIO()
            mask.save(output, format='PNG')
            mask_bytes = output.getvalue()
        
        # Build prompt from conversation context
        context = ""
        for msg in request.conversation_history[-5:]:  # Last 5 messages for context
            context += f"{msg.role}: {msg.content}\n"
        
        prompt = f"""{context}

User's modification request: {request.user_input}

Based on the conversation context above, modify the selected region of the image according to the user's request. Ensure the modification is mathematically accurate and pedagogically clear."""

        logger.info(f"🖼️ DEBUG: Image prompt prepared: {len(prompt)} characters")
        logger.info(f"🎨 DEBUG: Using OpenAI images.edit API for region editing...")
        logger.info("=" * 80)
        logger.info("🚀 CALLING OPENAI IMAGES.EDIT API NOW")
        logger.info(f"📝 Edit instruction: {request.user_input}")
        logger.info(f"🖼️ Image size: {len(image_bytes)} bytes")
        logger.info(f"🎭 Mask size: {len(mask_bytes)} bytes")
        logger.info("=" * 80)
        
        # Use OpenAI images.edit API
        # Note: OpenAI's edit API expects file-like objects with proper format
        # Ensure both image and mask are PNG format
        image_file = BytesIO(image_bytes)
        image_file.name = "image.png"  # Set filename so OpenAI knows it's PNG
        
        mask_file = BytesIO(mask_bytes)
        mask_file.name = "mask.png"  # Set filename so OpenAI knows it's PNG
        
        logger.info(f"📤 Sending image file: {len(image_bytes)} bytes, mask: {len(mask_bytes)} bytes")
        logger.info(f"🤖 Attempting to use model 'gpt-image-1' for image editing (instead of default DALL-E 2)")
        
        # Use OpenAI images.edit API with explicit model specification
        # Explicitly use gpt-image-1 model for better quality results
        # If model parameter is not supported, it will fall back to default behavior
        try:
            response = client.images.edit(
                model="gpt-image-1",
                image=image_file,
                mask=mask_file,
                prompt=prompt,
                n=1,
                size="1024x1024"
            )
            logger.info(f"✅ Successfully called images.edit with model='gpt-image-1'")
        except TypeError as e:
            # If model parameter is not supported, try without it
            # This might happen if the API doesn't support model selection for edit endpoint
            logger.warning(f"⚠️ Model parameter not supported, falling back to default model: {e}")
            logger.info("🔄 Retrying without model parameter (using default DALL-E 2)")
            response = client.images.edit(
                image=image_file,
                mask=mask_file,
                prompt=prompt,
                n=1,
                size="1024x1024"
            )
        except Exception as e:
            # Re-raise other exceptions
            logger.error(f"❌ Error calling images.edit API: {e}")
            raise
        
        logger.info(f"📦 DEBUG: Response type: {type(response)}")
        
        if response.data and len(response.data) > 0:
            image_data = response.data[0]
            
            if hasattr(image_data, 'url') and image_data.url:
                logger.info(f"✅ Image edited successfully (URL format): {image_data.url}")
                return image_data.url
            elif hasattr(image_data, 'b64_json') and image_data.b64_json:
                base64_data = image_data.b64_json
                data_url = f"data:image/png;base64,{base64_data}"
                logger.info(f"✅ Image edited successfully (base64 format): {len(base64_data)} chars")
                return data_url
            else:
                logger.error("❌ No image data found in edit response")
                raise ValueError("No image data in edit response")
        else:
            logger.error("❌ No image data in edit response")
            raise ValueError("Empty edit response")
            
    except Exception as e:
        logger.error(f"❌ Image editing failed: {type(e).__name__}: {e}")
        logger.error(f"🔍 Full error details: {str(e)}")
        raise e

