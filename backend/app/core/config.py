import os
from typing import List
from pydantic import ConfigDict
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "DocuMind AI"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str = "super-secret-key-change-in-production-32bytes-minimum"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # OpenAI Settings
    OPENAI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    LLM_MODEL: str = "gpt-4o-mini"
    
    # Database & File Storage
    DATABASE_URL: str = "sqlite:///./documind.db"
    STORAGE_DIR: str = "./storage/uploads"
    VECTOR_STORE_DIR: str = "./storage/vectors"
    
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = ConfigDict(env_file=".env", extra="ignore")


settings = Settings()

os.makedirs(settings.STORAGE_DIR, exist_ok=True)
os.makedirs(settings.VECTOR_STORE_DIR, exist_ok=True)
