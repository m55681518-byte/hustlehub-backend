@echo off
echo ==========================================
echo  HustleHub Backend Deploy Script
echo ==========================================
echo.

REM Check if we're in the right folder
if not exist "server.js" (
    echo ERROR: server.js not found!
    echo Please run this script from your hustlehub-backend folder.
    echo.
    pause
    exit /b 1
)

echo Step 1/3: Adding files to Git...
git add .
if errorlevel 1 (
    echo ERROR: git add failed. Make sure Git is installed.
    pause
    exit /b 1
)
echo [OK] Files added
echo.

echo Step 2/3: Committing changes...
git commit -m "Complete M-Pesa backend with mpesaService.js - ready for Render"
if errorlevel 1 (
    echo [INFO] Nothing new to commit, or commit failed.
    echo Continuing anyway...
)
echo [OK] Commit done
echo.

echo Step 3/3: Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo ERROR: git push failed.
    echo.
    echo Common fixes:
    echo 1. Make sure you're connected to internet
echo 2. Check if your Personal Access Token is correct
echo 3. Try running: git push origin main --force
echo.
    pause
    exit /b 1
)
echo [OK] Pushed to GitHub successfully!
echo.

echo ==========================================
echo  DONE! Now go to Render and click:
echo  Manual Deploy - Deploy latest commit
echo ==========================================
echo.
echo Opening Render dashboard...
start https://dashboard.render.com
echo.
pause
