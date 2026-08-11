from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    # We removed the auto-generator. 
    # Now, when a user signs up on the frontend, Supabase creates an Auth UUID.
    # We will pass that exact Supabase UUID here so they match perfectly!
    id = Column(String, primary_key=True, index=True)
    
    # MVP Requirements (Notice: hashed_password is GONE - Supabase owns credentials.)
    # No username: users are identified by email (in Supabase Auth) and this id.
    name = Column(String, nullable=False)
    age = Column(Integer)
    language = Column(String, default="English") # e.g., "English", "Tamil"

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships: A user can have multiple Personas
    personas = relationship("Persona", back_populates="owner", cascade="all, delete-orphan")