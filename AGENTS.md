# Gauntlet project instructions

## Ownership and canonical source
Codex owns ongoing development, asset integration, verification and GitHub maintenance.
The canonical native game is godot/project.godot in this checkout.
The root browser game is the preserved legacy implementation.
Read CODEX_HANDOFF.md and MIGRATION_BLUEPRINT_V1.md before substantial changes.
Master_ Gauntlet_Guide.pdf and current Godot code define the gameplay baseline.
Older handoffs assigning work to Antigravity are historical; their technical contracts remain.

## Design workflow
Blueprint mechanics, interfaces, preservation requirements and acceptance criteria before implementation.
Keep four classes, Minotaur stalker, sanctuary, Asterion and Aegis unless a deliberate design revises them.
Every floor, transition, treasure area and boss encounter must remain a labyrinth.
Use the five elemental proposals in godot/ELEMENTAL_STAGE_DESIGN_V1.md and ELEMENTAL_LABYRINTHS_V1.json.
Keys precede gates; far-side levers open return shortcuts; boss victory releases the exit.
Fliers and ghosts obey walls and doors; safe routes do not require a specific class.

## Asset contracts
Preserve original imports, delivered source PNGs and both shield versions; selected shield is v2.
Use godot/ASSET_CATALOG_V1.json for portable source paths; historical manifests keep original paths.
Reviewed RGB sources require masks, safe extraction and canonical RGBA conversion.
Character canonical sheets are six by six temporal cells, 1536 by 1536, anchored at x128/y224.
Weapons have four horizontal cells at 1024 by 256; shield three at 768 by 256.
Do not use blind cropping, equality-only chroma keying or silently replace original imports.
Integrate one verified vertical slice before expanding all enemies and floors.

## GEN-9 workflow
For code files over 50 lines call omniglyph_pack and inspect its tile and AST sidecar.
Use bounded structured queries if a tool returns an inaccessible tile; record the evidence boundary.
Query psyche_query before structural changes; independently verify returned context against this project.
Represent edits as NPB FILE_PATCH vectors and ratify with tribunal_verify_patch before writing.
Treat ratification and token telemetry as tool reports, not runtime or image-quality proof.

## Validation and preservation
Run tools/codex/check_godot.py using an explicit engine or GODOT_BIN.
Keep local backups, transcripts, engine imports and validation logs outside version control.
Record meaningful test and runtime evidence in the durable handoff.
Headless success does not certify rendered art, controller hardware or performance.
Preserve external player data and use isolated logs for verification.
Use reviewable branches; do not force-push or discard source history.
