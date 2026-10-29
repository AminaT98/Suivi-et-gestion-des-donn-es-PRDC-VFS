@echo off
setlocal
cd /d "%~dp0"

REM Detect Python by actually running it (does not rely only on WHERE).
python --version >nul 2>&1
if not errorlevel 1 (
  start "PRDC-VFS serveur local" /min python -m http.server 8765 --bind 127.0.0.1
  goto open_dashboard
)

py -3 --version >nul 2>&1
if not errorlevel 1 (
  start "PRDC-VFS serveur local" /min py -3 -m http.server 8765 --bind 127.0.0.1
  goto open_dashboard
)

echo Python n'a pas ete detecte par ce lanceur.
echo Ouvrez CMD dans ce dossier et executez : python --version
pause
exit /b 1

:open_dashboard
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765/PRDC_VFS_Tableau_de_bord.html"
endlocal
