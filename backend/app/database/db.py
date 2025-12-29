# backend/app/database/db.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import os
from pathlib import Path

# Database file path - works locally and in containers
DB_DIR = Path(__file__).parent.parent.parent
DB_PATH = DB_DIR / "visual4math.db"
DB_URL = f"sqlite:///{DB_PATH}"

# Create engine with connection pooling
# StaticPool allows multiple threads/processes to share the same connection
# This is important for SQLite in web applications
engine = create_engine(
    DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False  # Set to True for SQL query logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Session:
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database tables"""
    from app.models.tracking import Base
    Base.metadata.create_all(bind=engine)
    print(f"✅ Database initialized at {DB_PATH}")

