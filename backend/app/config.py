"""FraudShield AI — Application Configuration."""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "FraudShield AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    # Database
    # Database — uses psycopg3 (asyncpg doesn't support Python 3.13)
    DATABASE_URL: str = "postgresql+psycopg://fraudshield:fraudshield_dev@localhost:5432/fraudshield"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50

    # ML Models
    MODEL_DIR: str = "app/ml_models"
    MODEL_VERSION: str = "lgbm_v1.0.0_20260713"

    # Scoring Thresholds (configurable per SRD Section 5.1.11)
    THRESHOLD_APPROVE: float = 0.35
    THRESHOLD_REJECT: float = 0.75

    # Aggregation Weights (SRD Section 5.1.10)
    WEIGHT_ML: float = 0.45
    WEIGHT_RULES: float = 0.25
    WEIGHT_BEHAVIOR: float = 0.20
    WEIGHT_GRAPH: float = 0.10

    # Auth
    API_KEYS: str = "fs_demo_key_001,fs_demo_key_002,fs_hackathon_key"
    JWT_SECRET: str = "fraudshield-jwt-secret-change-in-prod"
    JWT_ALGORITHM: str = "HS256"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 10000

    # Feature Timeouts (ms)
    FEATURE_TIMEOUT_MS: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def api_key_list(self) -> list[str]:
        return [k.strip() for k in self.API_KEYS.split(",") if k.strip()]


settings = Settings()
