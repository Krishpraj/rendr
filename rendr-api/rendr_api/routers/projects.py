"""CRUD endpoints for projects and their chat messages."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from rendr_api.services import database as db

router = APIRouter(prefix="/projects")


# ── Request / Response Models ──

class ProjectCreate(BaseModel):
    id: str
    name: str = "Untitled Project"
    code: str = ""
    parameters: list = []
    previewImage: str | None = None
    createdAt: str
    updatedAt: str


class ProjectUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    parameters: list | None = None
    previewImage: str | None = None
    updatedAt: str


class MessageBody(BaseModel):
    id: str
    role: str
    content: str = ""
    code: str | None = None
    parameters: list | None = None
    pipelineStages: list[str] | None = None
    timestamp: str


class BulkMessagesBody(BaseModel):
    messages: list[MessageBody]


# ── Project Endpoints ──

@router.get("")
async def list_projects():
    return await db.list_projects()


@router.get("/{project_id}")
async def get_project(project_id: str):
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("", status_code=201)
async def create_project(body: ProjectCreate):
    return await db.create_project(body.model_dump())


@router.put("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    result = await db.update_project(project_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str):
    deleted = await db.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")


# ── Chat Message Endpoints ──

@router.get("/{project_id}/messages")
async def get_messages(project_id: str):
    return await db.get_messages(project_id)


@router.post("/{project_id}/messages", status_code=201)
async def save_message(project_id: str, body: MessageBody):
    return await db.save_message(project_id, body.model_dump())


@router.put("/{project_id}/messages")
async def save_messages_bulk(project_id: str, body: BulkMessagesBody):
    await db.save_messages_bulk(project_id, [m.model_dump() for m in body.messages])
    return {"status": "ok"}


@router.delete("/{project_id}/messages", status_code=204)
async def delete_messages(project_id: str):
    await db.delete_messages(project_id)
