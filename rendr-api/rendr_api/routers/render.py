from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from rendr_api.config import Settings
from rendr_api.dependencies import get_settings
from rendr_api.models.requests import RenderRequest, StlRequest
from rendr_api.models.responses import RenderResponse
from rendr_api.services.openscad import encode_png_base64, is_openscad_available, render_png, render_stl

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


@router.post("/render-stl")
async def render_stl_endpoint(req: StlRequest, settings: Settings = Depends(get_settings)):
    if not is_openscad_available(settings):
        raise HTTPException(status_code=503, detail="OpenSCAD is not installed")

    try:
        stl_bytes = await render_stl(req.code, settings)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return Response(content=stl_bytes, media_type="application/octet-stream")
