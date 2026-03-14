"""Railtracks-based review agent for the code review pipeline step."""

import railtracks as rt

from rendr_api.config import Settings
from rendr_api.services.parameters import parse_parameters
from rendr_api.services.prompts import AGENT_PROMPT


@rt.function_node
def check_parameters(code: str) -> str:
    """Validate that all dimensions are parameterized at the top of the OpenSCAD file."""
    params = parse_parameters(code)
    if not params:
        return "FAIL: No parameterized dimensions found at the top of the file."
    names = [p.name for p in params]
    return f"PASS: {len(params)} parameters found — {', '.join(names)}"


@rt.function_node
def check_geometry(code: str) -> str:
    """Check for proper CSG operations, manifold geometry, and best practices."""
    issues = []
    if "difference()" not in code and "union()" not in code:
        issues.append("No CSG operations (difference/union) found")
    if "$fn" not in code:
        issues.append("$fn not set for curved surfaces")
    if "0.01" not in code:
        issues.append("No z-fighting prevention (0.01mm extension) detected")
    if "color(" not in code:
        issues.append("No semantic colors applied")
    if "module " not in code:
        issues.append("No modules used for reusable geometry")
    if not issues:
        return "PASS: All geometry checks passed."
    return "ISSUES:\n" + "\n".join(f"- {i}" for i in issues)


def build_review_agent(provider: str, model: str, settings: Settings) -> rt.Flow:
    """Build a railtracks Flow for the review step."""
    if provider == "anthropic":
        llm = rt.llm.AnthropicLLM(model, api_key=settings.anthropic_api_key)
    elif provider == "openai":
        llm = rt.llm.OpenAILLM(
            model,
            api_key=settings.openai_api_key or "dummy",
            base_url=settings.openai_api_base,
        )
    else:
        llm = rt.llm.OllamaLLM(model)

    agent = rt.agent_node(
        "OpenSCAD Reviewer",
        tool_nodes=(check_parameters, check_geometry),
        llm=llm,
        system_message=AGENT_PROMPT,
    )
    return rt.Flow(name="review-agent", entry_point=agent)
