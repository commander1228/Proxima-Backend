@echo off
REM Windows batch script to automate backend and frontend setup

REM Start Docker containers (PostgreSQL, etc.)
docker-compose up -d

REM Start backend (Node.js/Express)
call npm install
call npx prisma generate
call npx prisma migrate deploy
start "Backend Server" cmd /k npm run dev