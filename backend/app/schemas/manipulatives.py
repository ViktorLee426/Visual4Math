# backend/app/schemas/manipulatives.py
from pydantic import BaseModel
from typing import List, Optional

class ManipulativeElement(BaseModel):
    id: str
    type: str  # "icon" or "text"
    svg_content: Optional[str] = None
    x: int
    y: int
    w: int
    h: int
    label: str
    count: Optional[int] = None
    container_name: Optional[str] = None
    container_type: Optional[str] = None
    entity_name: Optional[str] = None

class ManipulativesRequest(BaseModel):
    problem_text: str

class ManipulativesResponse(BaseModel):
    elements: List[ManipulativeElement]
    visual_language: str
    parsed: Optional[dict] = None

