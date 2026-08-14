<#
  move-duplicates.ps1
  Safely find nested "backend" directories (e.g., backend/backend/...) and move them
  into ./backup-duplicate-backend-<timestamp> for manual review. This avoids accidental
  deletion and prevents TypeScript from compiling duplicate sources.

  Usage (from repo root):
    PowerShell -ExecutionPolicy Bypass -File .\backend\move-duplicates.ps1
#>

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$repoRoot = Get-Location
Write-Host "[move-duplicates] repoRoot: $repoRoot"

# Find directories named 'backend' whose parent directory is also named 'backend'
$dups = Get-ChildItem -Recurse -Directory -Filter backend | Where-Object { $_.Parent -and $_.Parent.Name -eq 'backend' }

if (-not $dups -or $dups.Count -eq 0) {
  Write-Host "[move-duplicates] No nested 'backend/backend' directories found."
  exit 0
}

# Show what will be moved
Write-Host "[move-duplicates] Found the following nested backend directories to move:"
$dups | ForEach-Object { Write-Host "  - " $_.FullName }

$backupDir = Join-Path $repoRoot.Path "backup-duplicate-backend-$timestamp"
Write-Host "[move-duplicates] Files will be moved to: $backupDir"

# Confirm with user
$answer = Read-Host "Proceed to move these directories to backup? Type YES to confirm"
if ($answer -ne 'YES') {
  Write-Host "[move-duplicates] Aborted by user. No changes made."
  exit 1
}

# Create backup dir and move
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
foreach ($d in $dups) {
  $dest = Join-Path $backupDir ($d.FullName -replace '[\\:/]', '_')
  Write-Host "[move-duplicates] Moving $($d.FullName) -> $dest"
  try {
    Move-Item -Path $d.FullName -Destination $dest -Force
  } catch {
    Write-Host "[move-duplicates] ERROR moving $($d.FullName): $_"
  }
}

Write-Host "[move-duplicates] Done. Review $backupDir and commit changes if OK."
