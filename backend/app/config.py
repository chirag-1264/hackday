import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SwasthyaCall API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "development")
    
    # MongoDB (Supports local and MongoDB Atlas mongodb+srv://)
    MONGODB_URI: str = os.environ.get("MONGODB_URI", os.environ.get("MONGODB_URL", "mongodb://127.0.0.1:27017"))
    DATABASE_NAME: str = os.environ.get("DATABASE_NAME", "swasthyacall")
    
    # Security / Auth
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "swasthyacall_super_secret_jwt_key_2026_hackday")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # AI - Gemma 4
    GEMMA_API_BASE: str = os.environ.get("GEMMA_API_BASE", "https://openrouter.ai/api/v1")
    GEMMA_MODEL_NAME: str = os.environ.get("GEMMA_MODEL_NAME", "google/gemma-4-26b-a4b-it")
    GEMMA_MODE: str = os.environ.get("GEMMA_MODE", "online")
    GEMMA_API_KEY: Optional[str] = os.environ.get("GEMMA_API_KEY", None)
    
    # Telephony - Twilio
    TWILIO_ACCOUNT_SID: Optional[str] = os.environ.get("TWILIO_ACCOUNT_SID", None)
    TWILIO_AUTH_TOKEN: Optional[str] = os.environ.get("TWILIO_AUTH_TOKEN", None)
    TWILIO_PHONE_NUMBER: Optional[str] = os.environ.get("TWILIO_PHONE_NUMBER", None)
    TWILIO_DEMO_MODE: bool = os.environ.get("TWILIO_DEMO_MODE", "true").lower() in ("true", "1")
    TWILIO_VERIFY_SIGNATURE: bool = os.environ.get("TWILIO_VERIFY_SIGNATURE", "false").lower() in ("true", "1")
    
    # Public HTTPS URL for Twilio Webhooks (Required for Render / Production reverse proxy)
    PUBLIC_WEBHOOK_URL: Optional[str] = os.environ.get("PUBLIC_WEBHOOK_URL", os.environ.get("BASE_URL", None))
    
    # Notifications
    SMS_NOTIFICATIONS_ENABLED: bool = os.environ.get("SMS_NOTIFICATIONS_ENABLED", "false").lower() in ("true", "1")
    
    # CORS & Web Origins
    FRONTEND_ORIGIN: str = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
    ALLOWED_ORIGINS: Optional[str] = os.environ.get("ALLOWED_ORIGINS", None)
    
    # Server Host & Dynamic Port for Render
    SERVER_HOST: str = os.environ.get("SERVER_HOST", "0.0.0.0")
    SERVER_PORT: int = int(os.environ.get("PORT", os.environ.get("SERVER_PORT", 8000)))
    
    # Emergency Helpline
    EMERGENCY_NUMBER: str = os.environ.get("EMERGENCY_NUMBER", "112")
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
