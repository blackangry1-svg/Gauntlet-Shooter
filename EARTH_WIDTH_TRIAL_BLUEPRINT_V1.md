# Earth width trial v1
Date: 2026-10-12. Baseline: elemental-overhaul commit 8a48bc5.
## Scope and preservation
Only Earth receives wider geometry and grouped pursuit. Water, Fire, Air and Aether retain their maps, geometry and encounter population.
Earth retains its 31 x 31 authored labyrinth, keys before gates, chest and secret locations, far-side return levers and boss exit.
Earth cell width changes from 3 m to 9 m; walls from 3.2 m to 5.4 m. Gates and merged collision span the passages.
Actors, pickup reach, weapon reach and marker cells retain human scale. Save cells remap through the floor-specific metric.
Original artwork, both shields, sibling project, browser baseline and external player saves remain preserved.
Future large chambers, lakes and parkour rooms depend on the user's width playtest; this trial does not rebuild those encounters.
## Geometry and rendering
World exposes get_floor_metrics(index) and cell_to_world_for_floor(cell,index); active cell_to_world retains its contract.
All indexed entries, feature definitions, enemy and boss positions use indexed metrics, independent of the loaded floor.
Earth gate footprint is 8.9 x 5.4 x 0.5 m. Other floor gates retain 2.9 x 2.7 x 0.36 m.
Earth wall texture repeats 3 horizontally and 1.6875 vertically, preserving stone scale.
Cheap procedural sky and bounded distant silhouettes add skyline without dynamic lighting or collision.
Geometry remains batched in MultiMesh with merged static colliders and only one floor loaded.
## Refuge and enemy interfaces
World exposes is_safe_refuge(position): Earth entry/checkpoint radius 7 m, vertical tolerance 2.5 m; lift radius 3 m.
Checkpoint interaction emits refuge_requested after its existing healing, restock and save action.
Only checkpoint and lift sanctuary suppress hostile damage. Merchants, treasure and boss areas remain combat spaces.
Earth contains eight authored mixed squads of three regular enemies, plus its hidden guardian and boss.
Director configures an awake cap: low 8, balanced 10, native 12; other floors retain 8. One boss is additional.
Director exposes set_quality_budget(value). Projectile caps remain total 24 and hostile 12.
One reverse BFS field drives pursuit at 10 Hz. Physical wall and gate collision remains authoritative.
Group alerts cross at most two reachable cells. Path-based wake distance is 4 to 6 Earth cells.
Enemy combat_level is 1 to 3. Hero rating uses level plus bounded equipped tier bonus.
Hero rating at least enemy level plus 3 produces cautious retreat; enemy level above hero rating produces persistent hunting until refuge or unreachable topology.
Stable lane offsets and bounded pair separation let squads share a corridor without bypassing corners.
Refuge clears hostile tells and projectiles; in-flight shots cannot damage a protected player.
## Character progression interfaces
State adds hero_level (1), experience (0) and hero_attributes {strength:5,dexterity:5,focus:5}.
Public methods: attribute_value(id), level_up_cost(), can_level_up(), level_up(attribute), weapon_requirements(id), can_equip(id), get_character_stats(), award_combat_reward(embers,xp), get_combat_rating().
A refuge level costs 80 + 45*n + 15*n*n XP, n=level-1; cap 30. One selected attribute gains one point.
Driftwood has no requirement; sword needs strength 6, bow dexterity 6, staff focus 6, spear strength 7 plus dexterity 6.
XP is separate from Embers. Regular kills award XP once. Optional third argument ammo_rewards on award_combat_reward combines ammo with XP/currency in one persistence transaction. Boss reward is atomic and idempotent with boss progression.
Capacity and damage grow modestly. Synchronizing stats preserves current health/stamina; only refuge resting heals.
Equip/cycle skip locked weapons; attacks reject unmet requirements before consuming ammo/stamina.
Save schema 2 accepts schema 1. Previously owned schema-1 weapons receive permanent explicit legacy attunement, preserving usability, inventory, equipped weapon, tiers, ammo, flags, currency and checkpoint.
Loading an old save never writes it automatically and does not invent XP. Isolated migration fixtures verify this.
Refuge UI offers strength/dexterity/focus choices; journal/hotbar display level, XP and weapon requirements.
## Acceptance and evidence
Verify independent physical corridor/gate width, wall top, capsule passage and closed/open gate behavior; indexed other-floor geometry and maze JSON hash remain unchanged.
Run legacy, persistence, route, combat, campaign and new trial tests with isolated saves; preserve external save SHA hashes.
Capture rendered shoreline skyline, wide corridor, gate, grouped combat and refuge UI. Record measured timing and awake/projectile bounds.
Manual test: launcher, Earth chest/key/gate/shortcut, squad pursuit, refuge rest/level, save/reload and Earth boss. Physical keyboard/controller experience remains the user's acceptance.
GEN9 pack tiles are inaccessible relative paths in this environment; AST sidecars are generic/truncated. Bounded symbol and semantic queries provide the inspected evidence. Psyche returns are independently checked against project code.
