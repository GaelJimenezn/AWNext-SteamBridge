# Reads only installation registry values and game package manifests.
$workerSource = @'
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$provider = '__PROVIDER__'
$records = New-Object Collections.Generic.List[object]
$errors = New-Object Collections.Generic.List[string]
function Read-XmlMetadata([string]$path) {
    if (!(Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
    if ((Get-Item -LiteralPath $path).Length -gt 2097152) { throw 'Metadata exceeds size limit' }
    $settings = New-Object Xml.XmlReaderSettings
    $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [Xml.XmlReader]::Create($path, $settings)
    try { $doc = New-Object Xml.XmlDocument; $doc.XmlResolver = $null; $doc.Load($reader); return ,$doc }
    finally { $reader.Dispose() }
}
if ($provider -eq 'ubisoft' -or $provider -eq 'gog') {
    $paths = if ($provider -eq 'ubisoft') { @('SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs', 'SOFTWARE\Ubisoft\Launcher\Installs') } else { @('SOFTWARE\WOW6432Node\GOG.com\Games', 'SOFTWARE\GOG.com\Games') }
    foreach ($path in $paths) {
        $key = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey($path, $false)
        if (!$key) { continue }
        try {
            $names = @($key.GetSubKeyNames())
            if ($names.Count -gt 5000) { throw 'Registry record limit' }
            foreach ($id in $names) {
                if ($id -notmatch '^\d+$') { continue }
                $game = $key.OpenSubKey($id, $false)
                if (!$game) { continue }
                try {
                    $folder = if ($provider -eq 'ubisoft') { $game.GetValue('InstallDir') } else { $game.GetValue('path') }
                    $name = if ($provider -eq 'ubisoft') { $game.GetValue('DisplayName') } else { $game.GetValue('gameName') }
                    $resolved = ![string]::IsNullOrWhiteSpace($name)
                    if (!$resolved) { $name = "$provider [$id]" }
                    $records.Add(@{id=$id;name=[string]$name;nameResolved=$resolved;path=[string]$folder;source="HKLM\$path\$id"})
                } finally { $game.Dispose() }
            }
        } finally { $key.Dispose() }
    }
} elseif ($provider -eq 'xbox') {
    $packages = @(Get-AppxPackage -PackageTypeFilter Main -ErrorAction Stop)
    if ($packages.Count -gt 5000) { throw 'Package record limit' }
    foreach ($package in $packages) {
        if ($package.IsFramework -or $package.IsResourcePackage -or !$package.InstallLocation) { continue }
        try {
            $folder = [string]$package.InstallLocation
            $config = $null
            foreach ($relative in @('MicrosoftGame.config', 'Content\MicrosoftGame.config')) {
                $config = Read-XmlMetadata (Join-Path $folder $relative)
                if ($config -and $config.DocumentElement.LocalName -eq 'Game') { break }
                $config = $null
            }
            $manifest = Read-XmlMetadata (Join-Path $folder 'AppxManifest.xml')
            $gameExtension = $manifest -and $manifest.SelectSingleNode('//*[local-name()="Extension" and @Category="windows.game"]')
            if (!$config -and !$gameExtension) { continue }
            $visual = if ($config) { $config.SelectSingleNode('//*[local-name()="ShellVisuals"]') } else { $null }
            $name = if ($visual) { $visual.GetAttribute('DefaultDisplayName') } else { '' }
            $resolved = $name -and !$name.StartsWith('ms-resource:')
            if (!$resolved) { $name = [string]$package.Name }
            $store = if ($config) { $config.SelectSingleNode('//*[local-name()="StoreId"]') } else { $null }
            $apps = if ($manifest) { @($manifest.SelectNodes('//*[local-name()="Application"]')) } else { @() }
            if ($apps.Count -eq 0) { $apps = @($null) }
            foreach ($app in $apps) {
                $aumid = if ($app) { "$($package.PackageFamilyName)!$($app.GetAttribute('Id'))" } else { $null }
                $records.Add(@{id=[string]$package.PackageFamilyName;name=[string]$name;nameResolved=[bool]$resolved;path=$folder;source='current-user Appx game metadata';aumid=$aumid;storeId=$(if ($store) {$store.InnerText} else {$null})})
            }
        } catch { if ($errors.Count -lt 50) { $errors.Add('A game package could not be inspected') } }
    }
} else { throw 'Unsupported metadata provider' }
@{records=@($records.ToArray());errors=@($errors.ToArray())} | ConvertTo-Json -Depth 8 -Compress
'@
$start = New-Object Diagnostics.ProcessStartInfo
$start.FileName = Join-Path $PSHOME 'powershell.exe'
$start.Arguments = '-NoProfile -NonInteractive -EncodedCommand ' + [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($workerSource))
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$start.StandardOutputEncoding = New-Object Text.UTF8Encoding($false)
$process = New-Object Diagnostics.Process
$process.StartInfo = $start
try {
    [void]$process.Start()
    $output = $process.StandardOutput.ReadToEndAsync()
    $errorOutput = $process.StandardError.ReadToEndAsync()
    if (!$process.WaitForExit(15000)) { $process.Kill(); throw 'Metadata scan timed out' }
    if ($process.ExitCode -ne 0) { throw 'Local metadata enumeration failed' }
    $text = $output.Result
    if ($text.Length -gt 2097152) { throw 'Metadata result exceeds size limit' }
    [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
    [Console]::Write($text)
} finally { $process.Dispose() }
