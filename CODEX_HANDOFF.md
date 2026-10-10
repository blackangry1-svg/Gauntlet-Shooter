# Codex project handoff
Date: 2026-10-10. Owner: Codex. Native overhaul implemented and validated.

## Canonical project
Work in this gauntlet_l checkout; the active game is godot/project.godot.
GitHub repository: blackangry1-svg/Gauntlet-Shooter.
Development branch: codex/elemental-overhaul; base: codex/godot-takeover.
The migration draft remains separate; do not merge or overwrite main without a user request.
Original sibling Godot/browser folders, root browser history and old saves remain baselines.

## Play and verify
Double-click PlayAdventure.cmd; PlayAdventure.ps1 -Editor opens Godot.
GODOT_BIN can select another local engine. Verified engine: Godot 4.7.2.
Run python tools/codex/check_adventure.py --godot <executable> --render.
Tests use isolated adventure save paths under .codex-local/overhaul.
Use OVERHAUL_ACCEPTANCE_V1.json for tracked results; detailed logs and PNGs are local.
Read OVERHAUL_BLUEPRINT_V1.md and ADVENTURE_INTERFACES_V1.md before changing mechanics.

## Implemented campaign
One first-person hero starts with driftwood on the Earth shore.
Sword/buckler chest precedes the Earth guardian; its reward grants bow and Tide Charm.
Water requires the Tide Charm to dive for a submerged key; its guardian grants staff and Ember Sigil.
Fire requires a local key and a bow shot at the chain ring to lower the physical lava bridge.
The Fire guardian grants the spear and Gale Mantle; Air requires crossing its storm ward.
The Air guardian grants Aether Sight. Revisit Earth with staff for Sun Seal and Fire with spear for Moon Seal.
Both seals unlock Aether; defeat its guardian for the Tower Heart.
All five distinct 31x31 mazes have branching corridors, keys, persistent passages, secrets and refuge lifts.
The captive smith upgrades owned weapons, buckler and traversal utilities with earned Embers.
Relic tiers improve dive speed, fire protection, dodge stamina cost and magical map reveal radius.
Checkpoints heal and provide a minimum reserve of finite bow/staff ammunition to prevent softlocks.
The active four-class system is replaced. Legacy files remain for regression and recovery.

## Save and hardware boundaries
New saves use adventure_v1.json plus checksum/version validation and a backup; no legacy conversion.
Only the current floor is built. Regular active actors cap at eight; combined shots cap at 24, hostile shots at 12.
Enemy AI uses bounded updates and a shared navigation field cached by player cell and topology revision.
GL Compatibility, 60 FPS cap, 75 percent rendering and shadow-free lighting are defaults.
The final five-floor Intel UHD sample measured median frames 16.7-17.3 ms and 95th percentiles 18.2-26.4 ms.
Repeated timing varied under other applications. Low-power mode uses 60 percent rendering with a 45 FPS cap.
508 integrated assertions passed; post-menu campaign 81/81 and low-power rendered checks 12/12 passed.
These are bounded scripted samples; locked frame rates, physical controller feel and long-session balance are not certified.
Creature/viewmodel visuals are inexpensive prototypes with reviewed ready textures; production art is pending.

## Preservation and next work
The original 105 sibling Godot files match their migration capture; preserved artwork was not re-extracted.
Pre-migration backup: .codex-local/backups/Gauntlet_Before_Codex_2026-10-10.zip.
MIGRATION_MANIFEST_V1.json retains the earlier 425-file capture and source history.
Next: fresh-save human campaign playtest, then tune boss tells, combat feel, story and creature animation.
Preserve the new player's progress when iterating. Never use unrelated Godot MCP projects for this game.
