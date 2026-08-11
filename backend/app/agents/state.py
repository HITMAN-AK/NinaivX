from typing import Annotated, TypedDict, Sequence
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

# This defines the "Memory" that gets passed between your agents
class AgentState(TypedDict):
    # add_messages ensures new messages are appended, not overwritten
    messages: Annotated[Sequence[BaseMessage], add_messages]
    
    # We store the persona type so the Supervisor knows where to route
    persona_type: str  # 'DECEASED' or 'COMPANION'

    persona_id: str
    # We can store the final output here before sending it to the user
    final_response: str | None

    # True during a live voice call → nodes ask the model for a short, spoken reply.
    brief: bool