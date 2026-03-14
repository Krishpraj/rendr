from pydantic import BaseModel


class ParameterRange(BaseModel):
    min: float | None = None
    max: float | None = None
    step: float | None = None


class ParameterOption(BaseModel):
    value: str | float
    label: str | None = None


class Parameter(BaseModel):
    name: str
    display_name: str
    type: str
    value: str | float | bool | list
    default_value: str | float | bool | list
    description: str | None = None
    group: str = ""
    range: ParameterRange | None = None
    options: list[ParameterOption] = []


class ValidationResult(BaseModel):
    valid: bool
    errors: list[str] = []
    warnings: list[str] = []


class EditResponse(BaseModel):
    code: str
    title: str
    parameters: list[Parameter]
    analysis: str
    plan: str
    validation: ValidationResult | None = None
    refinements_applied: int
    model_used: str
    provider_used: str


class ParameterUpdateResponse(BaseModel):
    code: str
    parameters: list[Parameter]


class HealthResponse(BaseModel):
    status: str
    provider: str
    model: str
    openscad_available: bool


class RenderResponse(BaseModel):
    image: str  # base64-encoded PNG
    width: int
    height: int
