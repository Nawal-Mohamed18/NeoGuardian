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

if not exist "backend\.env" copy backend\.env.example backend\.env

pushd backend
python manage.py migrate
python manage.py seed_platform
popd

echo.
echo Done. Run run.bat
echo Logins: admin / doctor / nurse   password: password123
pause
