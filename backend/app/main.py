import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
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

    # Public "open the app" redirect: a normal https link participants can tap ON THEIR PHONE.
    # It launches Expo Go via the exp:// deep link (set EXPO_APP_URL in the environment).
    # This link is STABLE — if the tunnel URL rotates, just update EXPO_APP_URL (one place);
    # the link in the Google Form never changes.
    @app.get("/app", response_class=HTMLResponse)
    async def open_app():
        url = os.getenv("EXPO_APP_URL", "").strip().replace('"', "").replace("'", "")
        html = """<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open NinaivX</title>
<style>
 body{font-family:-apple-system,system-ui,Arial,sans-serif;background:#4B2E83;color:#fff;text-align:center;padding:48px 22px;margin:0}
 h2{margin:0 0 10px} p{line-height:1.5}
 a.btn{display:inline-block;background:#fff;color:#4B2E83;padding:15px 30px;border-radius:12px;font-weight:700;text-decoration:none;margin-top:20px;font-size:17px}
 .muted{opacity:.9;font-size:14px;margin-top:28px;line-height:1.7}
 code{background:rgba(255,255,255,.15);padding:2px 6px;border-radius:6px;word-break:break-all}
</style></head>
<body>
 <h2>Opening NinaivX&hellip;</h2>
 <p>If it doesn't open automatically, tap the button.</p>
 <a class="btn" href="__URL__">Open in Expo Go</a>
 <p class="muted">First install the free <b>Expo Go</b> app &mdash; iPhone: App Store &middot; Android: Google Play.<br>
 If nothing happens, open Expo Go and use this link:<br><code>__URL__</code></p>
 <script>
   var u = "__URL__";
   if (u) { setTimeout(function(){ window.location.href = u; }, 500); }
 </script>
</body></html>"""
        return HTMLResponse(html.replace("__URL__", url))

    return app

app = create_app()