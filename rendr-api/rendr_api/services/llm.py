"""Async LLM wrapper using litellm."""

import re

from litellm import acompletion

from rendr_api.config import Settings


async def chat_completion(
    messages: list[dict],
    settings: Settings,
    provider: str | None = None,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int = 8192,
) -> str:
    """Call LLM via litellm and return the text response."""
    provider = provider or settings.llm_provider
    model = model or settings.llm_model
    temperature = temperature if temperature is not None else settings.temperature

    # Build the model string litellm expects
    model_str = _build_model_string(provider, model)

    # Set API keys/base based on provider
    kwargs: dict = {
        "model": model_str,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    if provider == "anthropic" and settings.anthropic_api_key:
        kwargs["api_key"] = settings.anthropic_api_key
    elif provider == "openai":
        if settings.openai_api_key:
            kwargs["api_key"] = settings.openai_api_key
        if settings.openai_api_base:
            kwargs["api_base"] = settings.openai_api_base
            # litellm strips the openai/ prefix before sending to the API,
            # so re-wrap the full model name so the endpoint receives it as-is
            kwargs["model"] = f"openai/{model}"
    elif provider == "ollama":
        kwargs["api_base"] = settings.ollama_host

    response = await acompletion(**kwargs)
    return response.choices[0].message.content


def _build_model_string(provider: str, model: str) -> str:
    """Build litellm model identifier from provider + model name."""
    if provider == "ollama":
        if not model.startswith("ollama/"):
            return f"ollama/{model}"
    elif provider == "anthropic":
        if not model.startswith("anthropic/") and not model.startswith("claude"):
            return f"anthropic/{model}"
    elif provider == "openai":
        if not model.startswith("openai/"):
            return f"openai/{model}"
    return model


def extract_openscad_from_text(text: str) -> str | None:
    """Detect and extract OpenSCAD code from LLM text responses.

    Port of CADAM's extractOpenSCADCodeFromText + scoreOpenSCADCode.
    """
    if not text:
        return None

    # Try markdown code blocks first
    code_block_regex = re.compile(r"```(?:openscad)?\s*\n?([\s\S]*?)\n?```")
    best_code = None
    best_score = 0

    for match in code_block_regex.finditer(text):
        code = match.group(1).strip()
        score = _score_openscad(code)
        if score > best_score:
            best_score = score
            best_code = code

    if best_code and best_score >= 3:
        return best_code

    # Check if raw text is OpenSCAD
    raw_score = _score_openscad(text)
    if raw_score >= 5:
        return text.strip()

    return None


def _score_openscad(code: str) -> int:
    """Score how likely text is to be OpenSCAD code."""
    if not code or len(code) < 20:
        return 0

    score = 0
    patterns = [
        r"\b(cube|sphere|cylinder|polyhedron)\s*\(",
        r"\b(union|difference|intersection)\s*\(\s*\)",
        r"\b(translate|rotate|scale|mirror)\s*\(",
        r"\b(linear_extrude|rotate_extrude)\s*\(",
        r"\b(module|function)\s+\w+\s*\(",
        r"\$fn\s*=",
        r"\bfor\s*\(\s*\w+\s*=\s*\[",
        r";\s*$",
        r"//.*$",
    ]

    for pattern in patterns:
        matches = re.findall(pattern, code, re.MULTILINE | re.IGNORECASE)
        if matches:
            score += len(matches)

    var_decls = re.findall(r"^\s*\w+\s*=\s*[^;]+;", code, re.MULTILINE)
    if var_decls:
        score += min(len(var_decls), 5)

    return score
