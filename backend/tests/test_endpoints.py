"""
Endpoint + validation unit tests for NinaivX.

Run (from the backend/ directory, using the project venv):
    ./.venv/Scripts/python.exe -m unittest tests.test_endpoints -v

These tests are self-contained: they point the DB at a local SQLite file (so no
live Supabase connection is needed) and never call Bedrock/ElevenLabs. They verify:
  1. Every protected endpoint rejects unauthenticated requests (401).
  2. Public endpoints work without auth.
  3. Input validation (Pydantic) enforces the business rules.
"""
import os
# Use an offline SQLite DB so importing the app (which runs create_all) needs no Supabase.
os.environ["DATABASE_URL"] = "sqlite:///./_test_ninaivx.db"

import unittest
from starlette.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.api.routes import SignupRequest, PersonaCreate, PersonaUpdate

client = TestClient(app)

# Every endpoint that MUST require a valid token (method, path).
PROTECTED_ENDPOINTS = [
    ("GET", "/api/me"),
    ("POST", "/api/personas"),
    ("GET", "/api/personas"),
    ("GET", "/api/personas/some-id"),
    ("PATCH", "/api/personas/some-id"),
    ("DELETE", "/api/personas/some-id"),
    ("POST", "/api/personas/some-id/select-voice"),
    ("POST", "/api/chat"),
    ("POST", "/api/warmup"),
    ("POST", "/api/stt"),
    ("POST", "/api/chat-voice"),
    ("POST", "/api/voice-chat"),
    ("GET", "/api/synthetic-voice"),
    ("POST", "/api/clone-voice"),
    ("GET", "/api/preview-voice?voice_id=x"),
    ("GET", "/api/voices"),
]

# Endpoints that are intentionally public.
PUBLIC_ENDPOINTS = [
    ("GET", "/"),
    ("GET", "/health"),
    ("GET", "/api/disclosure"),
]


class TestAuthCoverage(unittest.TestCase):
    def test_every_protected_endpoint_requires_auth(self):
        for method, path in PROTECTED_ENDPOINTS:
            resp = client.request(method, path)
            self.assertEqual(
                resp.status_code, 401,
                f"{method} {path} must require auth but returned {resp.status_code}",
            )

    def test_bad_token_is_rejected(self):
        resp = client.get("/api/me", headers={"Authorization": "Bearer clearly-not-valid"})
        self.assertEqual(resp.status_code, 401)

    def test_public_endpoints_open(self):
        for method, path in PUBLIC_ENDPOINTS:
            resp = client.request(method, path)
            self.assertEqual(
                resp.status_code, 200,
                f"{method} {path} should be public but returned {resp.status_code}",
            )


# Minimal valid persona payload for the validation tests.
BASE_PERSONA = dict(
    name="Test", gender="female", relationship_with_user="friend",
    personality_text="A warm and caring person who loves to talk.",
    elevenlabs_voice_id="voice_123",
)


class TestSignupValidation(unittest.TestCase):
    def test_valid(self):
        SignupRequest(email="a@b.com", password="password1", name="Alex", age=25)

    def test_underage_rejected(self):
        with self.assertRaises(ValidationError):
            SignupRequest(email="a@b.com", password="password1", name="Alex", age=15)

    def test_bad_email_rejected(self):
        with self.assertRaises(ValidationError):
            SignupRequest(email="notanemail", password="password1", name="Alex", age=25)

    def test_short_password_rejected(self):
        with self.assertRaises(ValidationError):
            SignupRequest(email="a@b.com", password="short", name="Alex", age=25)

    def test_blank_name_rejected(self):
        with self.assertRaises(ValidationError):
            SignupRequest(email="a@b.com", password="password1", name="   ", age=25)


class TestPersonaValidation(unittest.TestCase):
    def test_valid_companion(self):
        PersonaCreate(persona_type="companion", age=25, **BASE_PERSONA)

    def test_valid_legacy_any_age(self):
        PersonaCreate(persona_type="deceased", age=8, **BASE_PERSONA)   # a lost child

    def test_companion_must_be_adult(self):
        with self.assertRaises(ValidationError):
            PersonaCreate(persona_type="companion", age=15, **BASE_PERSONA)

    def test_voice_required(self):
        with self.assertRaises(ValidationError):
            PersonaCreate(persona_type="companion", age=25, **{**BASE_PERSONA, "elevenlabs_voice_id": "   "})

    def test_personality_min_length(self):
        with self.assertRaises(ValidationError):
            PersonaCreate(persona_type="companion", age=25, **{**BASE_PERSONA, "personality_text": "hi"})

    def test_age_out_of_range(self):
        with self.assertRaises(ValidationError):
            PersonaCreate(persona_type="deceased", age=0, **BASE_PERSONA)

    def test_cause_only_for_legacy(self):
        with self.assertRaises(ValidationError):
            PersonaCreate(persona_type="companion", age=25, cause_of_death="old age", **BASE_PERSONA)

    def test_year_only_for_legacy(self):
        with self.assertRaises(ValidationError):
            PersonaCreate(persona_type="companion", age=25, year_of_passing=2015, **BASE_PERSONA)

    def test_year_range(self):
        with self.assertRaises(ValidationError):
            PersonaCreate(persona_type="deceased", age=70, year_of_passing=1850, **BASE_PERSONA)

    def test_legacy_with_year_and_cause_ok(self):
        PersonaCreate(persona_type="deceased", age=70, year_of_passing=2015, cause_of_death="old age", **BASE_PERSONA)

    def test_update_blank_required_field_rejected(self):
        with self.assertRaises(ValidationError):
            PersonaUpdate(name="   ")

    def test_update_companion_age_partial_ok(self):
        # PersonaUpdate is partial; a valid age passes at the model level.
        PersonaUpdate(age=30)


if __name__ == "__main__":
    unittest.main(verbosity=2)
