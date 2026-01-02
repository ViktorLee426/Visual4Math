# Database and Tracking System

## Overview

Visual4Math uses SQLite to track user sessions, tool interactions, generated images, and evaluation responses for the user study.

## Database Schema

The SQLite database (`backend/visual4math.db`) contains the following tables:

1. **user_sessions**: User session tracking (start/end time, completion status)
2. **tool_a_generated_images**: Images generated in Tool A (conversational interface)
3. **tool_b_layout_screenshots**: Layout screenshots captured before image generation in Tool B
4. **tool_b_generated_images**: Images generated in Tool B
5. **tool_c_canvas_states**: Canvas states saved in Tool C
6. **tool_c_generated_images**: Images saved in Tool C
7. **evaluation_responses**: Evaluation answers (Likert scale 1-7) for each tool

## User Authentication

### Allowed User IDs
- **Study participants**: `visual4mathuserstudy1` through `visual4mathuserstudy24`
- **Test users**: `visual4mathtest1` through `visual4mathtest12`

Authentication is handled via `/api/tracking/auth` endpoint.

## Tracked Data

### Session Data
- User ID
- Start time (when user enters ID)
- End time (when user completes study)
- Completion status

### Tool A (Conversational Interface)
- Generated images with timestamps
- User text input that generated each image
- Operation type (addition, subtraction, multiplication, division)
- Final image selection per operation

### Tool B (Layout-Based)
- Layout screenshots (before image generation)
- Generated images with timestamps
- Operation type
- Final image selection per operation

### Tool C (Free-Form Canvas)
- Canvas states (elements, text input)
- Saved images with timestamps
- Operation type
- Final image selection per operation

### Evaluation Responses
- Tool name (tool_a, tool_b, tool_c)
- Task/question ID
- Question text
- Likert scale answer (1-7)
- Timestamp

## API Endpoints

All tracking endpoints are under `/api/tracking`:

- `POST /api/tracking/auth` - Authenticate user and create session
- `POST /api/tracking/session/end` - End session
- `POST /api/tracking/tool-a/image` - Submit Tool A generated image
- `POST /api/tracking/tool-b/layout` - Submit Tool B layout screenshot
- `POST /api/tracking/tool-b/image` - Submit Tool B generated image
- `POST /api/tracking/tool-c/canvas` - Submit Tool C canvas state
- `POST /api/tracking/tool-c/image` - Submit Tool C saved image
- `POST /api/tracking/evaluation` - Submit evaluation response

## Database Access

### Using SQLite Command Line
```bash
cd backend
sqlite3 visual4math.db

# View all sessions
SELECT * FROM user_sessions;

# View images generated in Tool A
SELECT user_id, image_url, operation, is_final, timestamp FROM tool_a_generated_images;

# View evaluation responses
SELECT tool, question, answer, timestamp FROM evaluation_responses WHERE user_id = 'visual4mathtest1';

.exit
```

### Export to CSV
```bash
cd backend
sqlite3 visual4math.db -header -csv "SELECT * FROM user_sessions" > sessions.csv
sqlite3 visual4math.db -header -csv "SELECT * FROM tool_a_generated_images" > tool_a_images.csv
sqlite3 visual4math.db -header -csv "SELECT * FROM evaluation_responses" > evaluations.csv
```

### Using Python
```python
from app.database.db import SessionLocal
from app.models.tracking import UserSession, ToolAGeneratedImage, EvaluationResponse

db = SessionLocal()
session = db.query(UserSession).filter(UserSession.user_id == 'visual4mathtest1').first()
images = db.query(ToolAGeneratedImage).filter(ToolAGeneratedImage.user_id == 'visual4mathtest1').all()
db.close()
```

## Database Initialization

The database is automatically initialized when the backend server starts. Tables are created automatically if they don't exist. No manual setup is required.

## Data Analysis Queries

```sql
-- Get all sessions
SELECT * FROM user_sessions ORDER BY start_time DESC;

-- Count final images per tool
SELECT COUNT(*) FROM tool_a_generated_images WHERE is_final = 1;
SELECT COUNT(*) FROM tool_b_generated_images WHERE is_final = 1;
SELECT COUNT(*) FROM tool_c_generated_images WHERE is_final = 1;

-- Average evaluation ratings per tool
SELECT tool, question, AVG(answer) as avg_rating, COUNT(*) as responses
FROM evaluation_responses
GROUP BY tool, question;
```

## Notes

- All tracking calls are non-blocking (errors are logged but don't interrupt user flow)
- Session ID is stored in browser `sessionStorage`
- Images are stored as URLs (base64 data URIs for Tool C snapshots, server URLs for Tool A/B)
- Database file persists in `backend/visual4math.db`

## Backup

To backup the database:
```bash
cp backend/visual4math.db backend/visual4math_backup_$(date +%Y%m%d_%H%M%S).db
```

