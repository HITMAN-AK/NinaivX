"""
The LangGraph "brain" for NinaivX.

This is the agent layer. It replaces the old hard-coded generate_persona_response()
logic with a real, compiled StateGraph:

        START
          |
   (supervisor routes by persona_type)
        /        \
  deceased_agent   companion_agent  <----+
    (air-gapped)     (web-connected)     |
        |               |                |
       END        has tool call? --yes--> tools (web_search)
                        |
                       no
                        |
                       END

The API calls run_agent(); the frontend never talks to this directly.
"""
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langchain_core.messages import HumanMessage

from app.agents.state import AgentState
from app.agents.supervisor import route_to_agent
from app.agents.deceased import deceased_agent_node
from app.agents.companion import companion_agent_node
from app.agents.tools import companion_tools

from app.db.database import SessionLocal
from app.db.models import Persona, Conversation
from app.services.llm_service import update_conversation_checkpoint


def should_companion_continue(state: AgentState) -> str:
    """
    After the Companion thinks, check its last message:
    - if Claude asked to call a tool (web_search) -> go run the tool
    - otherwise -> we have the final answer, so finish.
    """
    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "tools"
    return END


def build_graph():
    """Wires up the nodes and edges, then compiles into a runnable graph."""
    workflow = StateGraph(AgentState)

    # --- The Actors (nodes) ---
    workflow.add_node("deceased_agent", deceased_agent_node)
    workflow.add_node("companion_agent", companion_agent_node)
    workflow.add_node("tools", ToolNode(companion_tools))  # executes web_search

    # --- The Supervisor: route from START based on persona_type ---
    workflow.add_conditional_edges(
        START,
        route_to_agent,
        {
            "deceased_agent": "deceased_agent",
            "companion_agent": "companion_agent",
        },
    )

    # --- Deceased is air-gapped: one thought, then done ---
    workflow.add_edge("deceased_agent", END)

    # --- Companion can loop through tools (the ReAct pattern) ---
    workflow.add_conditional_edges(
        "companion_agent",
        should_companion_continue,
        {
            "tools": "tools",
            END: END,
        },
    )
    workflow.add_edge("tools", "companion_agent")  # after a tool runs, think again

    return workflow.compile()


# Compile once at import time so we don't rebuild the graph on every request.
graph = build_graph()


def run_agent(db, persona_id: str, user_message: str, background_tasks=None, brief: bool = False) -> str:
    """
    The single entry point the API uses instead of the old generate_persona_response().

    1. Make sure the persona (and its conversation row) exists.
    2. Build the initial state and invoke the compiled graph.
    3. Pull out the final reply.
    4. Update the rolling memory summary.

    LATENCY: the summary rewrite is a second LLM call. If `background_tasks` is
    provided (FastAPI), we schedule it to run AFTER the response is sent, so the
    user gets their reply/audio immediately. Otherwise we update inline.
    """
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise ValueError(f"No persona found with ID: {persona_id}")

    # Create the conversation row on first ever chat
    if not persona.conversation:
        new_convo = Conversation(
            persona_id=persona.id,
            current_summary="This is the very first time you are speaking together.",
        )
        db.add(new_convo)
        db.commit()
        db.refresh(persona)

    # The "clipboard" the graph passes between nodes.
    # persona_type.value gives the plain string ("deceased"/"companion") the supervisor checks.
    initial_state = {
        "messages": [HumanMessage(content=user_message)],
        "persona_type": persona.persona_type.value,
        "persona_id": persona_id,
        "final_response": None,
        "brief": brief,
    }

    result = graph.invoke(initial_state)
    ai_reply = result["messages"][-1].content

    if background_tasks is not None:
        # Return to the user NOW; update memory in the background.
        background_tasks.add_task(_update_summary_background, persona_id, user_message, ai_reply)
    else:
        update_conversation_checkpoint(
            db=db,
            conversation=persona.conversation,
            user_message=user_message,
            ai_response=ai_reply,
        )

    return ai_reply


def _update_summary_background(persona_id: str, user_message: str, ai_reply: str):
    """
    Runs AFTER the HTTP response is sent. The request-scoped DB session is already
    closed by then, so we open our OWN session here and close it when done.
    """
    db = SessionLocal()
    try:
        persona = db.query(Persona).filter(Persona.id == persona_id).first()
        if persona and persona.conversation:
            update_conversation_checkpoint(
                db=db,
                conversation=persona.conversation,
                user_message=user_message,
                ai_response=ai_reply,
            )
    finally:
        db.close()
