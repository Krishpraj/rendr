"""LangGraph pipeline: analyze_and_plan → generate → validate → review (with loop)."""

import json
import re

from langgraph.graph import END, StateGraph

from rendr_api.config import Settings
from rendr_api.models.state import PipelineState
from rendr_api.services.llm import chat_completion, extract_openscad_from_text
from rendr_api.services.openscad import validate_code
from rendr_api.services.parameters import parse_parameters
from rendr_api.services.postprocess import postprocess
from rendr_api.services.prompts import (
    AGENT_PROMPT,
    ANALYZE_AND_PLAN_PROMPT,
    REVIEW_CHECKLIST,
    STRICT_CODE_PROMPT,
    format_canvas_context,
)


def _pick_model(state: PipelineState, settings: Settings, *, is_generation: bool = False):
    """Return (provider, model) — use fast model for non-generation nodes when fast=True."""
    if state.get("fast") and not is_generation:
        return (
            state.get("fast_provider") or settings.fast_provider,
            state.get("fast_model") or settings.fast_model,
        )
    return state.get("provider"), state.get("model")


def _parse_title_from_review(review_text: str, user_prompt: str) -> str:
    """Extract TITLE: ... from review response, with fallback."""
    match = re.search(r"TITLE:\s*(.+)", review_text)
    if match:
        title = match.group(1).strip().strip('"\'').rstrip(".!?:;,")
        if 2 <= len(title) <= 27:
            return title
        if len(title) > 27:
            return title[:24] + "..."
    # Fallback: first 4 words of user prompt
    words = user_prompt.split()[:4]
    title = " ".join(words).title()
    if len(title) > 27:
        title = title[:24] + "..."
    return title if len(title) >= 2 else "3D Object"


def build_pipeline(settings: Settings) -> StateGraph:
    """Construct and compile the LangGraph pipeline."""

    async def analyze_and_plan(state: PipelineState) -> dict:
        code_context = f"\n\nCurrent code:\n```\n{state['original_code']}\n```" if state.get("original_code") else ""
        part_context = ""
        if state.get("part_labels"):
            parts = "\n".join(
                f"  @{p['index']}: {p.get('name', 'unnamed')} (color: {p.get('color', 'auto')}, bbox: {p.get('bbox', {})})"
                for p in state["part_labels"]
            )
            part_context = f"\n\nPart labels:\n{parts}"
        canvas_context = format_canvas_context(state.get("canvas_state"))

        messages = []
        # Prepend conversation history if available
        if state.get("conversation_history"):
            messages.append({"role": "system", "content": ANALYZE_AND_PLAN_PROMPT})
            for msg in state["conversation_history"]:
                messages.append(msg)
            messages.append({
                "role": "user",
                "content": f"Now analyze and plan for this new request:\n\nUser request: {state['user_prompt']}{code_context}{part_context}{canvas_context}",
            })
        else:
            messages = [
                {"role": "system", "content": ANALYZE_AND_PLAN_PROMPT},
                {
                    "role": "user",
                    "content": f"Analyze this OpenSCAD project and produce a modification plan.\n\nUser request: {state['user_prompt']}{code_context}{part_context}{canvas_context}",
                },
            ]

        provider, model = _pick_model(state, settings)
        raw = await chat_completion(messages, settings, provider=provider, model=model)

        # Parse JSON response
        try:
            # Strip markdown fences if the LLM wrapped it
            cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw.strip())
            cleaned = re.sub(r"\n?```\s*$", "", cleaned)
            data = json.loads(cleaned)
            analysis = data.get("analysis", raw)
            steps = data.get("plan_steps", [])
            plan = "\n".join(f"- {s}" for s in steps) if steps else raw
        except (json.JSONDecodeError, AttributeError):
            # Fallback: use raw text for both
            analysis = raw
            plan = raw

        return {"analysis": analysis, "plan": plan}

    async def generate(state: PipelineState) -> dict:
        feedback = ""
        if state.get("review_feedback"):
            feedback = f"\n\nPrevious review feedback (fix these issues):\n{state['review_feedback']}"
        if state.get("validation") and state["validation"].get("errors"):
            errors = "\n".join(state["validation"]["errors"])
            feedback += f"\n\nOpenSCAD compilation errors (fix these):\n{errors}"

        # Include previous attempt code for refinement context
        if feedback and state.get("generated_code"):
            previous = f"\n\nPrevious attempt (fix the issues below):\n```openscad\n{state['generated_code']}\n```"
            feedback = previous + feedback

        existing = ""
        if state.get("original_code"):
            existing = f"\n\nExisting code to modify:\n{state['original_code']}"
        canvas_context = format_canvas_context(state.get("canvas_state"))

        messages = [
            {"role": "system", "content": STRICT_CODE_PROMPT},
        ]
        # Include conversation history in generate for context
        if state.get("conversation_history"):
            for msg in state["conversation_history"]:
                messages.append(msg)
        messages.append({
            "role": "user",
            "content": f"Generate OpenSCAD code for: {state['user_prompt']}\n\nPlan:\n{state['plan']}{existing}{feedback}{canvas_context}",
        })

        provider, model = _pick_model(state, settings, is_generation=True)
        raw = await chat_completion(messages, settings, provider=provider, model=model)

        # Try to extract clean code if LLM wrapped it
        code = extract_openscad_from_text(raw) or raw
        code = postprocess(code)
        return {"generated_code": code}

    async def validate_node(state: PipelineState) -> dict:
        if state.get("skip_validation"):
            return {"validation": {"valid": True, "errors": [], "warnings": ["Validation skipped"]}}

        result = await validate_code(state["generated_code"], settings)
        # Also verify parameters are parseable
        try:
            parse_parameters(state["generated_code"])
        except Exception as e:
            result.warnings.append(f"Parameter parse warning: {e}")

        return {"validation": result.model_dump()}

    def after_validate(state: PipelineState) -> str:
        """Smart routing after validation:
        - Errors + refinements remaining → skip review, go straight to generate
        - Valid → go to review
        - Errors + max refinements → finalize
        """
        validation = state.get("validation", {})
        has_errors = bool(validation and validation.get("errors"))
        refinement_count = state.get("refinement_count", 0)
        max_refinements = state.get("max_refinements", 2)

        if has_errors and refinement_count < max_refinements:
            # Don't waste a review call on broken code
            return "generate"
        if has_errors and refinement_count >= max_refinements:
            return "finalize"
        return "review"

    async def review(state: PipelineState) -> dict:
        if state.get("skip_refinement"):
            params = parse_parameters(state["generated_code"])
            title = _parse_title_from_review("", state["user_prompt"])
            return {
                "review_feedback": "APPROVED",
                "final_code": state["generated_code"],
                "parameters": [p.model_dump() for p in params],
                "title": title,
            }

        messages = [
            {"role": "system", "content": AGENT_PROMPT},
            {
                "role": "user",
                "content": f"{REVIEW_CHECKLIST}\n\nUser request: {state['user_prompt']}\n\nGenerated code:\n```openscad\n{state['generated_code']}\n```\n\nValidation result: {state.get('validation', {})}",
            },
        ]
        provider, model = _pick_model(state, settings)
        feedback = await chat_completion(messages, settings, provider=provider, model=model)

        result: dict = {"review_feedback": feedback}
        title = _parse_title_from_review(feedback, state["user_prompt"])
        result["title"] = title

        if "APPROVED" in feedback:
            params = parse_parameters(state["generated_code"])
            result["final_code"] = state["generated_code"]
            result["parameters"] = [p.model_dump() for p in params]
        else:
            result["refinement_count"] = state.get("refinement_count", 0) + 1

        return result

    def should_loop(state: PipelineState) -> str:
        if "APPROVED" in state.get("review_feedback", ""):
            return END
        if state.get("refinement_count", 0) >= state.get("max_refinements", 2):
            return "finalize"
        return "generate"

    async def finalize(state: PipelineState) -> dict:
        """Accept code as-is after max refinement rounds."""
        params = parse_parameters(state["generated_code"])
        title = _parse_title_from_review(
            state.get("review_feedback", ""), state["user_prompt"]
        )
        return {
            "final_code": state["generated_code"],
            "parameters": [p.model_dump() for p in params],
            "title": title,
            "review_feedback": "APPROVED (max refinements reached)",
        }

    def entry_router(state: PipelineState) -> str:
        """Skip analyze_and_plan for from-scratch requests (no existing code)."""
        if not state.get("original_code"):
            return "generate"
        return "analyze_and_plan"

    # For from-scratch, set a deterministic plan from the user prompt
    async def setup_from_scratch(state: PipelineState) -> dict:
        """Set plan directly from user prompt for from-scratch generation."""
        return {
            "analysis": "New model from scratch.",
            "plan": f"- Create a new OpenSCAD model: {state['user_prompt']}",
        }

    graph = StateGraph(PipelineState)
    graph.add_node("setup_from_scratch", setup_from_scratch)
    graph.add_node("analyze_and_plan", analyze_and_plan)
    graph.add_node("generate", generate)
    graph.add_node("validate", validate_node)
    graph.add_node("review", review)
    graph.add_node("finalize", finalize)

    # Entry routing: from-scratch → setup → generate, existing code → analyze_and_plan → generate
    graph.set_conditional_entry_point(entry_router, {
        "generate": "setup_from_scratch",
        "analyze_and_plan": "analyze_and_plan",
    })
    graph.add_edge("setup_from_scratch", "generate")
    graph.add_edge("analyze_and_plan", "generate")
    graph.add_edge("generate", "validate")
    # Smart routing after validate
    graph.add_conditional_edges("validate", after_validate, {
        "generate": "generate",
        "review": "review",
        "finalize": "finalize",
    })
    graph.add_conditional_edges("review", should_loop)
    graph.add_edge("finalize", END)

    return graph.compile()
