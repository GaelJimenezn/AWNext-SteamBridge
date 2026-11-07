[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$SteamRoot, [string]$AppDataRoot = $env:APPDATA, [switch]$Apply)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'migration-common.ps1')
$steam = Resolve-LibrarySteamRoot $SteamRoot
if (-not $AppDataRoot) { throw 'APPDATA unavailable.' }
$appdataPath = [IO.Path]::GetFullPath($AppDataRoot)
$plugins = Join-Path $steam 'millennium/plugins'
$copies = @()
$legacyConfig = Join-Path $plugins 'org.awnext.steambridge.config.json'
if (Test-Path -LiteralPath $legacyConfig -PathType Leaf) {
    $config = Get-Content -LiteralPath $legacyConfig -Raw | ConvertFrom-Json
    if (-not $config.games) { throw 'Invalid legacy games configuration.' }
    # Full byte copy retains iconMap, preferences and unknown fields.
    $copies += @{ Source = $legacyConfig; Target = (Join-Path $plugins 'library-customizer.config.json') }
}
$oldData = Join-Path $appdataPath 'AWNext-SteamBridge'
$newData = Join-Path $appdataPath 'library-customizer'
if (Test-Path -LiteralPath $oldData) {
    Assert-LibraryNoLinks $oldData
    $entries = @(Get-ChildItem -LiteralPath $oldData -Recurse -Force)
    foreach ($entry in $entries) {
        Assert-LibraryNoLinks $entry.FullName
        if (-not $entry.PSIsContainer) {
            $suffix = $entry.FullName.Substring($oldData.Length).TrimStart('\', '/')
            $copies += @{ Source = $entry.FullName; Target = (Join-Path $newData $suffix) }
        }
    }
}
foreach ($copy in $copies) { Assert-LibraryCopy $copy.Source $copy.Target }
Write-Host "[MIGRATION] $($copies.Count) files; originals and installed packages remain untouched."
if (-not $Apply) { Write-Host '[PREVIEW] No files copied.'; return }
if ($PSCmdlet.ShouldProcess('Library Customizer data', 'Copy legacy configuration, preferences, backups and encrypted credentials')) {
    foreach ($copy in $copies) { Copy-LibraryVerified $copy.Source $copy.Target }
    Write-Host '[VERIFIED] Copied bytes match. Keep the old installation until runtime verification.'
}
