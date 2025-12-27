#!/bin/bash
# Start Frontend Development Server - Fast startup
cd "$(dirname "$0")/frontend"

# Start server (assumes dependencies installed - run npm install manually if needed)
echo "🚀 Starting frontend on http://localhost:5173"
npm run dev

