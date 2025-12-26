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
    Parse a math word problem using GPT to extract objects and create individual boxes.
    Returns a layout with individual boxes for each item (one box per item, no unnecessary containers).
    """
    canvas_width = 800
    canvas_height = 600
    
    # Create a prompt for GPT to parse the problem
    prompt = f"""Parse this math word problem and create a layout for visualization.

Problem: "{problem_text}"

CRITICAL RULES:
1. OBJECT COUNTING: Count EVERY item - if problem says "3 green apples", create EXACTLY 3 boxes labeled "green apple"
2. TEXT vs OBJECT BOXES:
   - TEXT BOXES: Group labels ("group 1", "box 1"), problem statements → TEXT BOXES
   - OBJECT BOXES: Physical objects only (apples, stars, cats, balloons) → OBJECT BOXES
   - NEVER create object boxes for group names
3. SPACING: 20px minimum between objects in containers, 30px outside containers, 40px between containers
4. TEXT POSITIONING: Main problem text centered top (x=50-100, y=20-50, w=600-700, h=60-80)
5. ALL elements must fit within 800x600 canvas - no cutting off

PROBLEM TYPES:
- MULTIPLICATION: Create containers for groups, group labels as TEXT boxes above containers
- DIVISION: Create containers, container labels as TEXT boxes above containers, items evenly spaced
- ADDITION: Individual object boxes, can group by person/collection
- SUBTRACTION: Show ALL items (even those "taken away"), group same-type together

Return a JSON object with this structure (example for "There are three green apples and two red apples"):
{{
  "containers": [],
  "objects": [
    {{"label": "green apple", "x": 100, "y": 250, "w": 100, "h": 100, "color_hex": "#c8e6c9"}},
    {{"label": "green apple", "x": 220, "y": 250, "w": 100, "h": 100, "color_hex": "#c8e6c9"}},
    {{"label": "green apple", "x": 340, "y": 250, "w": 100, "h": 100, "color_hex": "#c8e6c9"}},
    {{"label": "red apple", "x": 500, "y": 250, "w": 100, "h": 100, "color_hex": "#ffcdd2"}},
    {{"label": "red apple", "x": 620, "y": 250, "w": 100, "h": 100, "color_hex": "#ffcdd2"}}
  ],
  "text": {{
    "label": "3 green + 2 red apples",
    "x": 250,
    "y": 30,
    "w": 300,
    "h": 40
  }}
}}

LAYOUT SPECIFICATIONS:
- Canvas: {canvas_width}x{canvas_height} pixels, all elements must fit
- Text: Main problem centered top (x=50-100, y=20-50, w=600-700, h=60-80)
- Containers: w=180-220, h=160-200, 40px spacing, colors: blue="#bbdefb", green="#c8e6c9", red="#ffcdd2", yellow="#fff9c4"
- Objects: w=80-120, h=80-120, 20px spacing in containers, 30px outside
- Colors: green apples="#c8e6c9", red apples="#ffcdd2", balloons="#e3f2fd", stars="#fff9c4", cats="#fff9c4"

EXAMPLES:

Example 1 - ADDITION: "Sam has 2 balloons. Mia has 3 balloons. How many balloons do they have altogether?"
- 2 "balloon" objects left (x=100-200, y=250), 3 "balloon" objects right (x=500-600, y=250), 30px spacing
- Text: "Sam: 2, Mia: 3 balloons" (x=250, y=30, w=300, h=40)

Example 2 - SUBTRACTION: "There are three green apples and two red apples. If we take away three green apples, how many apples are there in total?"
- 3 "green apple" objects left (x=100-340, y=250), 2 "red apple" objects right (x=500-620, y=250), 30px spacing
- Text: "3 green + 2 red apples" (x=250, y=30, w=300, h=40)
- CRITICAL: Create ALL 5 boxes (3 green + 2 red)

Example 3 - MULTIPLICATION: "There are 3 groups of cats, and each group has 2 cats. How many cats are there in total?"
- 3 containers side-by-side (x=100,320,540, y=200, w=180, h=180), 40px spacing
- 6 "cat" objects: 2 per container in grid (20px spacing)
- 3 TEXT boxes: "group 1", "group 2", "group 3" above containers (x=150,350,550, y=170, w=100, h=30)
- Text: "3 groups of 2 cats. How many cats in total?" (x=100, y=30, w=600, h=60)
- CRITICAL: Group labels are TEXT boxes, not object boxes

Example 4 - DIVISION: "There are 6 stars that need to be shared equally among 3 boxes. How many stars go in each box?"
- 3 containers side-by-side (x=100,320,540, y=200, w=180, h=180), 40px spacing
- 6 "star" objects: 2 per container horizontally (x=120,220 per container, y=220), 20px spacing
- 3 TEXT boxes: "box 1", "box 2", "box 3" above containers (x=150,350,550, y=170, w=80, h=30)
- Text: "6 stars shared equally among 3 boxes. How many stars in each box?" (x=50, y=30, w=700, h=60)
- CRITICAL: Stars evenly spaced, no overlapping

Return ONLY valid JSON, no other text."""
    
    try:
        logger.info("=" * 80)
        logger.info("📋 COMPLETE PROMPT FOR LAYOUT GENERATION (PARSING):")
        logger.info("=" * 80)
        logger.info(prompt)
        logger.info("=" * 80)
        logger.info(f"📏 Prompt length: {len(prompt)} characters")
        logger.info("🤖 Using GPT to parse math word problem...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using mini for faster/cheaper parsing
            messages=[
                {"role": "system", "content": "You are a math problem parser. Extract objects, containers, and spatial relationships from word problems. Return only valid JSON."},
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
            text_label = text_data.get("label", "")
            # Check if it's a multiplication/division problem (allow up to 80 chars)
            is_multiplication_division = any(keyword in problem_text.lower() for keyword in 
                                            ["shared equally", "divided", "split equally", "how many", "go in each",
                                             "groups of", "times", "multiply", "each group", "in each"])
            max_chars = 80 if is_multiplication_division else 50
            if len(text_label) > max_chars:
                text_label = text_label[:max_chars-3] + "..."
            layout_items.append(LayoutItem(
                type="text",
                label=text_label,
                count=None,  # Text always has count=null
                x=text_data.get("x", 50),
                y=text_data.get("y", 30),
                w=text_data.get("w", 700 if is_multiplication_division else 300),
                h=text_data.get("h", 40),
                color="#ffffff"
            ))
        
        # Add containers first and store them in a dict for reference
        # Containers should NOT have counts
        if "containers" in parsed_data:
            for container in parsed_data["containers"]:
                # Handle None color values - ensure we always have a valid string
                color_hex = container.get("color_hex") or "#f5f5f5"
                if not isinstance(color_hex, str):
                    color_hex = "#f5f5f5"
                
                container_item = LayoutItem(
                    type="box",
                    label=container.get("label", "container"),
                    count=None,  # Containers never have counts
                    x=container.get("x", 100),
                    y=container.get("y", 150),
                    w=container.get("w", 180),
                    h=container.get("h", 150),
                    color=color_hex
                )
                layout_items.append(container_item)
                containers_dict[container.get("label", "container")] = container_item
        
        # Track which objects belong to which containers
        container_items_map: Dict[str, List[str]] = {}  # container_label -> list of item labels
        
        # Process objects - create individual boxes (no counts)
        if "objects" in parsed_data:
            # Group objects by their label and container to handle positioning
            objects_by_group: Dict[str, List[Dict]] = {}
            
            for obj in parsed_data["objects"]:
                obj_label = obj.get("label", "object")
                inside_container = obj.get("inside_container")
                group_key = f"{inside_container or 'none'}:{obj_label}"
                
                if group_key not in objects_by_group:
                    objects_by_group[group_key] = []
                objects_by_group[group_key].append(obj)
                
                # Track container-item relationships
                if inside_container:
                    if inside_container not in container_items_map:
                        container_items_map[inside_container] = []
                    container_items_map[inside_container].append(obj_label)
            
            # Create individual boxes for each object
            for group_key, obj_list in objects_by_group.items():
                inside_container = obj_list[0].get("inside_container")
                base_obj = obj_list[0]
                
                # Calculate spacing for multiple items
                obj_w = base_obj.get("w", 100)
                obj_h = base_obj.get("h", 100)
                spacing = 20
                
                # Determine starting position
                if inside_container and inside_container in containers_dict:
                    container = containers_dict[inside_container]
                    container_x = container.x
                    container_y = container.y
                    container_w = container.w
                    container_h = container.h
                    padding = 15
                    start_x = container_x + padding
                    start_y = container_y + padding
                    max_x = container_x + container_w - obj_w - padding
                    max_y = container_y + container_h - obj_h - padding
                else:
                    # Position outside containers
                    start_x = base_obj.get("x", 100)
                    start_y = base_obj.get("y", 200)
                    max_x = canvas_width - obj_w - 50
                    max_y = canvas_height - obj_h - 50
                
                # Create individual boxes for each object in the group
                for idx, obj in enumerate(obj_list):
                    # Calculate position (arrange in grid if multiple items)
                    # Calculate how many items can actually fit per row (at least 1)
                    available_width = max_x - start_x
                    items_per_row = max(1, int(available_width / (obj_w + spacing)))
                    row = idx // items_per_row
                    col = idx % items_per_row
                    
                    obj_x = start_x + col * (obj_w + spacing)
                    obj_y = start_y + row * (obj_h + spacing)
                    
                    # Ensure within bounds - wrap to next row if needed
                    if obj_x + obj_w > max_x:
                        # Move to next row instead of clipping
                        row = row + 1
                        col = 0
                        obj_x = start_x
                        obj_y = start_y + row * (obj_h + spacing)
                    
                    # Ensure vertical bounds
                    if obj_y + obj_h > max_y:
                        obj_y = max_y - obj_h
                    
                    # Ensure minimum bounds
                    if inside_container and inside_container in containers_dict:
                        container = containers_dict[inside_container]
                        obj_x = max(container.x + padding, min(obj_x, container.x + container.w - obj_w - padding))
                        obj_y = max(container.y + padding, min(obj_y, container.y + container.h - obj_h - padding))
                    
                    # Handle None color values - ensure we always have a valid string
                    obj_color_hex = obj.get("color_hex") or "#e3f2fd"
                    if not isinstance(obj_color_hex, str):
                        obj_color_hex = "#e3f2fd"
                    
                    # Each box represents one item
                    layout_items.append(LayoutItem(
                        type="box",
                        label=obj.get("label", "object"),
                        count=1,  # Each box represents one item
                        x=int(obj_x),
                        y=int(obj_y),
                        w=obj_w,
                        h=obj_h,
                        color=obj_color_hex
                    ))
        
        # Filter out unnecessary containers
        # A container is unnecessary if it only wraps items of the same type
        # BUT keep containers for multiplication/division problems (they show grouping/collections)
        is_multiplication_division = any(keyword in problem_text.lower() for keyword in 
                                        ["shared equally", "divided", "split equally", "how many", "go in each",
                                         "groups of", "times", "multiply", "each group", "in each"])
        
        containers_to_remove = []
        if not is_multiplication_division:  # Only filter containers for non-multiplication/division problems
            for container_label, container_item in containers_dict.items():
                if container_label in container_items_map:
                    items_in_container = container_items_map[container_label]
                    if items_in_container:
                        # Check if all items have the same label (or similar)
                        unique_labels = set(label.lower() for label in items_in_container)
                        container_label_lower = container_label.lower()
                        
                        # If container label is similar to item labels (e.g., "green apples" vs "green apple")
                        # and all items are the same type, remove the container
                        if len(unique_labels) == 1:
                            item_label = list(unique_labels)[0]
                            # More precise matching: check if container label is just pluralized version of item label
                            # Only remove if container label is essentially the same as item label (with/without 's')
                            container_words = container_label_lower.split()
                            item_words = item_label.split()
                            
                            # Check if container is just item label with 's' added/removed
                            is_simple_plural = (
                                # Exact match
                                item_label == container_label_lower or
                                # Container is item + 's'
                                container_label_lower == item_label + 's' or
                                # Container is item - 's' (if item ends with 's')
                                (item_label.endswith('s') and container_label_lower == item_label[:-1]) or
                                # Container contains item as a word (e.g., "green apples" contains "apple")
                                (len(item_words) == 1 and item_words[0] in container_words and 
                                 len(container_words) <= len(item_words) + 1)
                            )
                            
                            if is_simple_plural:
                                containers_to_remove.append(container_item)
        
        # Remove unnecessary containers
        for container_to_remove in containers_to_remove:
            layout_items = [item for item in layout_items if item != container_to_remove]
            # Items that were inside this container stay in their positions
        
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
    Extracts objects and creates layout items for visualization.
    Each object gets its own box (one box per item).
    """
    try:
        logger.info(f"Parsing math word problem: {request.problem_text[:100]}...")
        result = parse_math_word_problem(request.problem_text)
        logger.info(f"Parsed successfully: {len(result.layout)} layout items")
        return result
    except Exception as e:
        logger.error(f"Error parsing problem: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to parse problem: {str(e)}")

