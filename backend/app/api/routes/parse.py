# backend/app/api/routes/parse.py
from fastapi import APIRouter, HTTPException
from app.schemas.parse import ParseRequest, ParseResponse, LayoutItem
from app.clients.openai_client import client
from typing import List, Dict, Optional
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def parse_math_word_problem(problem_text: str) -> ParseResponse:
    """
    Parse a math word problem using GPT to extract objects, containers, counts, and spatial relationships.
    Returns a layout with items positioned to show containment relationships.
    """
    canvas_width = 800
    canvas_height = 600
    
    # Create a prompt for GPT to parse the problem
    prompt = f"""Parse this math word problem and extract all objects, containers, counts, and spatial relationships.

Problem: "{problem_text}"

Extract:
1. All objects/items mentioned (e.g., basketballs, apples, books) with their counts
2. All containers mentioned (e.g., bags, boxes, baskets) with their colors/identifiers and counts
3. Which items belong inside which containers (spatial relationships)
4. Total counts vs. per-container counts

CRITICAL: For items inside containers, use the per-container count (e.g., if blue bag has 4 basketballs, show count=4 for that basketball box inside blue bag).

Return a JSON object with this structure:
{{
  "containers": [
    {{
      "label": "blue bag",
      "count": 1,
      "color": "blue",
      "x": 100,
      "y": 200,
      "w": 200,
      "h": 180,
      "color_hex": "#bbdefb"
    }}
  ],
  "objects": [
    {{
      "label": "basketball",
      "count": 4,
      "x": 120,
      "y": 220,
      "w": 140,
      "h": 100,
      "color_hex": "#e3f2fd",
      "inside_container": "blue bag"
    }}
  ],
  "text": {{
    "label": "Problem text (truncated to 150 chars)",
    "x": 50,
    "y": 30,
    "w": 700,
    "h": 60
  }}
}}

Layout rules (STRICTLY FOLLOW):
- Canvas size: {canvas_width}x{canvas_height} pixels
- Text element: x=50, y=30, w=700, h=60
- Containers: 
  * Size: w=180-220, h=160-200 (larger than objects)
  * Position containers side-by-side or in a grid, starting at y=150-200
  * Use color_hex: blue="#bbdefb", green="#c8e6c9", red="#ffcdd2", yellow="#fff9c4", orange="#ffe0b2", purple="#e1bee7"
- Objects inside containers:
  * MUST be positioned so their bounds (x, y, x+w, y+h) are INSIDE the container's bounds
  * Example: if container is at x=100, y=200, w=200, h=180, then object should be at x=110-280, y=210-360
  * Size: w=120-160, h=80-120 (smaller than containers)
  * Use per-container count, not total count
- Objects outside containers:
  * Position separately, not overlapping with containers or other objects
  * Use total count if applicable
- Colors for objects: use light pastel colors like "#e3f2fd", "#f3e5f5", "#e8f5e9", "#fff3e0", "#fce4ec"
- Ensure NO overlapping items
- Position items logically to show problem structure

Example for "10 basketballs total, 4 in blue bag, 6 in green bag":
- Blue bag container: x=100, y=200, w=200, h=180
- Basketballs in blue bag: x=120, y=220, w=140, h=100, count=4
- Green bag container: x=350, y=200, w=200, h=180  
- Basketballs in green bag: x=370, y=220, w=140, h=100, count=6

Return ONLY valid JSON, no other text."""
    
    try:
        logger.info("🤖 Using GPT to parse math word problem...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using mini for faster/cheaper parsing
            messages=[
                {"role": "system", "content": "You are a math problem parser. Extract objects, containers, counts, and spatial relationships from word problems. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,  # Lower temperature for more consistent parsing
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content
        logger.info(f"📝 GPT response: {result_text[:200]}...")
        
        parsed_data = json.loads(result_text)
        
        layout_items: List[LayoutItem] = []
        containers_dict: Dict[str, LayoutItem] = {}  # label -> container LayoutItem
        
        # Add text element first
        if "text" in parsed_data:
            text_data = parsed_data["text"]
            layout_items.append(LayoutItem(
                type="text",
                label=text_data.get("label", problem_text[:150]),
                count=None,
                x=text_data.get("x", 50),
                y=text_data.get("y", 30),
                w=text_data.get("w", 700),
                h=text_data.get("h", 60),
                color="#ffffff"
            ))
        
        # Add containers first and store them in a dict for reference
        if "containers" in parsed_data:
            for container in parsed_data["containers"]:
                container_item = LayoutItem(
                    type="box",
                    label=container.get("label", "container"),
                    count=container.get("count"),
                    x=container.get("x", 100),
                    y=container.get("y", 150),
                    w=container.get("w", 180),
                    h=container.get("h", 150),
                    color=container.get("color_hex", "#f5f5f5")
                )
                layout_items.append(container_item)
                containers_dict[container.get("label", "container")] = container_item
        
        # Add objects, ensuring they're positioned inside containers if specified
        if "objects" in parsed_data:
            for obj in parsed_data["objects"]:
                obj_x = obj.get("x", 100)
                obj_y = obj.get("y", 200)
                obj_w = obj.get("w", 140)
                obj_h = obj.get("h", 100)
                inside_container = obj.get("inside_container")
                
                # If object should be inside a container, validate and adjust position
                if inside_container and inside_container in containers_dict:
                    container = containers_dict[inside_container]
                    container_x = container.x
                    container_y = container.y
                    container_w = container.w
                    container_h = container.h
                    
                    # Ensure object fits inside container with some padding
                    padding = 10
                    min_x = container_x + padding
                    min_y = container_y + padding
                    max_x = container_x + container_w - obj_w - padding
                    max_y = container_y + container_h - obj_h - padding
                    
                    # Adjust position if needed
                    if obj_x < min_x or obj_x > max_x:
                        obj_x = min_x
                    if obj_y < min_y or obj_y > max_y:
                        obj_y = min_y
                    
                    # Ensure object doesn't exceed container bounds
                    if obj_x + obj_w > container_x + container_w - padding:
                        obj_x = max_x
                    if obj_y + obj_h > container_y + container_h - padding:
                        obj_y = max_y
                
                layout_items.append(LayoutItem(
                    type="box",
                    label=obj.get("label", "object"),
                    count=obj.get("count"),
                    x=obj_x,
                    y=obj_y,
                    w=obj_w,
                    h=obj_h,
                    color=obj.get("color_hex", "#e3f2fd")
                ))
        
        # If GPT returned nothing useful, create a fallback
        if not layout_items:
            layout_items.append(LayoutItem(
                type="text",
                label=problem_text[:200],
                count=None,
                x=50,
                y=50,
                w=700,
                h=100,
                color="#ffffff"
            ))
        
        logger.info(f"✅ Parsed successfully: {len(layout_items)} layout items")
        return ParseResponse(layout=layout_items)
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ Failed to parse GPT JSON response: {str(e)}")
        # Fallback to simple text element
        return ParseResponse(layout=[
            LayoutItem(
                type="text",
                label=problem_text[:200],
                count=None,
                x=50,
                y=50,
                w=700,
                h=100,
                color="#ffffff"
            )
        ])
    except Exception as e:
        logger.error(f"❌ Error calling GPT: {str(e)}")
        raise

@router.post("/parse-mwp", response_model=ParseResponse)
async def parse_mwp(request: ParseRequest):
    """
    Parse a math word problem and return a proposed layout.
    Extracts objects, counts, and creates layout items for visualization.
    """
    try:
        logger.info(f"Parsing math word problem: {request.problem_text[:100]}...")
        result = parse_math_word_problem(request.problem_text)
        logger.info(f"Parsed successfully: {len(result.layout)} layout items")
        return result
    except Exception as e:
        logger.error(f"Error parsing problem: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to parse problem: {str(e)}")

