# NeoGuardian

Django + React NICU clinical decision support.

## Project setup (Windows)

1. Install: **Python 3.12**, **Node.js**, **Git**, **Git LFS** (`git lfs install`)
2. Clone this repo (`git lfs pull` if model files look tiny)
3. Create `backend/.env` (see Database below) — **before** or right after first `setup.bat`
4. Run `setup.bat` (installs deps, migrates, seeds staff)
5. Run `run.bat`
6. Open the Vite URL (usually http://127.0.0.1:5173)

### Logins
| User | Password |
|------|----------|
| admin | password123 |
| doctor | password123 |
| nurse | password123 |

### Database (PostgreSQL required)

Put this in **`backend/.env`** (file is gitignored — never commit real passwords):

```text
DEBUG=true
DJANGO_SECRET_KEY=change-me-in-production
DATABASE_URL=YOUR_URL_HERE
AI_FALLBACK_ENABLED=true
```

**Shared team demo DB (recommended):** your lead sends a Neon `DATABASE_URL`. Paste that exact URL as `DATABASE_URL=...` in `backend/.env`, then run `setup.bat`. Everyone with that URL sees the same live demo data.

**Local-only DB:** install PostgreSQL (or Docker Desktop + `docker compose up -d db`) and use:

`DATABASE_URL=postgresql://neoguardian:neoguardian@127.0.0.1:5432/neoguardian`

`setup.bat` copies `.env.example` only if `.env` is missing — edit `.env` to your real URL before migrate succeeds.

### Notes
- ML models are under `models/` and `assessment_model/models/` (Git LFS)
- Do not commit `.env`, `venv312/`, or `node_modules/`
- After setup, admit newborns in the app to add patients
