"""LangGraph + Railtracks pipeline: analyze_and_plan → generate → validate → review (with loop).

The review step uses a Railtracks agent with tool-based code checks.
"""

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
    SYNTAX_FIX_PROMPT,
)
from rendr_api.services.retrieval import DIRECT_MATCH_THRESHOLD, ScadRetriever
from rendr_api.services.review_agent import build_review_agent


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

        messages = []
        # Prepend conversation history if available
        if state.get("conversation_history"):
            messages.append({"role": "system", "content": ANALYZE_AND_PLAN_PROMPT})
            for msg in state["conversation_history"]:
                messages.append(msg)
            messages.append({
                "role": "user",
                "content": f"Now analyze and plan for this new request:\n\nUser request: {state['user_prompt']}{code_context}{part_context}",
            })
        else:
            messages = [
                {"role": "system", "content": ANALYZE_AND_PLAN_PROMPT},
                {
                    "role": "user",
                    "content": f"Analyze this OpenSCAD project and produce a modification plan.\n\nUser request: {state['user_prompt']}{code_context}{part_context}",
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

        # Include retrieved reference models from the dataset
        ref_context = ""
        if state.get("retrieved_references"):
            ref_context = f"\n\n{state['retrieved_references']}"

        messages = [
            {"role": "system", "content": STRICT_CODE_PROMPT},
        ]
        # Include conversation history in generate for context
        if state.get("conversation_history"):
            for msg in state["conversation_history"]:
                messages.append(msg)
        messages.append({
            "role": "user",
            "content": f"Generate OpenSCAD code for: {state['user_prompt']}\n\nPlan:\n{state['plan']}{existing}{feedback}{ref_context}",
        })

        provider, model = _pick_model(state, settings, is_generation=True)
        raw = await chat_completion(messages, settings, provider=provider, model=model)

        # Try to extract clean code if LLM wrapped it
        code = extract_openscad_from_text(raw) or raw
        code = postprocess(code)
        return {"generated_code": code}

    def _has_syntax_issues(code: str) -> bool:
        """Quick regex check for common OpenSCAD syntax mistakes."""
        import re as _re
        # Pattern: variable = geometry_op() { ... } (geometry assigned to variable)
        if _re.search(r'\b\w+\s*=\s*(?:difference|union|intersection|hull|minkowski|linear_extrude|rotate_extrude|cube|sphere|cylinder|polyhedron|circle|square|polygon)\s*\(', code):
            return True
        # Pattern: using bare variable names as geometry: union() { varname; }
        # This is trickier — check for bare identifiers inside CSG blocks that aren't function calls
        return False

    async def syntax_fix(state: PipelineState) -> dict:
        """Check generated code for OpenSCAD syntax errors and fix them with LLM.

        Only calls the LLM if a quick regex detects likely issues,
        to avoid wasting API calls on clean code.
        """
        code = state["generated_code"]
        if not _has_syntax_issues(code):
            return {}

        messages = [
            {"role": "system", "content": SYNTAX_FIX_PROMPT},
            {"role": "user", "content": code},
        ]
        # Use fast model for this — it's a focused fix, not creative generation
        provider, model = _pick_model(state, settings)
        raw = await chat_completion(messages, settings, provider=provider, model=model)
        fixed = extract_openscad_from_text(raw) or raw
        fixed = postprocess(fixed)
        return {"generated_code": fixed}

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

        # Use Railtracks review agent with tool-based checks
        provider, model = _pick_model(state, settings)
        try:
            review_flow = build_review_agent(provider, model, settings)
            review_input = (
                f"{REVIEW_CHECKLIST}\n\n"
                f"User request: {state['user_prompt']}\n\n"
                f"Generated code:\n```openscad\n{state['generated_code']}\n```\n\n"
                f"Validation result: {state.get('validation', {})}"
            )
            result = await review_flow.ainvoke(review_input)
            feedback = str(result)
        except Exception:
            # Fallback to direct LLM call if railtracks agent fails
            messages = [
                {"role": "system", "content": AGENT_PROMPT},
                {
                    "role": "user",
                    "content": f"{REVIEW_CHECKLIST}\n\nUser request: {state['user_prompt']}\n\nGenerated code:\n```openscad\n{state['generated_code']}\n```\n\nValidation result: {state.get('validation', {})}",
                },
            ]
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
        """Route after retrieve: direct match → END, else normal flow."""
        if state.get("direct_match"):
            return "direct_done"
        if not state.get("original_code"):
            return "generate"
        return "analyze_and_plan"

    async def retrieve(state: PipelineState) -> dict:
        """Search the parquet dataset for similar OpenSCAD models.

        If the top match score >= DIRECT_MATCH_THRESHOLD and there's no
        existing code to modify, short-circuit: return the matched code
        directly without calling the LLM at all.
        """
        try:
            retriever = ScadRetriever.get_instance()
            results = retriever.search(state["user_prompt"], top_k=3)
        except Exception:
            return {"retrieved_references": "", "direct_match": False}

        if not results:
            return {"retrieved_references": "", "direct_match": False}

        best = results[0]
        # Direct return: strong match + from-scratch (no existing code to edit)
        if best.score >= DIRECT_MATCH_THRESHOLD and not state.get("original_code"):
            code = postprocess(best.scad)
            params = parse_parameters(code)
            # Title from the dataset entry name
            title = best.name
            if len(title) > 27:
                title = title[:24] + "..."
            return {
                "direct_match": True,
                "generated_code": code,
                "final_code": code,
                "parameters": [p.model_dump() for p in params],
                "title": title,
                "analysis": f"Direct match from dataset: {best.name} (score: {best.score:.2f})",
                "plan": "Using existing model from dataset — no generation needed.",
                "review_feedback": "APPROVED (direct dataset match)",
                "retrieved_references": "",
            }

        # No direct match — pass references to the LLM for inspiration
        references = retriever.format_references(results)
        return {"retrieved_references": references, "direct_match": False}

    # For from-scratch, set a deterministic plan from the user prompt
    async def setup_from_scratch(state: PipelineState) -> dict:
        """Set plan directly from user prompt for from-scratch generation."""
        return {
            "analysis": "New model from scratch.",
            "plan": f"- Create a new OpenSCAD model: {state['user_prompt']}",
        }

    async def direct_done(state: PipelineState) -> dict:
        """No-op node for direct dataset matches — everything is already set."""
        return {}

    graph = StateGraph(PipelineState)
    graph.add_node("retrieve", retrieve)
    graph.add_node("direct_done", direct_done)
    graph.add_node("setup_from_scratch", setup_from_scratch)
    graph.add_node("analyze_and_plan", analyze_and_plan)
    graph.add_node("generate", generate)
    graph.add_node("syntax_fix", syntax_fix)
    graph.add_node("validate", validate_node)
    graph.add_node("review", review)
    graph.add_node("finalize", finalize)

    # Entry: always retrieve first, then route
    # direct_done → END (dataset match, no LLM needed)
    # generate → setup_from_scratch → generate (from-scratch)
    # analyze_and_plan → generate (editing existing code)
    graph.set_entry_point("retrieve")
    graph.add_conditional_edges("retrieve", entry_router, {
        "direct_done": "direct_done",
        "generate": "setup_from_scratch",
        "analyze_and_plan": "analyze_and_plan",
    })
    graph.add_edge("direct_done", END)
    graph.add_edge("setup_from_scratch", "generate")
    graph.add_edge("analyze_and_plan", "generate")
    graph.add_edge("generate", "syntax_fix")
    graph.add_edge("syntax_fix", "validate")
    # Smart routing after validate
    graph.add_conditional_edges("validate", after_validate, {
        "generate": "generate",
        "review": "review",
        "finalize": "finalize",
    })
    graph.add_conditional_edges("review", should_loop)
    graph.add_edge("finalize", END)

    return graph.compile()
