[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$SteamRoot,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
if (-not $SteamRoot) {
    foreach ($key in @('HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam', 'HKLM:\SOFTWARE\Valve\Steam')) {
        $item = Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
        foreach ($candidate in @($item.SteamPath, $item.InstallPath)) {
            if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'steam.exe') -PathType Leaf)) {
                $SteamRoot = $candidate
                break
            }
        }
        if ($SteamRoot) { break }
    }
}
if (-not $SteamRoot) { throw 'Steam no se encontro; indica -SteamRoot.' }
$steam = (Resolve-Path -LiteralPath $SteamRoot).Path
$pluginDir = Join-Path $steam 'millennium\plugins'
if (-not (Test-Path -LiteralPath $pluginDir -PathType Container)) { throw "No existe $pluginDir" }
$package = Join-Path $pluginDir 'org.awnext.steambridge.star'
$config = Join-Path $pluginDir 'org.awnext.steambridge.config.json'
if (-not (Test-Path -LiteralPath $package -PathType Leaf)) {
    Write-Host "[AUSENTE] $package"
    return
}
$projectRoot = Split-Path -Parent $PSScriptRoot
$starlight = Join-Path $projectRoot 'plugin\node_modules\.bin\starlight.exe'
if (-not (Test-Path -LiteralPath $starlight -PathType Leaf)) { throw "Falta Starlight: $starlight" }
$inspection = (& $starlight inspect $package 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $inspection -notmatch 'id:\s+org\.awnext\.steambridge') {
    throw 'El archivo no se identifica como nuestro plugin; no se borrara.'
}
Write-Host "[PAQUETE] Se retirara unicamente $package"
Write-Host "[CONFIG] Se conservara $config"
if (-not $Apply) {
    Write-Host '[PREVISION] No se retiro ningun archivo. Repite con -Apply tras revisar la ruta.'
    return
}
if ($PSCmdlet.ShouldProcess($package, 'Retirar AWNext Steam Bridge')) {
    Remove-Item -LiteralPath $package -ErrorAction Stop
    Write-Host '[RETIRADO] El paquete se elimino. La configuracion y los otros plugins permanecen intactos.'
}
