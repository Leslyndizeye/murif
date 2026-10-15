# MURI backend

This folder contains the FastAPI backend. The Next.js frontend stays at the repository root.

## Run locally

From the repository root:

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

The activation command above is for Git Bash on Windows. On macOS/Linux, use `source .venv/bin/activate`.

If `.env` does not exist, copy `.env.example` to `.env` and configure the database, JWT secret, CORS origins, and email settings. The private `.env`, local database files, virtual environments, and Python caches are ignored by Git.

API health endpoint: `http://localhost:8000/`

API documentation: `http://localhost:8000/docs`

## Render

The repository's `render.yaml` describes the backend service. To connect an existing Render service to this repository, use:

- Repository: `https://github.com/Leslyndizeye/murif`
- Branch: `main`
- Root directory: `backend`
- Runtime: Python
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/`

Configure production secrets in Render's environment settings. Set `CORS_ORIGINS` to include `https://murif.netlify.app` and any other frontend domain in use. Set `FRONTEND_LOGIN_URL` to `https://murif.netlify.app/`. Account invitations require the `SMTP_*` settings listed in `.env.example`.

Adding this folder does not reconnect or replace the existing Render service. The frontend continues using its configured backend API URL.

For database migration instructions, see `README_MIGRATE.md`.
