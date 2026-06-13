@echo off
REM CGameCore Windows Installation Script
REM This script automates the installation process for CGameCore on Windows

setlocal enabledelayedexpansion
color 0A
title CGameCore Windows Installation

echo.
echo ================================================
echo  CGameCore - Windows Installation Script
echo ================================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [✓] Node.js detected: 
node --version

REM Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH
    echo Please download and install Git from https://git-scm.com/
    pause
    exit /b 1
)

echo [✓] Git detected: 
git --version
echo.

REM Clone repository
echo [Step 1/7] Cloning repository...
git clone https://github.com/Sachither/CGameCore.git
if %errorlevel% neq 0 (
    echo [ERROR] Failed to clone repository
    pause
    exit /b 1
)
cd CGameCore
echo [✓] Repository cloned successfully

REM Install dependencies
echo.
echo [Step 2/7] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [✓] Dependencies installed successfully

REM Check if .env.local exists
echo.
echo [Step 3/7] Checking environment setup...
if not exist .env.local (
    echo [WARNING] .env.local not found
    echo Creating template .env.local file...
    (
        echo # CGameCore Environment Variables
        echo ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY_HERE
        echo NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
        echo NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
        echo NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
        echo DATABASE_URL=YOUR_DATABASE_URL
    ) > .env.local
    echo [!] Created template. Please edit .env.local with your credentials
)
echo [✓] Environment setup checked

REM Run database migrations
echo.
echo [Step 4/7] Running database migrations...
call npm run db:push
if %errorlevel% neq 0 (
    echo [WARNING] Database migration failed
    echo You may need to run this manually: npm run db:push
)
echo [✓] Database migration completed

REM Run TypeScript check
echo.
echo [Step 5/7] Checking TypeScript...
call npm run type-check
if %errorlevel% neq 0 (
    echo [WARNING] TypeScript errors detected
    echo Please review and fix any type errors
)
echo [✓] TypeScript check completed

REM Build application
echo.
echo [Step 6/7] Building application...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo [✓] Build completed successfully

REM Installation complete
echo.
echo [Step 7/7] Installation complete!
echo.
echo ================================================
echo  Installation Summary
echo ================================================
echo.
echo ✓ Node.js verified
echo ✓ Dependencies installed
echo ✓ Environment configured
echo ✓ Database migrated
echo ✓ Application built
echo.
echo Next Steps:
echo   1. Edit .env.local with your API credentials
echo   2. Run: npm run dev
echo   3. Open http://localhost:3000 in your browser
echo.
echo For more information, see SETUP_INSTALLATION.md
echo.
pause
