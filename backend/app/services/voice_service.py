import httpx
from fastapi import UploadFile, HTTPException
from app.core.config import settings

class VoiceService:
    def __init__(self):
        # Don't crash the whole app at import if the key is missing.
        # We check lazily, only when a voice endpoint is actually called.
        self.api_key = settings.ELEVENLABS_API_KEY

    def _require_key(self):
        if not self.api_key:
            raise HTTPException(
                status_code=503,
                detail="Voice features are unavailable: ELEVENLABS_API_KEY is not set in .env",
            )

    async def text_to_speech(self, text: str, voice_id: str, model_id: str = "eleven_turbo_v2_5",
                            language_code: str | None = None) -> bytes:
        """
        Converts Claude's text response into high-quality audio using ElevenLabs.
        Returns the raw MP3 audio bytes, ready to be sent to React Native.

        model_id: "eleven_turbo_v2_5" (default, high quality) or "eleven_flash_v2_5"
        (lowest latency — used for live voice calls).
        language_code: optional ISO code (e.g. "ta") to lock pronunciation to that
        language so the voice doesn't drift toward another (e.g. Hindi vs Tamil).
        """
        self._require_key()
        print(f"🎤 Generating ElevenLabs audio (voice={voice_id}, model={model_id}, lang={language_code or 'auto'})...")

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }

        data = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        if language_code:
            data["language_code"] = language_code
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data, headers=headers, timeout=30.0)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"ElevenLabs TTS Error: {response.text}"
                )
                
            return response.content

    async def speech_to_text(self, audio_file: UploadFile, language_code: str | None = None) -> str:
        """
        Takes the voice note recorded on the React Native frontend and
        converts it into text using ElevenLabs' Speech-to-Text (Scribe) API.

        Scribe auto-detects the spoken language (so Tamil speech -> Tamil text).
        An optional language_code (e.g. "ta", "hi") improves accuracy when known.
        """
        self._require_key()
        print(f"👂 Transcribing user audio with ElevenLabs Scribe (lang={language_code or 'auto'})...")

        url = "https://api.elevenlabs.io/v1/speech-to-text"

        headers = {
            "xi-api-key": self.api_key
        }

        audio_bytes = await audio_file.read()

        files = {
            "file": (audio_file.filename, audio_bytes, audio_file.content_type)
        }

        data = {
            "model_id": "scribe_v1"
        }
        if language_code:
            data["language_code"] = language_code
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, files=files, data=data, timeout=30.0)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"ElevenLabs STT Error: {response.text}"
                )
                
            result = response.json()
            return result["text"]
    
    async def clone_voice(self, name: str, description: str, files: list[UploadFile]) -> str:
        """
        Takes one or more audio files (UploadFile) and creates a custom cloned voice in ElevenLabs.
        Returns the new voice_id.
        """
        self._require_key()
        print(f"🧬 Cloning voice '{name}'...")
        url = "https://api.elevenlabs.io/v1/voices/add"
        
        headers = {
            "xi-api-key": self.api_key
        }
        
        data = {
            "name": name,
            "description": description
        }
        
        form_files = []
        for file in files:
            audio_bytes = await file.read()
            # ElevenLabs expects the tuple: (filename, file_bytes, content_type)
            form_files.append(("files", (file.filename, audio_bytes, file.content_type)))
            
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, data=data, files=form_files, timeout=60.0)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"ElevenLabs Clone Error: {response.text}"
                )
                
            result = response.json()
            return result["voice_id"]

    async def list_voices(self, gender: str | None = None, age: str | None = None,
                          language: str | None = None, use_case: str | None = "conversational",
                          limit: int = 5) -> list[dict]:
        """
        Searches the ElevenLabs **Voice Library** (the shared community library used by
        the ElevenLabs website) — not just this account's premade voices. This is what
        surfaces many languages (Tamil, Hindi, Arabic, Japanese, …), unlike /v1/voices
        which only lists the (mostly English) premade + cloned voices on the account.

        Filters (all optional, applied server-side by ElevenLabs):
        - gender:   "male" / "female"
        - age:      "young" / "middle_aged" / "old"
        - language: ISO code, e.g. "en", "ta", "hi", "es", "ar", "ja"
        - use_case: defaults to "conversational" (best fit for a talking persona)

        Library voice_ids can be used directly for text-to-speech (no "add to account"
        step needed), so a selected voice works immediately. Returns up to `limit`
        voices (5 by default) with a preview_url so the user can hear them first.
        """
        self._require_key()
        print(f"📋 Searching Voice Library (gender={gender}, age={age}, language={language}, use_case={use_case})...")
        url = "https://api.elevenlabs.io/v1/shared-voices"

        headers = {"xi-api-key": self.api_key}

        params: dict = {"page_size": max(1, min(limit, 30))}
        if gender:
            params["gender"] = gender.strip().lower()
        if age:
            params["age"] = age.strip().lower()
        if language:
            params["language"] = language.strip().lower()
        if use_case:
            params["use_cases"] = use_case.strip().lower()

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=30.0)

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"ElevenLabs Voice Library Error: {response.text}"
                )

            voices_data = response.json().get("voices", [])

        clean_voices = []
        for v in voices_data:
            clean_voices.append({
                "voice_id": v["voice_id"],
                "name": v.get("name", "Voice"),
                "gender": v.get("gender") or "unknown",
                "age": v.get("age") or "unknown",
                "accent": v.get("accent") or "unknown",
                "language": v.get("language") or "unknown",
                "description": v.get("description") or v.get("descriptive") or "",
                "preview_url": v.get("preview_url"),
                "use_case": v.get("use_case") or use_case,
            })

        return clean_voices[:limit]

# Export a single instance to be used across the app
voice_service = VoiceService()