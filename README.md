# NeoGuardian

Django + React NICU clinical decision support.

## Team setup (Windows)

1. Install: **Python 3.12**, **Node.js**, **Git**, **Git LFS** (`git lfs install`)
2. Clone this repo
3. Run `setup.bat`
4. Run `run.bat`
5. Open the Vite URL (usually http://127.0.0.1:5173)

### Logins
| User | Password |
|------|----------|
| admin | password123 |
| doctor | password123 |
| nurse | password123 |

### Notes
- Copy `backend/.env.example` → `backend/.env` if setup did not (OpenAI key optional)
- ML models are under `models/` and `assessment_model/models/` (Git LFS — pull with `git lfs pull` if missing)
- Fresh DB has staff only — admit newborns in the app
