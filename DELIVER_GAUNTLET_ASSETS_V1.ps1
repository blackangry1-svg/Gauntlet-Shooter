param([Parameter(Mandatory=$true)][string]$ReceiptPath)
$ErrorActionPreference = 'Stop'
$taskGameRoot = 'C:\Users\pdard\OneDrive\Desktop\voxel games\gauntlet legends\Gauntlet Godot'
$taskCacheRoot = 'C:\Users\pdard\.codex\generated_images\01a1225d-d07b-7922-a3b2-ceaf200941cb'
$taskReceipt = Get-Content -LiteralPath $ReceiptPath -Raw | ConvertFrom-Json
foreach ($taskAsset in $taskReceipt.assets) {
    $taskSource = [System.IO.Path]::GetFullPath([string]$taskAsset.generated_source_path)
    $taskTarget = [System.IO.Path]::GetFullPath([string]$taskAsset.source_path)
    $taskExpectedDir = if ($taskAsset.category -eq 'weapon') { Join-Path $taskGameRoot 'assets\weapons' } elseif ($taskAsset.category -eq 'character') { Join-Path $taskGameRoot 'assets\sprites' } else { throw 'Unknown asset category' }
    if (-not $taskSource.StartsWith($taskCacheRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Source outside generated-image directory' }
    if ([System.IO.Path]::GetDirectoryName($taskTarget) -ne $taskExpectedDir) { throw 'Target outside approved asset directory' }
    if ([System.IO.Path]::GetExtension($taskTarget) -ne '.png' -or [System.IO.Path]::GetFileName($taskTarget) -notmatch '_source_v[0-9]+\.png$') { throw 'Target must be a versioned source PNG' }
    if (-not (Test-Path -LiteralPath $taskSource -PathType Leaf)) { throw 'Missing generated source image' }
    $taskSourceHash = (Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($taskSourceHash -ne $taskAsset.sha256) { throw 'Source hash differs from receipt' }
    if (Test-Path -LiteralPath $taskTarget) {
        if ((Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskSourceHash) { throw ('Refusing to overwrite differing file: ' + $taskTarget) }
    } else {
        if (-not (Test-Path -LiteralPath $taskExpectedDir)) { New-Item -ItemType Directory -Path $taskExpectedDir | Out-Null }
        Copy-Item -LiteralPath $taskSource -Destination $taskTarget
    }
    if ((Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskSourceHash) { throw 'Delivered hash mismatch' }
    [pscustomobject]@{asset=$taskAsset.asset; path=$taskTarget; sha256=$taskSourceHash; status='SOURCE_DELIVERED'}
}

