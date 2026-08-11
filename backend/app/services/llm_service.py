import boto3
from sqlalchemy.orm import Session
from langchain_aws import ChatBedrock
from langchain_core.messages import HumanMessage

from app.db.models import Conversation
from app.core.config import settings

def get_bedrock_client():
    return boto3.client(
        service_name="bedrock-runtime",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )

def get_llm(model_id: str | None = None, max_tokens: int = 1000):
    client = get_bedrock_client()
    return ChatBedrock(
        client=client,
        model_id=model_id or settings.BEDROCK_MODEL_ID,
        model_kwargs={"temperature": 0.7, "max_tokens": max_tokens}
    )

def update_conversation_checkpoint(db: Session, conversation: Conversation, user_message: str, ai_response: str):
    """
    Takes the old memory summary, adds the new chat, and asks Claude to write 
    a highly compressed, updated summary. Then saves it to the database!
    """
    llm = get_llm()
    
    # Prompt Claude to update the memory
    summarizer_prompt = f"""
You are the memory manager for an AI companion. 
Here is the previous summary of their relationship:
"{conversation.current_summary}"

Just now, the user said: "{user_message}"
And the AI replied: "{ai_response}"

Write a brief, updated summary of their relationship and conversation history. 
Keep it concise but retain important emotional details, facts, and the current topic.
"""
    
    # Get the new summary from Claude
    new_summary_response = llm.invoke([HumanMessage(content=summarizer_prompt)])
    new_summary = new_summary_response.content
    
    # --- THIS IS WHERE THE MAGIC HAPPENS (Saving to Database) ---
    conversation.current_summary = new_summary
    db.commit()
    db.refresh(conversation)