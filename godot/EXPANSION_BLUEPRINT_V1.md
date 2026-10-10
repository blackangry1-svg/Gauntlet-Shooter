# Gauntlet mythic enemy expansion blueprint v1

Scope: 12 new regular enemy source sheets, 5 elemental boss source sheets, and design for 5 playable labyrinth stages. User authorizes original mythic fantasy inspired by Arthurian quests, enchanted kingdoms and dark epic fantasy.
Authority: existing ASSET_BLUEPRINT_V1.md; Master_ Gauntlet_Guide.pdf; user's requirement that EVERY floor is a labyrinth/maze.
Game scripts, imported originals, saves and the 13 previously selected sources are preserved. Antigravity owns production extraction, combat wiring and runtime validation.

## Artwork contract
- Built-in imagegen; original pixel art, source PNGs in assets/sprites/*_source_v1.png.
- Fixed front three-quarter view; 6x6 time grid, rows idle, movement, windup, attack/recovery, stagger/recovery, death.
- Canonical RGBA import 1536x1536, cells256², world anchor x128/y224; generated sources must be inspected and measured.
- Green-screen source request #00FF00; record actual samples and review key masks, boundaries and anchors before importing.
- No green-key color on subject; no clipped limbs/weapons, adjacent-cell effects, extra limbs, changing equipment or revival in death row.
- Fliers/ghosts obey maze wall collision. Boss movement fits marked corridor circuits. Combat collision uses controller volumes, never rendered pixels.

## New roster
| Asset | Name | Stage | Role |
|---|---|---|---|
| thornbound_revenant | Thornbound Revenant | earth | regular |
| barrow_knight | Barrow Knight | earth,aether | regular |
| mire_hag | Mire Hag | water | regular |
| frost_wraith | Frost Wraith | water | regular |
| ember_imp | Ember Imp | fire | regular |
| ash_zealot | Ash Zealot | fire | regular |
| storm_gargoyle | Storm Gargoyle | air | regular |
| tempest_harpy | Tempest Harpy | air | regular |
| rune_sentinel | Rune Sentinel | aether | regular |
| mirror_duelist | Mirror Duelist | aether | regular |
| cave_spider | Cave Spider | earth | regular |
| moss_troll | Moss Troll | earth | regular |
| stonehart_regent | Stonehart Regent | earth | boss |
| abbess_of_the_tide | Abbess of the Tide | water | boss |
| bellows_wyrm | Bellows Wyrm | fire | boss |
| roc_of_the_broken_sky | Roc of the Broken Sky | air | boss |
| magister_of_glass | Magister of Glass | aether | boss |

## Stage design contract
- Five elemental stages: Earth, Water/Ice, Fire, Air/Storm, Aether/Arcane. Each floor contains branches, meaningful dead ends, cycles, orientation landmarks and return shortcuts.
- No open-arena floor substitutes. Boss encounters occupy navigable labyrinth circuits with multiple approach routes.
- Main route is solvable; each required key/lever is reachable before its gate. Optional hazards never force irreversible loss of the only route.
- Spectral/flying foes cannot travel through walls or bypass locked doors; blinks select reachable floor anchors.
- Exact floor schemes and enemy encounter roles will be delivered separately with maps, module art needs and acceptance criteria.

## Acceptance and delivery
- Independent visual QA for identity, six-row intent, silhouette containment and anatomy; record actual dimensions/hash/background.
- Deliver selected bytes without post-generation image manipulation, complete prompts and per-source review notes.
- Source suitability does not establish canonical animation timing, alpha quality, combat behavior or Godot performance.
- Existing selected shield stays v2; other existing sources stay v1. Never replace imports with these sources automatically.

