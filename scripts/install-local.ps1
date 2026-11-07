[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$SteamRoot, [switch]$Apply)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'migration-common.ps1')
$steam = Resolve-LibrarySteamRoot $SteamRoot
$enabled = @(Get-LibraryEnabledPlugins $steam)
$plugins = Join-Path $steam 'millennium/plugins'
$old = Join-Path $plugins 'org.awnext.steambridge.star'
if ((Test-Path -LiteralPath $old) -or (Test-Path -LiteralPath (Join-Path $plugins 'org.awnext.steambridge'))) {
    Write-Host '[LEGACY] Old installation detected; it will not be deleted or overwritten.'
}
if ($enabled -contains 'org.awnext.steambridge') {
    throw 'Disable org.awnext.steambridge in Millennium first. Installing a second active identity is blocked.'
}
$project = Split-Path -Parent $PSScriptRoot
$package = Join-Path $project 'artifacts/library-customizer/library-customizer.star'
$manifest = Join-Path $project 'artifacts/library-customizer/build-manifest.json'
if (-not (Test-Path -LiteralPath $manifest)) { throw 'Build locally first.' }
$build = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
if ($build.id -ne 'library-customizer' -or $build.artifactSha256 -ne (Get-LibraryHash $package)) { throw 'Build manifest mismatch.' }
$starlight = Join-Path $project 'plugin/node_modules/@steambrew/starlight/bin/starlight.js'
$inspection = (& node $starlight inspect $package 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $inspection -notmatch 'id:\s+library-customizer\s') { throw 'Unexpected package identity.' }
$target = Join-Path $plugins 'library-customizer.star'
if (Test-Path -LiteralPath (Join-Path $plugins 'library-customizer')) { throw 'A directory installation already exists; do not install another copy.' }
Assert-LibraryCopy $package $target
Write-Host "[PACKAGE] $package -> $target"
Write-Host '[DATA] Run migrate-local.ps1 separately before first activation. Existing personal config is never replaced.'
if (-not $Apply) { Write-Host '[PREVIEW] No files installed.'; return }
if ($PSCmdlet.ShouldProcess($target, 'Install Library Customizer without replacing any existing package')) {
    Copy-LibraryVerified $package $target
    Write-Host '[INSTALLED] Keep the old identity disabled. Enable only library-customizer and verify in Steam.'
}
