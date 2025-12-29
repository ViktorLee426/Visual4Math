# Database Information

## Database Location
The database file is stored at: **`backend/visual4math.db`**

This is a SQLite database file that will be created automatically when the backend server starts.

## What Gets Stored

When you use a test ID (e.g., `visual4mathtest1`) to start a task, the following data is tracked:

### 1. **Session Information** (`user_sessions` table)
- User ID
- Start time (when you enter your ID)
- End time (when you complete the study)
- Completion status

### 2. **Tool A (Conversational Interface)** (`tool_a_generated_images` table)
- All generated images (with URLs/timestamps)
- User text input that generated each image
- Operation type (addition, subtraction, multiplication, division)
- Whether each image is marked as "final" for an operation

### 3. **Tool B (Layout-Based)** 
- **Layout screenshots** (`tool_b_layout_screenshots` table): Canvas layout before image generation
- **Generated images** (`tool_b_generated_images` table): Final images with timestamps
- Operation type
- Whether each image is marked as "final"

### 4. **Tool C (Free-Form Canvas)**
- **Canvas states** (`tool_c_canvas_states` table): Saved canvas configurations (elements, text)
- **Saved images** (`tool_c_generated_images` table): Images saved from canvas
- Operation type
- Whether each image is marked as "final"

### 5. **Evaluation Responses** (`evaluation_responses` table)
- Tool name (tool_a, tool_b, tool_c)
- Question ID and question text
- Your Likert scale answer (1-7)
- Timestamp

## How to Check Your Data

### Option 1: Using SQLite Command Line
```bash
cd backend
sqlite3 visual4math.db

# View all sessions
SELECT * FROM user_sessions;

# View your test session
SELECT * FROM user_sessions WHERE user_id = 'visual4mathtest1';

# View all images generated in Tool A
SELECT user_id, image_url, operation, is_final, timestamp FROM tool_a_generated_images;

# View evaluation responses
SELECT tool, question, answer, timestamp FROM evaluation_responses WHERE user_id = 'visual4mathtest1';

# Exit
.exit
```

### Option 2: Export to CSV
```bash
cd backend
sqlite3 visual4math.db -header -csv "SELECT * FROM user_sessions" > sessions.csv
sqlite3 visual4math.db -header -csv "SELECT * FROM tool_a_generated_images" > tool_a_images.csv
sqlite3 visual4math.db -header -csv "SELECT * FROM evaluation_responses" > evaluations.csv
```

### Option 3: Using Python (in backend venv)
```python
from app.database.db import SessionLocal
from app.models.tracking import UserSession, ToolAGeneratedImage, EvaluationResponse

db = SessionLocal()

# Get your session
session = db.query(UserSession).filter(UserSession.user_id == 'visual4mathtest1').first()
print(f"Session started: {session.start_time}")

# Get your images
images = db.query(ToolAGeneratedImage).filter(ToolAGeneratedImage.user_id == 'visual4mathtest1').all()
print(f"Generated {len(images)} images in Tool A")

# Get your evaluations
evals = db.query(EvaluationResponse).filter(EvaluationResponse.user_id == 'visual4mathtest1').all()
print(f"Submitted {len(evals)} evaluation responses")

db.close()
```

## Database Initialization

The database is automatically initialized when the backend server starts:
- Tables are created automatically if they don't exist
- No manual setup required
- Database file is created at `backend/visual4math.db`

## Testing

To test the tracking system:

1. **Start the backend server** (this initializes the database):
   ```bash
   cd backend
   source venv/bin/activate
   python main.py
   ```

2. **Start the frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Use a test ID**: Enter `visual4mathtest1` on the welcome page

4. **Complete some tasks**: Generate images, mark them as final, submit evaluations

5. **Check the database**:
   ```bash
   sqlite3 backend/visual4math.db "SELECT * FROM user_sessions WHERE user_id = 'visual4mathtest1';"
   ```

## Important Notes

- **All tracking is automatic** - No need to manually save anything
- **Data persists** - Database file remains even after closing the app
- **Non-blocking** - Tracking errors won't interrupt your workflow (they're logged but don't stop the app)
- **Session-based** - Each login creates a new session with a unique session_id
- **Images stored as URLs** - Base64 data URIs for Tool C snapshots, server URLs for Tool A/B

## Backup

To backup your database:
```bash
cp backend/visual4math.db backend/visual4math_backup_$(date +%Y%m%d_%H%M%S).db
```

