from pydantic import BaseModel


class PartLabel(BaseModel):
    index: int
    name: str | None = None
    color: str | None = None
    bbox: dict | None = None


class EditRequest(BaseModel):
    code: str = ""
    prompt: str
    provider: str | None = None
    model: str | None = None
    part_labels: list[PartLabel] = []
    skip_validation: bool = False
    skip_refinement: bool = False
    stream: bool = False
    messages: list[dict] = []
    fast: bool = False


class ParamUpdate(BaseModel):
    name: str
    value: str


class ParameterUpdateRequest(BaseModel):
    code: str
    updates: list[ParamUpdate]


class RenderRequest(BaseModel):
    code: str
    width: int = 512
    height: int = 512
    camera: str | None = None
