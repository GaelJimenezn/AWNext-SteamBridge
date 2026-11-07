# Library Customizer: SteamGridDB isolated provider test (Windows PowerShell 5.1)
# This does not modify the repository or Steam artwork.
param([ValidateSet('Configure','Test','Search','Disconnect')][string]$Action='Configure', [string]$Game='Forza Horizon 3', [ValidateSet('Grid','Hero','Logo','Icon')][string]$Artwork='Grid')
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$dir = Join-Path $env:APPDATA 'library-customizer\secrets'
$file = Join-Path $dir 'steamgriddb.dpapi'
function Get-Key {
    if (!(Test-Path -LiteralPath $file)) { throw 'API key missing. Run -Action Configure first.' }
    $blob = [IO.File]::ReadAllText($file).Trim()
    try {
        $secure = ConvertTo-SecureString -String $blob
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    } catch { throw 'Unable to unlock key. It is tied to the Windows user and computer that saved it.' }
}
function Invoke-SGDB([string]$Path) {
    $key = Get-Key
    $url = 'https://www.steamgriddb.com/api/v2/' + $Path
    try {
        return Invoke-RestMethod -Uri $url -Method Get -Headers @{ Authorization = 'Bearer ' + $key; Accept = 'application/json' } -TimeoutSec 25
    } catch {
        $status = ''
        if ($_.Exception.Response) { try { $status = [int]$_.Exception.Response.StatusCode } catch {} }
        throw "SteamGridDB request failed (HTTP $status). Check API key, connection or request limits. $($_.Exception.Message)"
    } finally { $key = $null }
}
if ($Action -eq 'Configure') {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $key = Read-Host 'Paste your SteamGridDB API key (hidden)' -AsSecureString
    if ($key.Length -lt 8) { throw 'Key is too short. Nothing saved.' }
    $protected = ConvertFrom-SecureString -SecureString $key
    [IO.File]::WriteAllText($file, $protected, (New-Object Text.UTF8Encoding($false)))
    Write-Host 'Key stored encrypted for current Windows user (DPAPI). Not in Git.' -ForegroundColor Green
    Write-Host 'Run the script with -Action Test, then -Action Search.'
    exit 0
}
if ($Action -eq 'Disconnect') {
    if (Test-Path $file) { Remove-Item -LiteralPath $file -Force }
    Write-Host 'Local SteamGridDB credentials removed.' -ForegroundColor Green
    exit 0
}
$term = [Uri]::EscapeDataString($(if ($Action -eq 'Test') { 'Forza Horizon 3' } else { $Game }))
$results = Invoke-SGDB ('search/autocomplete/' + $term)
if (!$results.success) { throw 'SteamGridDB returned success=false.' }
$games = @($results.data)
if ($games.Count -eq 0) { Write-Host 'API connected, no games matched.'; exit 0 }
Write-Host 'SteamGridDB API connected!' -ForegroundColor Green
$games | Select-Object -First 10 id,name | Format-Table -AutoSize
if ($Action -eq 'Test') { exit 0 }
$gameId = [string]$games[0].id
$endpoint = switch ($Artwork) { Grid {'grids'} Hero {'heroes'} Logo {'logos'} Icon {'icons'} }
$art = Invoke-SGDB ($endpoint + '/game/' + $gameId)
if (!$art.success) { throw 'Artwork lookup returned success=false.' }
Write-Host "Artwork options for $($games[0].name) (SGDB ID $gameId), type $Artwork" -ForegroundColor Cyan
@($art.data) | Select-Object -First 12 id,url,thumb | Format-List
Write-Host 'Read-only test. Nothing has been downloaded or applied to Steam.' -ForegroundColor Yellow
