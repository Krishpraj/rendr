from fastapi import APIRouter, Depends

from rendr_api.config import Settings
from rendr_api.dependencies import get_settings
from rendr_api.models.responses import HealthResponse
from rendr_api.services.openscad import is_openscad_available

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(settings: Settings = Depends(get_settings)):
    return HealthResponse(
        status="ok",
        provider=settings.llm_provider,
        model=settings.llm_model,
        openscad_available=is_openscad_available(settings),
    )
