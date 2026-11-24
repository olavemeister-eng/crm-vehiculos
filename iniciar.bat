@echo off
cd /d "%~dp0"
echo.
echo   CRM Vehiculos - servidor local
echo   ----------------------------------
echo   Abre http://localhost:8000 en tu navegador.
echo.
start "CRM Vehiculos - servidor" /MIN python -m http.server 8000
timeout /t 2 >nul
start "" http://localhost:8000
echo   El servidor sigue corriendo en segundo plano.
echo   Para detenerlo: cierra la ventana "CRM Vehiculos - servidor".
echo.
pause
