# Mythic enemy expansion and elemental labyrinth handoff v1

Delivered with built-in imagegen: twelve regular enemy sheets, five boss sheets and five biome concept PNGs. Enemy sources are1254x1254 RGB, intended6x6 cells209x209; production target remains1536x1536 RGBA, cells256x256. Biome concepts are1536x1024 opaque visual references.

Read EXPANSION_BLUEPRINT_V1.md for scope, EXPANSION_MANIFEST_V1.json for source hashes/prompts/review notes, ELEMENTAL_STAGE_DESIGN_V1.md for routes/art kits/counters, and ELEMENTAL_LABYRINTHS_V1.html for five interactive exact schematics. ELEMENTAL_LABYRINTHS_V1.json preserves grids, markers, key/gate state checks and solution paths. EXPANSION_VERIFICATION_V1.json records delivery and preservation readback.

| Enemy source | Rank | Element | Tactical role |
|---|---|---|---|
| [Thornbound Revenant](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/thornbound_revenant_source_v1.png>) | regular | earth | Root-spear pressure |
| [Barrow Knight](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/barrow_knight_source_v1.png>) | regular | earth,aether | Greatsword elite |
| [Mire Hag](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/mire_hag_source_v1.png>) | regular | water | Censer mist zoning |
| [Frost Wraith](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/frost_wraith_source_v1.png>) | regular | water | Ice-scythe skirmisher |
| [Ember Imp](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/ember_imp_source_v1.png>) | regular | fire | Fire-pot harassment |
| [Ash Zealot](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/ash_zealot_source_v1.png>) | regular | fire | Short-flail pressure |
| [Storm Gargoyle](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/storm_gargoyle_source_v1.png>) | regular | air | Armored claw bruiser |
| [Tempest Harpy](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/tempest_harpy_source_v1.png>) | regular | air | Talon dive disruptor |
| [Rune Sentinel](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/rune_sentinel_source_v1.png>) | regular | aether | Shield-and-hammer guard |
| [Mirror Duelist](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/mirror_duelist_source_v1.png>) | regular | aether | Rapier melee elite |
| [Cave Spider](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/cave_spider_source_v1.png>) | regular | earth | Low bite ambusher |
| [Moss Troll](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/moss_troll_source_v1.png>) | regular | earth | Slow log bruiser |
| [Stonehart Regent](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/stonehart_regent_source_v1.png>) | boss | earth | Antler charge / hoof stomp |
| [Abbess of the Tide](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/abbess_of_the_tide_source_v1.png>) | boss | water | Mist lanes / frost cast |
| [Bellows Wyrm](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/bellows_wyrm_source_v1.png>) | boss | fire | Furnace breath / bite |
| [Roc of the Broken Sky](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/roc_of_the_broken_sky_source_v1.png>) | boss | air | Dive / lightning discharge |
| [Magister of Glass](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/magister_of_glass_source_v1.png>) | boss | aether | Crystal shards / visible reposition |

| Biome reference | Element | Source size |
|---|---|---|
| [Rootbound Crown](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/biomes/earth_labyrinth_concept_v1.png>) | earth | 1536 x1024 |
| [Drowned Bellways](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/biomes/water_labyrinth_concept_v1.png>) | water | 1536 x1024 |
| [Ember Oathforge](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/biomes/fire_labyrinth_concept_v1.png>) | fire | 1536 x1024 |
| [Windglass Warrens](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/biomes/air_labyrinth_concept_v1.png>) | air | 1536 x1024 |
| [Unwritten Labyrinth](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/biomes/aether_labyrinth_concept_v1.png>) | aether | 1536 x1024 |

## Integration for Antigravity
- Preserve the existing game, saves, original imported assets and thirteen previously selected sources; shield remains shield_source_v2.png. These new names do not replace imports automatically.
- Enemy sheets: rows idle/movement/windup/attack-and-recovery/stagger-and-recovery/death; columns advance time, not facing. Extract reviewed masks, normalize scale and x128/y224 world anchor, then assemble canonical1536² RGBA atlas. Use nearest filtering and verify Sprite3D billboard/alpha/light behavior.
- Background green varies considerably; build reviewed masks, protect muted moss/olive materials and preserve smoke/ice/fire/crystal fragments. Remove incidental green-ground shadows and floor marks. Do not blindly equality-key#00FF00 or crop equal rectangles.
- Review every frame border: rapier/spear tips, dragon breath, spell rays, wings and rubble can cross nominal cells. If a particle cannot be isolated from a neighbor, regenerate the affected pose or create separately reviewed VFX before import; do not silently clip or blend neighboring bodies.
- Generation repairs: Thornbound duplicate spear; Barrow missing sixth death pose/sword; Ember missing attack body; Troll missing stagger club; Rune duplicate hammer. Final selected revisions were independently rechecked.
- Bind Sprite3D frame progression to actual combat events; the existing enemy controller's frame0 behavior does not play sheets. Collision and attacks use explicit controller volumes, not sprite pixels. Retain clear windup/punish windows and the per-enemy pairing limits in the manifest.
- Implement every floor as a labyrinth. Each provided schematic has5 cycles before the key gate,3 after it, a key-before-gate route, a far-side return lever and a looping boss route. Flying/ghost enemies obey walls and locked doors. Optional hazards preserve the verified safe backbone.
- Concept images guide materials/landmarks only. Use the JSON schematics and stage document for navigation, not guessed routes from isometric concept PNGs. Build repeatable wall/corner/floor/door/prop modules at consistent density; widen corridors against actual capsules/turning radii while preserving maze topology.
- Boss victory releases the exit; unlocking the key gate and return shortcut is permanent. Verify all door/switch states, every mandatory hazard's damage-free timing window, retreat routes, sightline breaks, landmarks, projectile-wall collision and performance in Godot.

Source review and static graph/browser checks establish deliverable quality, without proving final RGBA import, in-game animation, AI/navigation, combat balance or hardware performance. No runtime implementation was performed by this asset delivery.

