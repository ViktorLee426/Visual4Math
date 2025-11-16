# backend/app/api/routes/parse.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.clients.openai_client import client
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class ParseRequest(BaseModel):
    problem_text: str

class LayoutItem(BaseModel):
    type: str  # "box" or "text"
    label: str
    count: int | None = None
    x: int
    y: int
    w: int
    h: int
    color: str = "#ffffff"

class ParseResponse(BaseModel):
    layout: list[LayoutItem]

@router.post("/parse-mwp", response_model=ParseResponse)
async def parse_math_word_problem(data: ParseRequest):
    """
    Parse a math word problem and generate layout suggestions.
    Returns a list of layout items with positions and properties.
    """
    try:
        logger.info(f"🔍 Parsing math word problem: {data.problem_text[:100]}...")
        
        prompt = f"""Parse this math word problem and generate a layout specification for visual representation.

Problem: {data.problem_text}

Generate a JSON array of layout items. Each item should represent an object or element mentioned in the problem.

For each item, provide:
- type: "box" (for objects like balls, bags, etc.) or "text" (for labels)
- label: the name/description (e.g., "basketball", "bag", "total")
- count: the number if specified (e.g., 10, 3), or null
- x, y: starting position (0-600 range)
- w, h: width and height (suggest 120-160 for boxes, 100-200 for text)
- color: hex color (default "#ffffff")

Arrange items in a logical layout. If objects are related (e.g., balls inside a bag), position them appropriately.
Keep items spaced out so they don't overlap.

Return ONLY valid JSON array format, no markdown, no explanation:
[
  {{"type": "box", "label": "basketball", "count": 10, "x": 100, "y": 100, "w": 140, "h": 90, "color": "#ffffff"}},
  {{"type": "box", "label": "bag", "count": null, "x": 300, "y": 100, "w": 160, "h": 120, "color": "#ffffff"}}
]
"""
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that parses math word problems and generates layout specifications in JSON format."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        content = response.choices[0].message.content.strip()
        logger.info(f"📦 Raw response: {content[:200]}...")
        
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        import json
        layout_data = json.loads(content)
        
        # Validate and convert to LayoutItem format
        layout_items = []
        for item in layout_data:
            layout_items.append(LayoutItem(
                type=item.get("type", "box"),
                label=item.get("label", "object"),
                count=item.get("count"),
                x=item.get("x", 100),
                y=item.get("y", 100),
                w=item.get("w", 140),
                h=item.get("h", 90),
                color=item.get("color", "#ffffff")
            ))
        
        logger.info(f"✅ Parsed {len(layout_items)} layout items")
        return ParseResponse(layout=layout_items)
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON parsing error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response as JSON: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Parse error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

