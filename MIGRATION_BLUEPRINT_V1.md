# Codex migration blueprint
Date: 2026-10-10
Status: local migration and runtime checks passed; publication uses the migration branch.

## Canonical locations
- Codex checkout: this gauntlet_l folder, already registered as Gauntlet Shooter.
- Current native game: godot/project.godot within this checkout.
- GitHub: blackangry1-svg/Gauntlet-Shooter; migration branch codex/godot-takeover.
- Root browser game: preserved legacy baseline including Antigravity's local working changes.
- Original sibling folders stay available as preserved baselines.

## Ownership and authority
Codex takes responsibility for code, assets, tests, integration and GitHub maintenance.
The current Godot source and Master_ Gauntlet_Guide.pdf define the gameplay baseline.
Existing delivery handoffs remain historical records; Codex assumes their former Antigravity tasks.
Five ELEMENTAL labyrinth proposals and reviewed artwork define the approved expansion backlog.

## Migration sequence
1. Back up the Godot folder, browser working tree and Git history, current workspace and thread image cache.
2. Capture source SHA256 hashes and verify archive CRC and file readback.
3. Initialize the current Codex workspace from Antigravity's committed browser history.
4. Restore its uncommitted browser files and tracked deletions, then import the native game under godot.
5. Add portable launch/check tools, ownership guidance and durable project state.
6. Import with installed Godot 4.7.2, run the existing assertion suite and perform a bounded headless scene boot.
7. Verify originals, source delivery hashes, and current GitHub main before committing.
8. Push a migration branch and create an attached draft PR for review.

## Preservation contracts
- Preserve all original source files, selected images, both shield versions and external player data.
- Retain local browser branches and history; do not force-push GitHub or replace its default branch.
- Keep personal transcripts, generated import caches, local backups and runtime logs outside version control.
- Source RGB sheets need reviewed extraction and alpha cleanup before engine use.
- Characters target 1536 by 1536 RGBA with six by six temporal cells; weapons four horizontal cells, shield three.
- Every elemental floor, encounter, transition and boss space must remain a maze.
- Preserve four classes, Minotaur stalker, sanctuary, Asterion and Aegis until a deliberate gameplay blueprint reconciles them.
- New elemental key/gate/return-lever/boss-exit designs remain proposals until implemented and verified.

## Acceptance
- The Codex workspace is a real checkout connected to the user's existing repository.
- The migrated Godot content matches the source, except documented portable tooling and necessary baseline fixes.
- Backup, all 35 selected art source hashes and the preserved shield are verified.
- Godot import, existing tests and bounded scene startup produce explicit recorded outcomes.
- A durable handoff names the canonical project, commands, current limitations and next milestone.
- GitHub receives the complete migration on a separate reviewable branch.
