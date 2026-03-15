# rendr

Text-to-CAD desktop app. Describe a 3D model in plain English and get OpenSCAD code, a live 3D preview, and exportable files.

Built with Electron + React (frontend) and FastAPI + LangGraph (backend).

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.11
- **npm**
- **An LLM API key** (Anthropic recommended, OpenAI also supported)
- **OpenSCAD** (optional — enables server-side PNG rendering. The app uses WASM for 3D preview without it)

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/Krishpraj/rendr.git
cd rendr
```

### 2. Set up the backend

```bash
cd rendr-api

# (Optional) Create a virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -e .
```

Create a `.env` file in `rendr-api/`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

That's the only required variable. See [Backend Configuration](#backend-configuration) for all options.

### 3. Set up the frontend

```bash
cd rendr-app
npm install
```

### 4. Run both

**Option A — Use the dev script (Windows PowerShell):**

```powershell
# From the repo root
.\start-dev.ps1
```

This opens two terminal windows: one for the API server and one for the Electron app.

**Option B — Run manually in two terminals:**

Terminal 1 (backend):
```bash
cd rendr-api
uvicorn rendr_api.main:app --reload
```

Terminal 2 (frontend):
```bash
cd rendr-app
npm run dev
```

The API runs on `http://localhost:8000` and the Electron app connects to it automatically.

## How It Works

1. You describe a 3D model in the chat
2. The backend runs a multi-stage pipeline: **Analyze → Generate → Validate → Review**
3. OpenSCAD code is generated, compiled to STL via WASM in the browser, and rendered in a 3D viewer
4. You can refine the model with follow-up prompts
5. Export as `.scad` or `.png`

## Backend Configuration

All settings go in `rendr-api/.env`. Defaults are shown:

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | LLM provider (`anthropic`, `openai`, `ollama`) |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | Primary model for code generation |
| `FAST_PROVIDER` | `anthropic` | Provider for fast/validation steps |
| `FAST_MODEL` | `claude-haiku-4-5-20251001` | Model for fast/validation steps |
| `ANTHROPIC_API_KEY` | — | Required if using Anthropic |
| `OPENAI_API_KEY` | — | Required if using OpenAI |
| `OPENAI_API_BASE` | — | Custom OpenAI-compatible endpoint |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OPENSCAD_PATH` | `openscad` | Path to OpenSCAD binary |
| `TEMPERATURE` | `0.0` | LLM temperature |
| `MAX_REFINEMENT_ROUNDS` | `2` | Max validation retries |
| `HOST` | `0.0.0.0` | API server host |
| `PORT` | `8000` | API server port |

## Project Structure

```
rendr/
├── rendr-api/          # FastAPI backend
│   ├── rendr_api/
│   │   ├── main.py           # App entry point
│   │   ├── config.py         # Settings from .env
│   │   ├── routers/          # API endpoints
│   │   ├── services/         # LangGraph pipeline, OpenSCAD
│   │   └── models/           # Request/response schemas
│   └── pyproject.toml
├── rendr-app/          # Electron + React frontend
│   ├── src/
│   │   ├── main/             # Electron main process
│   │   ├── preload/          # Preload scripts
│   │   └── renderer/         # React app
│   │       └── src/
│   │           ├── components/   # UI components
│   │           ├── contexts/     # React contexts
│   │           ├── hooks/        # Custom hooks
│   │           └── lib/          # API client, utilities
│   └── package.json
└── start-dev.ps1       # Dev startup script (Windows)
```

## Troubleshooting

**"Offline" in status bar**
The backend isn't running or isn't reachable at `localhost:8000`. Start it with `uvicorn rendr_api.main:app --reload`.

**3D preview shows "Building 3D model..." forever**
The WASM OpenSCAD compiler may have hit an error. Check the browser console (Ctrl+Shift+I) for details. Usually means the generated code has a syntax error.

**Export PNG fails**
Server-side PNG rendering requires OpenSCAD installed on your system. Install it from [openscad.org](https://openscad.org/downloads.html) and make sure `openscad` is in your PATH (or set `OPENSCAD_PATH` in `.env`).
