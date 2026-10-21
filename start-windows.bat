@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Mahami - Smart Task Manager
where node >nul 2>nul || (echo Node.js 20.19+ is required: https://nodejs.org & pause & exit /b 1)
if not exist node_modules (echo Installing dependencies... & call npm install || (pause & exit /b 1))
if not exist .env (
  echo DATABASE_URL="postgresql://mahami:mahami@localhost:5433/mahami"> .env
  echo Created .env using the built-in local PostgreSQL.
)
findstr /c:"localhost:5433" .env >nul && (if not exist node_modules\embedded-postgres call npm install --no-save embedded-postgres) & findstr /c:"localhost:5433" .env >nul && (start "Mahami DB" /min cmd /k npm run db:local & echo Starting local PostgreSQL... & timeout /t 10 /nobreak >nul)
call npm run setup || (pause & exit /b 1)
if not exist .next\BUILD_ID (call npm run build || (pause & exit /b 1))
echo.
echo  Mahami is running at http://localhost:3000
echo.
start "" http://localhost:3000
call npm start
