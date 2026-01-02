# Visual4Math

A web-based platform for creating educational visualizations of mathematical word problems, designed for primary-level mathematics education. This application supports a user study comparing three different approaches to visual generation for educational content.

## Overview

Visual4Math enables teachers to create visual representations of mathematical problems through three distinct interactive tools. Each tool implements a different interaction paradigm, allowing researchers to study the effectiveness of various approaches to educational visual generation.

## Features

### Three Interactive Tools

**Tool 1: Conversational Interface**
- Natural language interaction with AI assistant
- DALL-E image generation based on conversation
- Image editing with brush tool
- Context-aware conversation history

**Tool 2: Layout-Based Interface**
- Drag-and-drop layout editor
- Spatial relationship definitions (inside, next-to, on-top-of)
- Image generation from layout descriptions
- Generation history tracking

**Tool 3: Panel-Based Interface**
- Canvas editor with icon library
- Mathematical symbols and objects
- Drag-and-drop placement
- Zoom, pan, undo/redo functionality
- Snapshot capture

## Technology Stack

### Frontend
- React 19 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router DOM for navigation
- KaTeX for mathematical notation rendering

### Backend
- FastAPI (Python 3.13)
- OpenAI API (GPT-4 Vision, DALL-E)
- SQLite database (SQLAlchemy ORM)
- Pillow for image processing
- Uvicorn ASGI server

### Infrastructure
- Docker containerization
- Docker Compose for orchestration
- nginx-proxy with Let's Encrypt SSL

## Getting Started

### Prerequisites

- Python 3.13
- Node.js 20.x
- OpenAI API key
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Visual4Math
```

2. Set up the backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
# Create .env file in backend directory
echo "OPENAI_API_KEY=your_api_key_here" > .env
```

4. Set up the frontend:
```bash
cd frontend
npm install
```

### Running Locally

Start the backend server:
```bash
cd backend
uvicorn main:app --reload
```

Start the frontend development server:
```bash
cd frontend
npm run dev
```

Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Project Structure

```
Visual4Math/
├── backend/                 # FastAPI backend application
│   ├── app/
│   │   ├── api/            # API route handlers
│   │   ├── services/       # Business logic services
│   │   ├── models/         # Database models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── clients/        # External API clients
│   │   └── database/       # Database configuration
│   ├── main.py             # Application entry point
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   ├── services/      # API client services
│   │   ├── contexts/      # React contexts
│   │   ├── utils/         # Utility functions
│   │   └── data/          # Static data files
│   ├── package.json       # Node.js dependencies
│   └── vite.config.ts     # Vite configuration
│
├── docs/                   # Documentation
│   ├── DATABASE.md        # Database and tracking documentation
│   ├── DEPLOYMENT.md      # Deployment guide
│   └── EXTERNAL_DIRECTORIES.md  # External dependencies reference
│
├── docker-compose.yml     # Docker Compose configuration
├── Dockerfile             # Multi-stage Docker build
└── README.md              # This file
```

## User Study Flow

1. **Welcome Page**: Participants enter their participant ID
2. **Instructions Page**: Overview of the assigned tool
3. **Tool Pages**: Participants create visuals using one of the three tools
4. **Evaluation Pages**: Participants evaluate their experience
5. **Final Survey**: Comprehensive feedback collection

## Data Collection

The application tracks:
- User sessions (start/end times, completion status)
- Generated images per tool
- User interactions and inputs
- Evaluation responses (Likert scale)
- Canvas states and layout configurations

All data is stored in SQLite database (`backend/visual4math.db`). See [docs/DATABASE.md](docs/DATABASE.md) for detailed information about the database schema and data access.

## API Documentation

Interactive API documentation is available at `/docs` when the backend server is running. Key endpoints include:

- `/api/chat` - Chat interface with AI
- `/api/images/generate` - Image generation
- `/api/images/modify` - Image modification
- `/api/tracking/*` - User tracking endpoints
- `/api/research/*` - Research data endpoints

## Deployment

For production deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Quick Docker Deployment

```bash
# Build image
docker build --platform linux/amd64 -t visual4math:latest .

# Run with docker-compose
docker compose up -d

# View logs
docker compose logs -f
```

## Environment Variables

### Backend (.env)
- `OPENAI_API_KEY` (required): OpenAI API key
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)
- `DATA_FILE_PATH`: Path to data file (default: `/app/data/simple_data.json`)
- `CACHE_DIR`: Image cache directory (default: `/app/cached_images`)

## Development

### Code Style
- Python: Follow PEP 8 conventions
- TypeScript: ESLint configuration included
- Use type hints in Python and TypeScript

### Testing
```bash
# Backend linting
cd backend
python -m flake8 .  # If configured

# Frontend linting
cd frontend
npm run lint
npm run build
```

## Research Context

This application is part of a research study conducted at ETH PEACH LAB investigating different approaches to visual generation for educational content. The three tools represent distinct interaction paradigms:

1. **Conversational**: Natural language interaction
2. **Layout-based**: Structured spatial arrangement
3. **Panel-based**: Direct manipulation interface

## License

This project is part of research conducted at ETH PEACH LAB.

## Citation

If you use this software in your research, please cite:

```
Visual4Math: A Platform for Educational Visual Generation
[Your citation details]
```

## Contact

For questions or issues related to this research project, please contact the research team at ETH PEACH LAB.
