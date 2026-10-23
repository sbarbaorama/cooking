# Ricettario - pubblica l'app su GitHub Pages (archivio sbarbaorama/cooking).
# Usa git: la cartella e' gia' collegata all'archivio, quindi non serve nessun codice di accesso qui.
# A ogni pubblicazione aumenta la versione in sw.js: cosi' le app aperte mostrano il pulsante Aggiorna.
param([string]$Descrizione = '')
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$site = 'https://sbarbaorama.github.io/cooking/'
$notApp = @('README.md', 'LEGGIMI.txt', 'pubblica.bat', 'pubblica.ps1', '.gitignore')

function Stop-WithMessage($msg) { Write-Host ''; Write-Host "ERRORE: $msg" -ForegroundColor Red; exit 1 }
function Invoke-Git { & git @args | Out-Host; return ($LASTEXITCODE -eq 0) }

Write-Host '=== Ricettario: pubblicazione dell''app ===' -ForegroundColor Cyan
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-WithMessage 'git non e'' installato: scaricalo da https://git-scm.com e rilancia pubblica.bat.' }
if (-not (Test-Path (Join-Path $root '.git'))) { Stop-WithMessage 'questa cartella non e'' collegata a un archivio git.' }
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()

# file cambiati rispetto all'ultima pubblicazione
$status = @(& git status --porcelain -uall | Where-Object { $_ })
if ($status.Count -eq 0) {
  & git fetch -q origin 2>$null
  $ahead = 0; try { $ahead = [int](& git rev-list --count "origin/$branch..HEAD") } catch {}
  if ($ahead -eq 0) { Write-Host ''; Write-Host 'Niente da pubblicare: online c''e'' gia'' questa versione.' -ForegroundColor Cyan; exit 0 }
}
$changed = @($status | ForEach-Object {
  $p = $_.Substring(3).Trim('"'); if ($p -like '* -> *') { $p = ($p -split ' -> ')[1].Trim('"') }
  @{ code = $_.Substring(0, 2); path = $p }
})

# controlli di sicurezza: nell'archivio pubblico non deve finire nessun codice segreto
foreach ($c in $changed) {
  $f = Join-Path $root $c.path
  if ((Test-Path $f -PathType Leaf) -and ([IO.Path]::GetExtension($f) -in '.html', '.js', '.json', '.webmanifest', '.md', '.css', '.txt')) {
    $txt = [IO.File]::ReadAllText($f)
    if ($txt -match 'github_pat_[A-Za-z0-9_]{20,}' -or $txt -match 'ghp_[A-Za-z0-9]{30,}') { Stop-WithMessage "il file $($c.path) sembra contenere un codice segreto: pubblicazione annullata." }
  }
}

# versione: aumenta solo se cambia qualcosa dell'app (non per README o script)
$swFile = Join-Path $root 'sw.js'
$sw = [IO.File]::ReadAllText($swFile)
$m = [regex]::Match($sw, "const VERSION = 'ricettario-v(\d+)'")
if (-not $m.Success) { Stop-WithMessage 'non trovo VERSION in sw.js.' }
$n = [int]$m.Groups[1].Value
$appChanged = @($changed | Where-Object { $notApp -notcontains $_.path }).Count -gt 0
if ($appChanged) {
  $n++
  $sw = $sw.Replace($m.Value, "const VERSION = 'ricettario-v$n'")
  [IO.File]::WriteAllText($swFile, $sw, (New-Object Text.UTF8Encoding $false))
  if (-not ($changed | Where-Object { $_.path -eq 'sw.js' })) { $changed += @{ code = ' M'; path = 'sw.js' } }
}
$ver = "v$n"

Write-Host ''
Write-Host "Archivio: sbarbaorama/cooking (ramo $branch) - versione $ver"
foreach ($c in $changed) {
  if ($c.code -match 'D') { Write-Host "  - $($c.path) (eliminato)" -ForegroundColor Yellow }
  else { Write-Host "  + $($c.path)" -ForegroundColor Green }
}
Write-Host ''

if (-not $Descrizione) { $Descrizione = (Read-Host 'Cosa hai cambiato? (Invio per saltare)').Trim() }
$msg = if ($Descrizione) { "Ricettario $ver - $Descrizione" } else { "Ricettario $ver" }

# un solo commit con tutti i file: GitHub Pages fa un'unica pubblicazione
if ($changed.Count -gt 0) {
  & git add -A
  if (-not (Invoke-Git commit -q -m $msg)) { Stop-WithMessage 'salvataggio (commit) non riuscito.' }
}
Write-Host 'Allineo con GitHub...'
if (-not (Invoke-Git pull -r -q origin $branch)) {
  & git rebase --abort 2>$null
  Stop-WithMessage 'online ci sono modifiche in conflitto con le tue: risolvile e rilancia pubblica.bat.'
}
Write-Host 'Invio...'
if (-not (Invoke-Git push -q origin $branch)) { Stop-WithMessage 'invio non riuscito: controlla la connessione e l''accesso a GitHub (Git Credential Manager).' }

Write-Host ''
if ($changed.Count -gt 0) { Write-Host "Fatto: $($changed.Count) file pubblicati in un solo aggiornamento. Versione $ver." -ForegroundColor Cyan }
else { Write-Host "Fatto: inviati i salvataggi che non erano ancora online. Versione $ver." -ForegroundColor Cyan }
Write-Host 'Tra uno o due minuti, nell''app comparira'' la barra con il pulsante Aggiorna.'
Write-Host "Indirizzo dell'app: $site"
