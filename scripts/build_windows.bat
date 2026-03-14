@echo off
REM ============================================================
REM  OratioText Windows Build Script
REM  Builds OratioText.exe using PyInstaller
REM ============================================================

echo === OratioText Windows Build ===
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo        Install Python 3.8+ from https://python.org
    exit /b 1
)

REM Check ffmpeg
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo [ERROR] ffmpeg is not installed or not in PATH.
    echo        Install it with: choco install ffmpeg
    echo        Or download from: https://ffmpeg.org/download.html
    exit /b 1
)

REM Check pyinstaller
python -m PyInstaller --version >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
)

REM Install dependencies
echo [INFO] Installing Python dependencies...
pip install -r requirements.txt

REM Build
echo.
echo [INFO] Building OratioText...
pyinstaller --clean OratioText-windows.spec --distpath dist\

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Check the output above for details.
    exit /b 1
)

echo.
echo === Build complete! ===
echo Output: dist\OratioText\OratioText.exe
echo.
pause
