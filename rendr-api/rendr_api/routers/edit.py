import json
import re

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from rendr_api.config import Settings
from rendr_api.dependencies import get_pipeline, get_settings
from rendr_api.models.requests import EditRequest
from rendr_api.models.responses import EditResponse, Parameter, ValidationResult
from rendr_api.services.llm import chat_completion, extract_openscad_from_text
from rendr_api.services.openscad import validate_code
from rendr_api.services.parameters import parse_parameters
from rendr_api.services.postprocess import postprocess
from rendr_api.services.prompts import (
    AGENT_PROMPT,
    ANALYZE_AND_PLAN_PROMPT,
    REVIEW_CHECKLIST,
    STRICT_CODE_PROMPT,
)
from rendr_api.services.review_agent import build_review_agent

router = APIRouter()


def _parse_title_from_review(review_text: str, user_prompt: str) -> str:
    """Extract TITLE: ... from review response, with fallback."""
    match = re.search(r"TITLE:\s*(.+)", review_text)
    if match:
        title = match.group(1).strip().strip('"\'').rstrip(".!?:;,")
        if 2 <= len(title) <= 27:
            return title
        if len(title) > 27:
            return title[:24] + "..."
    words = user_prompt.split()[:4]
    title = " ".join(words).title()
    if len(title) > 27:
        title = title[:24] + "..."
    return title if len(title) >= 2 else "3D Object"


@router.post("/edit")
async def edit(
    req: EditRequest,
    settings: Settings = Depends(get_settings),
    pipeline=Depends(get_pipeline),
):
    initial_state = {
        "original_code": req.code,
        "user_prompt": req.prompt,
        "part_labels": [pl.model_dump() for pl in req.part_labels],
        "analysis": "",
        "plan": "",
        "generated_code": "",
        "validation": None,
        "review_feedback": "",
        "refinement_count": 0,
        "max_refinements": settings.max_refinement_rounds,
        "final_code": "",
        "parameters": [],
        "title": "",
        "errors": [],
        "provider": req.provider or settings.llm_provider,
        "model": req.model or settings.llm_model,
        "skip_validation": req.skip_validation,
        "skip_refinement": req.skip_refinement,
        "conversation_history": req.messages,
        "fast": req.fast,
        "fast_provider": settings.fast_provider,
        "fast_model": settings.fast_model,
    }

    if req.stream:
        return StreamingResponse(
            _stream_pipeline(initial_state, settings),
            media_type="application/x-ndjson",
        )

    result = await pipeline.ainvoke(initial_state)

    validation = None
    if result.get("validation"):
        validation = ValidationResult(**result["validation"])

    return EditResponse(
        code=result.get("final_code") or result.get("generated_code", ""),
        title=result.get("title", "3D Object"),
        parameters=[Parameter(**p) for p in result.get("parameters", [])],
        analysis=result.get("analysis", ""),
        plan=result.get("plan", ""),
        validation=validation,
        refinements_applied=result.get("refinement_count", 0),
        model_used=result.get("model", settings.llm_model),
        provider_used=result.get("provider", settings.llm_provider),
    )


async def _stream_pipeline(initial_state: dict, settings: Settings):
    """Stream pipeline progress as NDJSON."""
    state = dict(initial_state)
    provider = state["provider"]
    model = state["model"]
    fast = state.get("fast", False)
    fast_provider = state.get("fast_provider", settings.fast_provider)
    fast_model = state.get("fast_model", settings.fast_model)
    conversation_history = state.get("conversation_history", [])

    def _model_for(is_generation: bool = False):
        if fast and not is_generation:
            return fast_provider, fast_model
        return provider, model

    async def emit(stage: str, status: str, **extra):
        data = {"stage": stage, "status": status, **extra}
        return json.dumps(data) + "\n"

    # Route: skip analyze_and_plan for from-scratch
    if state["original_code"]:
        # Analyze and Plan (merged into single call)
        yield await emit("analyze_and_plan", "running")

        code_ctx = f"\n\nCurrent code:\n```\n{state['original_code']}\n```"
        part_context = ""
        if state.get("part_labels"):
            parts = "\n".join(
                f"  @{p['index']}: {p.get('name', 'unnamed')} (color: {p.get('color', 'auto')}, bbox: {p.get('bbox', {})})"
                for p in state["part_labels"]
            )
            part_context = f"\n\nPart labels:\n{parts}"

        messages = []
        if conversation_history:
            messages.append({"role": "system", "content": ANALYZE_AND_PLAN_PROMPT})
            for msg in conversation_history:
                messages.append(msg)
            messages.append({
                "role": "user",
                "content": f"Now analyze and plan for this new request:\n\nUser request: {state['user_prompt']}{code_ctx}{part_context}",
            })
        else:
            messages = [
                {"role": "system", "content": ANALYZE_AND_PLAN_PROMPT},
                {"role": "user", "content": f"Analyze this OpenSCAD project and produce a modification plan.\n\nUser request: {state['user_prompt']}{code_ctx}{part_context}"},
            ]

        ap_provider, ap_model = _model_for()
        raw = await chat_completion(messages, settings, provider=ap_provider, model=ap_model)

        try:
            cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw.strip())
            cleaned = re.sub(r"\n?```\s*$", "", cleaned)
            data = json.loads(cleaned)
            state["analysis"] = data.get("analysis", raw)
            steps = data.get("plan_steps", [])
            state["plan"] = "\n".join(f"- {s}" for s in steps) if steps else raw
        except (json.JSONDecodeError, AttributeError):
            state["analysis"] = raw
            state["plan"] = raw

        yield await emit("analyze_and_plan", "done", analysis=state["analysis"], plan=state["plan"])
    else:
        # From-scratch: deterministic plan, no LLM call
        state["analysis"] = "New model from scratch."
        state["plan"] = f"- Create a new OpenSCAD model: {state['user_prompt']}"
        yield await emit("analyze_and_plan", "done", analysis=state["analysis"], plan=state["plan"])

    max_rounds = state["max_refinements"]
    for round_num in range(max_rounds + 1):
        # Generate
        yield await emit("generate", "running", round=round_num)
        feedback = ""
        if state.get("review_feedback"):
            feedback = f"\n\nPrevious review feedback (fix these issues):\n{state['review_feedback']}"
        if state.get("validation") and state["validation"].get("errors"):
            feedback += f"\n\nOpenSCAD compilation errors (fix these):\n" + "\n".join(state["validation"]["errors"])

        # Include previous attempt for refinement context
        if feedback and state.get("generated_code"):
            previous = f"\n\nPrevious attempt (fix the issues below):\n```openscad\n{state['generated_code']}\n```"
            feedback = previous + feedback

        existing = f"\n\nExisting code:\n{state['original_code']}" if state["original_code"] else ""

        gen_messages = [
            {"role": "system", "content": STRICT_CODE_PROMPT},
        ]
        if conversation_history:
            for msg in conversation_history:
                gen_messages.append(msg)
        gen_messages.append({
            "role": "user",
            "content": f"Generate OpenSCAD code for: {state['user_prompt']}\n\nPlan:\n{state['plan']}{existing}{feedback}",
        })

        gen_provider, gen_model = _model_for(is_generation=True)
        raw = await chat_completion(gen_messages, settings, provider=gen_provider, model=gen_model)
        code = extract_openscad_from_text(raw) or raw
        state["generated_code"] = postprocess(code)
        yield await emit("generate", "done", round=round_num)

        # Validate
        if not state.get("skip_validation"):
            yield await emit("validate", "running")
            result = await validate_code(state["generated_code"], settings)
            state["validation"] = result.model_dump()
            yield await emit("validate", "done", validation=state["validation"])

            # Smart shortcut: if validation errors and refinements remain, skip review
            has_errors = bool(state["validation"].get("errors"))
            if has_errors and round_num < max_rounds:
                state["refinement_count"] = state.get("refinement_count", 0) + 1
                continue  # Loop back to generate without review
            if has_errors and round_num >= max_rounds:
                break  # Give up, finalize

        # Review
        if state.get("skip_refinement"):
            break

        yield await emit("review", "running", round=round_num)
        rev_provider, rev_model = _model_for()

        # Use Railtracks review agent with tool-based checks
        try:
            review_flow = build_review_agent(rev_provider, rev_model, settings)
            review_input = (
                f"{REVIEW_CHECKLIST}\n\n"
                f"User request: {state['user_prompt']}\n\n"
                f"Generated code:\n```openscad\n{state['generated_code']}\n```\n\n"
                f"Validation: {state.get('validation', {})}"
            )
            result = await review_flow.ainvoke(review_input)
            review_text = str(result)
        except Exception:
            # Fallback to direct LLM call
            review_messages = [
                {"role": "system", "content": AGENT_PROMPT},
                {"role": "user", "content": f"{REVIEW_CHECKLIST}\n\nUser request: {state['user_prompt']}\n\nGenerated code:\n```openscad\n{state['generated_code']}\n```\n\nValidation: {state.get('validation', {})}"},
            ]
            review_text = await chat_completion(review_messages, settings, provider=rev_provider, model=rev_model)
        state["review_feedback"] = review_text

        # Parse title from review response
        title = _parse_title_from_review(review_text, state["user_prompt"])
        state["title"] = title

        yield await emit("review", "done", round=round_num, approved="APPROVED" in review_text)

        if "APPROVED" in review_text:
            break

        state["refinement_count"] = state.get("refinement_count", 0) + 1

    # Finalize
    params = parse_parameters(state["generated_code"])
    title = state.get("title") or _parse_title_from_review(
        state.get("review_feedback", ""), state["user_prompt"]
    )

    final = {
        "code": state["generated_code"],
        "title": title,
        "parameters": [p.model_dump() for p in params],
        "analysis": state["analysis"],
        "plan": state["plan"],
        "validation": state.get("validation"),
        "refinements_applied": state.get("refinement_count", 0),
        "model_used": model,
        "provider_used": provider,
    }
    yield json.dumps({"stage": "complete", "status": "done", "result": final}) + "\n"
