import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from dotenv import load_dotenv
from app.api import routes

# --- THE CRUCIAL FIX ---
# You MUST import your models here so SQLAlchemy knows what tables to create!
from app.db.models import User, Persona, Conversation

load_dotenv()

# NOW it will see the imported models and successfully create the tables in Supabase!
Base.metadata.create_all(bind=engine)

def create_app() -> FastAPI:
    app = FastAPI(
        title=os.getenv("PROJECT_NAME", "NinaivX API"),
        version=os.getenv("VERSION", "1.0.0"),
        description="Backend API for NinaivX - Multi-Persona Voice AI"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], 
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Production, authenticated API (prefix /api).
    app.include_router(routes.router)

    @app.get("/")
    async def root():
        return {
            "status": "online", 
            "message": "Welcome to the NinaivX API!",
        }

    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    return app

app = create_app()