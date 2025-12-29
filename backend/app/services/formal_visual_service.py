# backend/app/services/formal_visual_service.py
"""
Adapts math2visual's formal visual generation to create draggable elements.
Based on generate_visual_formal.py from math2visual repo.
"""
import re
import math
import os
from typing import List, Dict, Optional
import logging
from app.services.math2visual_service import find_svg_icon, read_svg_content, get_svg_dataset_path

logger = logging.getLogger(__name__)

# Constants from math2visual
UNIT_SIZE = 40
APPLE_SCALE = 0.75
ITEM_SIZE = int(UNIT_SIZE * APPLE_SCALE)
ITEM_PADDING = int(UNIT_SIZE * 0.25)
BOX_PADDING = UNIT_SIZE
OPERATOR_SIZE = 30
MAX_ITEM_DISPLAY = 10
MARGIN = 50


def parse_dsl_formal(dsl_str: str) -> Dict:
    """
    Parse visual language DSL string (same as math2visual's parse_dsl).
    Returns structured dict with operations and entities.
    """
    operations_list = ["addition", "subtraction", "multiplication", "division", "surplus", "unittrans", "area"]

    def split_entities(inside_str):
        """Safely splits entities or nested operations while balancing parentheses and square brackets."""
        entities = []
        balance_paren = 0
        balance_bracket = 0
        buffer = ""

        for char in inside_str:
            if char == "(":
                balance_paren += 1
            elif char == ")":
                balance_paren -= 1
            elif char == "[":
                balance_bracket += 1
            elif char == "]":
                balance_bracket -= 1

            if char == "," and balance_paren == 0 and balance_bracket == 0:
                entities.append(buffer.strip())
                buffer = ""
            else:
                buffer += char

        if buffer:
            entities.append(buffer.strip())
        return entities

    def recursive_parse(input_str):
        """Recursively parses operations and entities."""
        input_str = " ".join(input_str.strip().split())
        func_pattern = r"(\w+)\s*\((.*)\)"
        match = re.match(func_pattern, input_str)

        if not match:
            raise ValueError(f"DSL does not match the expected pattern: {input_str}")

        operation, inside = match.groups()
        parsed_entities = []
        result_container = None

        for entity in split_entities(inside):
            if any(entity.startswith(op) for op in operations_list):
                parsed_entities.append(recursive_parse(entity))
            else:
                entity_pattern = r"(\w+)\[(.*?)\]"
                entity_match = re.match(entity_pattern, entity)
                if not entity_match:
                    raise ValueError(f"Entity format is incorrect: {entity}")
                entity_name, entity_content = entity_match.groups()
                parts = [p.strip() for p in entity_content.split(',')]
                entity_dict = {"name": entity_name, "item": {}}
                for part in parts:
                    if ':' in part:
                        key, val = part.split(':', 1)
                        key, val = key.strip(), val.strip()
                        if key == "entity_quantity":
                            try:
                                entity_dict["item"]["entity_quantity"] = float(val)
                            except ValueError:
                                entity_dict["item"]["entity_quantity"] = 0.0
                        elif key == "entity_type":
                            entity_dict["item"]["entity_type"] = val
                        else:
                            entity_dict[key] = val
                
                if entity_name == "result_container":
                    result_container = entity_dict
                else:
                    parsed_entities.append(entity_dict)

        result = {"operation": operation, "entities": parsed_entities}
        if result_container:
            result["result_container"] = result_container
        return result

    return recursive_parse(dsl_str)


def extract_operations_and_entities(data: Dict):
    """
    Extract operations, entities, and result entities from parsed data.
    Adapted from math2visual's extract_operations_and_entities.
    For multiplication, consolidates multiple containers into 2 entities.
    """
    operations = []
    entities = []
    result_entities = []

    def extract_recursive(node, parent_op=None):
        op = node.get("operation", "")
        
        if op == "unittrans":
            sub_ents = node.get("entities", [])
            if len(sub_ents) == 2:
                main_entity = sub_ents[0]
                unit_entity = sub_ents[1]
                main_entity["unittrans_unit"] = unit_entity["name"]
                main_entity["unittrans_value"] = unit_entity["item"]["entity_quantity"]
                entities.append(main_entity)
            return

        if op == "comparison":
            raise ValueError("Comparison not handled in formal visual")

        child_ents = node.get("entities", [])
        my_result = node.get("result_container")

        # Special handling for multiplication: consolidate into 2 entities
        if op == "multiplication" and parent_op is None and len(child_ents) >= 2:
            # Check if all containers have the same entity_quantity (repeated groups)
            quantities = [e.get("item", {}).get("entity_quantity") for e in child_ents if "operation" not in e]
            entity_types = [e.get("item", {}).get("entity_type", "") for e in child_ents if "operation" not in e]
            container_types = [e.get("container_type", "") for e in child_ents if "operation" not in e]
            
            if len(set(quantities)) == 1 and len(quantities) >= 2:
                # This is multiplication with repeated equal groups (e.g., 3 trays × 2 cupcakes)
                num_groups = len(child_ents)
                items_per_group = quantities[0] if quantities else 0
                entity_type = entity_types[0] if entity_types else ""
                container_type = container_types[0] if container_types else ""
                
                logger.info(f"   🔢 Multiplication detected: {num_groups} groups × {items_per_group} items = {num_groups * items_per_group}")
                logger.info(f"   📦 Consolidating {num_groups} containers into 2 entities for multiplication")
                
                # Entity 1: Multiplier (number of groups) - rendered as text showing the number
                multiplier_entity = {
                    "name": "container1",
                    "item": {
                        "entity_type": "multiplier",  # Special type for multiplier rendering
                        "entity_quantity": num_groups,
                        "entity_name": container_type if container_type else "group"
                    },
                    "container_type": container_type if container_type else "group",
                    "container_name": container_type if container_type else "",
                    "layout": "multiplier"
                }
                entities.append(multiplier_entity)
                
                # Entity 2: Multiplicand (items per group) - show as entity type with icons
                multiplicand_entity = {
                    "name": "container2",
                    "item": {
                        "entity_type": entity_type,
                        "entity_quantity": items_per_group,
                        "entity_name": entity_type
                    },
                    "container_type": container_type if container_type else "",
                    "container_name": container_type if container_type else "",
                    "layout": "normal"
                }
                entities.append(multiplicand_entity)
                
                # Record operation
                operations.append({"type": op})
                
                # Record result if available
                if my_result and isinstance(my_result, dict):
                    result_entities.append(my_result)
                
                return

        if len(child_ents) < 2:
            return

        left_child = child_ents[0]
        right_child = child_ents[1]

        # Handle left child
        if "operation" in left_child:
            extract_recursive(left_child, parent_op=op)
        else:
            entities.append(left_child)

        # Record operation as a dict so we can add planned_x/planned_y later
        operations.append({"type": op})

        # Handle right child
        if "operation" in right_child:
            extract_recursive(right_child, parent_op=op)
        else:
            entities.append(right_child)

        # Record result if top-level
        if parent_op is None and my_result:
            if isinstance(my_result, dict):
                result_entities.append(my_result)

    extract_recursive(data)
    return operations, entities, result_entities


def generate_formal_visual_elements(visual_lang: str, start_x: int = 50, start_y: int = 100) -> List[Dict]:
    """
    Generate draggable elements using math2visual's formal visual algorithm.
    Returns list of element dicts with positions calculated from the algorithm.
    """
    try:
        # Parse visual language
        data = parse_dsl_formal(visual_lang)
        
        # Extract operations and entities
        operations, entities, result_entities = extract_operations_and_entities(data)
        
        logger.info(f"📊 Parsed: {len(operations)} operations, {len(entities)} entities")
        
        # Calculate layout (adapted from handle_all_except_comparison)
        elements = []
        resources_path = get_svg_dataset_path()
        
        # Determine layouts
        quantities = [e["item"].get("entity_quantity", 0) for e in entities]
        entity_types = [e["item"].get("entity_type", "") for e in entities]
        
        any_multiplier = any(t == "multiplier" for t in entity_types)
        any_above_20 = any(q > MAX_ITEM_DISPLAY for q in quantities)
        
        # Determine entity layout
        for e in entities:
            q = e["item"].get("entity_quantity", 0)
            t = e["item"].get("entity_type", "")
            container = e.get("container_type", "")
            attr = e.get("attr_entity_type", "")
            
            if t == "multiplier":
                e["layout"] = "multiplier"
            elif q > MAX_ITEM_DISPLAY or q % 1 != 0:
                e["layout"] = "large"
            else:
                if "row" in [container, attr]:
                    e["layout"] = "row"
                elif "column" in [container, attr]:
                    e["layout"] = "column"
                else:
                    e["layout"] = "normal"
        
        # Compute global layout for normal entities
        normal_entities = [e for e in entities if e["layout"] == "normal"]
        if normal_entities:
            largest_normal_q = max(e["item"].get("entity_quantity", 0) for e in normal_entities)
        else:
            largest_normal_q = 1
        
        if largest_normal_q > 0:
            max_cols = int(math.ceil(math.sqrt(largest_normal_q)))
            max_rows = (largest_normal_q + max_cols - 1) // max_cols
        else:
            max_cols, max_rows = 1, 1
        
        for e in normal_entities:
            e["cols"] = max_cols
            e["rows"] = max_rows
        
        # Compute box sizes
        for e in entities:
            if e["layout"] == "large":
                e["cols"] = 1
                e["rows"] = 1
            elif e["layout"] == "row":
                q = e["item"].get("entity_quantity", 0)
                e["cols"] = q if q > 0 else 1
                e["rows"] = 1
            elif e["layout"] == "column":
                q = e["item"].get("entity_quantity", 0)
                e["cols"] = 1
                e["rows"] = q if q > 0 else 1
            elif e["layout"] == "multiplier":
                e["cols"] = 1
                e["rows"] = 1
        
        normal_box_width = max_cols * (ITEM_SIZE + ITEM_PADDING) + BOX_PADDING
        normal_box_height = max_rows * (ITEM_SIZE + ITEM_PADDING) + BOX_PADDING
        
        large_box_width = ITEM_SIZE * 4 + BOX_PADDING
        large_box_height = ITEM_SIZE * 4 + BOX_PADDING
        
        if any_multiplier or any_above_20:
            ref_box_width = max(normal_box_width, large_box_width)
            ref_box_height = max(normal_box_height, large_box_height)
        else:
            ref_box_width = normal_box_width
            ref_box_height = normal_box_height
        
        # Compute entity box sizes
        def compute_entity_box_size(e):
            layout = e["layout"]
            if layout == "multiplier":
                return (UNIT_SIZE * 2, ref_box_height)
            if layout == "large":
                return (large_box_width, large_box_height)
            elif layout == "normal":
                return (normal_box_width, normal_box_height)
            elif layout == "row":
                cols = e["cols"]
                w = cols * (ITEM_SIZE + ITEM_PADDING) + BOX_PADDING
                h = (ITEM_SIZE + ITEM_PADDING) + BOX_PADDING
                return (w, h)
            elif layout == "column":
                rows = e["rows"]
                w = (ITEM_SIZE + ITEM_PADDING) + BOX_PADDING
                h = rows * (ITEM_SIZE + ITEM_PADDING) + BOX_PADDING
                return (w, h)
            return (normal_box_width, normal_box_height)
        
        for e in entities:
            w, h = compute_entity_box_size(e)
            e["planned_width"] = w
            e["planned_height"] = h
        
        # Position planning
        operator_gap = e_gap = eq_gap = qmark_gap = 20
        current_x = start_x
        current_y = start_y
        position_box_y = start_y
        
        for i, entity in enumerate(entities):
            entity["planned_x"] = current_x
            entity["planned_y"] = current_y
            entity["planned_box_y"] = current_y
            if i == 0:
                position_box_y = current_y
            
            e_right = current_x + entity["planned_width"]
            if operations and i < len(operations):
                operator_x = e_right + operator_gap
                operator_y = position_box_y + (entities[0]["planned_height"] / 2) - (OPERATOR_SIZE / 2)
                operations[i]["planned_x"] = operator_x
                operations[i]["planned_y"] = operator_y
                current_x = operator_x + OPERATOR_SIZE + e_gap
            else:
                current_x = e_right + e_gap
        
        eq_x = current_x + eq_gap
        eq_y = position_box_y + (entities[0]["planned_height"] / 2) - (OPERATOR_SIZE / 2)
        qmark_x = eq_x + 30 + qmark_gap
        qmark_y = position_box_y + (entities[0]["planned_height"] / 2) - (OPERATOR_SIZE / 2) - 15
        
        # Create element objects
        element_id_counter = 0
        
        # Create box elements (containers)
        for i, entity in enumerate(entities):
            q = entity["item"].get("entity_quantity", 0)
            t = entity["item"].get("entity_type", "")
            layout = entity["layout"]
            
            if layout == "multiplier":
                # Multiplier is just text, skip box
                continue
            
            # Create box container
            box_id = f"box_{element_id_counter}"
            element_id_counter += 1
            elements.append({
                "id": box_id,
                "type": "box",
                "x": entity["planned_x"],
                "y": entity["planned_box_y"],
                "w": entity["planned_width"],
                "h": entity["planned_height"],
                "label": entity.get("container_name", "") or entity.get("container_type", ""),
                "entity_type": t,
                "entity_quantity": q,
                "layout": layout,
                "cols": entity.get("cols", 1),
                "rows": entity.get("rows", 1)
            })
            
            # Create individual items inside the box
            if layout != "large" and layout != "multiplier":
                item_svg_path = find_svg_icon(t)
                if item_svg_path:
                    icon_filename = os.path.basename(item_svg_path)
                    logger.info(f"   📌 Using icon '{icon_filename}' for entity_type '{t}' (normal layout, {int(q)} items)")
                item_svg_content = read_svg_content(item_svg_path) if item_svg_path else None
                
                cols = entity.get("cols", 1)
                rows = entity.get("rows", 1)
                
                for item_idx in range(int(q)):
                    row = item_idx // cols
                    col = item_idx % cols
                    item_x = entity["planned_x"] + BOX_PADDING / 2 + col * (ITEM_SIZE + ITEM_PADDING)
                    item_y = entity["planned_y"] + BOX_PADDING / 2 + row * (ITEM_SIZE + ITEM_PADDING)
                    
                    elements.append({
                        "id": f"item_{box_id}_{item_idx}",
                        "type": "icon",
                        "svg_content": item_svg_content,
                        "x": item_x,
                        "y": item_y,
                        "w": ITEM_SIZE,
                        "h": ITEM_SIZE,
                        "label": t,
                        "parent_box": box_id
                    })
            elif layout == "large":
                # Large layout: show one big icon with number
                item_svg_path = find_svg_icon(t)
                if item_svg_path:
                    icon_filename = os.path.basename(item_svg_path)
                    logger.info(f"   📌 Using icon '{icon_filename}' for entity_type '{t}' (large layout, quantity={q})")
                item_svg_content = read_svg_content(item_svg_path) if item_svg_path else None
                
                svg_x = entity["planned_x"] + (entity["planned_width"] - ITEM_SIZE * 4) / 2
                svg_y = entity["planned_y"] + ITEM_PADDING
                
                elements.append({
                    "id": f"large_item_{box_id}",
                    "type": "icon",
                    "svg_content": item_svg_content,
                    "x": svg_x,
                    "y": svg_y,
                    "w": ITEM_SIZE * 4,
                    "h": ITEM_SIZE * 4,
                    "label": t,
                    "count": int(q) if q.is_integer() else q,
                    "parent_box": box_id
                })
        
        # Create multiplier elements (just text)
        for i, entity in enumerate(entities):
            if entity["layout"] == "multiplier":
                q = entity["item"].get("entity_quantity", 0)
                q_str = str(int(q)) if float(q).is_integer() else str(q)
                text_x = entity["planned_x"] + entity["planned_width"] / 2
                text_y = position_box_y + (entities[0]["planned_height"] / 2) - (OPERATOR_SIZE / 2) + 34
                
                elements.append({
                    "id": f"multiplier_{element_id_counter}",
                    "type": "text",
                    "x": text_x,
                    "y": text_y,
                    "w": len(q_str) * 30,
                    "h": 50,
                    "text": q_str,
                    "label": "multiplier"
                })
                element_id_counter += 1
        
        # Create operator elements
        operator_svg_mapping = {
            "surplus": "division",
            "area": "multiplication",
            "default": "addition"
        }
        
        for i, op in enumerate(operations):
            # op is now a dict with "type" key
            op_type_str = op.get("type", "") if isinstance(op, dict) else op
            op_type = operator_svg_mapping.get(op_type_str, op_type_str)
            op_svg_path = find_svg_icon(op_type)
            if not op_svg_path:
                op_svg_path = find_svg_icon(operator_svg_mapping["default"])
            if op_svg_path:
                icon_filename = os.path.basename(op_svg_path)
                logger.info(f"   📌 Using icon '{icon_filename}' for operator '{op_type}'")
            op_svg_content = read_svg_content(op_svg_path) if op_svg_path else None
            
            elements.append({
                "id": f"operator_{i}",
                "type": "icon",
                "svg_content": op_svg_content,
                "x": op["planned_x"],
                "y": op["planned_y"],
                "w": OPERATOR_SIZE,
                "h": OPERATOR_SIZE,
                "label": op_type
            })
        
        # Create equals sign
        equals_svg_path = find_svg_icon("equals")
        if equals_svg_path:
            icon_filename = os.path.basename(equals_svg_path)
            logger.info(f"   📌 Using icon '{icon_filename}' for equals sign")
        equals_svg_content = read_svg_content(equals_svg_path) if equals_svg_path else None
        
        elements.append({
            "id": "equals",
            "type": "icon",
            "svg_content": equals_svg_content,
            "x": eq_x,
            "y": eq_y,
            "w": 30,
            "h": 30,
            "label": "equals"
        })
        
        # Create question mark
        question_svg_path = find_svg_icon("question")
        if question_svg_path:
            icon_filename = os.path.basename(question_svg_path)
            logger.info(f"   📌 Using icon '{icon_filename}' for question mark")
        question_svg_content = read_svg_content(question_svg_path) if question_svg_path else None
        
        elements.append({
            "id": "question",
            "type": "icon",
            "svg_content": question_svg_content,
            "x": qmark_x,
            "y": qmark_y,
            "w": 60,
            "h": 60,
            "label": "question"
        })
        
        logger.info(f"✅ Generated {len(elements)} formal visual elements")
        return elements
        
    except Exception as e:
        logger.error(f"❌ Error generating formal visual elements: {str(e)}", exc_info=True)
        raise

