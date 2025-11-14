# Visual4Math - Educational Visual Generation Tool

A web application designed for primary-level mathematics education, enabling teachers to create educational visuals through interactive AI-powered tools. This application is part of a user study comparing different approaches to visual generation for educational purposes.

## 🎯 Project Overview

Visual4Math provides three distinct interactive tools that help teachers create visual representations of mathematical word problems. Each tool offers a different approach to visual generation, allowing researchers to study which methods are most effective for educational content creation.

## 🛠️ The Three Tools

### Tool 1: Conversational Interface
A chat-based AI assistant that helps create mathematical visualizations through natural language conversation. Teachers describe what they want, and the AI generates images accordingly. Features include:
- Natural language interaction
- Image generation with DALL-E
- Image editing capabilities (brush tool for modifications)
- Conversation history and context awareness

### Tool 2: Layout-Based Interface
A drag-and-drop layout editor where teachers can arrange visual elements and generate images based on spatial relationships. Features include:
- Visual layout canvas with boxes and text elements
- Spatial relationship definitions (inside, next-to, on-top-of)
- Image generation from layout descriptions
- Generation history tracking

### Tool 3: Panel-Based Interface
A canvas-based editor with a library of icons and text elements that teachers can place and arrange manually. Features include:
- Icon library with mathematical symbols and objects
- Text elements for labels and descriptions
- Drag-and-drop placement
- Zoom and pan controls
- Undo/redo functionality
- Snapshot capture

## 🏗️ Architecture

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **Math Rendering**: KaTeX for mathematical notation

### Backend
- **Framework**: FastAPI (Python 3.13)
- **AI Service**: OpenAI API (GPT-4 Vision, DALL-E)
- **Database**: SQLite (via SQLAlchemy)
- **Image Processing**: Pillow
- **Server**: Uvicorn

### Infrastructure
- **Containerization**: Docker
- **Deployment**: Docker Compose
- **Reverse Proxy**: nginx-proxy with Let's Encrypt SSL

## 📋 Prerequisites

- **Python**: 3.13
- **Node.js**: 20.x
- **Docker**: For containerized deployment
- **OpenAI API Key**: Required for AI features

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Visual4Math
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Create environment file**
   ```bash
   # In backend directory
   echo "OPENAI_API_KEY=your_api_key_here" > .env
   ```

4. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

5. **Run the application**
   ```bash
   # Terminal 1: Start backend
   cd backend
   uvicorn main:app --reload

   # Terminal 2: Start frontend
   cd frontend
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## 📁 Project Structure

```
Visual4Math/
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── services/       # Business logic
│   │   ├── models/         # Database models
│   │   └── schemas/        # Pydantic schemas
│   ├── main.py             # Application entry point
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── services/      # API clients
│   │   └── utils/         # Utility functions
│   ├── package.json       # Node dependencies
│   └── vite.config.ts     # Vite configuration
│
├── docker-compose.yml     # Docker Compose configuration
├── Dockerfile             # Multi-stage Docker build
└── DEPLOYMENT.md          # Detailed deployment guide
```

## 🔧 Development Workflow

### User Study Flow

1. **Welcome Page**: Participants enter their participant ID
2. **Instructions Page**: Overview of the tool they'll be using
3. **Tool Pages**: Participants use one of the three tools to create visuals
4. **Final Survey**: Feedback collection

### Session Management

The application uses a session manager to track:
- Participant ID
- Current phase/tool
- Task progress
- Generated images and interactions

### Data Storage

- **Research Data**: Stored in `simple_data.json` (backend)
- **Image Cache**: Cached images stored in `cached_images/` directory
- **Database**: SQLite database for conversation history

## 🐳 Docker Deployment

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on:
- Building Docker images
- Deploying to ETH PEACH LAB server
- Configuring nginx-proxy
- Setting up SSL certificates
- Managing environment variables

### Quick Docker Commands

```bash
# Build image
docker build --platform linux/amd64 -t visual4math:latest .

# Run with docker-compose
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

## 🔑 Environment Variables

### Backend (.env file)
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `DATA_FILE_PATH`: Path to data file (default: `/app/data/simple_data.json`)
- `CACHE_DIR`: Image cache directory (default: `/app/cached_images`)
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)

### Frontend
Environment variables are configured in `vite.config.ts` for API endpoints.

## 📝 API Endpoints

### Chat API
- `POST /api/chat` - Send chat message and get AI response
- `POST /api/chat/stream` - Stream chat response with image generation

### Image API
- `POST /api/images/generate` - Generate image from prompt
- `POST /api/images/modify` - Modify existing image
- `GET /api/images/proxy` - Proxy image requests

### Research API
- `POST /api/research/register` - Register participant
- `GET /api/research/data` - Get research data

See `/docs` endpoint for interactive API documentation.

## 🧪 Testing

### Backend Testing
```bash
cd backend
python -m pytest  # If tests are added
```

### Frontend Testing
```bash
cd frontend
npm run lint      # Lint code
npm run build     # Build for production
```

## 📚 Key Features

- **Multimodal AI**: Text and image understanding using GPT-4 Vision
- **Image Generation**: DALL-E integration for creating educational visuals
- **Image Editing**: Brush tool for modifying generated images
- **Session Tracking**: Participant progress and interaction logging
- **Responsive Design**: Works on desktop and tablet devices
- **Math Rendering**: KaTeX for displaying mathematical notation

## 🔒 Security Notes

- API keys are stored in `.env` files (never commit to git)
- CORS is configured for specific allowed origins
- Image proxy endpoint prevents direct API key exposure
- Session data is stored locally in browser

## 📄 License

This project is part of research conducted at ETH PEACH LAB.

## 🤝 Contributing

This is a research project. For questions or issues, contact the research team.

## 📞 Support

For deployment issues, refer to [DEPLOYMENT.md](./DEPLOYMENT.md). For development questions, check the code comments and API documentation at `/docs` endpoint.
