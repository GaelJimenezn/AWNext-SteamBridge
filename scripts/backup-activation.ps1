[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$SteamRoot, [string]$BackupName = 'config.before-library-customizer.json', [switch]$Apply)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'migration-common.ps1')
$steam = Resolve-LibrarySteamRoot $SteamRoot
if ($BackupName -eq 'config.json' -or $BackupName.Length -gt 120 -or $BackupName -notmatch '^[a-zA-Z0-9_.-]+\.json$') { throw 'Choose a separate JSON backup filename without directories.' }
$source = Join-Path $steam 'millennium/config/config.json'
$target = Join-Path $steam "millennium/config/$BackupName"
Assert-LibraryCopy $source $target
Write-Host "[BACKUP] $source -> $target"
if (-not $Apply) { Write-Host '[PREVIEW] No files copied. Back up before changing activation in Steam.'; return }
if ($PSCmdlet.ShouldProcess($target, 'Create a verified activation backup without overwriting differences')) {
    Copy-LibraryVerified $source $target
    Write-Host '[VERIFIED] Activation configuration was not modified.'
}
