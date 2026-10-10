# Elemental tower overhaul
Date: 2026-10-10
Authority: user's explicit one-hero Zelda / Souls / Metroid vision supersedes the four-class baseline.
Preserved baseline: migration commit a6ea40e9; original projects and source artwork remain intact.
Branch: codex/elemental-overhaul.

## Playable contract
One first-person stranded hero starts with driftwood, 120 health and 100 stamina.
Earn sword and buckler, bow and finite arrows, staff and finite charges, and a long-reach spear.
Each weapon is independently upgradeable at a trapped tower merchant; upgrades spend earned currency.
Light/heavy attacks, guarding, dodge, readable boss windups and healing remain deliberate.
Five distinct floors are real connected labyrinths with corridors, cycles, landmarks, keys, gates and secrets.
Loading one floor destroys its old runtime geometry; saved loot, gates, levers, boss and secrets persist.
Checkpoint lifts and return stairs permit meaningful revisits; only unlocked floors can be entered.

## Progression and backtracking
Earth / Rootbound Crown: shoreline start, driftwood, sword/buckler chest, local key and Stonehart guardian.
Earth boss earns bow and tide_charm; Water becomes available.
Water / Drowned Bellways: dive station needs tide_charm to reach its submerged key, flooded branches and bell shortcuts.
Water boss earns staff and ember_sigil; Fire becomes available.
Fire / Ember Oathforge: bow-operated lever lowers a bridge across lava; heat routes and alternate corridors.
Fire boss earns spear and gale_mantle; Air becomes available.
Air / Windglass Warrens: gale protection, gust passages and long-reach mechanisms lead to a large guardian.
Air boss earns aether_sight and reveals two earlier-floor seals required for the final floor.
Return to Earth with the staff to burn sealed roots and recover sun_seal.
Return to Fire with the spear to reach a grate mechanism and recover moon_seal.
Aether / Unwritten Labyrinth: both seals and Air victory unlock it; reveal arcane secrets and defeat the tower's final guardian.
Boss fights remain in linked maze chambers with cover and multiple approaches.
Hidden enemies, optional loot, an imprisoned merchant, weapon chests and persistent shortcuts reward exploration.

## Performance and presentation
Target hardware verified: i5-1035G1, Intel UHD, approximately 12 GB RAM.
GL Compatibility, inexpensive unshadowed light, active-floor-only geometry and batched wall visuals.
At most eight active enemies, ten-Hz AI, capped projectiles, cached materials and HUD updates at ten Hz.
Use lower internal rendering resolution, a 60-FPS cap and explicit quality controls.
Reuse original engine-ready textures and simple readable weapon geometry; preserve reviewed RGB sources for later extraction.
Measure rendered frame timings on this machine; headless speed alone cannot establish smooth graphics.

## Acceptance
Verify all five maze graphs, gated main routes, shortcuts, secrets, cross-floor seals and deterministic placements.
Verify one-hero inventory, finite ammunition, upgrades, save/load, checkpoint recovery and wall-safe combat.
Run complete native import, legacy regression checks and new adventure contract tests.
Capture actual rendered views of every biome and a representative traversal/combat performance sample.
Record limits honestly and fix functional, graphical and runtime failures before delivery.
