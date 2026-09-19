# KNOWN ISSUES LOG

### Resolved Issues
1. **[RESOLVED] Weapons Subsystem Raycasting & Binding:** Fixed raycasting and weapon injection (`player.weapons.inject(enemies, particles)`). Hitbox geometry converted to non-culled invisible volume (`opacity: 0, transparent: true`) and supplemented with forward horizontal arc hit detection (`cos >= 0.45`, range 2.8m).
2. **[RESOLVED] Collision Binding:** Connected map collision bounding boxes via `player.setWalls(world.walls)`. Player sliding against AABB walls prevents floor and wall penetration.
3. **[RESOLVED] Enemy Lifecycle Cleanup:** Implemented comprehensive `dispose()` method on `Enemy` class to cleanly release geometry, cloned materials, sprite textures, hitboxes, and remove meshes from the scene graph.
4. **[RESOLVED] Sprite Keying & Transparency:** Created `tools/process_sprites.py` to batch-process all 6 sprite sheets (`death_bat`, `death_knight`, `orc_grunt`, `skeleton_archer`, `stone_golem`, `warrior`). High-precision RGB chroma-keying with green/blue edge despill removed all `#FF00FF` magenta background artifacts and output clean transparent RGBA PNG assets.
5. **[RESOLVED] Disconnected Teleports to Contiguous Dungeon:** Built interconnected 8-sector layout with Crypt Entrance, Hall of the Damned, Catacomb Junction (with locked portcullis), Sunken Vault, Shrine of Ash (bonfire checkpoint), High Ramparts (with shortcut lever), Blood Cloister, and Throne of Death (boss arena sealed with glowing fog wall).
6. **[RESOLVED] Souls Combat & Telegraphs:** Implemented stamina consumption and regeneration delay, 250ms invulnerability dodge roll (`Space`), directional blocking (`Right Mouse Button`) with guard break, 3 charges of Soul Flask healing (`Q`), and enemy wind-up telegraphs with audio cues and orange emissive glows.
7. **[RESOLVED] Fixed-Timestep Input Clearing:** Fixed input one-shot consumption in `main.js` so that `input.endFrame()` only clears when physics fixed updates execute, preventing dropped attack clicks or dodge rolls during sub-frame deltas.

### Fatal Functional Bugs
- *None.* All 13/13 automated gauntlet tests pass cleanly across consecutive runs.

### Shallow Verification
1. **Audio Context Autoplay in Headless Environments:** Web Audio API synthesis executes and synthesizes all SFX and music waveforms, but audio output is muted via `--mute-audio` flag in headless Chrome. Audio fidelity was verified via procedural waveform synthesis tests and manual browser launch.

### Minor Robustness Risks
1. **Rapid Character Switching:** Character selection resets player stats and weapons to Warrior, Elf, Wizard, or Valkyrie. While all 4 classes load and initialize weapon meshes properly, automated full-level playthrough test specifically benchmarks Warrior (Sword & Shield). Ranged projectile physics (Elf Bow / Wizard Fireball) are covered by projectile unit updates but have not completed a full automated boss run.
2. **Multiple Simultaneous Collisions in Corners:** Player collision resolves X and Z axes independently against AABB wall bounding boxes. In rare high-speed sprint into 90-degree internal corners, micro-jitter (sub-pixel) can occasionally occur before sliding resolves.
