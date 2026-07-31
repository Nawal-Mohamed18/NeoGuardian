@echo off
cd /d "%~dp0"

where py >nul 2>&1 && (set PY=py -3.12) || (set PY=python)

if not exist "backend\venv312\Scripts\python.exe" (
  %PY% -m venv backend\venv312
)

call backend\venv312\Scripts\activate.bat
pip install -r backend\requirements.txt

if not exist "frontend\node_modules" (
  pushd frontend & call npm.cmd install & popd
)

if not exist "backend\.env" (
  copy backend\.env.example backend\.env
  echo.
  echo Created backend\.env from .env.example
  echo IMPORTANT: For the shared team Neon DB, open backend\.env and set DATABASE_URL
  echo to the connection string your lead sent you, then re-run setup.bat.
  echo For local-only Postgres, start Docker or local Postgres first.
  echo.
)

echo.
echo Starting PostgreSQL (Docker Compose) if DATABASE_URL looks local...
where docker >nul 2>&1
if %ERRORLEVEL%==0 (
  findstr /C:"127.0.0.1" backend\.env >nul 2>&1
  if %ERRORLEVEL%==0 (
    docker compose up -d db
    if errorlevel 1 (
      echo WARNING: could not start Docker Postgres. Ensure DATABASE_URL in backend\.env is correct.
    ) else (
      echo Waiting for Postgres to become ready...
      timeout /t 5 /nobreak >nul
    )
  ) else (
    echo DATABASE_URL is not localhost — skipping Docker. Using remote Postgres from .env
  )
) else (
  echo Docker not found. Using DATABASE_URL from backend\.env — PostgreSQL must already be reachable.
)

pushd backend
python manage.py migrate
if errorlevel 1 (
  echo.
  echo ERROR: migrate failed. Check PostgreSQL is running and DATABASE_URL in backend\.env is correct.
  popd
  pause
  exit /b 1
)
python manage.py seed_platform
popd

echo.
echo Done. Run run.bat
echo Logins: admin / doctor / nurse   password: password123
echo Database: PostgreSQL via DATABASE_URL
pause
