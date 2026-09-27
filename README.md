# 🎙️ Talk — The Instant Voice-First AI Decision Maker

> **Settle any dilemma in milliseconds with statistically calibrated confidence, live WebGL visual presence, and deep context grounding.**

---

## 🌟 Overview

**Talk** is a voice-first decision assistant designed to eliminate decision paralysis. From everyday choices (*"Pizza vs Sushi"*, *"MacBook vs ThinkPad"*) to multi-factor corporate tradeoffs and document-backed evaluations, Talk delivers instant, calibrated verdicts with auditable reasoning.

### ⚡ The Dual-Path Architecture
Unlike traditional chatbots that force every question through slow, generative autoregressive loops (taking 3–8 seconds), Talk uses a **dual-path triage system**:

```
                       ┌─────────────────────────┐
                       │  User Speaks / Inputs   │
                       └────────────┬────────────┘
                                    │
                         [ Intelligent Triage ]
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌─────────────────────────┐                       ┌─────────────────────────┐
│   System 1 (Instant)    │                       │  System 2 (Cloud LLM)   │
│  Laya Engine (< 50ms)   │                       │   Research & Framing    │
│  - Self-contained query │                       │  - Open-ended / Realtime│
│  - Document-grounded    │                       │  - Web search grounding │
│  - Direct probabilities │                       │  - Hands off to Laya    │
└────────────┬────────────┘                       └────────────┬────────────┘
             │                                                 │
             └──────────────────────┬──────────────────────────┘
                                    ▼
                      ┌───────────────────────────┐
                      │  Calibrated Output:       │
                      │  • Verdict Badge & Flavor │
                      │  • XYZ Reasoning Pillars  │
                      │  • 3D Fluid Orb Reaction  │
                      │  • Neural Voice Synthesis │
                      └───────────────────────────┘
```

---

## 📸 Visual Showcase

### 1. Main Decision Workspace & Calibrated Right Pane
The interactive WebGL liquid orb dynamically reacts to voice frequencies and pipeline stages (`idle`, `listening`, `thinking`, `speaking`, `error`). The slide-out decision pane reveals calibrated confidence bars, verdict flavor badges, and 3-pillar XYZ reasoning.

![Talk Main Decision UI](docs/assets/talk-main-decision.png)

---

### 2. Versus Duel Builder & Document Grounding
Directly pit any two choices against each other, inject specific decision criteria, or drag-and-drop complex documentation (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.json`, `.txt`) to anchor the decision with verified citations.

![Versus Duel Builder](docs/assets/talk-versus-modal.png)

---

### 3. Pluggable LLM Providers & Neural Voice Personas
Easily switch between hosted cloud providers (Gemini API) and local LLMs (Ollama, LM Studio, or custom OpenAI-compatible endpoints) with live connection testing. Select from distinct neural voice personas (Jarvis, Nova, Executive, Puck, Charon).

![Settings and Connections](docs/assets/talk-settings-modal.png)

---

## 📁 Repository Structure

```
TALK/
├── backend/                        # FastAPI Backend Application
│   └── app/
│       ├── main.py                 # FastAPI application, CORS, and API routes
│       ├── orchestrator.py         # Dual-path triage (System 1 vs System 2)
│       ├── laya_service.py         # Laya typed-decision engine client & fallback
│       ├── llm_manager.py          # Pluggable LLM connections (Gemini, Ollama, LM Studio)
│       ├── document_parser.py      # Grounding parser (PDF, DOCX, XLSX, CSV, JSON, TXT)
│       ├── voice_service.py        # Neural TTS engine (Edge-TTS & Gemini Live Voice)
│       └── models.py               # Pydantic schemas, telemetry, and response types
│
├── frontend/                       # Vite + React 19 + TypeScript SPA
│   ├── src/
│   │   ├── App.tsx                 # Core application controller & state machine
│   │   ├── App.css                 # Premium glassmorphic dark theme stylesheet
│   │   ├── components/
│   │   │   ├── LiquidOrb.tsx       # 3D fluid sphere with Three.js & noise shaders
│   │   │   ├── RightPane.tsx       # Calibrated cards, XYZ reasoning & telemetry
│   │   │   ├── VersusModal.tsx     # 2-option duel builder with file upload
│   │   │   └── SettingsModal.tsx   # LLM endpoints and voice persona configurator
│   │   ├── utils/
│   │   │   └── audio.ts            # Web Audio API real-time FFT analyzer
│   │   ├── types.ts                # TypeScript interfaces and telemetry contracts
│   │   └── main.tsx                # React DOM entry point
│   ├── index.html                  # HTML5 template with Google Inter/Outfit fonts
│   ├── vite.config.ts              # Vite server configuration (Strict Port: 5190)
│   └── package.json                # Frontend dependencies
│
├── docs/                           # Documentation & Assets
│   └── assets/                     # High-resolution UI screenshots & badges
│
├── start-dev.bat                   # 1-Click Windows batch script to launch both servers
├── start-dev.ps1                   # 1-Click PowerShell launcher script
├── talk-app-prd.md                 # Product Requirements Document & specs
├── .gitignore                      # Git exclusion rules
└── README.md                       # Comprehensive project documentation
```

---

## 🔌 Dedicated Port Allocation

To prevent network port collisions with local voice services and existing tools, Talk isolates its network boundaries:

| Service | Port | Endpoint URL | Purpose |
|---|---|---|---|
| **Frontend UI** | `5190` | `http://localhost:5190` | Vite React development server (isolated strict port) |
| **Backend API** | `8001` | `http://127.0.0.1:8001` | FastAPI orchestration, document parsing, TTS streaming |
| **Laya Service** | `8000` | `http://localhost:8000` | Self-hosted Laya typed decision engine (optional / fallback active) |

---

## 🚀 Quick Setup & Getting Started

### Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: v18.0.0 or higher (`npm` included)
- **Git**

---

### Method A: 1-Click Automated Launch (Recommended)

From the project root directory (`TALK`):

**Via Command Prompt or PowerShell:**
```powershell
.\start-dev.bat
```
*Or using PowerShell script:*
```powershell
.\start-dev.ps1
```

This automatically launches two dedicated windows running the Backend (port 8001) and Frontend (port 5190).

---

### Method B: Manual Step-by-Step Launch

#### 1. Backend Setup
Open a terminal in `backend/`:
```bash
cd backend

# Install dependencies (if not already installed)
pip install fastapi uvicorn httpx pydantic pdfplumber python-docx openpyxl edge-tts

# Start the FastAPI server on port 8001
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Verify backend health:
```bash
curl http://127.0.0.1:8001/api/health
```

#### 2. Frontend Setup
Open a second terminal in `frontend/`:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server on port 5190
npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:5190`**

---

## 🧠 Key Features Deep Dive

### 1. Statistical Confidence Calibration
Laya provides non-autoregressive typed scoring over questions rather than unstructured text tokens:
- **`choice`**: Normalized categorical distribution with exact winner matching.
- **`verdict_flavor`**: Categorized confidence thresholds:
  - `≥ 90%`: **Absolute No-Brainer**
  - `≥ 78%`: **Decisive Winner**
  - `≥ 65%`: **Close Call / Leaning**
  - `< 65%`: **Toss-Up / High Dilemma**

### 2. Tailored XYZ Reasoning Pillars
Every decision automatically structures three critical analytical pillars:
1. **Primary Advantage / Craving Alignment:** Core payoff differentiator.
2. **Execution Simplicity & Friction:** Operational overhead vs. alternatives.
3. **Downside Risk & Net Utility:** Long-term regret minimization.

### 3. Document Parser & Grounding Engine
Upload job offer comparisons, financial spreadsheets, lease agreements, or technical specs. Talk extracts the relevant excerpts, verifies context against the candidates, and appends citations directly to the decision payload.

### 4. High-Resolution Social Share Badge
Click **Export Badge** in the right pane to render a custom high-DPI HTML5 canvas decision badge (`.png`) formatted with gradient borders, calibrated percentage rings, and reasoning highlights.

---

## 📡 API Reference

### Health Check
- **`GET /api/health`**
- Returns backend operational status, active LLM connection, and voice provider.

### Process Decision Turn
- **`POST /api/talk`**
- Request Body:
  ```json
  {
    "text": "MacBook Pro M4 vs ThinkPad X1 Carbon for full-stack engineering?",
    "session_id": "session-123",
    "document_text": null
  }
  ```
- Returns: `TalkResponse` including `triage`, `spoken_answer`, `laya_result`, `visual_payload`, and `stage2_telemetry`.

### Parse Grounding Document
- **`POST /api/documents/parse`**
- Multipart Form:
  - `file`: Binary document (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.json`, `.txt`)
  - `option_a`: (Optional) Candidate A override
  - `option_b`: (Optional) Candidate B override

### Voice Synthesis
- **`POST /api/voice/speak`**
- Streams real-time MP3 neural audio for spoken responses.

---

## 🛠️ Testing & Quality Assurance

- **Type Check & Lint:**
  ```bash
  cd frontend
  npm run build
  npm run lint
  ```
- **Backend Sanity Test:**
  ```bash
  cd backend
  python -c "from app.main import app; print('Backend loaded successfully!')"
  ```

---

## 📄 License
This project is open-source under the [Apache 2.0 License](LICENSE).
