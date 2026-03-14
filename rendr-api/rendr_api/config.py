from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    llm_provider: str = "anthropic"
    llm_model: str = "claude-sonnet-4-20250514"
    fast_provider: str = "anthropic"
    fast_model: str = "claude-haiku-4-5-20251001"
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    openai_api_base: str | None = None
    ollama_host: str = "http://localhost:11434"
    openscad_path: str = "openscad"
    temperature: float = 0.0
    max_refinement_rounds: int = 2
    host: str = "0.0.0.0"
    port: int = 8000
