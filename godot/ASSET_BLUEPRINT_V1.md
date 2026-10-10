# Gauntlet Godot asset blueprint v1

Scope: generate 13 original artwork sources for the Godot project. Antigravity owns chromakey removal, reviewed frame extraction, canonical atlas assembly, import configuration and animation wiring.

Current authority: Master_ Gauntlet_Guide.pdf in gauntlet_l; Gauntlet Godot code. Older browser magenta and prerendered-3D instructions are historical.

## Shared artwork contract
- Gritty 1990s 32-bit dark-fantasy pixel art, bold dark outlines, rich hand-shaded ramps, weathered materials; no soft airbrush or plastic rendering.
- Requested source background: exact flat #00FF00, no scenery, floor lines, cast shadows, ambient occlusion, gradients, labels, frame numbers or drawn grids.
- Exclude exact chromakey green from subject pixels; orc skin and elf clothing use muted olive/forest ramps.
- Characters: fixed front three-quarter orthographic view; identical proportions, equipment, camera and nominal anchor throughout each sheet.
- Weapons: player first-person viewpoint, hands entering each frame from the bottom; consistent hand/weapon scale and identity.
- Keep complete extremities within each cell, with safe space at sides and top; only weapon wrists may intentionally enter the bottom edge.

## Canonical imports for Antigravity
- Character target: 1536x1536 RGBA PNG, 6 columns x 6 rows; each frame 256x256. Frame index = row*6+column.
- Character standing anchor: x=128, nominal ground y=224 in the cell. Preserve this world reference during collapse and Merlin hover; do not move each pose to match its lowest pixel.
- Character row order: 0 idle; 1 movement; 2 windup; 3 attack; 4 stagger; 5 death or departure. Columns advance time, not facing direction.
- Weapon targets: 1024x256 RGBA PNG, 4 horizontal 256x256 cells; shield 768x256, 3 cells.
- Starter timing recommendations, subject to combat-controller timing: character idle 6fps, movement 10fps, windup 8fps, attack 12fps, stagger 10fps, death 8fps; weapon four-frame sequences use event-driven phases instead of uniform looping.
- Suggested import configuration: nearest filtering, billboard fixed-Y for enemies; verify actual Sprite3D alpha settings and lighting in-engine.
- Canonical sizes are selected production targets, not specifications supplied by the PDF.

## Source assets
Weapon sources go under assets/weapons with versioned names: broadsword_source_v1.png, shield_source_v1.png, bow_source_v1.png, staff_source_v1.png, spear_source_v1.png.
Character sources go under assets/sprites with versioned names: minotaur_stalker_source_v1.png, asterion_source_v1.png, skeleton_archer_source_v1.png, orc_grunt_source_v1.png, warrior_thor_source_v1.png, elf_questor_source_v1.png, wizard_merlin_source_v1.png, valkyrie_thyra_source_v1.png.
Existing filenames and game scripts must not be overwritten by this delivery.

## Explicit interpretation decisions
- Shield uses the specific three-frame brief over the general four-frame rule.
- Skeleton follows the shared 32-bit aesthetic, retaining its cracked bones, dark cowl, bow and violet arrowhead.
- Minotaur Stalker row 5 is exhausted retreat/collapse, not permanent death.
- Asterion row 5 ends in divine gold dissolution.

## Source QA and known integration boundaries
- Built-in generation may return dimensions and approximate chromakey colors different from the prompt. Record actual pixel dimensions and background samples; do not certify exact cell geometry from a successful generation call.
- A generated image whose width is not divisible by its grid columns is a source for reviewed extraction, not a direct hframes/vframes import.
- Review all apparent frame cells for clipping, equipment mutation, omitted or duplicated poses, baseline drift, green spill and incorrect phases.
- Normalize chromakey background and assemble canonical grids after reviewed extraction; reserve exact #00FF00 for background.
- Source images are RGB green-screen candidates; final RGBA imports and in-engine motion acceptance belong to Antigravity.
- Current enemy.gd fixes sprite.frame=0; asset delivery alone will not activate animations.
- Existing tests do not establish atlas alignment, alpha quality, animation appearance or target-hardware performance.

Delivery evidence: ASSET_DELIVERY_MANIFEST_V1.json will record each file's SHA256, actual dimensions, intended grid, background samples, canonical import target, full generation prompt, visual QA notes and integration status.

Generator: built-in imagegen tool. No CLI fallback or source-image manipulation is planned for this artwork delivery.

