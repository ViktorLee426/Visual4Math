# backend/app/services/math2visual_service.py
"""
Math2Visual Service: Generates visual language from math word problems
and converts it to manipulative elements for Tool3.
"""
from app.clients.openai_client import client
from typing import List, Dict, Optional
import re
import logging
import os

logger = logging.getLogger(__name__)

# Path to math2visual SVG dataset
# Get the backend directory (where main.py is)
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
# Go up one level to project root, then into math2visual_repo
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
SVG_DATASET_PATH = os.path.join(PROJECT_ROOT, 'math2visual_repo', 'svg_dataset')

# Also try resolving from current working directory (for uvicorn)
def get_svg_dataset_path():
    """Get SVG dataset path with fallback options."""
    # Try the calculated path first
    if os.path.exists(SVG_DATASET_PATH):
        return SVG_DATASET_PATH
    
    # Try relative to current working directory
    cwd_path = os.path.join(os.getcwd(), 'math2visual_repo', 'svg_dataset')
    if os.path.exists(cwd_path):
        return cwd_path
    
    # Try relative to backend directory
    backend_path = os.path.join(BACKEND_DIR, '..', 'math2visual_repo', 'svg_dataset')
    backend_path = os.path.abspath(backend_path)
    if os.path.exists(backend_path):
        return backend_path
    
    return SVG_DATASET_PATH  # Return original even if doesn't exist

def get_additional_icons_path():
    """Get path to additional icons (Heroicons, etc.)."""
    # Try relative to project root
    additional_path = os.path.join(PROJECT_ROOT, 'additional_icons')
    if os.path.exists(additional_path):
        return additional_path
    
    # Try relative to current working directory
    cwd_path = os.path.join(os.getcwd(), 'additional_icons')
    if os.path.exists(cwd_path):
        return cwd_path
    
    # Try relative to backend directory
    backend_path = os.path.join(BACKEND_DIR, '..', 'additional_icons')
    backend_path = os.path.abspath(backend_path)
    if os.path.exists(backend_path):
        return backend_path
    
    return None


def generate_visual_language(mwp_text: str) -> str:
    """
    Generate visual language from math word problem using GPT.
    Returns the visual language string in math2visual format.
    """
    prompt = f'''
    You are an expert at converting math story problem into a structured 'visual language'. Your task is to write a visual language expression based on the given math word problem. 
    **Background information**
        You shoud use the following fixed format for each problem:
        <operation>(
        container1[entity_name: <entity name>, entity_type: <entity type>, entity_quantity: <number of this entity in this container>, container_name: <container name>, container_type: <container type>, attr_name: <attribute name>, attr_type: <attribute type>],
        container2[entity_name: <entity name>, entity_type: <entity type>, entity_quantity: <number of this entity in this container>, container_name: <container name>, container_type: <container type>, attr_name: <attribute name>, attr_type: <attribute type>],
        result_container[entity_name: <entity name>, entity_type: <entity type>, entity_quantity: <number of this entity in this container>, container_name: <container name>, container_type: <container type>, attr_name: <attribute name>, attr_type: <attribute type>]
        )               
        operation can be ``addition'', ``subtraction'', ``multiplication'', ``division'', ``surplus'', ``area'', ``comparison'', or ``unittrans''.
        
    Each entity has the attributes: entity_name, entity_type, entity_quantity, container_name, container_type, attr_name, attr_type. Name and type are different, for example, a girl named Lucy may be represented by entity_name: Lucy, entity_type: girl. The attributes container_name, container_type, attr_name and attr_type are optional and may vary according to different interpretations, only use them if you think they are necessary to clarify the entity.
    
    **Examples**
    1. Question: Marin has nine apples and Donald has two apples. How many apples do Marin and Donald have together?
    Visual language: addition(container1[entity_name: apple, entity_type: apple, entity_quantity:9 , container_name: Marin, container_type: girl, attr_name: , attr_type: ],container2[entity_name: apple, entity_type: apple, entity_quantity: 2, container_name: Donald, container_type: boy, attr_name: , attr_type: ], result_container[entity_name:apple,entity_type:apple,entity_quantity:11 , container_name:Marin and Donald, container_type:, attr_name:, attr_type:])
    
    2. Question: There are 10 basketballs total. 4 are in a blue bag, 6 are in a green bag.
    Visual language: addition(container1[entity_name: basketball, entity_type: basketball, entity_quantity: 4, container_name: blue bag, container_type: bag, attr_name: , attr_type: ],container2[entity_name: basketball, entity_type: basketball, entity_quantity: 6, container_name: green bag, container_type: bag, attr_name: , attr_type: ], result_container[entity_name:basketball,entity_type:basketball,entity_quantity:10 , container_name:, container_type:, attr_name:, attr_type:])
    
    Now convert this math word problem to visual language:
    Problem: {mwp_text}
    
    Return ONLY the visual language expression, no other text.
    '''
    
    try:
        logger.info(f"🤖 Generating visual language for: {mwp_text[:100]}...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at converting math word problems into structured visual language expressions. Return only the visual language expression."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        
        visual_lang = response.choices[0].message.content.strip()
        # Remove "visual_language:" prefix if present
        if visual_lang.startswith("visual_language:"):
            visual_lang = visual_lang.replace("visual_language:", "").strip()
        
        logger.info(f"✅ Generated visual language: {visual_lang[:200]}...")
        return visual_lang
    except Exception as e:
        logger.error(f"❌ Error generating visual language: {str(e)}")
        raise


def parse_visual_language(visual_lang: str) -> Dict:
    """
    Parse visual language string into structured dictionary.
    Returns: {
        "operation": "addition",
        "containers": [
            {"entity_name": "...", "entity_type": "...", "entity_quantity": 4, ...},
            ...
        ],
        "result_container": {...}
    }
    """
    try:
        # Extract operation
        operation_match = re.match(r'(\w+)\(', visual_lang)
        operation = operation_match.group(1) if operation_match else "addition"
        
        # Extract containers using regex
        container_pattern = r'container(\d+|_result)\[(.*?)\]'
        containers = []
        result_container = None
        
        for match in re.finditer(container_pattern, visual_lang):
            container_id = match.group(1)
            container_data = match.group(2)
            
            # Parse container attributes
            attrs = {}
            for attr_match in re.finditer(r'(\w+):\s*([^,]+)', container_data):
                key = attr_match.group(1).strip()
                value = attr_match.group(2).strip()
                # Remove trailing spaces and clean up
                value = value.rstrip(' ,')
                attrs[key] = value
            
            # Convert entity_quantity to int if possible
            if 'entity_quantity' in attrs:
                try:
                    attrs['entity_quantity'] = int(attrs['entity_quantity'])
                except:
                    attrs['entity_quantity'] = None
            
            container_obj = {
                "entity_name": attrs.get('entity_name', ''),
                "entity_type": attrs.get('entity_type', ''),
                "entity_quantity": attrs.get('entity_quantity'),
                "container_name": attrs.get('container_name', ''),
                "container_type": attrs.get('container_type', ''),
                "attr_name": attrs.get('attr_name', ''),
                "attr_type": attrs.get('attr_type', '')
            }
            
            if container_id == '_result' or 'result' in container_id.lower():
                result_container = container_obj
            else:
                containers.append(container_obj)
        
        return {
            "operation": operation,
            "containers": containers,
            "result_container": result_container
        }
    except Exception as e:
        logger.error(f"❌ Error parsing visual language: {str(e)}")
        raise


def find_svg_icon(entity_type: str) -> Optional[str]:
    """
    Find SVG icon file path for an entity type.
    Returns the SVG file path or None if not found.
    """
    if not os.path.exists(SVG_DATASET_PATH):
        logger.warning(f"⚠️ SVG dataset path not found: {SVG_DATASET_PATH}")
        return None
    
    # Normalize entity_type: lowercase, replace spaces/hyphens
    normalized = entity_type.lower().replace(' ', '-').replace('_', '-')
    
    # Try exact match first
    exact_path = os.path.join(SVG_DATASET_PATH, f"{normalized}.svg")
    if os.path.exists(exact_path):
        return exact_path
    
    # Try without hyphens
    no_hyphen = normalized.replace('-', '')
    no_hyphen_path = os.path.join(SVG_DATASET_PATH, f"{no_hyphen}.svg")
    if os.path.exists(no_hyphen_path):
        return no_hyphen_path
    
    # Try partial match (contains entity_type)
    for filename in os.listdir(SVG_DATASET_PATH):
        if filename.endswith('.svg'):
            name_without_ext = filename[:-4].lower()
            if normalized in name_without_ext or name_without_ext in normalized:
                return os.path.join(SVG_DATASET_PATH, filename)
    
    logger.warning(f"⚠️ No SVG icon found for entity_type: {entity_type}")
    return None


def read_svg_content(svg_path: str) -> Optional[str]:
    """Read SVG file content."""
    try:
        # Try UTF-8 first
        with open(svg_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if content and len(content) > 0:
                return content
            logger.warning(f"⚠️ Empty SVG file: {svg_path}")
            return None
    except UnicodeDecodeError:
        # Try with error handling for files with special characters
        try:
            with open(svg_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if content and len(content) > 0:
                    return content
                return None
        except Exception as e:
            logger.error(f"❌ Error reading SVG file {svg_path} (with error handling): {str(e)}")
            return None
    except Exception as e:
        logger.error(f"❌ Error reading SVG file {svg_path}: {str(e)}")
        return None


def convert_to_manipulatives_formal(visual_lang: str, canvas_width: int = 800, canvas_height: int = 600) -> List[Dict]:
    """
    Convert visual language to formal visual elements using math2visual algorithm.
    Uses the formal visual generation logic from generate_visual_formal.py.
    """
    from app.services.formal_visual_service import generate_formal_visual_elements
    return generate_formal_visual_elements(visual_lang)

def convert_to_manipulatives(parsed_lang: Dict, canvas_width: int = 800, canvas_height: int = 600) -> List[Dict]:
    """
    Convert parsed visual language to manipulative elements.
    Returns list of elements ready for frontend.
    """
    elements = []
    base_x = 100
    base_y = 150
    gap_x = 200
    gap_y = 150
    
    containers = parsed_lang.get("containers", [])
    result_container = parsed_lang.get("result_container")
    
    # Process each container
    for idx, container in enumerate(containers):
        entity_type = container.get("entity_type", "")
        entity_quantity = container.get("entity_quantity", 1)
        container_name = container.get("container_name", "")
        container_type = container.get("container_type", "")
        
        # Calculate position
        x = base_x + (idx % 3) * gap_x
        y = base_y + (idx // 3) * gap_y
        
        # Find SVG icon
        svg_path = find_svg_icon(entity_type)
        svg_content = read_svg_content(svg_path) if svg_path else None
        
        # Create elements for each entity instance (if quantity > 1, create multiple)
        # For now, create one element with count attribute
        element_id = f"elem_{idx}_{entity_type}"
        
        elements.append({
            "id": element_id,
            "type": "icon",
            "svg_content": svg_content,
            "x": x,
            "y": y,
            "w": 80,
            "h": 80,
            "label": entity_type,
            "count": entity_quantity,
            "container_name": container_name,
            "container_type": container_type,
            "entity_name": container.get("entity_name", "")
        })
        
        # If there's a container (bag, box, etc.), add it too
        if container_type and container_type != entity_type:
            container_svg_path = find_svg_icon(container_type)
            container_svg_content = read_svg_content(container_svg_path) if container_svg_path else None
            
            elements.append({
                "id": f"container_{idx}_{container_type}",
                "type": "icon",
                "svg_content": container_svg_content,
                "x": x - 20,
                "y": y - 20,
                "w": 120,
                "h": 120,
                "label": container_name or container_type,
                "count": None,
                "container_name": container_name,
                "container_type": container_type,
                "entity_name": container_name
            })
    
    # Add result container if present
    if result_container:
        result_type = result_container.get("entity_type", "")
        result_quantity = result_container.get("entity_quantity")
        result_svg_path = find_svg_icon(result_type)
        result_svg_content = read_svg_content(result_svg_path) if result_svg_path else None
        
        elements.append({
            "id": "result_elem",
            "type": "icon",
            "svg_content": result_svg_content,
            "x": base_x + len(containers) * gap_x,
            "y": base_y,
            "w": 80,
            "h": 80,
            "label": result_type,
            "count": result_quantity,
            "container_name": result_container.get("container_name", ""),
            "container_type": result_container.get("container_type", ""),
            "entity_name": result_container.get("entity_name", "")
        })
    
    return elements


def generate_manipulatives_from_mwp(mwp_text: str) -> Dict:
    """
    Main function: Generate manipulative elements from math word problem.
    Uses math2visual's formal visual generation algorithm.
    Returns: {
        "elements": [...],
        "visual_language": "...",
        "parsed": {...}
    }
    """
    try:
        # Step 1: Generate visual language
        visual_lang = generate_visual_language(mwp_text)
        
        # Step 2: Parse visual language (for metadata)
        parsed = parse_visual_language(visual_lang)
        
        # Step 3: Convert to formal visual elements using math2visual algorithm
        elements = convert_to_manipulatives_formal(visual_lang)
        
        return {
            "elements": elements,
            "visual_language": visual_lang,
            "parsed": parsed
        }
    except Exception as e:
        logger.error(f"❌ Error generating manipulatives: {str(e)}")
        raise

