from functools import lru_cache
from typing import Any

from pydantic import AliasChoices, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="HOSPEDEX_",
        extra="ignore",
    )

    api_name: str = "Hospedex API"
    api_version: str = "0.1.0"
    api_env: str = "local"
    docs_url: str | None = "/docs"
    cors_origins: list[str] = Field(default_factory=list)
    database_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("HOSPEDEX_DATABASE_URL", "DATABASE_URL"),
    )
    database_ssl: str = "auto"
    database_set_role: bool = True
    supabase_jwt_secret: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("HOSPEDEX_SUPABASE_JWT_SECRET", "SUPABASE_JWT_SECRET"),
    )
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_issuer: str | None = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str] | Any:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
