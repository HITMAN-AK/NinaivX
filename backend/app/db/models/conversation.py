from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class Conversation(Base):
    """
    Since we are NOT saving individual chat messages to save space, 
    this table stores the running 'checkpoint summary' of the conversation.
    LangGraph will read this summary to remember what happened last time.
    """
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    
    # Connects exactly to ONE persona
    persona_id = Column(String, ForeignKey("personas.id"), unique=True, nullable=False)
    
    # This is the "Checkpoint". Every time they finish talking, 
    # the AI will overwrite this with a new summary of the relationship.
    current_summary = Column(Text, default="This is the beginning of the conversation.")
    
    # The LangGraph Thread ID (needed so LangGraph knows which state to load)
    langgraph_thread_id = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # This acts as the "Last Spoken" timestamp
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    persona = relationship("Persona", back_populates="conversation")