Set-StrictMode -Version Latest

function Get-LibraryHash([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}

function Resolve-LibrarySteamRoot([string]$SteamRoot) {
    if (-not $SteamRoot) {
        $item = Get-ItemProperty -LiteralPath 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue
        if ($item) { $SteamRoot = $item.SteamPath }
    }
    if (-not $SteamRoot) { throw 'Indica -SteamRoot.' }
    $steam = (Resolve-Path -LiteralPath $SteamRoot).Path
    if (-not (Test-Path -LiteralPath (Join-Path $steam 'steam.exe') -PathType Leaf) -or
        -not (Test-Path -LiteralPath (Join-Path $steam 'millennium/plugins') -PathType Container)) {
        throw 'Steam root must contain steam.exe and millennium/plugins.'
    }
    return $steam
}

function Get-LibraryEnabledPlugins([string]$SteamRoot) {
    $path = Join-Path $SteamRoot 'millennium/config/config.json'
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Millennium activation config unavailable.' }
    $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    if (-not $config.plugins -or $null -eq $config.plugins.enabledPlugins) { throw 'Invalid Millennium activation config.' }
    return @($config.plugins.enabledPlugins)
}

function Assert-LibraryNoLinks([string]$Path) {
    $item = Get-Item -LiteralPath $Path -ErrorAction SilentlyContinue
    while ($item) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Links are not migration targets: $Path" }
        $parent = Split-Path -Parent $item.FullName
        if (-not $parent -or $parent -eq $item.FullName) { break }
        $item = Get-Item -LiteralPath $parent -ErrorAction SilentlyContinue
    }
}

function Assert-LibraryCopy([string]$Source, [string]$Target) {
    Assert-LibraryNoLinks $Source
    $parent = $Target
    while (-not (Test-Path -LiteralPath $parent)) { $parent = Split-Path -Parent $parent }
    Assert-LibraryNoLinks $parent
    if (Test-Path -LiteralPath $Target) {
        Assert-LibraryNoLinks $Target
        if (-not (Test-Path -LiteralPath $Target -PathType Leaf) -or
            (Get-LibraryHash $Source) -ne (Get-LibraryHash $Target)) {
            throw "Destination differs; no automatic overwrite or merge: $Target"
        }
    }
}

function Copy-LibraryVerified([string]$Source, [string]$Target) {
    Assert-LibraryCopy $Source $Target
    if (Test-Path -LiteralPath $Target) { return }
    [IO.Directory]::CreateDirectory((Split-Path -Parent $Target)) | Out-Null
    [IO.File]::Copy($Source, $Target, $false)
    if ((Get-LibraryHash $Source) -ne (Get-LibraryHash $Target)) {
        throw "Copied file hash mismatch: $Target"
    }
}
