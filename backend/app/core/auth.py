"""
Supabase Auth for NinaivX.

The React Native app logs the user in with Supabase and receives a JWT access
token. It sends that token on every request as:  Authorization: Bearer <token>

Here we verify that token with Supabase and map it to our own User row.
Our User.id IS the Supabase auth UID, so they line up exactly.

No extra secret needed - we validate via the Supabase client using the
SUPABASE_URL / SUPABASE_KEY you already have in .env.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from supabase import create_client, Client

from app.core.config import settings
from app.db.database import get_db
from app.db.models import User

# Declaring a security scheme makes the "Authorize" button appear in Swagger (/docs),
# so the token can be entered once and applied to every endpoint.
bearer_scheme = HTTPBearer(
    scheme_name="Supabase access token",
    description="Paste the access_token returned by Supabase Auth (no 'Bearer ' prefix needed).",
    auto_error=False,
)

_supabase: Client | None = None


def get_supabase() -> Client:
    """Lazily create a single Supabase client."""
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _supabase


def get_auth_uid(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    Dependency: pull the Bearer token, verify it with Supabase, return the auth UID.
    Verifies the token only; does not require a profile row to exist yet.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")

    token = credentials.credentials
    try:
        response = get_supabase().auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not response or not response.user:
        raise HTTPException(status_code=401, detail="Invalid token.")

    return response.user.id


def get_current_user(
    uid: str = Depends(get_auth_uid),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency: the fully authenticated user WITH a profile row.
    Use this on every normal endpoint. A 404 means the token is valid but no profile
    exists (should not happen via /api/auth/signup, which creates both together).
    """
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found. Sign up via /api/auth/signup.")
    return user
