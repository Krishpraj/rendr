# rendr

> type words → get a 3D model ready to print

rendr is a little desktop app that turns plain English into manufacturable 3D models. describe what you want, watch it generate OpenSCAD code, compile to a mesh right in your browser, and refine it until it's ready to send to your printer.

this is a personal project — rough edges and all.

---

## what it does

```
"a threaded bolt with a hex head"
        ↓
  OpenSCAD code
        ↓
  3D mesh in browser
        ↓
  print analysis + STL download
```

**generation pipeline** — 7-stage LangGraph state machine. starts with a TF-IDF similarity search over ~7k OpenSCAD models; direct matches skip the LLM entirely. otherwise it plans → generates → fixes syntax → validates → reviews → refines.

**3D viewer** — orbit controls, wireframe/solid modes, 9 color presets, adjustable material properties, STL download.

**mesh analysis** — watertight check, genus, Euler characteristic, surface area, volume, center of mass, and a 5-point print readiness checklist with weight/time/cost estimates for 6 materials.

**parametric controls** — auto-detected sliders and toggles for any parameter in the code. tweak values and the model recompiles live.

**print simulation** — layer-by-layer build animation with playback controls.

**code editor** — CodeMirror 6 with syntax highlighting. edit the code directly and the viewer updates.

---

## stack

| | |
|---|---|
| desktop shell | Electron 33 |
| frontend | React 18 · TypeScript · Tailwind CSS |
| 3D | Three.js via React Three Fiber |
| editor | CodeMirror 6 |
| 3D compilation | OpenSCAD WASM (Web Worker, no install needed) |
| backend | FastAPI · Python 3.11+ |
| db | SQLite via aiosqlite |
| pipeline | LangGraph |
| review agent | Railtracks |
| LLMs | Claude Sonnet 4 (generation) · Claude Haiku 4.5 (fast steps) |
| retrieval | TF-IDF + cosine similarity · 7,378 Thingiverse models |

---

## getting started

### you'll need

- **Node.js** >= 18
- **Python** >= 3.11
- **An API key** — Anthropic (recommended), OpenAI, or a local Ollama instance
- **OpenSCAD** *(optional)* — only for server-side PNG export. the 3D viewer works without it via WASM

### 1 · clone

```bash
git clone https://github.com/Krishpraj/rendr.git
cd rendr
```

### 2 · backend

```bash
cd rendr-api
python -m venv .venv

# windows
.venv\Scripts\activate
# mac / linux
source .venv/bin/activate

pip install -e .
```

create `rendr-api/.env` and drop in your key:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### 3 · frontend

```bash
cd rendr-app
npm install
```

### 4 · run

**windows (powershell):**
```powershell
.\start-dev.ps1
```

**everyone else (two terminals):**
```bash
# terminal 1
cd rendr-api && uvicorn rendr_api.main:app --reload

# terminal 2
cd rendr-app && npm run dev
```

API runs at `http://localhost:8000`. Electron connects automatically.

---

## configuration

all options go in `rendr-api/.env`

| variable | default | what it does |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | `anthropic` · `openai` · `ollama` |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | primary generation model |
| `FAST_PROVIDER` | `anthropic` | provider for lightweight steps |
| `FAST_MODEL` | `claude-haiku-4-5-20251001` | fast model for validation/review |
| `ANTHROPIC_API_KEY` | — | required for Anthropic |
| `OPENAI_API_KEY` | — | required for OpenAI |
| `OPENAI_API_BASE` | — | custom OpenAI-compatible endpoint |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OPENSCAD_PATH` | `openscad` | path to binary (PNG export only) |
| `TEMPERATURE` | `0.0` | LLM temperature |
| `MAX_REFINEMENT_ROUNDS` | `2` | max generate→review iterations |
| `HOST` | `0.0.0.0` | API bind host |
| `PORT` | `8000` | API bind port |

---

## project structure

```
rendr/
├── rendr-api/                  # FastAPI backend
│   ├── rendr_api/
│   │   ├── main.py             # entry point, CORS, router mounting
│   │   ├── config.py           # pydantic settings from .env
│   │   ├── routers/            # /health /edit /render /projects
│   │   └── services/
│   │       ├── pipeline.py     # LangGraph 7-stage state machine
│   │       ├── review_agent.py # Railtracks agent + tool nodes
│   │       ├── retrieval.py    # TF-IDF search over dataset
│   │       ├── parameters.py   # OpenSCAD parameter extraction
│   │       └── database.py     # SQLite (projects, chat history)
│   └── train-00000-of-00001.parquet   # 7,378 OpenSCAD models
│
└── rendr-app/                  # Electron + React frontend
    └── src/renderer/src/
        ├── components/
        │   ├── chat/           # chat panel + pipeline progress
        │   ├── preview/        # 3D viewer, code editor, STL renderer
        │   ├── workspace/      # analysis, parameters, print sim
        │   └── welcome/        # home screen + project cards
        ├── contexts/           # Project, Chat, MeshAnalytics state
        ├── hooks/              # useEditStream, useRender, useBackendHealth
        ├── lib/                # API client, mesh analytics, WASM bridge
        └── workers/            # OpenSCAD WASM Web Worker
```

---

## troubleshooting

**status bar says "Offline"**
backend isn't running — `cd rendr-api && uvicorn rendr_api.main:app --reload`

**stuck on "Building 3D model..."**
WASM hit an error. open DevTools (`Ctrl+Shift+I`) and check the console for OpenSCAD output. usually a syntax error in generated code.

**PNG export fails**
needs the OpenSCAD binary installed and in PATH (or set `OPENSCAD_PATH`). download at [openscad.org](https://openscad.org/downloads.html).

**pipeline keeps looping**
the review agent is rejecting the code. lower `MAX_REFINEMENT_ROUNDS` in `.env`, or use "fast" mode in the chat which skips validation and review.

**model looks wrong but compiles**
check the Analysis tab → print readiness. non-watertight meshes or high genus values usually point to geometry issues.

---

## credits

[CADAM](https://github.com/Adam-CAD/CADAM) — parametric CAD modeling environment that informed rendr's approach to code-driven 3D design 

[openscad-playground](https://github.com/openscad/openscad-playground) — browser-based OpenSCAD editor that proved client-side compilation was viable and shaped the in-browser rendering architecture

[openscad-wasm](https://github.com/openscad/openscad-wasm) — OpenSCAD compiled to WebAssembly, the engine that powers rendr's 3D compilation without requiring a local OpenSCAD install

---
