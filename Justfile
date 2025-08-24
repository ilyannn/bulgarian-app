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