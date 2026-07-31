# NeoGuardian

Django + React NICU clinical decision support.

## Team setup (Windows)

1. Install: **Python 3.12**, **Node.js**, **Git**, **Git LFS** (`git lfs install`), **Docker Desktop** (for PostgreSQL)
2. Clone this repo
3. Run `setup.bat` (starts Postgres via Docker Compose, migrates, seeds staff)
4. Run `run.bat`
5. Open the Vite URL (usually http://127.0.0.1:5173)

### Logins
| User | Password |
|------|----------|
| admin | password123 |
| doctor | password123 |
| nurse | password123 |

### Database (PostgreSQL required)

- Connection: `DATABASE_URL` in `backend/.env` (copied from `backend/.env.example` by setup)
- Default local URL: `postgresql://neoguardian:neoguardian@127.0.0.1:5432/neoguardian`
- Docker service: root `docker-compose.yml` → `docker compose up -d db`

If Docker is not available, install PostgreSQL yourself and point `DATABASE_URL` at it before `setup.bat`.

### Notes
- ML models are under `models/` and `assessment_model/models/` (Git LFS — pull with `git lfs pull` if missing)
- Do not commit `.env`, `venv312/`, or `node_modules/`
- After setup, admit newborns in the app to add patients
