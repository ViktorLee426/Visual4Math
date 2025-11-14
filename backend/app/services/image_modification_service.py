# backend/app/services/image_modification_service.py
from app.clients.openai_client import client
from app.schemas.chat import ChatRequest, ImageRegion
from app.services.image_storage_service import store_image
import logging
import base64
import requests
from io import BytesIO
from PIL import Image
import tempfile
import os

logger = logging.getLogger(__name__)

def download_image_as_bytes(image_url: str) -> bytes:
    """Download image from URL and return as PNG bytes"""
    import time
    start_time = time.perf_counter()
    
    try:
        download_start = time.perf_counter()
        if image_url.startswith('data:image'):
            # Base64 data URL
            logger.info("📥 [download_image] Decoding base64 data URL...")
            header, encoded = image_url.split(',', 1)
            image_bytes = base64.b64decode(encoded)
            download_time = time.perf_counter() - download_start
            logger.info(f"   ⏱️ Base64 decode: {download_time:.3f}s")
        elif image_url.startswith('/images/'):
            # Backend URL - read directly from file system (much faster than HTTP)
            from app.services.image_storage_service import get_image_path
            image_id = image_url.replace('/images/', '')
            logger.info(f"📂 [download_image] Reading from local storage: {image_id[:20]}...")
            image_path = get_image_path(image_id)
            if not image_path:
                raise ValueError(f"Image not found in local storage: {image_id}")
            with open(image_path, 'rb') as f:
                image_bytes = f.read()
            download_time = time.perf_counter() - download_start
            logger.info(f"   ⏱️ File read: {download_time:.3f}s ({len(image_bytes)/1024:.1f} KB)")
        else:
            # External HTTP/HTTPS URL
            logger.info(f"🌐 [download_image] Downloading from external URL: {image_url[:50]}...")
            response = requests.get(image_url)
            response.raise_for_status()
            image_bytes = response.content
            download_time = time.perf_counter() - download_start
            logger.info(f"   ⏱️ HTTP download: {download_time:.3f}s ({len(image_bytes)/1024:.1f} KB)")
        
        # Convert to PNG format to ensure compatibility with OpenAI API
        convert_start = time.perf_counter()
        try:
            img = Image.open(BytesIO(image_bytes))
            original_mode = img.mode
            original_size = img.size
            logger.info(f"   📐 Image opened: {original_size}, mode={original_mode}")
            
            # Convert to RGB if needed (remove alpha channel for PNG)
            if img.mode in ('RGBA', 'LA', 'P'):
                logger.info(f"   🔄 Converting {img.mode} to RGB...")
                # Create white background
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = rgb_img
            elif img.mode != 'RGB':
                logger.info(f"   🔄 Converting {img.mode} to RGB...")
                img = img.convert('RGB')
            
            # Save as PNG bytes
            save_start = time.perf_counter()
            output = BytesIO()
            img.save(output, format='PNG')
            png_bytes = output.getvalue()
            save_time = time.perf_counter() - save_start
            convert_time = time.perf_counter() - convert_start
            logger.info(f"   ⏱️ Convert to PNG: {convert_time:.3f}s (save: {save_time:.3f}s)")
            logger.info(f"   📊 Size: {len(image_bytes)/1024:.1f} KB -> {len(png_bytes)/1024:.1f} KB")
            
            total_time = time.perf_counter() - start_time
            logger.info(f"✅ [download_image] Total: {total_time:.3f}s")
            return png_bytes
        except Exception as e:
            logger.warning(f"⚠️ Could not convert image to PNG, using original: {e}")
            # If conversion fails, return original bytes (might work if already PNG)
            return image_bytes
    except Exception as e:
        total_time = time.perf_counter() - start_time
        logger.error(f"❌ [download_image] Failed after {total_time:.3f}s: {e}")
        raise e

def process_mask_data(mask_data: str, target_size: tuple = (1024, 1024)) -> bytes:
    """
    Process mask data from frontend (base64) and return as PNG bytes.
    
    Frontend sends: White = brushed (to edit), Black = unbrushed (to preserve)
    OpenAI needs: Transparent (alpha=0) = area to edit, Opaque (alpha=255) = area to preserve
    So we invert: white -> transparent, black -> opaque
    """
    import time
    start_time = time.perf_counter()
    logger.info(f"🎭 [process_mask_data] Starting mask processing (target: {target_size})...")
    logger.info(f"   📏 Input mask_data length: {len(mask_data)} chars ({len(mask_data)/1024:.1f} KB)")
    
    try:
        # Decode base64 mask data
        decode_start = time.perf_counter()
        if mask_data.startswith('data:image'):
            logger.info("   🔓 Decoding data URL format...")
            _, encoded = mask_data.split(',', 1)
            mask_bytes = base64.b64decode(encoded)
        else:
            logger.info("   🔓 Decoding raw base64...")
            mask_bytes = base64.b64decode(mask_data)
        decode_time = time.perf_counter() - decode_start
        logger.info(f"   ⏱️ Base64 decode: {decode_time:.3f}s ({len(mask_bytes)/1024:.1f} KB)")
        
        # Open and convert to RGBA
        open_start = time.perf_counter()
        img = Image.open(BytesIO(mask_bytes))
        original_size = img.size
        original_mode = img.mode
        logger.info(f"   📐 Opened mask: {original_size}, mode={original_mode}")
        
        if img.mode != 'RGBA':
            logger.info(f"   🔄 Converting {img.mode} -> RGBA...")
            img = img.convert('RGBA')
        open_time = time.perf_counter() - open_start
        logger.info(f"   ⏱️ Open & convert: {open_time:.3f}s")
        
        # Resize to target size if needed
        resize_start = time.perf_counter()
        if img.size != target_size:
            logger.info(f"   📏 Resizing: {img.size} -> {target_size}...")
            img = img.resize(target_size, Image.Resampling.LANCZOS)
            resize_time = time.perf_counter() - resize_start
            logger.info(f"   ⏱️ Resize: {resize_time:.3f}s")
        else:
            resize_time = time.perf_counter() - resize_start
            logger.info(f"   ✅ Size matches target, no resize needed ({resize_time:.3f}s)")
        
        # Convert to grayscale to get brightness (PIL's convert('L') is fast)
        gray_start = time.perf_counter()
        gray = img.convert('L')
        gray_time = time.perf_counter() - gray_start
        logger.info(f"   ⏱️ Convert to grayscale: {gray_time:.3f}s")
        
        # Invert alpha: brightness > 128 -> transparent (0), else -> opaque (255)
        invert_start = time.perf_counter()
        new_alpha = gray.point(lambda p: 0 if p > 128 else 255, mode='L')
        invert_time = time.perf_counter() - invert_start
        logger.info(f"   ⏱️ Invert alpha channel: {invert_time:.3f}s")
        
        # Create RGBA mask: black RGB with inverted alpha
        merge_start = time.perf_counter()
        black = Image.new('L', img.size, 0)
        inverted_mask = Image.merge('RGBA', (black, black, black, new_alpha))
        merge_time = time.perf_counter() - merge_start
        logger.info(f"   ⏱️ Merge RGBA channels: {merge_time:.3f}s")
        
        # Save as PNG bytes
        save_start = time.perf_counter()
        output = BytesIO()
        inverted_mask.save(output, format='PNG')
        mask_result = output.getvalue()
        save_time = time.perf_counter() - save_start
        logger.info(f"   ⏱️ Save to PNG: {save_time:.3f}s ({len(mask_result)/1024:.1f} KB)")
        
        total_time = time.perf_counter() - start_time
        logger.info(f"✅ [process_mask_data] Total: {total_time:.3f}s (decode:{decode_time:.3f}s, open:{open_time:.3f}s, resize:{resize_time:.3f}s, gray:{gray_time:.3f}s, invert:{invert_time:.3f}s, merge:{merge_time:.3f}s, save:{save_time:.3f}s)")
        return mask_result
        
    except Exception as e:
        total_time = time.perf_counter() - start_time
        logger.error(f"❌ [process_mask_data] Failed after {total_time:.3f}s: {type(e).__name__}: {e}")
        raise e

def edit_image_region_stream(request: ChatRequest):
    """
    Stream image editing with status updates and partial images (if supported).
    Yields status messages and partial/final images.
    """
    import time
    total_start = time.perf_counter()
    logger.info("🎨 [edit_image_region_stream] Starting streaming image editing...")
    
    if not request.image_region:
        yield {'type': 'error', 'message': 'image_region is required'}
        return
    
    image_region = request.image_region
    
    try:
        # STEP 1: Download image
        yield {'type': 'status', 'message': 'Getting started...'}
        yield {'type': 'status', 'message': 'Preparing image...'}
        
        image_start = time.perf_counter()
        image_bytes = download_image_as_bytes(image_region.image_url)
        image_download_time = time.perf_counter() - image_start
        
        # STEP 2: Process image
        yield {'type': 'status', 'message': 'Processing image...'}
        process_start = time.perf_counter()
        target_size = (1024, 1024)
        img = Image.open(BytesIO(image_bytes))
        
        if img.size != target_size:
            img = img.resize(target_size, Image.Resampling.LANCZOS)
        if img.mode != 'RGB':
            if img.mode in ('RGBA', 'LA', 'P'):
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = rgb_img
            else:
                img = img.convert('RGB')
        
        image_output = BytesIO()
        img.save(image_output, format='PNG')
        image_bytes = image_output.getvalue()
        process_time = time.perf_counter() - process_start
        
        # STEP 3: Process mask
        yield {'type': 'status', 'message': 'Processing mask...'}
        mask_start = time.perf_counter()
        if image_region.mask_data:
            mask_bytes = process_mask_data(image_region.mask_data, target_size)
        else:
            mask = Image.new('RGBA', target_size, (0, 0, 0, 0))
            output = BytesIO()
            mask.save(output, format='PNG')
            mask_bytes = output.getvalue()
        mask_time = time.perf_counter() - mask_start
        
        # STEP 4: Build prompt
        prompt = f"""Modify the selected region of the image according to the user's request: {request.user_input}

Ensure the modification is mathematically accurate and pedagogically clear for primary-level math education."""
        
        # STEP 5: Create temp files
        yield {'type': 'status', 'message': 'Generating image, may take a moment...'}
        image_temp_path = None
        mask_temp_path = None
        
        try:
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as image_temp:
                image_temp.write(image_bytes)
                image_temp_path = image_temp.name
            
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as mask_temp:
                mask_temp.write(mask_bytes)
                mask_temp_path = mask_temp.name
            
            # STEP 6: Call OpenAI API (try streaming, fallback to regular)
            with open(image_temp_path, 'rb') as image_file, open(mask_temp_path, 'rb') as mask_file:
                api_start = time.perf_counter()
                try:
                    # Try streaming first
                    response_stream = client.images.edit(
                        model="gpt-image-1",
                        image=image_file,
                        mask=mask_file,
                        prompt=prompt,
                        n=1,
                        size="1024x1024",
                        stream=True,
                        partial_images=2
                    )
                    
                    # Process streaming events
                    for event in response_stream:
                        event_type = getattr(event, 'type', None)
                        if event_type == "image_generation.partial_image" or event_type == "image_edit.partial_image":
                            partial_b64 = getattr(event, 'b64_json', None)
                            partial_idx = getattr(event, 'partial_image_index', None)
                            if partial_b64:
                                yield {
                                    'type': 'partial_image',
                                    'index': partial_idx or 0,
                                    'image_b64': partial_b64
                                }
                        elif event_type == "image_generation.completed" or event_type == "image_edit.completed":
                            final_b64 = getattr(event, 'b64_json', None)
                            if final_b64:
                                data_url = f"data:image/png;base64,{final_b64}"
                                backend_url = store_image(data_url)
                                yield {'type': 'completed', 'image_url': backend_url}
                                break
                except (TypeError, AttributeError) as e:
                    # Streaming not supported, use regular API
                    logger.info("   ⚠️ Streaming not supported, using regular images.edit API")
                    image_file.seek(0)
                    mask_file.seek(0)
                    response = client.images.edit(
                        model="gpt-image-1",
                        image=image_file,
                        mask=mask_file,
                        prompt=prompt,
                        n=1,
                        size="1024x1024"
                    )
                    
                    # Process regular response
                    if response.data and len(response.data) > 0:
                        image_data = response.data[0]
                        
                        if hasattr(image_data, 'url') and image_data.url:
                            backend_url = store_image(image_data.url)
                            yield {'type': 'completed', 'image_url': backend_url}
                        elif hasattr(image_data, 'b64_json') and image_data.b64_json:
                            data_url = f"data:image/png;base64,{image_data.b64_json}"
                            backend_url = store_image(data_url)
                            yield {'type': 'completed', 'image_url': backend_url}
        finally:
            # Cleanup
            try:
                if image_temp_path and os.path.exists(image_temp_path):
                    os.unlink(image_temp_path)
                if mask_temp_path and os.path.exists(mask_temp_path):
                    os.unlink(mask_temp_path)
            except Exception:
                pass
                
    except Exception as e:
        logger.error(f"❌ Streaming image editing failed: {type(e).__name__}: {e}")
        yield {'type': 'error', 'message': str(e)}

def edit_image_region(request: ChatRequest) -> str:
    """
    Edit image region using OpenAI images.edit API.
    
    This function ONLY processes:
    - The image being edited (from image_region.image_url - should be a URL like /images/{id})
    - The mask data (from image_region.mask_data - base64 from frontend brush tool)
    
    It does NOT process conversation history images - we only use the current edit instruction.
    This makes editing fast and avoids timeout issues.
    """
    import time
    total_start = time.perf_counter()
    logger.info("🎨 [edit_image_region] Starting image region editing...")
    
    if not request.image_region:
        raise ValueError("image_region is required for image editing")
    
    image_region = request.image_region
    
    # Initialize timing variables
    image_download_time = 0
    process_time = 0
    mask_time = 0
    api_time = 0
    
    try:
        # STEP 1: Download original image
        logger.info("=" * 80)
        logger.info("STEP 1: DOWNLOADING IMAGE")
        logger.info("=" * 80)
        image_start = time.perf_counter()
        image_bytes = download_image_as_bytes(image_region.image_url)
        image_download_time = time.perf_counter() - image_start
        logger.info(f"⏱️ STEP 1 TOTAL: {image_download_time:.3f}s")
        
        # STEP 2: Process and resize image to match mask size (1024x1024)
        logger.info("=" * 80)
        logger.info("STEP 2: PROCESSING IMAGE (resize & format conversion)")
        logger.info("=" * 80)
        process_start = time.perf_counter()
        target_size = (1024, 1024)
        
        open_start = time.perf_counter()
        img = Image.open(BytesIO(image_bytes))
        original_image_size = img.size
        original_mode = img.mode
        open_time = time.perf_counter() - open_start
        logger.info(f"   ⏱️ Open image: {open_time:.3f}s ({original_image_size}, {original_mode})")
        
        resize_start = time.perf_counter()
        if img.size != target_size:
            logger.info(f"   📏 Resizing: {img.size} -> {target_size}...")
            img = img.resize(target_size, Image.Resampling.LANCZOS)
            resize_time = time.perf_counter() - resize_start
            logger.info(f"   ⏱️ Resize: {resize_time:.3f}s")
        else:
            resize_time = time.perf_counter() - resize_start
            logger.info(f"   ✅ Size matches, no resize ({resize_time:.3f}s)")
        
        convert_start = time.perf_counter()
        if img.mode != 'RGB':
            logger.info(f"   🔄 Converting {img.mode} -> RGB...")
            if img.mode in ('RGBA', 'LA', 'P'):
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = rgb_img
            else:
                img = img.convert('RGB')
            convert_time = time.perf_counter() - convert_start
            logger.info(f"   ⏱️ Convert mode: {convert_time:.3f}s")
        else:
            convert_time = time.perf_counter() - convert_start
            logger.info(f"   ✅ Already RGB ({convert_time:.3f}s)")
        
        save_start = time.perf_counter()
        image_output = BytesIO()
        img.save(image_output, format='PNG')
        image_bytes = image_output.getvalue()
        save_time = time.perf_counter() - save_start
        logger.info(f"   ⏱️ Save to PNG: {save_time:.3f}s ({len(image_bytes)/1024:.1f} KB)")
        
        process_time = time.perf_counter() - process_start
        logger.info(f"⏱️ STEP 2 TOTAL: {process_time:.3f}s (open:{open_time:.3f}s, resize:{resize_time:.3f}s, convert:{convert_time:.3f}s, save:{save_time:.3f}s)")
        
        # STEP 3: Process mask
        logger.info("=" * 80)
        logger.info("STEP 3: PROCESSING MASK")
        logger.info("=" * 80)
        mask_start = time.perf_counter()
        if image_region.mask_data:
            mask_bytes = process_mask_data(image_region.mask_data, target_size)
        else:
            logger.info("   ⚠️ No mask provided, creating default (edit entire image)...")
            mask = Image.new('RGBA', target_size, (0, 0, 0, 0))
            output = BytesIO()
            mask.save(output, format='PNG')
            mask_bytes = output.getvalue()
        mask_time = time.perf_counter() - mask_start
        logger.info(f"⏱️ STEP 3 TOTAL: {mask_time:.3f}s")
        
        # STEP 4: Build prompt
        logger.info("=" * 80)
        logger.info("STEP 4: BUILDING PROMPT")
        logger.info("=" * 80)
        prompt_start = time.perf_counter()
        prompt = f"""Modify the selected region of the image according to the user's request: {request.user_input}

Ensure the modification is mathematically accurate and pedagogically clear for primary-level math education."""
        prompt_time = time.perf_counter() - prompt_start
        logger.info(f"   ⏱️ Prompt built: {prompt_time:.3f}s ({len(prompt)} chars)")
        logger.info(f"   📝 Prompt preview: {prompt[:100]}...")
        
        # STEP 5: Create temp files
        logger.info("=" * 80)
        logger.info("STEP 5: CREATING TEMP FILES")
        logger.info("=" * 80)
        temp_start = time.perf_counter()
        image_temp_path = None
        mask_temp_path = None
        response = None
        
        try:
            file_write_start = time.perf_counter()
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as image_temp:
                image_temp.write(image_bytes)
                image_temp_path = image_temp.name
            
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as mask_temp:
                mask_temp.write(mask_bytes)
                mask_temp_path = mask_temp.name
            file_write_time = time.perf_counter() - file_write_start
            logger.info(f"   ⏱️ Write temp files: {file_write_time:.3f}s")
            logger.info(f"   📁 Image temp: {image_temp_path}")
            logger.info(f"   📁 Mask temp: {mask_temp_path}")
            temp_time = time.perf_counter() - temp_start
            logger.info(f"⏱️ STEP 5 TOTAL: {temp_time:.3f}s")
            
            # STEP 6: Call OpenAI API
            logger.info("=" * 80)
            logger.info("STEP 6: CALLING OPENAI IMAGES.EDIT API")
            logger.info("=" * 80)
            logger.info(f"   📝 Prompt: {prompt[:150]}...")
            logger.info(f"   🖼️ Image size: {len(image_bytes)/1024:.1f} KB")
            logger.info(f"   🎭 Mask size: {len(mask_bytes)/1024:.1f} KB")
            logger.info(f"   📐 Dimensions: {target_size}")
            logger.info(f"   ⏳ This may take 30-90 seconds...")
            
            with open(image_temp_path, 'rb') as image_file, open(mask_temp_path, 'rb') as mask_file:
                api_start = time.perf_counter()
                try:
                    # Try streaming for image editing (if supported)
                    # Note: images.edit might not support streaming, but we'll try
                    try:
                        response = client.images.edit(
                            model="gpt-image-1",
                            image=image_file,
                            mask=mask_file,
                            prompt=prompt,
                            n=1,
                            size="1024x1024",
                            stream=True,
                            partial_images=2  # Try to get partial images
                        )
                        # If streaming works, process events
                        final_response = None
                        for event in response:
                            event_type = getattr(event, 'type', None)
                            if event_type == "image_generation.completed" or event_type == "image_edit.completed":
                                final_response = event
                                break
                        if final_response:
                            response = final_response
                    except TypeError:
                        # Streaming not supported, use regular API
                        logger.info("   ⚠️ Streaming not supported for images.edit, using regular API")
                        response = client.images.edit(
                            model="gpt-image-1",
                            image=image_file,
                            mask=mask_file,
                            prompt=prompt,
                            n=1,
                            size="1024x1024"
                        )
                    api_time = time.perf_counter() - api_start
                    logger.info(f"✅ STEP 6 COMPLETE: {api_time:.1f}s")
                except Exception as api_error:
                    api_time = time.perf_counter() - api_start
                    logger.error(f"❌ STEP 6 FAILED after {api_time:.1f}s: {type(api_error).__name__}: {api_error}")
                    raise
        finally:
            # Clean up temporary files
            cleanup_start = time.perf_counter()
            try:
                if image_temp_path and os.path.exists(image_temp_path):
                    os.unlink(image_temp_path)
                if mask_temp_path and os.path.exists(mask_temp_path):
                    os.unlink(mask_temp_path)
            except Exception as cleanup_error:
                logger.warning(f"⚠️ Failed to cleanup temp files: {cleanup_error}")
            cleanup_time = time.perf_counter() - cleanup_start
            logger.info(f"   ⏱️ Cleanup: {cleanup_time:.3f}s")
        
        if not response:
            raise ValueError("Failed to get response from OpenAI images.edit API")
        
        # STEP 7: Process response
        logger.info("=" * 80)
        logger.info("STEP 7: PROCESSING RESPONSE")
        logger.info("=" * 80)
        response_start = time.perf_counter()
        
        total_time = time.perf_counter() - total_start
        logger.info("=" * 80)
        logger.info("⏱️ TIMING BREAKDOWN:")
        logger.info(f"   STEP 1 - Image download: {image_download_time:.3f}s")
        logger.info(f"   STEP 2 - Image processing: {process_time:.3f}s")
        logger.info(f"   STEP 3 - Mask processing: {mask_time:.3f}s")
        logger.info(f"   STEP 4 - Prompt building: {prompt_time:.3f}s")
        logger.info(f"   STEP 5 - Temp files: {temp_time:.3f}s")
        logger.info(f"   STEP 6 - OpenAI API call: {api_time:.1f}s ⚠️ THIS IS THE BOTTLENECK")
        logger.info(f"   STEP 7 - Response processing: {time.perf_counter() - response_start:.3f}s")
        logger.info(f"   TOTAL TIME: {total_time:.1f}s")
        logger.info("=" * 80)
        
        if response.data and len(response.data) > 0:
            image_data = response.data[0]
            
            # Import storage service
            from app.services.image_storage_service import store_image
            
            if hasattr(image_data, 'url') and image_data.url:
                logger.info(f"✅ Image edited successfully (URL format): {image_data.url}")
                # Store the edited image locally and return our backend URL
                backend_url = store_image(image_data.url)
                return backend_url
            elif hasattr(image_data, 'b64_json') and image_data.b64_json:
                base64_data = image_data.b64_json
                data_url = f"data:image/png;base64,{base64_data}"
                logger.info(f"✅ Image edited successfully (base64 format): {len(base64_data)} chars")
                # Store the edited image locally and return our backend URL
                backend_url = store_image(data_url)
                logger.info(f"🔗 Stored edited image, returning backend URL: {backend_url}")
                return backend_url
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

