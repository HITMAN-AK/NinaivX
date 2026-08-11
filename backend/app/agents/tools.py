import re
import html as _html
import httpx

from langchain_core.tools import tool
from app.db.database import SessionLocal
from app.db.models import Persona


@tool
def fetch_persona_and_memory(persona_id: str) -> str:
    """
    Pass the persona_id to fetch your assigned persona details, the user's details,
    and the summary of your previous conversations. You need this to stay in character.
    (Kept for reference - the agent nodes currently load this directly from the DB.)
    """
    db = SessionLocal()
    try:
        persona = db.query(Persona).filter(Persona.id == persona_id).first()
        if not persona:
            return "SYSTEM ERROR: Persona not found in database."

        user = persona.owner
        if persona.conversation:
            current_summary = persona.conversation.current_summary
        else:
            current_summary = "This is the very first time you are speaking together."

        memory_document = f"""
        === THE USER ===
        Name: {user.name}
        Age: {user.age}
        Language: {user.language}

        === YOUR PERSONA ===
        Name: {persona.name}
        Age: {persona.age}
        Gender: {persona.gender}
        Relationship to user: {persona.relationship_with_user}
        Personality: {persona.personality_text}
        """
        if persona.cause_of_death:
            memory_document += f"Cause of passing: {persona.cause_of_death}\n"

        memory_document += f"""
        === CONVERSATION MEMORY (CHECKPOINT) ===
        {current_summary}
        """
        return memory_document
    finally:
        db.close()


@tool
def web_search(query: str) -> str:
    """
    Search the live internet for current, real-world information (news, weather,
    sports results, facts, dates, prices, recent events). Use this whenever the
    user asks about something you cannot know from memory or that may have changed
    recently. Returns the top search results as plain text.
    """
    print(f"🌐 Companion Agent: Searching the web for '{query}'...")
    try:
        response = httpx.post(
            "https://lite.duckduckgo.com/lite/",
            data={"q": query},
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            timeout=15.0,
        )
        response.raise_for_status()

        titles = re.findall(r"class=['\"]result-link['\"][^>]*>(.*?)</a>", response.text, re.S)
        snippets = re.findall(r"class=['\"]result-snippet['\"][^>]*>(.*?)</td>", response.text, re.S)

        def clean(raw: str) -> str:
            return _html.unescape(re.sub("<.*?>", "", raw)).strip()

        results = []
        for i in range(min(4, len(titles))):
            title = clean(titles[i])
            snippet = clean(snippets[i]) if i < len(snippets) else ""
            results.append(f"{i + 1}. {title} - {snippet[:200]}")

        if not results:
            return f"No web results found for '{query}'."
        return "Here is what I found online:\n" + "\n".join(results)

    except Exception as e:
        return f"Web search failed: {e}. Answer from your own knowledge instead."


# The Companion is "web-connected": it gets the search tool.
# The Deceased persona is intentionally "air-gapped" and gets NO tools.
companion_tools = [web_search]
