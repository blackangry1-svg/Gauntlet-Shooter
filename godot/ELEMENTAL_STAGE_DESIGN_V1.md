# Five elemental labyrinth stages
Restore five broken ward seals to repair an original mythic kingdom: roots, waterways, furnaces, winds and protective enchantment. Every playable floor, transition, treasure route and boss floor is a labyrinth.
Authority: the user's maze requirement and existing ASSET_BLUEPRINT_V1.md. This is an art/design delivery; Antigravity owns Godot blockout, collision, AI, animation and runtime checks.
Open ELEMENTAL_LABYRINTHS_V1.html to explore five reproducible maps. ELEMENTAL_LABYRINTHS_V1.json contains exact 31x31 wall grids, 15x15 logical cells, marker coordinates, paths and state checks. Named sector connections below guide expansion; the supplied schematics are blockout seeds, not literal sector geometry.
## Maze structure
Each floor has 5 cycles before the key gate and 3 after it, branch rewards, a unique key reachable before its gate, a return lever beyond the gate and a closed boss corridor circuit. Gate remains open; boss victory releases exit seal. Completion works without the shortcut.
Keep player passages wide enough for dodge/retreat and foes. Widen boss circuit segments for turning and collision while retaining walls, corners and loops; no open arena substitute. Suggested starting widths are 3m ordinary / 5m major-boss, to be revised against real controller scale.
All fliers/ghosts obey walls and doors; spectral blinks choose visible reachable floor anchors. The player is never forced to expend a consumable or select a particular class to navigate.
## 1. Earth — Rootbound Crown
**Look/story:** An ancient coronation maze is fractured by roots: muted moss and granite, amber sap lamps, bronze crown reliefs, broken royal arches. Restoring Earth stabilizes the abbey foundations.
**Route:** Arrival → Root Shrine → Forked Cairn → Broken Aqueduct → Thorn Gallery → Root Shrine. A burial side branch holds the Root Key. Crown Gate leads to a looping Hammer Walk / Fallen Pillars / Root Trench / Crown Walk boss circuit. A far-side lever opens the shrine return; exit is beyond Crown Walk.
**Play/ecology:** Revenants guard corners with root spears; Cave Spiders mark low ambush branches; Moss Trolls pressure wide junctions; Barrow Knights guard optional tombs. Root snares and rising stone teeth telegraph visibly and leave safe waiting alcoves.
**Boss:** Stonehart Regent, a crowned quadruped stone stag. Forehoof scrape warns of a straight charge; evade around a branch, strike cracked flank stone in recovery. Root binds never overlap an unavoidable charge.
**Art kit:** Rooted wall straights/corners, crown relief panels, arches, stone/soil floors, cairns, roots, sap lamps, burial key doors, plates, broken pillars; keep arches wide enough for antlers.
## 2. Water/Ice — Drowned Bellways
**Look/story:** Flooded abbey drainage tunnels alternate deep navy wet stone and cyan ice; brass bells, tide marks and raised dry ledges orient the player. Restoring Water reopens forge cooling channels.
**Route:** Arrival → Bell Landing → Drain Fork; Reed Walk / Pump Shrine / Frost Walk loop back to Drain Fork. A pump branch holds the Tide Key. Tide Gate opens the Bell Crossing / Shallow Channel / Ice Arcade / Sluice Bend circuit; a downstream wheel opens the dry return shortcut.
**Play/ecology:** Mire Hags cast visible censer mist from wet intersections; Frost Wraiths sweep ice scythes through icy loops. Flood rises with bell cues and drains cyclically; slippery lanes have dry alternatives and waiting ledges. Never combine unavoidable mist and frost slow.
**Boss:** Abbess of the Tide, drowned staff-and-bell sorceress. A raised bell announces a channel cast; use dry cover around a bend and attack as her implements lower. One support group at most.
**Art kit:** Wet/frozen walls, sluice doors, dry/flooded floor variants, frost edges, reeds, chains, cracked bells, pump wheels, tide marks, raised ledges, blue lamps.
## 3. Fire — Ember Oathforge
**Look/story:** Black furnace-brick passages, copper pipes, ash-white oath inscriptions and orange vents surround cobalt cooling-water channels. Restoring Fire powers the observatory mechanisms.
**Route:** Quench Shrine → Anvil Fork; Cinder Gallery and Cooler Passage connect to Furnace Crossing. Cinder side branch contains Ember Key. Ember Gate opens Hammer Channel / Chain Gallery / Ash Bend / Furnace Spine circuit. Cooling lever opens maintenance return to shrine.
**Play/ecology:** Ember Imps lob pots into visible lanes; Ash Zealots hold corners with short flails. Vents glow and pressure hisses before fire jets. Cooler Passage remains reliable; burning patches never close every retreat branch.
**Boss:** Bellows Wyrm, four-legged two-winged furnace dragon. Braced feet and expanding chest announce breath. Leave its lane through a junction and strike the neck during exhale recovery. Wings stay folded in passage travel.
**Art kit:** Furnace bricks, copper ducts, vents, cold/hot grates, chains, anvils, slag, cooling levers, furnace shutters, soot signs, orange warning lamps.
## 4. Air/Storm — Windglass Warrens
**Look/story:** Storm-damaged mountain observatory with ivory partitions, bronze vanes, blue banners and purple sky. Tall screens preserve maze geometry outdoors. Restoring Air anchors archive enchantments.
**Route:** Stillwind Shrine → Vane Fork → Banner Walk → Lightning Gallery → Lantern Walk → Vane Fork. Protected Banner branch contains Storm Key. Storm Gate opens Gale Bend / Copper Walk / Cloud Arch / Thunder Spine circuit. Vane control opens sheltered return.
**Play/ecology:** Storm Gargoyles slam at junctions; Tempest Harpies rake along corridor approaches. Grounded strips and wind screens counter charged-floor lightning and gusts. Mandatory routes have solid floors and rails; optional falls return to the last safe ledge.
**Boss:** Roc of the Broken Sky, thunderbird. Paused wingbeats announce a marked dive lane; move across it, then attack grounded recovery. Harpy dives alternate with boss dives.
**Art kit:** Observatory walls, wind screens, parapets, rails, grounded plates, conductors, banners, vanes, broken astrolabe, storm lamps, sheltered alcoves.
## 5. Aether/Arcane — Unwritten Labyrinth
**Look/story:** Blue-black royal archive, silver script, angular violet lamps and barred glimpses of a broken throne. Restoring Aether restores the kingdom's oaths.
**Route:** Memory Shrine → Script Fork; Ink Gallery and Mirror Walk provide stable routes to Witness Crossing. Ink side branch holds Witness Key. Optional phase switch adds a connection without removing stable routes. Witness Gate opens Name Passage / Star Gallery / Broken Oath / Regent Walk circuit; seal pedestal opens return.
**Play/ecology:** Rune Sentinels hold one branch with right shield/left hammer; Mirror Duelists thrust with a right-hand rapier; optional Barrow Knights add slow pressure. Real passages keep consistent silver marks, false doors cannot hide the only route, rune bursts charge visibly.
**Boss:** Magister of Glass, hostile violet-crystal staff sorcerer. Staff facets and a visible destination warn before shards/reposition. Corners block shard lanes; translucent decoys never block all routes. Counter while staff dims.
**Art kit:** Archive wall straights/corners, silver marks, rune floors, mirrors, distinguishable real/illusory doors, script plaques, celestial instruments, phase pedestals, throne fragments, violet lamps.
## Production and acceptance
Use tileable wall/floor material families at an agreed texel density (suggested 256px per2m module, nearest filtering); separate straight/corner/endcap meshes and independent prop sprites. Biome concept PNGs are visual references, not seamless textures or exact topology.
Preserve sightline breaks and clearance: decorations have reviewed collision and stay out of routes; floor decals never mask hazard cues. Each hazard uses a distinct shape/audio cue as well as color.
Graph checks confirm key-before-gate, connected unlocked floors, lever reachability, safe backbone and boss loops. They do not confirm Godot navigation, capsule clearance, timed-hazard fairness or combat quality.
Before release verify every frame and transition, collision/turning widths, every door/switch state, safe waiting/traversal windows, projectile wall blocking, landmark visibility and target-hardware performance.
Every additional entry, treasure, transition and boss floor must pass the same maze rules. Saves and existing selected sources remain the baseline.

