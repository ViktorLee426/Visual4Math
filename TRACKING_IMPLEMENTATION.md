# Tracking System Implementation

## Overview
This document describes the user authentication and tracking system implemented for the Visual4Math user study. The system tracks user sessions, tool usage, generated images, and evaluation responses.

## Database Schema

The system uses SQLite database (`visual4math.db`) with the following tables:

1. **user_sessions**: Tracks user sessions (start/end time, completion status)
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

Users must enter their user ID on the Welcome page to proceed. Authentication is handled via `/tracking/auth` endpoint.

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

All tracking endpoints are under `/tracking`:

- `POST /tracking/auth` - Authenticate user and create session
- `POST /tracking/session/end` - End session
- `POST /tracking/tool-a/image` - Submit Tool A generated image
- `POST /tracking/tool-b/layout` - Submit Tool B layout screenshot
- `POST /tracking/tool-b/image` - Submit Tool B generated image
- `POST /tracking/tool-c/canvas` - Submit Tool C canvas state
- `POST /tracking/tool-c/image` - Submit Tool C saved image
- `POST /tracking/evaluation` - Submit evaluation response

## Database Location

The SQLite database file (`visual4math.db`) is stored in the `backend/` directory. This works for:
- **Local development**: Database file is accessible directly
- **Container deployment**: Database file persists in the container's filesystem

## Cloud Deployment Considerations

### Option 1: Export Database Manually
1. After the study, copy `backend/visual4math.db` from the container
2. Use SQLite tools to analyze the data
3. Export to CSV/JSON for analysis

### Option 2: Use Cloud Database (Recommended for Production)
For production deployment, consider migrating to PostgreSQL or MySQL:

1. **Update `backend/app/database/db.py`**:
   ```python
   # Change from SQLite to PostgreSQL
   DB_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@host:5432/dbname")
   engine = create_engine(DB_URL)
   ```

2. **Update `requirements.txt`**:
   ```
   psycopg2-binary>=2.9.0  # For PostgreSQL
   # OR
   mysql-connector-python>=8.0.0  # For MySQL
   ```

3. **Set environment variable**:
   ```bash
   export DATABASE_URL="postgresql://user:password@host:5432/visual4math"
   ```

### Option 3: Database Backup Script
Create a script to periodically backup the SQLite database:

```python
# backend/scripts/backup_db.py
import shutil
from datetime import datetime
import os

def backup_database():
    db_path = "visual4math.db"
    backup_dir = "backups"
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{backup_dir}/visual4math_{timestamp}.db"
    
    shutil.copy2(db_path, backup_path)
    print(f"Database backed up to {backup_path}")

if __name__ == "__main__":
    backup_database()
```

## Data Analysis

### Query Examples

**Get all sessions:**
```sql
SELECT * FROM user_sessions ORDER BY start_time DESC;
```

**Get images generated per tool:**
```sql
-- Tool A
SELECT COUNT(*) FROM tool_a_generated_images WHERE is_final = 1;

-- Tool B
SELECT COUNT(*) FROM tool_b_generated_images WHERE is_final = 1;

-- Tool C
SELECT COUNT(*) FROM tool_c_generated_images WHERE is_final = 1;
```

**Get evaluation responses:**
```sql
SELECT tool, question, AVG(answer) as avg_rating, COUNT(*) as responses
FROM evaluation_responses
GROUP BY tool, question;
```

**Export to CSV:**
```bash
sqlite3 visual4math.db -header -csv "SELECT * FROM user_sessions" > sessions.csv
sqlite3 visual4math.db -header -csv "SELECT * FROM evaluation_responses" > evaluations.csv
```

## Testing

To test the tracking system:

1. Start backend: `cd backend && python main.py`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to welcome page
4. Enter test user ID: `visual4mathtest1`
5. Complete a task and generate images
6. Submit evaluation responses
7. Check database: `sqlite3 backend/visual4math.db "SELECT * FROM user_sessions;"`

## Notes

- All tracking calls are non-blocking (errors are logged but don't interrupt user flow)
- Session ID is stored in `sessionStorage` (cleared when browser closes)
- Images are stored as URLs (base64 data URIs for Tool C snapshots)
- Database is initialized automatically on backend startup

