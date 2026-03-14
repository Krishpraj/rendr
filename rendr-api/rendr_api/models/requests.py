from pydantic import BaseModel


class PartLabel(BaseModel):
    index: int
    name: str | None = None
    color: str | None = None
    bbox: dict | None = None


class CanvasState(BaseModel):
    """Snapshot of the 3D viewer state so the LLM knows what the user sees."""
    camera_position: list[float] | None = None   # [x, y, z]
    camera_target: list[float] | None = None      # [x, y, z] look-at point
    model_bbox_min: list[float] | None = None     # [x, y, z]
    model_bbox_max: list[float] | None = None     # [x, y, z]
    model_dimensions: list[float] | None = None   # [width, depth, height]
    model_center: list[float] | None = None       # [x, y, z]
    zoom_distance: float | None = None


class EditRequest(BaseModel):
    code: str = ""
    prompt: str
    provider: str | None = None
    model: str | None = None
    part_labels: list[PartLabel] = []
    canvas_state: CanvasState | None = None
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


class StlRequest(BaseModel):
    code: str
