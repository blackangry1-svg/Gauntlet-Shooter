# Gauntlet: Codex development checkout

The native Godot game now lives in **godot/project.godot**.
Codex maintains this checkout and blackangry1-svg/Gauntlet-Shooter.
The browser game at the repository root preserves the earlier Antigravity version.

## Open or play
Use Godot 4.7.2 with GL Compatibility.
- Run launch_godot.bat to play, or launch_godot.bat -Editor to open the editor.
- Alternatively import godot/project.godot directly in Godot.
- PowerShell accepts an explicit engine: ./launch_godot.ps1 -GodotPath <executable>.
- GODOT_BIN can supply the engine path on another computer.

## Verify
Run python tools/codex/check_godot.py --godot <Godot executable>.
The check imports assets, runs godot/tests/test_suite.gd and boots the main scene headlessly.
Local logs and JSON results live under .codex-local/validation.
The original godot/README.md retains the existing gameplay and controls documentation.

## Design and handoff
Read CODEX_HANDOFF.md for the current state and next milestone.
Read MIGRATION_BLUEPRINT_V1.md for the migration contract.
The original Master_ Gauntlet_Guide.pdf and current Godot code define the baseline.
godot/ASSET_HANDOFF_V1.md and EXPANSION_HANDOFF_V1.md describe delivered artwork.
godot/ELEMENTAL_STAGE_DESIGN_V1.md defines five proposed elemental maze stages.
Open godot/ELEMENTAL_LABYRINTHS_V1.html to explore their layouts offline.

## Current scope
Four hero classes, five original floors, the Minotaur stalker, sanctuary and Asterion are preserved.
The new source artwork and elemental maze designs await production extraction and gameplay integration.
Every future floor, including its boss encounter, must remain a labyrinth.

## Repository history
Migration work uses codex/godot-takeover and preserves GitHub main for review.
The local Antigravity history is retained in antigravity remote references.
A verified pre-migration backup is kept in .codex-local/backups.
Local transcripts, runtime logs, imports and backups remain outside Git.
