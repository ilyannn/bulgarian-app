# Bulgarian Voice Coach — Build Plan (Justfile edition)

This plan swaps the previous **Makefile** approach for a **Justfile**, integrates the **grammar lessons** + **scenario bindings**, folds in all key details from the earlier “**Create a minimal voice‑enabled web app…**” plan, and adds **Bulgarian typography** and **CI/CD** guidance.

---
## 1) Project layout
```
/server
  app.py            # FastAPI entry (WS + REST)
  asr.py            # faster-whisper + VAD
  tts.py            # eSpeak NG streaming (upgradeable to Piper or cloud)
  llm.py            # ChatProvider interface (+ Dummy + Claude/OpenAI stub)
  bg_rules.py       # lightweight grammar detectors (articles, clitics, да + present, future)
  content/
    bg_grammar_pack.json            # grammar rules + drills
    bg_scenarios_with_grammar.json  # scenarios bound to grammar
/client
  index.html
  main.js
  audio-worklet.js
  assets/
    fonts/          # (Ysabeau files go here if self-hosting)
/Justfile
/.github/workflows/ # (CI configs)
/README.md
```

> **Place both JSON content files** in `server/content/` (use the packs we created earlier).

---
## 2) Justfile (replaces Makefile)
Create a root-level file named `Justfile` with these recipes:

```just
set shell := ["bash", "-cu"]

# Paths
VENV := ".venv"
PY   := "{{VENV}}/bin/python"
PIP  := "{{VENV}}/bin/pip"

# Default task
default: dev

# Create venv and install deps (server + client)
install:
    test -d {{VENV}} || python3 -m venv {{VENV}}
    {{PIP}} install -U pip wheel
    {{PIP}} install -r server/requirements.txt
    cd client && npm i

# Dev servers (backend FastAPI + frontend Vite) with shared lifetime
dev:
    (cd server && {{PY}} -m uvicorn app:app --reload) &
    BACK_PID=$!
    (cd client && npm run dev) &
    FRONT_PID=$!
    trap 'kill $BACK_PID $FRONT_PID' INT TERM
    wait

# Linting (local)
lint:
    {{PY}} -m black --check server
    {{PY}} -m isort --check-only server
    {{PY}} -m ruff check server
    cd client && npx prettier -c .

# Code formatting (local)
format:
    {{PY}} -m black server
    {{PY}} -m isort server
    cd client && npx prettier -w .

# Tests (server)
test:
    {{PY}} -m pytest -q

# Production-ish serve (api + built frontend)
serve:
    (cd server && {{PY}} -m uvicorn app:app --host 0.0.0.0 --port 8000) &
    (cd client && npm run build && npm run preview -- --host) &
    wait
```

**Server requirements** (add to `server/requirements.txt`):
```
fastapi
uvicorn[standard]
websockets
numpy
ct2-transformers # (optional helper) or ctranslate2
faster-whisper
webrtcvad-wheels
pydantic
python-dotenv
black
isort
ruff
```

---
## 3) One‑shot scaffold generator (pasteable prompt)
Use this block with your codegen assistant (Claude/Code LLM) to generate the full runnable skeleton **matching this Justfile plan**.

```
Create a minimal voice-enabled web app for “Bulgarian coach for Slavic speakers”.

Tech:
- Backend: Python 3.11, FastAPI, uvicorn, websockets.
- ASR: faster-whisper (CTranslate2). Language fixed to "bg". Use webrtcvad for VAD.
- TTS: espeak-ng (Bulgarian) via subprocess; return WAV; support progressive/streamed responses.
- LLM: define ChatProvider interface; implement DummyProvider that echoes; add Claude/OpenAI provider stubs (read API keys from env).
- Frontend: Vite + vanilla JS. Use getUserMedia with noiseSuppression/echoCancellation/autoGainControl.
- Audio pipeline: AudioWorklet captures 16kHz mono PCM Int16 frames → WebSocket `/ws/asr`. Show partial transcripts live.
- Turn flow: client sends audio frames until VAD end; server finalizes ASR, calls ChatProvider with system prompt “You are a Bulgarian coach… reply ONLY in Bulgarian. Also return corrections and a short contrastive note for the user’s L1 if provided.” Return JSON:
  { reply_bg: string, corrections: [{type, before, after, note, error_tag}], contrastive_note: string|null }
- After receiving JSON, client hits `/tts?text=` to fetch WAV and plays it via MediaSource.
- Content: include `server/content/bg_grammar_pack.json` and `server/content/bg_scenarios_with_grammar.json` (already prepared). Implement helper functions to load and query them.
- Add `README.md` with run steps: install espeak-ng, `just install`, `just dev`, and `.env` for model paths/API keys.
- Add `Justfile` (not Makefile) with recipes: install/dev/format/test/serve/lint.

Files to generate (non-empty):
/server/app.py
/server/asr.py
/server/tts.py
/server/llm.py
/server/bg_rules.py
/server/content/__init__.py (helpers to load grammar/scenarios)
/client/index.html
/client/main.js
/client/audio-worklet.js
/README.md
/Justfile (use the recipes already specified)

Key implementation details:
- WebSocket `/ws/asr`: accepts binary PCM Int16 frames; uses ring buffer + VAD; emits JSON messages: {type:"partial", text:"…"} and {type:"final", text:"…"}; after final, call ChatProvider and emit {type:"coach", payload:{…}}.
- faster-whisper config: 16kHz input; `language="bg"`; beam_size=2; temperature=0; enable logprobs; tune `no_speech_threshold`; small or medium model via env path.
- TTS endpoint streams audio: write WAV header then chunk PCM; client plays progressively with MediaSource.
- Frontend: mic toggle, transcript area, partial line, final line, “Play reply” button; graceful fallback to ScriptProcessor if AudioWorklet unsupported.
- `bg_rules.py`: lightweight checks for definite article, clitic position, да + present (no infinitive), future with ще; expose simple `detect(sentence)->[error_tags]`.
```

---
## 4) Content integration (grammar + scenarios)

**Files**
- `server/content/bg_grammar_pack.json` — grammar items with `id`, `micro_explanation_bg`, `contrast_notes` (per L1), `triggers`, `examples`, `drills`, and `srs`.
- `server/content/bg_scenarios_with_grammar.json` — scenarios with `grammar_binding`: `{ primary: [...], secondary: [...], binding_method: "auto-heuristic-v1" }`.

**Server loading (add to `app.py`)**
- On startup, load both JSONs into memory (`GRAMMAR_INDEX`, `SCENARIOS`).
- Expose endpoints:
  - `GET /content/scenarios` → list of scenarios (id, title, level, primary grammar IDs).
  - `GET /content/grammar/:id` → a single grammar item by `id`.
  - `GET /content/lesson/next` → given `user_id`, returns 1–3 queued drills based on SRS due (see §7).

**Runtime use in chat**
- Each chat turn returns `{ reply_bg, corrections[], contrastive_note, drills[] }`.
- For every `corrections[i].error_tag`, look up the matching grammar item by `id` and attach a chip (one‑liner) + one micro‑drill. On 2nd repeat in a session, show a mini‑lesson (2–3 min).

---
## 5) Voice MVP specifics (from the earlier plan)

**Latency budget (aim)**
- 20–40 ms frames → VAD tail 200–400 ms → ASR 0.5–1.0 s → TTS ~0.2 s → **Total ~1.2–2.0 s**.

**Accuracy checklist**
1. Force `language="bg"` in ASR (avoid auto-detect).
2. 16‑kHz mono PCM Int16 end‑to‑end; resample client‑side.
3. Short frames (20–40 ms), sliding VAD (WebRTC VAD) to trim silence.
4. Decoder: beam 1–2, temp 0, logprob thresholds to curb hallucinations.
5. Optional re‑punctuation or let LLM normalize lightly.
6. Retry path for no‑speech: “Не те чух—опитай пак.”
7. Normalize quirks (apostrophes; ignore stress marks) before grammar checks.

---
## 6) Client UX hooks
- **Mic panel**: toggle, level meter, latency indicator.
- **Transcript**: live partial line + finalized bubbles.
- **Chips**: one‑liners from grammar items; tap to expand mini‑lesson.
- **Drills**: inline (transform/fill/reorder) — 10–20 seconds; correctness immediately updates SRS.
- **Audio**: `MediaSource` plays streamed WAV from `/tts`.

---
## 7) SRS & progress
- Each grammar item carries `srs.interval_days` (e.g., `[1,3,7,21]`).
- Persist per‑user mastery with counters and next‑due timestamps (SQLite is fine for MVP).
- `GET /content/lesson/next` surfaces 1–3 due drills used as:
  - **Warm‑up** on app open.
  - **Micro‑interrupt** after a tagged error in chat.

---
## 8) Bulgarian typography & CSS (Ysabeau)
Use a **distinct CSS class** for Bulgarian text and a **Bulgarian‑optimized Cyrillic** font. Prefer the open font **Ysabeau** by Catharsis Fonts (supports Cyrillic and Bulgarian forms).

**Self‑hosted setup (recommended)**
- Place font files under `client/assets/fonts/` (e.g., `Ysabeau[wght].woff2` or static weights).
- Add this to a global stylesheet (e.g., `client/main.css` or inlined in `index.html`):

```css
/* Bulgarian font face (self-hosted). Adjust paths to your files. */
@font-face {
  font-family: "Ysabeau";
  src: url("/assets/fonts/Ysabeau[wght].woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0400-04FF, U+0500-052F; /* Cyrillic + Extended */
}

/* Mark Bulgarian language spans; trigger Bulgarian-specific glyphs via lang selector */
:lang(bg) {
  font-family: "Ysabeau", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
  font-feature-settings: "locl" 1; /* enable local language forms where supported */
}

/* Optional explicit class for Bulgarian content in the app UI */
.bg-text {
  font-family: "Ysabeau", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-feature-settings: "locl" 1;
}
```

**HTML usage**
```html
<!-- Make the whole document Bulgarian-aware -->
<html lang="bg">
  ...
  <!-- Or on a per-snippet basis -->
  <span lang="bg" class="bg-text">Здравейте! Как сте?</span>
</html>
```

> If you prefer a CDN, you can load Ysabeau from a font host, but self‑hosting avoids CORS and version drift.

---
## 9) CI/CD with GitHub Actions + Super‑Linter
Mirror the CI style you use in `/Users/in/Code/wallos-mcp` and add a **single lint workflow** that runs on PRs and pushes. Locally, developers run `just lint` and `just format`.

**GitHub Actions: `.github/workflows/lint.yml`**
```yaml
name: Lint

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  super-lint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install server deps (lint-only)
        run: |
          python -m pip install --upgrade pip
          pip install black isort ruff

      - name: Install client deps (lint-only)
        run: |
          cd client
          npm ci || npm i

      - name: Run local linters (Python + JS/CSS)
        run: |
          black --check server
          isort --check-only server
          ruff check server
          cd client && npx prettier -c .

      - name: GitHub Super-Linter
        uses: super-linter/super-linter@v6
        env:
          DEFAULT_BRANCH: main
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          VALIDATE_PYTHON_BLACK: true
          VALIDATE_PYTHON_ISORT: true
          VALIDATE_PYTHON_RUFF: true
          VALIDATE_JAVASCRIPT_PRETTIER: true
          VALIDATE_TYPESCRIPT_PRETTIER: true
          VALIDATE_JSON: true
          VALIDATE_YAML: true
          VALIDATE_MARKDOWN: true
```

> Notes
> - The workflow first runs the **same checks** as `just lint` to keep parity with local dev.
> - Super‑Linter adds guardrails for other file types (YAML/JSON/Markdown). Tune its `VALIDATE_*` flags as needed.
> - Follow the folder conventions from `wallos-mcp` (branch names, required checks), but this workflow is portable.

---
## 10) Example data snippets

**Grammar item (excerpt — `bg.no_infinitive.da_present`)**
```json
{
  "id": "bg.no_infinitive.da_present",
  "title_bg": "Няма инфинитив: 'да' + сегашно",
  "level": ["A2","B1"],
  "micro_explanation_bg": "В български няма инфинитив. Използваме 'да' + сегашно: 'Искам да поръчам'.",
  "contrast_notes": {"PL": "…", "RU": "…"},
  "examples": [
    {"wrong": "Искам поръчвам кафе.", "right": "Искам да поръчам кафе."}
  ],
  "drills": [
    {"type": "transform", "prompt_bg": "Искам ___ (поръчвам) кафе.", "answer_bg": "да поръчам"}
  ],
  "srs": {"interval_days": [1,3,7,21]}
}
```

**Scenario binding (excerpt)**
```json
{
  "id": "a2_cafe_ordering",
  "title": "В кафене: поръчка",
  "level": "A2",
  "grammar_binding": {
    "primary": [
      "bg.no_infinitive.da_present",
      "bg.definite.article.postposed"
    ],
    "secondary": [
      "bg.future.shte",
      "bg.clitics.position"
    ],
    "binding_method": "auto-heuristic-v1"
  }
}
```

---
## 11) Environment & run
- `.env` (server): model path or leave blank to auto‑download; LLM API key if using a hosted model.
- First time:
  - `just install`
  - Put the two JSON files into `server/content/`
  - `just dev`

---
## 12) Acceptance checklist
- [ ] `just dev` launches both servers; hot reload works.
- [ ] Short BG utterance → partials < 1s; final transcript ≈ 1s.
- [ ] Typical error (e.g., infinitive‑like) shows a chip + one micro‑drill.
- [ ] SRS warm‑up appears on app open when drills are due.
- [ ] `just serve` runs a production‑ish stack (preview ok).
- [ ] `just lint` passes locally; CI **Lint** workflow green on PR.
- [ ] Bulgarian text renders with **Ysabeau** for Cyrillic and honors `:lang(bg)`.

---
## 13) Next steps (nice‑to‑haves)
- Swap TTS to **Piper** or a cloud voice when aesthetics matter.
- Add per‑L1 (PL/RU/UK/SR) selector to switch `contrast_notes`.
- Persist transcripts locally for privacy; opt‑in analytics; export progress.
