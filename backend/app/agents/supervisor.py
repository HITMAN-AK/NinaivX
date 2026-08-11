from app.agents.state import AgentState

def route_to_agent(state: AgentState) -> str:
    """
    The Traffic Cop.
    Reads the 'persona_type' from the clipboard (state) and instantly routes 
    the conversation to the correct LangGraph node (Actor) without wasting LLM tokens.
    """
    persona_type = state.get("persona_type")
    
    # We check the exact string values from your Enum (PersonaType)
    if persona_type == "deceased":
        print("🚦 Supervisor: Routing to Deceased Persona Agent...")
        return "deceased_agent"
        
    elif persona_type == "companion":
        print("🚦 Supervisor: Routing to Companion Agent...")
        return "companion_agent"
        
    else:
        # Failsafe just in case something weird gets passed in
        raise ValueError(f"Supervisor Error: Unknown persona type '{persona_type}'")