"""Deterministic post-processing for generated OpenSCAD code. Zero LLM cost."""

import re


def strip_markdown_fences(code: str) -> str:
    """Remove ```openscad ``` wrappers if present."""
    pattern = re.compile(r"^```(?:openscad)?\s*\n([\s\S]*?)\n```\s*$")
    match = pattern.match(code.strip())
    if match:
        return match.group(1)
    return code


def normalize_whitespace(code: str) -> str:
    """Tabs to 4 spaces, strip trailing whitespace, ensure trailing newline."""
    lines = code.expandtabs(4).splitlines()
    lines = [line.rstrip() for line in lines]
    result = "\n".join(lines)
    if not result.endswith("\n"):
        result += "\n"
    return result


def ensure_fn_for_curves(code: str) -> str:
    """Inject $fn = 32; if code uses curved primitives but never sets $fn."""
    curve_patterns = [
        r"\bsphere\s*\(",
        r"\bcylinder\s*\(",
        r"\bcircle\s*\(",
        r"\brotate_extrude\s*\(",
    ]
    has_curves = any(re.search(p, code) for p in curve_patterns)
    has_fn = bool(re.search(r"\$fn\s*=", code))

    if has_curves and not has_fn:
        # Insert $fn = 32; after the last top-level parameter line
        lines = code.splitlines()
        insert_idx = 0
        for i, line in enumerate(lines):
            stripped = line.strip()
            # Top-level variable assignment (not inside a block)
            if re.match(r"^\w+\s*=\s*[^;]+;", stripped):
                insert_idx = i + 1
        lines.insert(insert_idx, "$fn = 32;")
        code = "\n".join(lines) + "\n"

    return code


def postprocess(code: str) -> str:
    """Run all post-processing steps in sequence."""
    code = strip_markdown_fences(code)
    code = normalize_whitespace(code)
    code = ensure_fn_for_curves(code)
    return code
