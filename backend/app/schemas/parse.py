# backend/app/schemas/parse.py
from pydantic import BaseModel
from typing import List, Optional, Literal

class ParseRequest(BaseModel):
    problem_text: str

class LayoutItem(BaseModel):
    type: Literal["box", "text"]
    label: str
    count: Optional[int] = None
    x: int
    y: int
    w: int
    h: int
    color: str

class ParseResponse(BaseModel):
    layout: List[LayoutItem]

