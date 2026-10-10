param([switch]$Editor)
$ErrorActionPreference = 'Stop'
$projectRoot = Join-Path $PSScriptRoot 'godot'
$godotCommand = Get-Command godot -ErrorAction SilentlyContinue
$godotPath = if ($env:GODOT_BIN) { $env:GODOT_BIN } elseif ($godotCommand) { $godotCommand.Source } else {
    Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'Programs\Godot') -Filter '*win64.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $godotPath -or -not (Test-Path -LiteralPath $godotPath)) { throw 'Godot not found. Set GODOT_BIN to your Godot executable.' }
$gameArguments = @('--path', $projectRoot)
if ($Editor) { $gameArguments += '--editor' }
& $godotPath @gameArguments
