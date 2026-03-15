# Rendr LangGraph Pipeline

## Overview

The rendr pipeline converts natural language prompts into valid, parametric OpenSCAD code using a multi-step LangGraph state machine. It combines dataset retrieval (7,378 real OpenSCAD models) with LLM generation, syntax validation, and iterative refinement.

## Pipeline Flow

```
                         User Request
                              |
                              v
                        +-----------+
                        | retrieve  |  Search parquet dataset (TF-IDF)
                        +-----------+
                              |
                   +----------+----------+
                   |          |          |
            score >= 0.35   score < 0.35  has existing code
            (no existing     (no existing  to modify
             code)            code)
                   |          |          |
                   v          v          v
            +------------+  +----------+  +------------------+
            | direct_done|  | setup_   |  | analyze_and_plan |
            |   (END)    |  | from_    |  | (LLM: JSON plan) |
            +------------+  | scratch  |  +------------------+
                            +----------+          |
                                  |               |
                                  +-------+-------+
                                          |
                                          v
                                   +----------+
                               +-->| generate |  LLM generates OpenSCAD code
                               |   +----------+  (with dataset references if available)
                               |        |
                               |        v
                               |  +------------+
                               |  | syntax_fix |  Regex detects issues ->
                               |  +------------+  LLM fixes OpenSCAD syntax errors
                               |        |
                               |        v
                               |   +----------+
                               |   | validate  |  OpenSCAD CLI compilation check
                               |   +----------+
                               |        |
                               |   errors?  +--- yes + refinements left --+
                               |        |                                  |
                               |        | no errors                        |
                               |        v                                  |
                               |   +----------+                            |
                               |   |  review   |  Railtracks agent         |
                               |   +----------+  (tool-based code checks)  |
                               |        |                                  |
                               |   APPROVED?                               |
                               |   yes     no                              |
                               |    |       +------------------------------+
                               |    |       |
                               |    |       +-- refinements left? ---> generate (loop)
                               |    |       |
                               |    |       +-- max reached ----+
                               |    v                           v
                               | +-----+                  +----------+
                               | | END |                  | finalize |
                               | +-----+                  +----------+
                               |                               |
                               +-------------------------------+
                                                               v
                                                            +-----+
                                                            | END |
                                                            +-----+
```

## Node Details

### 1. `retrieve`
- **Purpose**: Search the parquet dataset (7,378 OpenSCAD models from Thingiverse) for similar models
- **Method**: TF-IDF vectorization + cosine similarity on model names and descriptions
- **Threshold**: Score >= 0.35 triggers a **direct match** (returns dataset code as-is, no LLM)
- **Below threshold**: Passes top-3 references to the `generate` node as context
- **State output**: `retrieved_references`, `direct_match`, and if direct: `final_code`, `parameters`, `title`

### 2. `direct_done`
- **Purpose**: No-op passthrough for direct dataset matches
- **When**: Top match score >= 0.35 and no existing code to modify
- **Result**: Pipeline ends immediately with dataset code — zero LLM calls, instant response

### 3. `setup_from_scratch`
- **Purpose**: Set a deterministic plan for new model generation (no LLM needed)
- **State output**: `analysis`, `plan`

### 4. `analyze_and_plan`
- **Purpose**: LLM analyzes existing code and produces a structured modification plan
- **Model**: Fast model (Haiku) when `fast=True`, otherwise primary model
- **Output format**: JSON with `analysis`, `plan_steps`, `affected_modules`, `new_parameters`
- **State output**: `analysis`, `plan`

### 5. `generate`
- **Purpose**: LLM generates OpenSCAD code based on plan + optional dataset references
- **Model**: Always uses primary model (Sonnet) — this is the creative step
- **Inputs**: User prompt, plan, existing code (if editing), review feedback (if looping), dataset references
- **System prompt**: `STRICT_CODE_PROMPT` with OpenSCAD syntax rules, parameterization rules, and examples
- **Post-processing**: Strips markdown fences, normalizes whitespace, auto-injects `$fn` if missing
- **State output**: `generated_code`

### 6. `syntax_fix`
- **Purpose**: Catch and fix common OpenSCAD syntax errors the LLM makes
- **Trigger**: Only runs if regex detects likely issues (e.g., `base = difference() { ... }`)
- **Common fixes**:
  - Geometry assigned to variables → convert to modules
  - Bare variable names used as geometry → convert to module calls
  - `let()` used with geometry → inline the geometry
  - Missing semicolons → add them
- **Model**: Fast model — focused syntax fix, not creative generation
- **State output**: `generated_code` (fixed)

### 7. `validate`
- **Purpose**: Compile-check the code using the OpenSCAD CLI
- **Command**: `openscad --export-format echo` (checks syntax without rendering)
- **Also**: Verifies parameters are parseable
- **State output**: `validation` (with `valid`, `errors`, `warnings`)

**Routing after validate:**
| Condition | Route |
|---|---|
| Errors + refinements remaining | `generate` (skip review, fix errors first) |
| Errors + max refinements reached | `finalize` (give up) |
| No errors | `review` |

### 8. `review`
- **Purpose**: Quality review of the generated code against an 11-point checklist
- **Method**: Railtracks agent with two tool nodes:
  - `check_parameters()`: Validates dimensions are parameterized at top
  - `check_geometry()`: Checks CSG ops, `$fn`, z-fighting prevention, colors, modules
- **Fallback**: Direct LLM call if Railtracks agent fails
- **Output**: `APPROVED` or structured feedback describing issues
- **Also extracts**: `TITLE: <name>` for the 3D object
- **State output**: `review_feedback`, `title`, and if approved: `final_code`, `parameters`

**Routing after review:**
| Condition | Route |
|---|---|
| `APPROVED` in feedback | `END` |
| Refinements remaining | `generate` (loop with feedback) |
| Max refinements reached | `finalize` |

### 9. `finalize`
- **Purpose**: Accept code as-is after max refinement rounds
- **State output**: `final_code`, `parameters`, `title`, `review_feedback` (forced APPROVED)

## State Schema (`PipelineState`)

| Field | Type | Description |
|---|---|---|
| `user_prompt` | `str` | The user's natural language request |
| `original_code` | `str` | Existing code to modify (empty for from-scratch) |
| `part_labels` | `list[dict]` | Part labels with @N indices, colors, bboxes |
| `analysis` | `str` | Code analysis from analyze_and_plan |
| `plan` | `str` | Modification plan (steps) |
| `generated_code` | `str` | Current generated/fixed code |
| `validation` | `dict` | OpenSCAD compilation result |
| `review_feedback` | `str` | Review agent feedback or "APPROVED" |
| `refinement_count` | `int` | Current refinement iteration |
| `max_refinements` | `int` | Max allowed refinement rounds (default: 2) |
| `final_code` | `str` | Final approved code |
| `parameters` | `list[dict]` | Extracted parametric dimensions |
| `title` | `str` | Short name for the 3D object |
| `retrieved_references` | `str` | Formatted dataset references for LLM context |
| `direct_match` | `bool` | Whether a direct dataset match was used |
| `provider` | `str` | LLM provider (anthropic/openai/ollama) |
| `model` | `str` | LLM model name |
| `fast` | `bool` | Use fast model for non-generation steps |
| `conversation_history` | `list[dict]` | Multi-turn chat messages |

## Dataset Retrieval

The parquet file (`train-00000-of-00001.parquet`) contains 7,378 OpenSCAD models from Thingiverse with:
- `name`: Model name
- `scad`: OpenSCAD source code
- `fakeprompt`: Generated natural language description
- `thingiverse_id`: Source ID

**Search method**: TF-IDF with bigrams over `name + fakeprompt`, cosine similarity ranking.

**Two modes**:
1. **Direct match** (score >= 0.35): Return dataset code directly. No LLM call. Instant, reliable.
2. **Reference mode** (score < 0.35): Pass top-3 matches as context to the LLM for inspiration.

## Streaming Protocol

The `/edit` endpoint supports NDJSON streaming. Each line is a JSON object:

```json
{"stage": "retrieve", "status": "running"}
{"stage": "retrieve", "status": "done", "matches": 3}
{"stage": "analyze_and_plan", "status": "running"}
{"stage": "analyze_and_plan", "status": "done", "analysis": "...", "plan": "..."}
{"stage": "generate", "status": "running", "round": 0}
{"stage": "generate", "status": "done", "round": 0}
{"stage": "syntax_fix", "status": "running"}
{"stage": "syntax_fix", "status": "done"}
{"stage": "validate", "status": "running"}
{"stage": "validate", "status": "done", "validation": {...}}
{"stage": "review", "status": "running", "round": 0}
{"stage": "review", "status": "done", "round": 0, "approved": true}
{"stage": "complete", "status": "done", "result": {...}}
```

For direct matches, streaming skips straight to complete:
```json
{"stage": "retrieve", "status": "running"}
{"stage": "retrieve", "status": "done", "matches": 3}
{"stage": "complete", "status": "done", "result": {...}, "direct_match": true}
```

## Model Selection

| Step | Default Model | Fast Mode |
|---|---|---|
| `analyze_and_plan` | Sonnet 4 | Haiku 4.5 |
| `generate` | Sonnet 4 | Sonnet 4 (always) |
| `syntax_fix` | Sonnet 4 | Haiku 4.5 |
| `review` | Sonnet 4 | Haiku 4.5 |

## Configuration

All settings via environment variables or `.env`:

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | Primary LLM provider |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | Primary model |
| `FAST_PROVIDER` | `anthropic` | Fast model provider |
| `FAST_MODEL` | `claude-haiku-4-5-20251001` | Fast model |
| `MAX_REFINEMENT_ROUNDS` | `2` | Max generate-validate-review loops |
| `OPENSCAD_PATH` | `openscad` | Path to OpenSCAD binary |
