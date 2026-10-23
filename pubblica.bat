@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Pubblica Ricettario
cd /d "%~dp0"

echo.
echo  ==============================================
echo    Ricettario - pubblicazione su GitHub Pages
echo  ==============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo  [ERRORE] Git non trovato. Installalo da https://git-scm.com e riprova.
  goto fine
)

rem --- Ci sono modifiche da pubblicare?
set "CHANGES="
for /f "delims=" %%i in ('git status --porcelain') do set "CHANGES=1"
if not defined CHANGES (
  echo  Nessuna modifica da pubblicare.
  goto fine
)

echo  File modificati:
git status --short
echo.

rem --- Messaggio del commit: argomento, oppure chiesto, oppure automatico
set "MSG=%~1"
if not defined MSG set /p "MSG= Descrizione delle modifiche (Invio = automatica): "
if not defined MSG set "MSG=Aggiornamento del %date% %time:~0,5%"

rem --- Nuova versione della cache offline, cosi' i dispositivi scaricano i file aggiornati
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f = Join-Path (Get-Location) 'sw.js'; $c = [IO.File]::ReadAllText($f); $m = [regex]::Match($c, 'ricettario-v(\d+)'); if (-not $m.Success) { exit 1 }; $n = [int]$m.Groups[1].Value + 1; $c = $c.Replace($m.Value, 'ricettario-v' + $n); [IO.File]::WriteAllText($f, $c, (New-Object Text.UTF8Encoding $false)); Write-Host (' Versione cache: ricettario-v' + $n)"
if errorlevel 1 echo  [ATTENZIONE] VERSION non trovata in sw.js: aggiornala a mano.

echo.
echo  Commit...
git add -A
git commit -q -m "%MSG%"
if errorlevel 1 (
  echo  [ERRORE] Commit non riuscito.
  goto fine
)

echo  Allineo con GitHub...
git pull --rebase -q origin main
if errorlevel 1 (
  echo  [ERRORE] Conflitto con la versione su GitHub: risolvilo e poi rilancia.
  goto fine
)

echo  Invio...
git push -q origin main
if errorlevel 1 (
  echo  [ERRORE] Push non riuscito: controlla la connessione e le credenziali GitHub.
  goto fine
)

echo.
echo  [OK] Pubblicato! Tra un minuto circa l'app aggiornata e' online su:
echo       https://sbarbaorama.github.io/cooking/
echo  Sui dispositivi basta riaprire l'app.

:fine
echo.
pause
endlocal
