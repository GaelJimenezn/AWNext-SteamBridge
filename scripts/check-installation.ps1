[CmdletBinding()]
param([string]$SteamRoot)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'migration-common.ps1')
$steam = Resolve-LibrarySteamRoot $SteamRoot
$enabled = @(Get-LibraryEnabledPlugins $steam)
$legacy = $enabled -contains 'org.awnext.steambridge'
$current = $enabled -contains 'library-customizer'
$plugins = Join-Path $steam 'millennium/plugins'
$result = [ordered]@{
    id = 'library-customizer'
    legacyEnabled = $legacy
    currentEnabled = $current
    bothEnabled = $legacy -and $current
    legacyPackagePresent = Test-Path -LiteralPath (Join-Path $plugins 'org.awnext.steambridge.star')
    currentPackagePresent = Test-Path -LiteralPath (Join-Path $plugins 'library-customizer.star')
    legacyConfigPresent = Test-Path -LiteralPath (Join-Path $plugins 'org.awnext.steambridge.config.json')
    currentConfigPresent = Test-Path -LiteralPath (Join-Path $plugins 'library-customizer.config.json')
    changesMade = $false
}
$result | ConvertTo-Json
if ($result.bothEnabled) { throw 'Both identities are enabled. Disable the legacy identity in Steam; do not delete it.' }
if ($legacy) { Write-Host '[ACTION IN STEAM] Disable org.awnext.steambridge before installing/enabling library-customizer.' }
Write-Host '[MANUAL] Verify loaded plugin ID, account, mapping editor, restart persistence, MWIII identity and x360recomp 16/70 in Steam.'
