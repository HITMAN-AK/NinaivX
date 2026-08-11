from langchain_core.messages import SystemMessage
from app.services.llm_service import get_llm
from app.core.config import settings
from app.agents.state import AgentState
from app.agents.prompts import get_companion_persona_prompt
from app.agents.tools import companion_tools
from app.db.database import SessionLocal
from app.db.models import Persona

def companion_agent_node(state: AgentState):
    """
    The Actor playing the living, supportive Companion Persona.
    Fetches the exact character details directly from the DB and uses your custom prompt!

    Unlike the Deceased agent, this one is "web-connected": it can call the
    web_search tool. If Claude decides it needs live info, it emits a tool call,
    the graph runs the tool, then loops back here to give the final answer.
    """
    print("🤝 Companion Agent: Building persona and thinking...")
    
    persona_id = state.get("persona_id")
    
    # 1. Instantly fetch exact details directly from the database using Python
    db = SessionLocal()
    try:
        persona = db.query(Persona).filter(Persona.id == persona_id).first()
        if not persona:
            raise ValueError(f"SYSTEM ERROR: Persona {persona_id} not found.")
            
        user = persona.owner
        
        # Check if they have spoken before to get the memory checkpoint
        if persona.conversation:
            current_summary = persona.conversation.current_summary
        else:
            current_summary = "This is the very first time you are speaking together."
        
        # 2. Build the perfect, character-locked system prompt using your existing function!
        # Notice we do NOT pass cause_of_death here, because this is a living companion.
        system_instruction = get_companion_persona_prompt(
            user_name=user.name,
            user_age=user.age,
            user_language=persona.language or user.language,
            persona_name=persona.name,
            persona_age=persona.age,
            persona_gender=persona.gender,
            relationship_with_user=persona.relationship_with_user,
            personality_text=persona.personality_text,
            current_summary=current_summary,
            user_nickname=persona.user_nickname
        )
    finally:
        db.close()
        
    # 3. Get our Claude connection WITH the web-search tool bound to it.
    #    This is what makes the Companion "web-connected" (vs the air-gapped Deceased agent).
    # VOICE CALL MODE: on a live call, use the fast model and keep replies short & spoken.
    if state.get("brief"):
        system_instruction += (
            "\n\n--- VOICE CALL MODE ---\n"
            "You are on a live voice phone call. Reply briefly and naturally — usually 1 to 2 short "
            "spoken sentences. Be warm but concise; do not give long explanations or lists."
        )
        llm = get_llm(model_id=settings.BEDROCK_VOICE_MODEL_ID, max_tokens=300).bind_tools(companion_tools)
    else:
        llm = get_llm().bind_tools(companion_tools)

    # 4. Combine your perfect system instruction with the running chat history
    messages = [SystemMessage(content=system_instruction)] + state["messages"]
    
    # 5. Let Claude think and get the response instantly
    response = llm.invoke(messages)
    
    # 6. Write the result back to the clipboard
    return {"messages": [response]}