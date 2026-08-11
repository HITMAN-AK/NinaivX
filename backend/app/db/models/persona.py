from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid

from app.db.database import Base

# Define the two types of Personas
class PersonaType(str, enum.Enum):
    COMPANION = "companion"
    DECEASED = "deceased"

class Persona(Base):
    __tablename__ = "personas"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Core Details
    persona_type = Column(Enum(PersonaType), nullable=False)
    name = Column(String, nullable=False)
    age = Column(Integer)
    gender = Column(String)
    relationship_with_user = Column(String) # e.g., "Grandfather", "Friend"
    
    # The "Personality" converted from the user's voice story
    personality_text = Column(Text, nullable=False) 
    
    # Specific to DECEASED personas
    cause_of_death = Column(String, nullable=True) 

    # Conversation language for THIS persona (e.g. "English", "Tamil").
    # Falls back to the owner's language if not set.
    language = Column(String, nullable=True)

    # What this persona affectionately calls the user (e.g. "beta", "kanna", "my boy").
    # Falls back to the user's name if not set.
    user_nickname = Column(String, nullable=True)

    # Specific to ElevenLabs (crucial for your Voice feature)
    elevenlabs_voice_id = Column(String, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="personas")
    conversation = relationship("Conversation", back_populates="persona", uselist=False, cascade="all, delete-orphan")