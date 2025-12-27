#!/bin/bash
# Start Backend Server - Fast startup, minimal checks

# Get project root directory (where .venv is located) BEFORE changing directories
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PATH="$SCRIPT_DIR/.venv"

# Now change to backend directory
cd "$SCRIPT_DIR/backend"

if [ -d "$VENV_PATH" ]; then
    echo "✅ Activating virtual environment: $VENV_PATH"
    source "$VENV_PATH/bin/activate"
else
    echo "❌ Error: Virtual environment not found at $VENV_PATH"
    echo "   Please create it with: python -m venv .venv"
    exit 1
fi

# Verify FastAPI is installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "❌ Error: FastAPI not found in virtual environment"
    echo "   Please install dependencies: pip install -r requirements.txt"
    exit 1
fi

# Start server
echo "🚀 Starting backend on http://localhost:8000"
uvicorn main:app --reload --host 0.0.0.0 --port 8000

