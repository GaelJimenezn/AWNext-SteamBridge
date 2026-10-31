[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$SteamRoot,
    [switch]$Apply,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$package = Join-Path $projectRoot 'plugin\dist'
$sourceConfig = Join-Path $projectRoot 'plugin\bridge-config.json'
$packageName = 'org.awnext.steambridge.star'
$configName = 'org.awnext.steambridge.config.json'

function Resolve-SteamRoot {
    param([string]$ExplicitRoot)
    if ($ExplicitRoot) { return (Resolve-Path -LiteralPath $ExplicitRoot).Path }
    foreach ($key in @('HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam', 'HKLM:\SOFTWARE\Valve\Steam')) {
        $item = Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
        foreach ($candidate in @($item.SteamPath, $item.InstallPath)) {
            if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'steam.exe') -PathType Leaf)) {
                return (Resolve-Path -LiteralPath $candidate).Path
            }
        }
    }
    throw 'Steam no se encontro en el registro; indica -SteamRoot.'
}

if (-not (Test-Path -LiteralPath $package -PathType Leaf)) { throw "Falta el paquete: $package" }
if (-not (Test-Path -LiteralPath $sourceConfig -PathType Leaf)) { throw "Falta la configuracion local: $sourceConfig" }
$steam = Resolve-SteamRoot $SteamRoot
$pluginDir = Join-Path $steam 'millennium\plugins'
if (-not (Test-Path -LiteralPath (Join-Path $steam 'steam.exe') -PathType Leaf) -or
    -not (Test-Path -LiteralPath $pluginDir -PathType Container)) {
    throw "Steam o el directorio de plugins de Millennium no existen bajo $steam"
}
$targetPackage = Join-Path $pluginDir $packageName
$targetConfig = Join-Path $pluginDir $configName
if ((Test-Path -LiteralPath $targetPackage) -and -not $Force) {
    Write-Host "[AVISO] El paquete ya existe: $targetPackage (usa -Force para sobrescribir o actualizar)"
    if ($Apply) { throw "El paquete ya existe; no se sobrescribira sin -Force: $targetPackage" }
}

$starlight = Join-Path $projectRoot 'plugin\node_modules\.bin\starlight.exe'
if (-not (Test-Path -LiteralPath $starlight -PathType Leaf)) { throw "Falta Starlight: $starlight" }
$inspection = (& $starlight inspect $package 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $inspection -notmatch 'id:\s+org\.awnext\.steambridge' -or
    $inspection -notmatch 'backend/main\.lua' -or $inspection -notmatch 'bundle\.js') {
    throw 'El paquete Starlight no paso la inspeccion de identidad o contenido.'
}
$config = Get-Content -LiteralPath $sourceConfig -Raw | ConvertFrom-Json
$mapping = $config.games.'2545026989'
if (-not $mapping -or $mapping.titleId -ne '4D5309C9' -or $mapping.adapter -ne 'x360recomp-toml') {
    throw 'bridge-config.json no contiene la asociacion verificada de Forza Horizon 1.'
}
$stateFile = Join-Path $mapping.stateRoot "$($mapping.profile)\achievements\$($mapping.titleId).toml"
$catalog = Join-Path $config.awnDataRoot "steam_cache\x360recomp\$($mapping.titleId).json"
if (-not (Test-Path -LiteralPath $stateFile -PathType Leaf)) { throw "Falta el estado local: $stateFile" }
if (-not (Test-Path -LiteralPath $catalog -PathType Leaf)) { throw "Falta el catalogo AWN: $catalog" }

Write-Host "[PAQUETE] $package -> $targetPackage"
Write-Host "[ASOCIACION] AppID 2545026989 -> $($mapping.titleId)"
Write-Host "[DATOS] $stateFile"
Write-Host "[CATALOGO] $catalog"
if (Test-Path -LiteralPath $targetConfig) {
    $existingConfig = Get-Content -LiteralPath $targetConfig -Raw | ConvertFrom-Json
    $existingMapping = $existingConfig.games.'2545026989'
    if (-not $existingMapping -or $existingMapping.titleId -ne '4D5309C9') {
        throw "La configuracion existente no contiene la asociacion esperada; no se sobrescribira: $targetConfig"
    }
    Write-Host "[CONFIG] Ya existe y se conservara sin cambios: $targetConfig"
} else {
    Write-Host "[CONFIG] $sourceConfig -> $targetConfig"
}
if (-not $Apply) {
    Write-Host '[PREVISION] No se instalo ningun archivo. Repite con -Apply tras revisar las rutas.'
    return
}

if ($PSCmdlet.ShouldProcess($targetPackage, 'Instalar paquete AWNext Steam Bridge')) {
    Copy-Item -LiteralPath $package -Destination $targetPackage -Force -ErrorAction Stop
    $sourceHash = (Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash
    $targetHash = (Get-FileHash -LiteralPath $targetPackage -Algorithm SHA256).Hash
    if ($sourceHash -ne $targetHash) { throw 'La copia del paquete no coincide con el original.' }
    if (-not (Test-Path -LiteralPath $targetConfig)) {
        if ($PSCmdlet.ShouldProcess($targetConfig, 'Instalar configuracion local AWN')) {
            Copy-Item -LiteralPath $sourceConfig -Destination $targetConfig -ErrorAction Stop
        }
    }
    Write-Host '[INSTALADO] Activa org.awnext.steambridge en Millennium y abre Forza horizon 1 en la biblioteca.'
}
