from typing import TypedDict


class PipelineState(TypedDict, total=False):
    original_code: str
    user_prompt: str
    part_labels: list[dict]
    canvas_state: dict | None
    analysis: str
    plan: str
    generated_code: str
    validation: dict | None
    review_feedback: str
    refinement_count: int
    max_refinements: int
    final_code: str
    parameters: list[dict]
    title: str
    errors: list[str]
    provider: str
    model: str
    skip_validation: bool
    skip_refinement: bool
    conversation_history: list[dict]
    fast: bool
    fast_provider: str
    fast_model: str
