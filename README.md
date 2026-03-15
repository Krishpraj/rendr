# rendr

A desktop application that turns natural language into manufacturable 3D models. Describe what you want — "a threaded bolt with a hex head" — and rendr generates parametric OpenSCAD code, compiles it to a 3D mesh in your browser, analyzes it for print readiness, and lets you refine it conversationally until it's ready to manufacture.

3D printing is becoming the backbone of rapid prototyping, medical devices, housing construction, and distributed manufacturing — but the design step remains a bottleneck. CAD tools have steep learning curves, and existing text-to-3D approaches produce visual meshes that look correct but can't actually be fabricated. rendr bridges that gap: anyone who can describe a part in words can get a printable model with real engineering constraints baked in.

## What Makes rendr Different

**Retrieval-augmented generation over real models.** Before the LLM writes a single line of code, rendr searches 7,378 real OpenSCAD models from Thingiverse using TF-IDF similarity. High-confidence matches return proven, working code instantly — zero LLM calls, zero hallucination. For novel requests, the top matches are passed as reference context so the LLM builds on patterns that are known to compile and print correctly. This hybrid approach means common parts (brackets, enclosures, gears) are near-instant and reliable, while novel geometry still gets the full generative pipeline.

**Self-correcting pipeline, not single-shot generation.** rendr runs a 7-stage LangGraph state machine that generates code, applies deterministic syntax fixes, compiles it against the real OpenSCAD engine, reviews it against manufacturing constraints, and loops back with structured feedback if it fails — automatically, up to a configurable number of rounds. Each stage is purpose-built: regex-based fixes handle the mechanical errors, compilation catches what regex misses, and agentic review validates the engineering quality. The pipeline streams progress to the UI in real-time via NDJSON so you see exactly where your model is in the process.

**Agentic review with real tool use.** The review stage isn't just an LLM reading code — it's a [Railtracks](https://github.com/railtracks/railtracks) agent that calls tool nodes to programmatically validate parameterization, check CSG operations, verify curve resolution, detect z-fighting, and audit module structure. Tool-based validation catches systematic issues that LLM-only review is unreliable at — like verifying every dimension is parameterized at the top of the file, or confirming that boolean operations use the correct manifold patterns.

**Client-side 3D compilation.** OpenSCAD runs as WASM in a Web Worker — the browser compiles `.scad` to STL directly with no server round-trip. This means instant feedback: edit a parameter slider and see the model recompile in seconds without touching the network. The server handles intelligence (code generation, review); the client handles geometry (compilation, rendering, analysis).

**Print-aware from generation to export.** rendr doesn't just show you a 3D model — it tells you if you can actually manufacture it. Real-time mesh analysis computes watertightness, wall thickness ratios, topological genus, and runs a 5-point print readiness checklist. Cost and time estimates across 6 materials (PLA, ABS, PETG, Resin, Nylon, TPU) let you make manufacturing decisions before opening a slicer. A layer-by-layer print simulation lets you visualize the actual build process. This closes the loop between design and fabrication — the person describing the part gets immediate feedback on whether it's producible, without needing manufacturing expertise.

**Parametric from the start.** Generated models aren't static geometry — dimensions are extracted as named parameters with interactive sliders. Adjust height, radius, wall thickness in real-time and watch the model recompile. This means a single generated design becomes a family of parts: one prompt produces a bolt, and the parameter controls let you resize it for M3 through M12 without another LLM call. For education, this makes the relationship between code and geometry tangible — students can see how changing `thread_pitch` reshapes the helix in real-time.

## Features

### Code Generation Pipeline

The backend runs a LangGraph state machine with 7 stages:

1. **Retrieve** — TF-IDF similarity search over 7,378 OpenSCAD models. Direct matches (score >= 0.35) return dataset code with zero LLM calls. Lower scores pass the top 3 results as reference context.

2. **Analyze & Plan** — Breaks down the prompt into a structured plan: modules to create, parameters to extract, CSG tree structure.

3. **Generate** — Produces OpenSCAD code from the plan, reference models, and any review feedback from previous rounds.

4. **Syntax Fix** — Deterministic regex pass that catches common OpenSCAD mistakes: geometry assigned to variables, bare variable usage, `let()` wrapping geometry, missing semicolons.

5. **Validate** — Compiles against OpenSCAD to verify syntax and checks parameter parseability.

6. **Review** — Railtracks agent with tool nodes runs an 11-point checklist covering parameterization, CSG operations, curve resolution, z-fighting prevention, and module structure. Returns "APPROVED" or structured feedback for the next generate round.

7. **Finalize** — Accepts code after max refinement rounds if the review loop hasn't converged.

### 3D Viewer

- Solid and wireframe view modes
- Perspective and orthographic cameras
- Orbit controls with gizmo viewcube
- Adjustable material properties: brightness, roughness, metalness, flat shading
- 9 color presets (silver, gold, copper, steel, etc.)
- Direct STL download

### Mesh Analysis

- **Geometry**: vertex, triangle, and edge counts
- **Dimensions**: bounding box (W x H x D) and center of mass
- **Physical properties**: surface area and volume
- **Topology**: watertight detection, genus (topological holes), Euler characteristic
- **Print readiness**: 5-point checklist — manifold mesh, valid geometry, positive volume, wall thickness ratio, simple topology
- **Print estimates**: weight, time, and cost for 6 materials (PLA, ABS, PETG, Resin, Nylon, TPU)

### Parametric Controls

- Sliders for numeric values with auto-detected min/max/step ranges
- Toggles for booleans, grouped parameters via `/* [GroupName] */` markers
- Real-time recompilation (600ms debounce)
- Reset to defaults

### Print Simulation

- Layer-by-layer build visualization with clipping plane
- Animated nozzle indicator at current layer height
- Playback controls with adjustable speed (0.25x to 5x)
- Layer count, height progress, and build percentage

### Code Editor

CodeMirror 6 with syntax highlighting, bracket matching, code folding, search/replace, and undo/redo. Changes propagate to the 3D viewer with 800ms debounce.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 33 |
| Frontend | React 18, TypeScript, Tailwind CSS |
| 3D rendering | Three.js via React Three Fiber |
| Code editor | CodeMirror 6 |
| 3D compilation | OpenSCAD WASM (client-side, Web Worker) |
| Backend | FastAPI, Python 3.11+ |
| Pipeline orchestration | LangGraph |
| Review agent | Railtracks |
| LLM | Claude Sonnet 4 (primary), Claude Haiku 4.5 (fast steps) |
| Model retrieval | TF-IDF + cosine similarity over 7,378 Thingiverse models |

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.11
- **An LLM API key** — Anthropic (recommended), OpenAI, or a local Ollama instance
- **OpenSCAD** (optional) — only needed for server-side PNG export. The 3D viewer uses WASM and works without it

## Setup

### 1. Clone

```bash
git clone https://github.com/Krishpraj/rendr.git
cd rendr
```

### 2. Backend

```bash
cd rendr-api

# Create a virtual environment (recommended)
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# Install
pip install -e .
```

Create `rendr-api/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

That's the minimum. See [Configuration](#configuration) for all options.

### 3. Frontend

```bash
cd rendr-app
npm install
```

### 4. Run

**Option A — Dev script (Windows PowerShell):**

```powershell
.\start-dev.ps1
```

Opens two terminals: API server + Electron app.

**Option B — Manual (two terminals):**

```bash
# Terminal 1: backend
cd rendr-api
uvicorn rendr_api.main:app --reload

# Terminal 2: frontend
cd rendr-app
npm run dev
```

The API starts on `http://localhost:8000`. The Electron app connects automatically.

## Configuration

All settings go in `rendr-api/.env`:

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | `anthropic`, `openai`, or `ollama` |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | Primary model for generation |
| `FAST_PROVIDER` | `anthropic` | Provider for validation/review steps |
| `FAST_MODEL` | `claude-haiku-4-5-20251001` | Fast model for lightweight steps |
| `ANTHROPIC_API_KEY` | — | Required for Anthropic provider |
| `OPENAI_API_KEY` | — | Required for OpenAI provider |
| `OPENAI_API_BASE` | — | Custom OpenAI-compatible endpoint |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OPENSCAD_PATH` | `openscad` | Path to OpenSCAD binary (for PNG export) |
| `TEMPERATURE` | `0.0` | LLM temperature |
| `MAX_REFINEMENT_ROUNDS` | `2` | Max generate→review loop iterations |
| `HOST` | `0.0.0.0` | API bind host |
| `PORT` | `8000` | API bind port |

## Project Structure

```
rendr/
├── rendr-api/                  # FastAPI backend
│   ├── rendr_api/
│   │   ├── main.py             # App entry, CORS, router mounting
│   │   ├── config.py           # Pydantic settings from .env
│   │   ├── routers/            # /health, /edit, /render, /projects endpoints
│   │   ├── services/
│   │   │   ├── pipeline.py     # LangGraph state machine (7 stages)
│   │   │   ├── review_agent.py # Railtracks agent with tool nodes
│   │   │   ├── openscad.py     # OpenSCAD CLI wrapper
│   │   │   ├── retrieval.py    # TF-IDF model search over dataset
│   │   │   └── parameters.py   # OpenSCAD parameter extraction
│   │   └── models/             # Pydantic request/response schemas
│   ├── train-00000-of-00001.parquet  # 7,378 OpenSCAD models
│   └── pyproject.toml
├── rendr-app/                  # Electron + React frontend
│   ├── src/
│   │   ├── main/index.ts       # Electron main process
│   │   ├── preload/            # IPC bridge
│   │   └── renderer/src/
│   │       ├── components/
│   │       │   ├── chat/       # Chat panel with pipeline progress
│   │       │   ├── preview/    # 3D viewer, code editor, STL renderer
│   │       │   ├── workspace/  # Analysis, parameters, print sim panels
│   │       │   └── welcome/    # Home screen with project cards
│   │       ├── contexts/       # Project, Chat, MeshAnalytics state
│   │       ├── hooks/          # useEditStream, useRender, useBackendHealth
│   │       ├── lib/            # API client, mesh analytics, WASM bridge
│   │       └── workers/        # OpenSCAD WASM Web Worker
│   └── package.json
└── start-dev.ps1               # Dev startup script (Windows)
```

## Troubleshooting

**"Offline" in status bar** — Backend isn't running. Start it with `uvicorn rendr_api.main:app --reload` from `rendr-api/`.

**3D preview stuck on "Building 3D model..."** — The WASM compiler hit an error. Open DevTools (Ctrl+Shift+I) and check console for OpenSCAD output. Usually a syntax error in the generated code.

**Export PNG fails** — Server-side rendering requires the OpenSCAD binary. Install from [openscad.org](https://openscad.org/downloads.html) and ensure it's in your PATH or set `OPENSCAD_PATH`.

**Pipeline keeps looping** — The review agent is rejecting the code. Check the chat for feedback. You can reduce `MAX_REFINEMENT_ROUNDS` in `.env` or use "fast" mode in the chat which skips validation and review.

**Model looks wrong but code compiles** — Switch to the Analysis tab and check the print readiness checklist. Non-watertight meshes or high genus values usually indicate geometry issues in the OpenSCAD code.
