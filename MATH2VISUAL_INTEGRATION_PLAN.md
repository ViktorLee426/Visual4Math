# Math2Visual Integration Plan for Tool3

## Overview

This document explains how to integrate the math2visual algorithm into Tool3 (Free Manipulation) to generate draggable SVG elements from math word problems.

## How Math2Visual Works

Math2Visual has **3 main steps**:

1. **Visual Language Generation** (`generate_visual_language_*.py`)
   - Input: Math word problem text
   - Output: Structured "visual language" description (JSON-like format)
   - Example: `"Group A: 4 basketballs, Group B: 6 basketballs, Operation: addition"`

2. **Formal Visual Generation** (`generate_visual_formal.py`)
   - Input: Visual language
   - Output: SVG with formal mathematical representation (grouped objects, operations)

3. **Intuitive Visual Generation** (`generate_visual_intuitive.py`)
   - Input: Visual language  
   - Output: SVG with intuitive representation (realistic objects, scenes)

## Adaptation Strategy for Tool3

### What We Need from Math2Visual

1. **Visual Language Generator**: To parse MWP → structured elements
2. **SVG Icon Dataset**: From Hugging Face (`svg_dataset/`)
3. **Element Mapping Logic**: Map visual language elements to SVG icons

### Integration Architecture

```
User Input (MWP) 
    ↓
Backend: Visual Language Generator (GPT-based, adapted from math2visual)
    ↓
Visual Language JSON: {groups: [{objects: [], count: N}], operations: []}
    ↓
Backend: Element Parser (extract manipulative elements)
    ↓
Frontend: Generate draggable SVG elements on canvas
```

## Implementation Steps

### Step 1: Download Math2Visual Dataset

**Command to download SVG dataset from Hugging Face:**

```bash
# Install huggingface_hub if not already installed
pip install huggingface_hub

# Download the SVG dataset
python -c "
from huggingface_hub import snapshot_download
import os

# Download the math2visual dataset
repo_id = 'eth-lre/math2visual'
local_dir = './math2visual_dataset'

# Download only the svg_dataset folder
snapshot_download(
    repo_id=repo_id,
    local_dir=local_dir,
    allow_patterns='svg_dataset/**',
    repo_type='dataset'
)

print(f'Dataset downloaded to {local_dir}/svg_dataset')
"
```

**What this does:**
- Downloads the `svg_dataset/` folder from the math2visual Hugging Face repository
- Contains SVG icons for various objects (basketballs, apples, bags, etc.)
- Saves to `./math2visual_dataset/svg_dataset/` locally

### Step 2: Backend - Visual Language Service

**File: `backend/app/services/math2visual_service.py`**

This service will:
- Generate visual language from MWP (using GPT, adapted from math2visual)
- Parse visual language into manipulative elements
- Map elements to SVG icons from the dataset

**Key Functions:**
1. `generate_visual_language(mwp_text: str) -> dict`
   - Uses GPT to generate structured visual language
   - Returns: `{groups: [{name, objects: [{type, count}], position}], operations: []}`

2. `parse_to_manipulatives(visual_lang: dict) -> List[ManipulativeElement]`
   - Converts visual language to draggable elements
   - Returns list of elements with: `{id, type, svg_path, x, y, count, label}`

3. `map_to_svg_icon(object_type: str) -> str`
   - Maps object types (e.g., "basketball") to SVG file paths
   - Uses the downloaded `svg_dataset/` folder

### Step 3: Backend API Endpoint

**File: `backend/app/api/routes/manipulatives.py`** (new)

**Endpoint:** `POST /api/manipulatives/generate`

**Request:**
```json
{
  "problem_text": "There are 10 basketballs total. 4 are in a blue bag, 6 are in a green bag."
}
```

**Response:**
```json
{
  "elements": [
    {
      "id": "elem_1",
      "type": "icon",
      "svg_content": "<svg>...</svg>",
      "x": 100,
      "y": 150,
      "w": 80,
      "h": 80,
      "label": "basketball",
      "count": 4,
      "group": "blue_bag"
    },
    ...
  ],
  "visual_language": "{groups: [...]}"
}
```

### Step 4: Frontend - Update Tool3PanelPage

**Changes to `frontend/src/pages/Tool3PanelPage.tsx`:**

1. **Replace `parseMWP` function** with API call:
   ```typescript
   const parseMWP = async (text: string) => {
     const response = await fetch('/api/manipulatives/generate', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ problem_text: text })
     });
     const data = await response.json();
     // Convert API elements to Elem[] format
     setElems(data.elements.map(e => ({
       id: e.id,
       kind: 'icon',
       x: e.x, y: e.y, w: e.w, h: e.h,
       svg: e.svg_content,
       label: e.label
     })));
   };
   ```

2. **Keep existing drag/drop/resize functionality** - no changes needed

3. **Update icon library** to load from math2visual dataset (optional, for manual selection)

### Step 5: SVG Icon Mapping

**File: `backend/app/services/svg_icon_mapper.py`**

Maps object types to SVG files:
- `basketball` → `svg_dataset/basketball.svg`
- `apple` → `svg_dataset/apple.svg`
- `bag` → `svg_dataset/bag.svg`
- etc.

**Fallback strategy:**
- If exact match not found, use closest match or default icon
- Cache SVG content in memory for performance

## File Structure After Integration

```
backend/
  app/
    services/
      math2visual_service.py      # NEW: Visual language generation
      svg_icon_mapper.py           # NEW: Map objects to SVG icons
    api/
      routes/
        manipulatives.py           # NEW: API endpoint for Tool3
math2visual_dataset/               # NEW: Downloaded dataset
  svg_dataset/
    basketball.svg
    apple.svg
    bag.svg
    ...
frontend/
  src/
    pages/
      Tool3PanelPage.tsx           # MODIFIED: Use new API
    services/
      manipulativesApi.ts          # NEW: Frontend API client
```

## Key Differences from Original Math2Visual

1. **We don't generate final SVG visuals** - we extract elements for manipulation
2. **We use GPT instead of fine-tuned model** (simpler, no model download needed)
3. **We return individual elements** instead of complete SVG scenes
4. **Users can drag/resize elements** - interactive manipulation

## Next Steps

1. **Download dataset** (run command above)
2. **Create backend services** (math2visual_service.py, svg_icon_mapper.py)
3. **Create API endpoint** (manipulatives.py)
4. **Update frontend** (Tool3PanelPage.tsx, manipulativesApi.ts)
5. **Test with sample problems**

## Example Visual Language Output

```json
{
  "groups": [
    {
      "name": "blue_bag",
      "type": "container",
      "objects": [
        {"type": "basketball", "count": 4}
      ],
      "position": {"x": 100, "y": 150}
    },
    {
      "name": "green_bag", 
      "type": "container",
      "objects": [
        {"type": "basketball", "count": 6}
      ],
      "position": {"x": 300, "y": 150}
    }
  ],
  "operation": {
    "type": "addition",
    "operands": [4, 6],
    "result": 10
  }
}
```

This gets converted to draggable elements:
- 4 basketball icons (grouped, draggable)
- 6 basketball icons (grouped, draggable)  
- 2 bag containers (draggable)
- Optional: operation symbols/text

