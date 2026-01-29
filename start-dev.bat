@echo off
REM Windows batch script to automate backend and frontend setup

REM Start Docker containers (PostgreSQL, etc.)
docker-compose up -d

REM Start backend (Node.js/Express)
cd backend
call npm install
call npx prisma generate
call npx prisma migrate deploy
start "Backend Server" cmd /k npm run dev
cd ..

REM Go to frontend and install npm dependencies
cd frontend\ProximityApp
call npm install

REM Start Expo frontend
call npx expo start
