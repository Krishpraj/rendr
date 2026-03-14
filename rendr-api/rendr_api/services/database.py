"""SQLite database for persistent project and chat storage."""

import json
from pathlib import Path

import aiosqlite

DB_PATH = Path(__file__).resolve().parent.parent.parent / "rendr.db"

_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        _db = await aiosqlite.connect(str(DB_PATH))
        _db.row_factory = aiosqlite.Row
        await _db.execute("PRAGMA journal_mode=WAL")
        await _db.execute("PRAGMA foreign_keys=ON")
        await _init_tables(_db)
    return _db


async def close_db():
    global _db
    if _db is not None:
        await _db.close()
        _db = None


async def _init_tables(db: aiosqlite.Connection):
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT 'Untitled Project',
            code TEXT NOT NULL DEFAULT '',
            parameters TEXT NOT NULL DEFAULT '[]',
            preview_image TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            code TEXT,
            parameters TEXT,
            pipeline_stages TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_messages_project
            ON chat_messages(project_id, timestamp);
    """)
    await db.commit()


# ── Projects ──

async def list_projects() -> list[dict]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM projects ORDER BY updated_at DESC"
    )
    rows = await cursor.fetchall()
    return [_row_to_project(r) for r in rows]


async def get_project(project_id: str) -> dict | None:
    db = await get_db()
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    return _row_to_project(row) if row else None


async def create_project(project: dict) -> dict:
    db = await get_db()
    await db.execute(
        """INSERT INTO projects (id, name, code, parameters, preview_image, created_at, updated_at)
           VALUES (:id, :name, :code, :parameters, :previewImage, :createdAt, :updatedAt)""",
        {
            "id": project["id"],
            "name": project["name"],
            "code": project.get("code", ""),
            "parameters": json.dumps(project.get("parameters", [])),
            "previewImage": project.get("previewImage"),
            "createdAt": project["createdAt"],
            "updatedAt": project["updatedAt"],
        },
    )
    await db.commit()
    return project


async def update_project(project_id: str, data: dict) -> dict | None:
    db = await get_db()
    existing = await get_project(project_id)
    if not existing:
        return None

    merged = {**existing, **data, "updatedAt": data.get("updatedAt", existing["updatedAt"])}
    await db.execute(
        """UPDATE projects
           SET name = :name, code = :code, parameters = :parameters,
               preview_image = :previewImage, updated_at = :updatedAt
           WHERE id = :id""",
        {
            "id": project_id,
            "name": merged["name"],
            "code": merged["code"],
            "parameters": json.dumps(merged.get("parameters", [])),
            "previewImage": merged.get("previewImage"),
            "updatedAt": merged["updatedAt"],
        },
    )
    await db.commit()
    return merged


async def delete_project(project_id: str) -> bool:
    db = await get_db()
    cursor = await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    await db.commit()
    return cursor.rowcount > 0


# ── Chat Messages ──

async def get_messages(project_id: str) -> list[dict]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM chat_messages WHERE project_id = ? ORDER BY timestamp ASC",
        (project_id,),
    )
    rows = await cursor.fetchall()
    return [_row_to_message(r) for r in rows]


async def save_message(project_id: str, message: dict) -> dict:
    db = await get_db()
    await db.execute(
        """INSERT OR REPLACE INTO chat_messages
           (id, project_id, role, content, code, parameters, pipeline_stages, timestamp)
           VALUES (:id, :project_id, :role, :content, :code, :parameters, :pipeline_stages, :timestamp)""",
        {
            "id": message["id"],
            "project_id": project_id,
            "role": message["role"],
            "content": message.get("content", ""),
            "code": message.get("code"),
            "parameters": json.dumps(message["parameters"]) if message.get("parameters") else None,
            "pipeline_stages": json.dumps(message["pipelineStages"]) if message.get("pipelineStages") else None,
            "timestamp": message["timestamp"],
        },
    )
    await db.commit()
    return message


async def save_messages_bulk(project_id: str, messages: list[dict]):
    db = await get_db()
    for msg in messages:
        await db.execute(
            """INSERT OR REPLACE INTO chat_messages
               (id, project_id, role, content, code, parameters, pipeline_stages, timestamp)
               VALUES (:id, :project_id, :role, :content, :code, :parameters, :pipeline_stages, :timestamp)""",
            {
                "id": msg["id"],
                "project_id": project_id,
                "role": msg["role"],
                "content": msg.get("content", ""),
                "code": msg.get("code"),
                "parameters": json.dumps(msg["parameters"]) if msg.get("parameters") else None,
                "pipeline_stages": json.dumps(msg["pipelineStages"]) if msg.get("pipelineStages") else None,
                "timestamp": msg["timestamp"],
            },
        )
    await db.commit()


async def delete_messages(project_id: str):
    db = await get_db()
    await db.execute("DELETE FROM chat_messages WHERE project_id = ?", (project_id,))
    await db.commit()


# ── Helpers ──

def _row_to_project(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "code": row["code"],
        "parameters": json.loads(row["parameters"]) if row["parameters"] else [],
        "previewImage": row["preview_image"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _row_to_message(row) -> dict:
    msg = {
        "id": row["id"],
        "role": row["role"],
        "content": row["content"],
        "timestamp": row["timestamp"],
    }
    if row["code"]:
        msg["code"] = row["code"]
    if row["parameters"]:
        msg["parameters"] = json.loads(row["parameters"])
    if row["pipeline_stages"]:
        msg["pipelineStages"] = json.loads(row["pipeline_stages"])
    return msg
