from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "NinaivX API"
    VERSION: str = "1.0.0"
    
    # --- Database & Auth (Supabase) ---
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # --- AWS Bedrock (The Brain) ---
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str = "eu-north-1"
    BEDROCK_MODEL_ID: str = "eu.anthropic.claude-sonnet-4-6"
    # Model used for live voice calls. Sonnet gives better language fidelity (e.g. it
    # stays in Tamil instead of drifting to Hindi); set to a Haiku id for lower latency.
    BEDROCK_VOICE_MODEL_ID: str = "eu.anthropic.claude-sonnet-4-6"

    # --- ElevenLabs (The Voice) ---
    ELEVENLABS_API_KEY: str | None = None

    # This tells Pydantic to look for the .env file in your root folder
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8', case_sensitive=True, extra="ignore")

# We create a single instance of this class to import everywhere else in the app
settings = Settings()