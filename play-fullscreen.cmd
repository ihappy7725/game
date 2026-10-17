@echo off
cd /d "%~dp0"
node scripts\launch-game.mjs
if errorlevel 1 pause
