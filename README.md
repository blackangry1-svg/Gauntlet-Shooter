# Gauntlet: Elemental Tower

The active native game is **godot/project.godot**, maintained by Codex in this checkout.
The adventure keeps the first-person perspective and replaces the active four-class game with one stranded hero.
The original browser game, native scripts, source artwork and sibling projects remain preserved.

## Play

Double-click **PlayAdventure.cmd**, or import godot/project.godot in Godot 4.7.2.
PlayAdventure.ps1 -Editor opens the editor; GODOT_BIN can specify another installation.
The earlier launch_godot launchers also open the current native project.

## The campaign

Every floor uses its supplied31-by-31 labyrinth, with actual walls, local keys, locked corridors,
return levers, persistent shortcuts, supply secrets, a captive smith and a distinct guardian.

| Floor | Traversal | Guardian reward |
|---|---|---|
| Earth: Rootbound Crown | Shore driftwood, sword/buckler chest, key gate | Bow and Tide Charm |
| Water: Drowned Bellways | Tide Charm descent to a submerged key and return bubbles | Staff and Ember Sigil |
| Fire: Ember Oathforge | Local key, elevated bow chain-ring lever, physical lava bridge | Valkyrie spear and Gale Mantle |
| Air: Windglass Warrens | Storm barrier opened with Gale Mantle | Aether Sight |
| Aether: Unwritten Labyrinth | Two earlier-floor seals, local key and true passage | Tower Heart |

After Air, revisit Earth with the staff for the Sun Seal and Fire with the spear for the Moon Seal.
Aether Sight reveals these wards. Both seals are required before the fifth floor opens.
Earned equipment and opened passages survive death, floor changes and save reload.

Arrows and staff charges are finite. Rest at a shrine to heal and recover a small owned-weapon supply.
The rescued smith offers independent weapon, shield and utility upgrades with Embers.
Large guardians have distinct attacks, readable windups, recovery windows, cover checks and stronger second phases.

## Controls

| Action | Keyboard/mouse | Controller |
|---|---|---|
| Move/look | WASD / mouse | Left/right sticks |
| Light / heavy | Left / right mouse | R1 / Triangle |
| Guard / dodge | Q / Space | L1 / Circle |
| Interact / heal | E / F | Cross / Square |
| Equipped weapon | 1–5 or brackets | D-pad left/right |
| Sprint | Shift | Left stick press |
| Journal / pause | Tab / Esc | Back / Start |
| Save / performance | F5 / F9 | Pause menu |

## Saves and performance

The new adventure uses its own adventure_v1.json and validated backup in Godot user storage.
It does not overwrite the legacy save. Tests use isolated files under .codex-local.
Only one floor is active. Geometry is batched; wall collision is merged.
AI uses a shared navigation cache at10Hz, at most8 regular actors plus1 boss, and24 combined projectiles.
GL Compatibility, a 60 FPS cap, 75% render scale and shadow-free lighting are defaults.
The pause menu offers 60%, 75% and 100% rendering.
The low-power option also caps rendering at 45 FPS; balanced and native use 60 FPS.
Relic upgrades improve dive speed, fire protection, dodge stamina cost and magical map sight.

## Verify and continue

Run python tools/codex/check_adventure.py --godot <executable> --render.
It checks legacy regressions, state/player, physical world topology, combat, the whole progression,
main-game transitions and real OpenGL rendering. Logs/captures are local under .codex-local/overhaul.
See OVERHAUL_BLUEPRINT_V1.md, ADVENTURE_INTERFACES_V1.md and CODEX_HANDOFF.md.

Current presentation uses inexpensive3D creature and weapon silhouettes plus ready environment textures.
Delivered new art remains preserved for reviewed extraction and animation work.
Physical controller feel and long-session balance still need human playtesting.
