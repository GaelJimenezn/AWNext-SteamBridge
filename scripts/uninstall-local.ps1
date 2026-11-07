[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$SteamRoot, [switch]$Apply)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'migration-common.ps1')
$steam = Resolve-LibrarySteamRoot $SteamRoot
$enabled = @(Get-LibraryEnabledPlugins $steam)
if ($enabled -contains 'library-customizer') { throw 'Disable library-customizer in Millennium before uninstalling.' }
$plugins = Join-Path $steam 'millennium/plugins'
if ($enabled -contains 'org.awnext.steambridge') { Write-Host '[LEGACY] Old identity enabled. It will remain unchanged.' }
$package = Join-Path $plugins 'library-customizer.star'
if (-not (Test-Path -LiteralPath $package -PathType Leaf)) { Write-Host '[ABSENT] No new package; old installation and all data are preserved.'; return }
Assert-LibraryNoLinks $package
$project = Split-Path -Parent $PSScriptRoot
$tool = Join-Path $project 'plugin/node_modules/@steambrew/starlight/bin/starlight.js'
$inspection = (& node $tool inspect $package 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $inspection -notmatch 'id:\s+library-customizer\s') { throw 'Refusing to remove a package with a different identity.' }
Write-Host "[PACKAGE] Remove only $package; preserve both configurations, credentials, backups and legacy package."
if ($Apply -and $PSCmdlet.ShouldProcess($package, 'Remove Library Customizer package only')) { Remove-Item -LiteralPath $package }
