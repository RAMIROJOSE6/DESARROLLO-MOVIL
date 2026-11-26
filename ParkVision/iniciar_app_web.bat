@echo off
title ParkVision - Servidor Web
color 0B
echo ===================================================
echo   INICIANDO PARKVISSION EN MODO WEB (NAVEGADOR)
echo   Universidad de La Guajira - Asignatura IoT
echo ===================================================
echo.
cd /d "%~dp0\parkvision-app"
echo Abriendo servidor Expo Web en http://localhost:8081 ...
npx expo start --web
pause
