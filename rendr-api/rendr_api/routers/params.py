from fastapi import APIRouter

from rendr_api.models.requests import ParameterUpdateRequest
from rendr_api.models.responses import Parameter, ParameterUpdateResponse
from rendr_api.services.parameters import apply_parameter_updates, parse_parameters

router = APIRouter()


@router.post("/params/update", response_model=ParameterUpdateResponse)
async def update_params(req: ParameterUpdateRequest):
    updated_code = apply_parameter_updates(
        req.code, [u.model_dump() for u in req.updates]
    )
    params = parse_parameters(updated_code)
    return ParameterUpdateResponse(
        code=updated_code,
        parameters=params,
    )
