@echo off
cd /d "%~dp0"

start "NeoGuardian API" cmd /k "cd /d backend && venv312\Scripts\activate && python manage.py runserver"
start "NeoGuardian UI" cmd /k "cd /d frontend && npm run dev"
