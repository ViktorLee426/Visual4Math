# backend/app/api/routes/manipulatives.py
from fastapi import APIRouter, HTTPException
from app.schemas.manipulatives import ManipulativesRequest, ManipulativesResponse, ManipulativeElement
from app.services.math2visual_service import generate_manipulatives_from_mwp, get_svg_dataset_path, get_additional_icons_path, read_svg_content
import logging
import os

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/generate", response_model=ManipulativesResponse)
async def generate_manipulatives(request: ManipulativesRequest):
    """
    Generate manipulative elements from math word problem using math2visual algorithm.
    Returns draggable SVG elements for Tool3.
    """
    try:
        logger.info(f"🎯 Generating manipulatives for: {request.problem_text[:100]}...")
        result = generate_manipulatives_from_mwp(request.problem_text)
        
        # Convert to response format
        elements = [
            ManipulativeElement(**elem) for elem in result["elements"]
        ]
        
        return ManipulativesResponse(
            elements=elements,
            visual_language=result["visual_language"],
            parsed=result.get("parsed")
        )
    except Exception as e:
        logger.error(f"❌ Error generating manipulatives: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate manipulatives: {str(e)}")

@router.get("/icons")
async def list_svg_icons():
    """
    List all available SVG icons from the math2visual dataset.
    Returns a list of icon names and their SVG content.
    """
    try:
        dataset_path = get_svg_dataset_path()
        logger.info(f"🔍 Looking for SVG dataset at: {dataset_path}")
        logger.info(f"🔍 Path exists: {os.path.exists(dataset_path)}")
        logger.info(f"🔍 Current working directory: {os.getcwd()}")
        
        if not os.path.exists(dataset_path):
            logger.warning(f"⚠️ SVG dataset path not found: {dataset_path}")
            return {"icons": [], "error": f"Dataset not found at {dataset_path}"}
        
        icons = []
        file_count = 0
        failed_count = 0
        
        # Get list of SVG files
        svg_files = [f for f in sorted(os.listdir(dataset_path)) if f.endswith('.svg')]
        logger.info(f"📁 Found {len(svg_files)} SVG files in dataset")
        
        for filename in svg_files:
            file_count += 1
            icon_name = filename[:-4]  # Remove .svg extension
            svg_path = os.path.join(dataset_path, filename)
            
            try:
                svg_content = read_svg_content(svg_path)
                
                if svg_content and len(svg_content.strip()) > 0:
                    icons.append({
                        "name": icon_name,
                        "svg_content": svg_content
                    })
                else:
                    failed_count += 1
                    if failed_count <= 5:  # Only log first 5 failures
                        logger.warning(f"⚠️ Could not read SVG content from {filename}")
            except Exception as e:
                failed_count += 1
                logger.error(f"❌ Exception reading {filename}: {str(e)}")
        
        if failed_count > 0:
            logger.warning(f"⚠️ Failed to read {failed_count} out of {file_count} SVG files")
        
        logger.info(f"✅ Processed {file_count} SVG files from math2visual dataset, loaded {len(icons)} icons")
        
        # Also load additional icons (Heroicons, etc.)
        additional_path = get_additional_icons_path()
        if additional_path:
            logger.info(f"📦 Loading additional icons from: {additional_path}")
            additional_files = [f for f in sorted(os.listdir(additional_path)) if f.endswith('.svg')]
            logger.info(f"📁 Found {len(additional_files)} additional SVG files")
            
            additional_count = 0
            for filename in additional_files:
                icon_name = filename[:-4]  # Remove .svg extension
                svg_path = os.path.join(additional_path, filename)
                
                try:
                    svg_content = read_svg_content(svg_path)
                    if svg_content and len(svg_content.strip()) > 0:
                        icons.append({
                            "name": f"heroicon-{icon_name}",  # Prefix to distinguish from math2visual icons
                            "svg_content": svg_content
                        })
                        additional_count += 1
                except Exception as e:
                    logger.warning(f"⚠️ Could not read additional icon {filename}: {str(e)}")
            
            logger.info(f"✅ Loaded {additional_count} additional icons")
        else:
            logger.info("ℹ️ No additional icons directory found")
        
        if len(icons) == 0:
            logger.error(f"❌ No icons were successfully loaded! Check SVG file reading.")
            return {"icons": [], "error": "No icons could be loaded from SVG files", "total": 0}
        
        # Limit to first 300 icons for performance (can be increased later)
        icons_limited = icons[:300]
        if len(icons) > 300:
            logger.info(f"⚠️ Limiting to first 300 icons (total: {len(icons)})")
        
        logger.info(f"✅ Returning {len(icons_limited)} icons to frontend (total available: {len(icons)})")
        return {"icons": icons_limited, "total": len(icons)}
    except Exception as e:
        logger.error(f"❌ Error listing icons: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list icons: {str(e)}")
