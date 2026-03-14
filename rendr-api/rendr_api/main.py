from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from rendr_api.dependencies import get_pipeline, get_settings
from rendr_api.routers import edit, health, params, render


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up settings and pipeline on startup
    get_settings()
    get_pipeline()
    yield


app = FastAPI(title="rendr-api", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(edit.router, prefix="/api/v1")
app.include_router(params.router, prefix="/api/v1")
app.include_router(render.router, prefix="/api/v1")
