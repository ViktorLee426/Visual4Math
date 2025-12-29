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

def get_my_icons_path():
    """Get path to my_icons folder (essential icons for problems)."""
    # Try relative to project root
    my_icons_path = os.path.join(PROJECT_ROOT, 'my_icons')
    if os.path.exists(my_icons_path):
        return my_icons_path
    
    # Try relative to current working directory
    cwd_path = os.path.join(os.getcwd(), 'my_icons')
    if os.path.exists(cwd_path):
        return cwd_path
    
    # Try relative to backend directory
    backend_path = os.path.join(BACKEND_DIR, '..', 'my_icons')
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
    
    3. Question: Emma bought 2 strawberry ice creams and 3 chocolate ice creams. How many ice creams did she buy in total?
    Visual language: addition(container1[entity_name: strawberry ice cream, entity_type: strawberry-ice-cream, entity_quantity: 2, container_name: Emma, container_type: girl, attr_name: , attr_type: ],container2[entity_name: chocolate ice cream, entity_type: chocolate-ice-cream, entity_quantity: 3, container_name: Emma, container_type: girl, attr_name: , attr_type: ], result_container[entity_name:ice cream,entity_type:ice-cream,entity_quantity:5 , container_name:, container_type:, attr_name:, attr_type:])
    
    **IMPORTANT RULES FOR ENTITY TYPES:**
    - Use SPECIFIC entity_type names that match available icons (e.g., "strawberry-ice-cream" not just "ice cream", "chocolate-ice-cream" not just "ice cream")
    - If the problem mentions specific types/varieties (strawberry, chocolate, red, green, etc.), include them in entity_type using hyphens
    - entity_name can be the full descriptive name (e.g., "strawberry ice cream"), but entity_type should be the icon-matching name (e.g., "strawberry-ice-cream")
    
    3. Question: There are 3 trays of cupcakes. Each tray has 2 cupcakes. How many cupcakes are there in total?
    Visual language: multiplication(container1[entity_name: tray, entity_type: tray, entity_quantity: 3, container_name: , container_type: , attr_name: , attr_type: ],container2[entity_name: cupcake, entity_type: cupcake, entity_quantity: 2, container_name: , container_type: , attr_name: , attr_type: ], result_container[entity_name:cupcake,entity_type:cupcake,entity_quantity:6 , container_name:, container_type:, attr_name:, attr_type:])
    
    **CRITICAL RULES FOR MULTIPLICATION:**
    - If the problem involves "groups of", "each has", "times", or repeated equal groups, you MUST use "multiplication" operation, NOT "addition"
    - For multiplication problems, you MUST use EXACTLY 2 containers (never 3 or more):
      * Container 1: The group/container type (e.g., tray) with entity_quantity = number of groups (e.g., 3 for "3 trays")
      * Container 2: The item type (e.g., cupcake) with entity_quantity = items per group (e.g., 2 for "2 cupcakes per tray")
    - NEVER create one container per group (e.g., NEVER create container1, container2, container3 for 3 trays - use only 2 containers total)
    - NEVER convert multiplication into repeated addition
    - Format: multiplication(container1[entity_type: <group_type>, entity_quantity: <number_of_groups>], container2[entity_type: <item_type>, entity_quantity: <items_per_group>], result_container[...])
    
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
        
        parsed_result = {
            "operation": operation,
            "containers": containers,
            "result_container": result_container
        }
        
        # Debug: Log parsed visual language structure
        logger.info("=" * 80)
        logger.info("📋 PARSED VISUAL LANGUAGE STRUCTURE:")
        logger.info(f"   Operation: {operation}")
        logger.info(f"   Containers ({len(containers)}):")
        for idx, container in enumerate(containers):
            logger.info(f"      Container {idx + 1}:")
            logger.info(f"         entity_name: {container.get('entity_name', '')}")
            logger.info(f"         entity_type: {container.get('entity_type', '')}")
            logger.info(f"         entity_quantity: {container.get('entity_quantity', '')}")
            logger.info(f"         container_name: {container.get('container_name', '')}")
            logger.info(f"         container_type: {container.get('container_type', '')}")
        if result_container:
            logger.info(f"   Result Container:")
            logger.info(f"      entity_name: {result_container.get('entity_name', '')}")
            logger.info(f"      entity_type: {result_container.get('entity_type', '')}")
            logger.info(f"      entity_quantity: {result_container.get('entity_quantity', '')}")
        logger.info("=" * 80)
        
        return parsed_result
    except Exception as e:
        logger.error(f"❌ Error parsing visual language: {str(e)}")
        raise


def find_svg_icon(entity_type: str) -> Optional[str]:
    """
    Find SVG icon file path for an entity type.
    Only searches in my_icons folder (not math2visual dataset).
    Returns the SVG file path or None if not found.
    Prioritizes exact matches and non-numbered versions.
    Handles variations like "chocolate ice cream" -> "ice-cream-chocolate"
    """
    my_icons_path = get_my_icons_path()
    if not my_icons_path or not os.path.exists(my_icons_path):
        logger.warning(f"⚠️ my_icons path not found: {my_icons_path}")
        return None
    
    # Normalize entity_type: lowercase, replace spaces/hyphens
    normalized = entity_type.lower().replace(' ', '-').replace('_', '-')
    
    # Try exact match first (e.g., "ice-cream-strawberry.svg")
    exact_path = os.path.join(my_icons_path, f"{normalized}.svg")
    if os.path.exists(exact_path):
        return exact_path
    
    # Try without hyphens
    no_hyphen = normalized.replace('-', '')
    no_hyphen_path = os.path.join(my_icons_path, f"{no_hyphen}.svg")
    if os.path.exists(no_hyphen_path):
        return no_hyphen_path
    
    # Try partial match, but prioritize non-numbered versions and more specific matches
    # Collect matches with scores (higher score = better match)
    matches = []  # List of (file_path, score) tuples
    numbered_matches = []  # List of (file_path, score) tuples
    
    # Extract key words from entity_type for better matching
    # e.g., "chocolate ice cream" -> ["chocolate", "ice", "cream"]
    # or "ice-cream-chocolate" -> ["ice", "cream", "chocolate"]
    import re
    key_words = set(re.findall(r'\w+', normalized.lower()))
    
    for filename in sorted(os.listdir(my_icons_path)):  # Sort for consistent ordering
        if filename.endswith('.svg'):
            name_without_ext = filename[:-4].lower()
            file_path = os.path.join(my_icons_path, filename)
            is_numbered = bool(re.search(r'-\d+$', name_without_ext))
            score = 0
            
            # Check if normalized matches or is contained in filename
            if normalized in name_without_ext:
                # Exact substring match - high score, prefer longer/more specific filenames
                score = 100 + len(name_without_ext.split('-'))  # More words = more specific
            elif name_without_ext in normalized:
                # Filename is substring of entity_type - medium score
                score = 50
            else:
                # Try matching by key words (handles "chocolate ice cream" -> "ice-cream-chocolate")
                filename_words = set(re.findall(r'\w+', name_without_ext))
                if key_words and filename_words:
                    common_words = key_words.intersection(filename_words)
                    # Score based on how many words match and how specific the match is
                    if len(common_words) >= min(2, len(key_words)) or (len(key_words) == 1 and len(common_words) == 1):
                        # More words in filename = more specific = higher score
                        # Prefer longer, more specific filenames (e.g., "ice-cream-chocolate" over "chocolate")
                        score = len(common_words) * 10 + len(name_without_ext.split('-'))
            
            if score > 0:
                if is_numbered:
                    numbered_matches.append((file_path, score))
                else:
                    matches.append((file_path, score))
    
    # Sort by score (highest first), then return the best non-numbered match
    matches.sort(key=lambda x: x[1], reverse=True)
    numbered_matches.sort(key=lambda x: x[1], reverse=True)
    
    if matches:
        selected_path = matches[0][0]
        selected_name = os.path.basename(selected_path)
        logger.info(f"   🎯 Icon found for '{entity_type}': {selected_name} (score: {matches[0][1]})")
        return selected_path
    elif numbered_matches:
        selected_path = numbered_matches[0][0]
        selected_name = os.path.basename(selected_path)
        logger.info(f"   🎯 Icon found for '{entity_type}': {selected_name} (score: {numbered_matches[0][1]}, numbered)")
        return selected_path
    
    logger.warning(f"   ⚠️ No SVG icon found in my_icons for entity_type: {entity_type}")
    return None


def fix_multiplication_visual_language(mwp_text: str, visual_lang: str) -> str:
    """
    Post-process visual language to fix multiplication problems that were incorrectly generated as addition.
    Detects multiplication patterns and converts addition operations to multiplication.
    """
    import re
    
    # Detect if this is a multiplication problem
    multiplication_keywords = [
        r'\beach\b.*\bhas\b',  # "each has"
        r'\b(\d+)\s+groups?\s+of\s+(\d+)',  # "3 groups of 2"
        r'\b(\d+)\s+trays?\s+.*\beach\b',  # "3 trays, each has"
        r'\b(\d+)\s+plates?\s+.*\beach\b',  # "3 plates, each has"
        r'\b(\d+)\s+times\b',  # "3 times"
        r'\b(\d+)\s*\*\s*(\d+)',  # "3 * 2"
        r'\b(\d+)\s*x\s*(\d+)',  # "3 x 2"
    ]
    
    is_multiplication = False
    for pattern in multiplication_keywords:
        if re.search(pattern, mwp_text.lower(), re.IGNORECASE):
            is_multiplication = True
            break
    
    # Also check if the problem asks for "total" with groups
    if re.search(r'\b(\d+)\s+.*\s+each\s+.*\s+(\d+)', mwp_text.lower()) and 'total' in mwp_text.lower():
        is_multiplication = True
    
    if not is_multiplication:
        return visual_lang
    
    # Check if visual language is incorrectly using addition
    if visual_lang.strip().startswith('addition('):
        logger.warning("⚠️ Detected multiplication problem incorrectly generated as addition. Fixing...")
        
        # Parse the addition structure
        parsed = parse_visual_language(visual_lang)
        containers = parsed.get('containers', [])
        result_container = parsed.get('result_container', {})
        
        if len(containers) >= 2:
            # Check if all containers have the same entity_quantity (multiplication pattern)
            quantities = [c.get('entity_quantity') for c in containers if c.get('entity_quantity')]
            if len(set(quantities)) == 1 and len(quantities) >= 2:
                # This is multiplication: same quantity repeated in multiple containers
                entity_type = containers[0].get('entity_type', '')
                entity_quantity = quantities[0]
                num_groups = len(containers)
                total_quantity = num_groups * entity_quantity
                
                # Reconstruct as multiplication
                container_parts = []
                for i in range(num_groups):
                    container = containers[i] if i < len(containers) else containers[0]
                    container_parts.append(
                        f"container{i+1}[entity_name: {container.get('entity_name', '')}, "
                        f"entity_type: {container.get('entity_type', entity_type)}, "
                        f"entity_quantity: {entity_quantity}, "
                        f"container_name: {container.get('container_name', '')}, "
                        f"container_type: {container.get('container_type', '')}, "
                        f"attr_name: {container.get('attr_name', '')}, "
                        f"attr_type: {container.get('attr_type', '')}]"
                    )
                
                result_entity_name = result_container.get('entity_name', containers[0].get('entity_name', ''))
                result_entity_type = result_container.get('entity_type', entity_type)
                
                fixed_visual_lang = (
                    f"multiplication({','.join(container_parts)}, "
                    f"result_container[entity_name:{result_entity_name},"
                    f"entity_type:{result_entity_type},"
                    f"entity_quantity:{total_quantity},"
                    f"container_name:,container_type:,attr_name:,attr_type:])"
                )
                
                logger.info(f"✅ Fixed: Converted addition to multiplication ({num_groups} groups × {entity_quantity} = {total_quantity})")
                return fixed_visual_lang
    
    return visual_lang


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
        logger.info("=" * 80)
        logger.info("🚀 GENERATING MANIPULATIVES FROM MATH WORD PROBLEM")
        logger.info(f"   Problem text: {mwp_text[:100]}...")
        logger.info("=" * 80)
        
        # Step 1: Generate visual language
        visual_lang = generate_visual_language(mwp_text)
        logger.info("=" * 80)
        logger.info("📝 GENERATED VISUAL LANGUAGE (DSL):")
        logger.info(f"   {visual_lang}")
        logger.info("=" * 80)
        
        # Step 2: Parse visual language (for metadata)
        parsed = parse_visual_language(visual_lang)
        
        # Step 3: Convert to formal visual elements using math2visual algorithm
        logger.info("=" * 80)
        logger.info("🔍 SEARCHING FOR ICONS IN my_icons DATASET:")
        logger.info("=" * 80)
        elements = convert_to_manipulatives_formal(visual_lang)
        
        # Debug: Log icon names used in final elements
        logger.info("=" * 80)
        logger.info("🎨 FINAL ELEMENTS WITH ICON NAMES:")
        icon_count = {}
        for idx, elem in enumerate(elements):
            elem_type = elem.get('type', 'unknown')
            elem_label = elem.get('label', '')
            if elem_type == 'icon' and elem.get('svg_content'):
                # Extract icon name from SVG content or use label
                icon_name = elem_label if elem_label else f"icon_{idx}"
                icon_count[icon_name] = icon_count.get(icon_name, 0) + 1
                logger.info(f"   Element {idx + 1}: type={elem_type}, label={elem_label}, "
                          f"x={elem.get('x', 0)}, y={elem.get('y', 0)}, "
                          f"w={elem.get('w', 0)}, h={elem.get('h', 0)}")
            elif elem_type == 'text':
                logger.info(f"   Element {idx + 1}: type={elem_type}, label='{elem_label}', "
                          f"x={elem.get('x', 0)}, y={elem.get('y', 0)}, "
                          f"w={elem.get('w', 0)}, h={elem.get('h', 0)}")
        
        logger.info("=" * 80)
        logger.info("📊 ICON USAGE SUMMARY:")
        for icon_name, count in icon_count.items():
            logger.info(f"   {icon_name}: used {count} time(s)")
        logger.info(f"   Total elements: {len(elements)}")
        logger.info("=" * 80)
        
        return {
            "elements": elements,
            "visual_language": visual_lang,
            "parsed": parsed
        }
    except Exception as e:
        logger.error(f"❌ Error generating manipulatives: {str(e)}")
        raise

