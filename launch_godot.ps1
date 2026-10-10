param([string]$GodotPath = "", [switch]$Editor)
$ErrorActionPreference = "Stop"
$projectPath = Join-Path $PSScriptRoot "godot"
$candidates = @($GodotPath, $env:GODOT_BIN)
foreach ($commandName in @("godot", "godot4")) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }
}
if ($env:LOCALAPPDATA) {
    $candidates += Join-Path $env:LOCALAPPDATA "Programs\Godot\4.7.2\Godot_v4.7.2-stable_win64_console.exe"
}
$engine = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
if (-not $engine) { throw "Set GODOT_BIN or pass -GodotPath to a Godot 4.7.2 executable." }
$engineArgs = @("--path", $projectPath)
if ($Editor) { $engineArgs += "--editor" }
& $engine @engineArgs
exit $LASTEXITCODE
