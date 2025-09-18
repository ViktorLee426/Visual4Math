# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Cross-Origin Resource Sharing

from app.api import router as api_router
#create FastAPI app instance, this is the core backend server
# sets up the web app that will handle all API requests and responses
app = FastAPI(
    title="Visual4Math Backend",
    description="API for Visual4Math user study experiment - includes chat, image generation, and research data collection endpoints",
    version="1.0.0",
    docs_url="/docs",  # Swagger UI at /docs
    redoc_url="/redoc"  # ReDoc at /redoc
)

# Allow frontend to connect (adjust if hosted separately)
# not actually connecting them, but allow them to communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # adjust for frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)
# connects all API routes like /chat, /image

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
