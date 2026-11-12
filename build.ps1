$ErrorActionPreference = 'Stop'
$slug = 'calico-map-studio'
$main = Get-Content -LiteralPath (Join-Path $PSScriptRoot "$slug.php") -Raw
$version = [regex]::Match($main, 'Version:\s*([0-9.]+)').Groups[1].Value
if (-not $version) { throw 'Plugin version missing' }
$buildRoot = Join-Path ([IO.Path]::GetTempPath()) ('calico-map-studio-build-' + [guid]::NewGuid().ToString('N'))
$package = Join-Path $buildRoot $slug
New-Item -ItemType Directory -Path $package -Force | Out-Null
foreach ($name in @("$slug.php", 'readme.txt', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'assets', 'includes')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $package -Recurse
}
$output = Join-Path $PSScriptRoot "$slug-v$version.zip"
Compress-Archive -LiteralPath $package -DestinationPath $output -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($output)
try {
    $expected = @(Get-ChildItem -LiteralPath $package -Recurse -File | ForEach-Object { $slug + '/' + $_.FullName.Substring($package.Length + 1).Replace('\','/') })
    $actual = @($archive.Entries | Where-Object { $_.Name } | ForEach-Object { $_.FullName.Replace('\','/') })
    if (Compare-Object $expected $actual) { throw 'ZIP paths do not match production source' }
    foreach ($entry in $archive.Entries) {
        if (-not $entry.Name) { continue }
        $relative = $entry.FullName.Replace('\','/').Substring($slug.Length + 1)
        $stream = $entry.Open()
        try {
            $hash = [Security.Cryptography.SHA256]::Create()
            $zipHash = [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','')
            if ($zipHash -ne (Get-FileHash -LiteralPath (Join-Path $package $relative) -Algorithm SHA256).Hash) { throw "ZIP content mismatch: $relative" }
        } finally { $stream.Dispose() }
    }
} finally { $archive.Dispose() }
Copy-Item -LiteralPath $output -Destination (Join-Path $PSScriptRoot "$slug.zip") -Force
Get-FileHash -LiteralPath $output -Algorithm SHA256
