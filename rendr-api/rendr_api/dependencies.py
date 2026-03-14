from functools import lru_cache

from rendr_api.config import Settings
from rendr_api.services.pipeline import build_pipeline


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_pipeline():
    return build_pipeline(get_settings())
