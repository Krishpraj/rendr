from fastapi import APIRouter, Depends, HTTPException

from rendr_api.config import Settings
from rendr_api.dependencies import get_settings
from rendr_api.models.requests import RenderRequest
from rendr_api.models.responses import RenderResponse
from rendr_api.services.openscad import encode_png_base64, is_openscad_available, render_png

router = APIRouter()


@router.post("/render", response_model=RenderResponse)
async def render(req: RenderRequest, settings: Settings = Depends(get_settings)):
    if not is_openscad_available(settings):
        raise HTTPException(status_code=503, detail="OpenSCAD is not installed")

    try:
        png_bytes = await render_png(
            req.code, settings, width=req.width, height=req.height, camera=req.camera
        )
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return RenderResponse(
        image=encode_png_base64(png_bytes),
        width=req.width,
        height=req.height,
    )
