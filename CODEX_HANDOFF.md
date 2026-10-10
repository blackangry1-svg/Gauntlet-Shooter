# Codex project handoff
Date: 2026-10-10
Owner: Codex; takeover and local migration complete.

## Canonical checkout
Use this gauntlet_l repository, registered in Codex as Gauntlet Shooter.
The native game is godot/project.godot. GitHub is blackangry1-svg/Gauntlet-Shooter.
Development branch: codex/godot-takeover; migrate through its attached draft pull request.
The root browser version preserves Antigravity's committed history and local work.
Original sibling folders are preserved baselines; make future native edits in godot here.

## Start and verify
Run launch_godot.bat to play; append -Editor to open Godot.
Use launch_godot.ps1 -GodotPath <executable> for a custom installation or set GODOT_BIN.
Run python tools/codex/check_godot.py --godot <executable> for all baseline checks.
Installed engine verified: 4.7.2.stable.official.ed1daf0bf, GL Compatibility.
Local logs and results: .codex-local/validation/RESULTS.json.

## Evidence
Godot import passed in 59.219 seconds with zero engine errors or warnings.
The existing 16 test groups passed all 94 assertions in 5.047 seconds.
Main-scene headless boot completed 120 iterations in 3.718 seconds without errors or warnings.
All 35 selected delivered artwork hashes and the preserved shield v1 are verified.
425 original files were verified against the pre-migration capture.
Backup: .codex-local/backups/Gauntlet_Before_Codex_2026-10-10.zip (426 entries).
MIGRATION_MANIFEST_V1.json records copied files, hashes, baseline history and validation.
Headless results do not certify rendered art, physical controllers or hardware performance.
The preserved browser implementation was not replayed during this native migration.

## Authority and design backlog
Read AGENTS.md, Master_ Gauntlet_Guide.pdf and the native gameplay code first.
The native baseline retains four classes, five old floors, Minotaur stalker, sanctuary, Asterion and Aegis.
Use godot/ASSET_CATALOG_V1.json for portable source paths and hashes.
Historical source manifests and handoffs retain original Windows paths and generation prompts.
Codex assumes extraction, wiring and verification previously assigned to Antigravity.
Source sheets need reviewed masks, safe cell extraction, canonical RGBA and gameplay animation.
Five ELEMENTAL labyrinth designs are proposals; they are not implemented in the current game.
The latest package in Downloads preserves the thread's complete artwork generation history.

## Next milestone
Blueprint one Earth labyrinth vertical slice using ELEMENTAL_STAGE_DESIGN_V1.md.
Resolve the intended elemental progression against existing baseline mechanics before replacing floors.
Integrate one regular enemy, the corrected shield and reviewed animation states.
Prove key-before-gate, return-lever shortcut, boss-exit release and wall collision for every creature.
Validate rendered frames and controller play before extending all five stages.
