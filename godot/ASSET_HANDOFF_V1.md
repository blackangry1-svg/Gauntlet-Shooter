# Gauntlet Godot artwork delivery v1

Thirteen original source PNGs generated with the built-in imagegen tool: five first-person weapon strips and eight 6x6 character sheets. Root inspection and an independent visual reviewer accepted the selected artwork sources.

These are RGB green-screen SOURCES. Final RGBA imports, exact frame assembly, Godot wiring and runtime acceptance remain pending. Generated backgrounds are green but not exact #00FF00; generated dimensions differ from the requested canonical imports.

Read [the blueprint](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/ASSET_BLUEPRINT_V1.md>) for frame contracts and [the manifest](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/ASSET_DELIVERY_MANIFEST_V1.json>) for actual dimensions, SHA256 hashes, complete prompts and per-asset review notes. [Delivery verification](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/ASSET_DELIVERY_VERIFICATION_V1.json>) records copied-file hashes and preservation checks.

| Source asset | Actual source size | Intended grid |
|---|---:|---:|
| [broadsword](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/weapons/broadsword_source_v1.png>) | 1983 x 793 | 4 x 1 |
| [shield](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/weapons/shield_source_v2.png>) | 2172 x 724 | 3 x 1 |
| [bow](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/weapons/bow_source_v1.png>) | 2172 x 724 | 4 x 1 |
| [staff](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/weapons/staff_source_v1.png>) | 2172 x 724 | 4 x 1 |
| [spear](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/weapons/spear_source_v1.png>) | 2048 x 768 | 4 x 1 |
| [minotaur_stalker](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/minotaur_stalker_source_v1.png>) | 1254 x 1254 | 6 x 6 |
| [asterion](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/asterion_source_v1.png>) | 1254 x 1254 | 6 x 6 |
| [skeleton_archer](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/skeleton_archer_source_v1.png>) | 1254 x 1254 | 6 x 6 |
| [orc_grunt](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/orc_grunt_source_v1.png>) | 1254 x 1254 | 6 x 6 |
| [warrior_thor](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/warrior_thor_source_v1.png>) | 1254 x 1254 | 6 x 6 |
| [elf_questor](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/elf_questor_source_v1.png>) | 1254 x 1254 | 6 x 6 |
| [wizard_merlin](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/wizard_merlin_source_v1.png>) | 1254 x 1254 | 6 x 6 |
| [valkyrie_thyra](<C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot/assets/sprites/valkyrie_thyra_source_v1.png>) | 1254 x 1254 | 6 x 6 |

## Integration request for Antigravity

Use the thirteen selected source files listed above: shield_source_v2.png plus the twelve remaining *_source_v1.png files. Keep the existing game, original asset files and player saves as the baseline. Follow the current Godot project contracts while preparing and wiring the new artwork.

1. Remove the background with a reviewed mask, not an exact #00FF00 equality test. Sampled green varies (see manifest); protect muted olive orc skin and forest-green elf clothing. Inspect transparent edges against dark and light backgrounds for green residue and damaged silhouettes.
2. Review every frame boundary before extraction. Do not blindly crop equal cells: broadsword/bow forearms and arrow tips, staff/Wizard spell effects, and Valkyrie lunges can cross nominal dividers. Use wider source masks where needed; preserve complete tips, rear legs and effects, while separating touching first-person forearms at their intended viewport edges.
3. Assemble character imports at 1536x1536, 6x6 cells of 256x256. Four-frame weapons target 1024x256; the specific three-frame shield targets 768x256. Normalize common scale and the intended world anchor, leaving padding. Character ground reference is x128/y224 per cell; collapse, hover and dissolution retain the same reference rather than aligning each pose by its lowest visible pixel. Weapon wrists enter the bottom edge.
4. Character rows are idle, movement, windup, attack, stagger, and death/departure; columns advance time, not facing direction. Loop idle/movement; handle other rows through combat states and attack events. Minotaur ends in exhausted temporary retreat; Asterion dissolves in gold. Asterion's kneeling stagger requires a recovery transition or reviewed reverse segment.
5. Map orc_grunt_source_v1.png and skeleton_archer_source_v1.png to the existing assets/sprites/orc_grunt.png and skeleton_archer.png presentations after reviewing the imports. New Minotaur, Asterion, hero and weapon sources need explicit scene/controller references. Existing hero portrait filenames are warrior.png, elf.png, wizard.png and valkyrie.png; current HUD does not consume them.
6. Existing enemy.gd currently sets sprite.frame=0. Loading a sheet alone will not activate animation. Check nearest filtering, fixed-Y billboarding, alpha discard and lighting choices against the intended crisp outlines; bind frame progression to the actual controller's phases.
7. Verify every frame and transition in Godot, including first-person poses, telegraph/strike/recovery timing, nonlethal stagger recovery, death/exhaustion handling, clipping, scale and transparency. Source QA and hashes do not prove Godot runtime quality or target-laptop performance.

## Selected revisions

Shield v2: corrected all three poses to show the wearer's inner wooden face, rear grip and left gauntlet. The exterior griffin points away from the camera throughout ready, block and bash. Direction and anatomy passed independent visual review; shield_source_v1.png is preserved but superseded. Other twelve sources are unchanged.

Broadsword: two-handed grip, runic fuller and readable slash corrected. Orc: disappearing cleaver restored. Skeleton and Elf: bow retained through stagger and return to standing guard. Minotaur: axe continuity and outer-edge clipping corrected. Full original prompts and targeted revision prompts are preserved in the manifest.

Unselected generation variants remain in the Codex generated-image cache. The delivery copies selected PNG bytes without image manipulation; it does not replace existing imports or modify game scripts.

