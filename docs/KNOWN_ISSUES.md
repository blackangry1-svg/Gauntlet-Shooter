# KNOWN ISSUES LOG

### Resolved Issues
1. **[RESOLVED] Inverted Movement Vectors:** Fixed `sinY`/`cosY` calculation in `Player.js` by utilizing exact camera `getWorldDirection()` projection and orthogonal right vector.
2. **[RESOLVED] Tampered Wall Collision Test:** Replaced misleading `TEST 3` that previously moved away from the wall with true negative-X translation into wall geometry at X = -6.0, verifying physical bounding box blocking (`-4.70 <= X <= -4.55`).
3. **[RESOLVED] Non-Functional Heavy Attacks & Missing Stagger Window:** Implemented `KeyR` binding in `InputManager.js`, heavy attack damage (55 vs 32) and stamina scaling (27 vs 16) in `Weapons.js`, and added a dedicated `stagger` state in `Enemy.js` AI providing a 0.65s vulnerable punish window with golden emissive shader feedback.
4. **[RESOLVED] Missing Mana Consumption:** Added `consumeMana(amount)` in `Player.js` and wired wizard staff attacks to verify and deduct 15 mana per cast in `Weapons.js`.
5. **[RESOLVED] Projectile Geometry Wall Phasing:** Implemented swept bounding box collision for `Projectile` and `EnemyProjectile` against world walls, ensuring fireballs and arrows stop and emit particle impacts when hitting geometry rather than phasing into other rooms.
6. **[RESOLVED] PointLight Memory Leak in Projectile:** Added explicit `dispose()` cleanup for projectile PointLight entities in `Weapons.js`.
7. **[RESOLVED] Enemy Phasing Through Dungeon Geometry:** Added AABB sliding collision routines (`_resolveX`/`_resolveZ`) to `Enemy.js` and injected world geometry via `enemies.setWalls(world.walls)`.
8. **[RESOLVED] Skeleton Archer Direct Wall-Hack:** Replaced raw `setTimeout` damage call with physical 3D `EnemyProjectile` entities that travel over time and can be blocked by player shields or dungeon pillars.
9. **[RESOLVED] Death Knight Boss Complexity:** Rebuilt boss AI to include Cleaving Slash (melee), Abyssal Lunge Thrust (3.5m forward dash), and Phase 2 Dark Ground-Shatter Slam (6m AoE shockwave) with crimson aura telegraph.
10. **[RESOLVED] Missing Audio SFX Definition:** Added `'boom'` synthesizer curve to `AudioManager.js` for ground shockwaves.
11. **[RESOLVED] Minimap Heading Indicator:** Aligned minimap LOS line with camera forward direction.
12. **[RESOLVED] Camera World Matrix Update in lookAt:** Ensured `Player.lookAt()` updates camera world matrix immediately so that directional raycasts and projectile spawns read accurate orientation.
13. **[RESOLVED] Full Playthrough Multi-Class Coverage:** Expanded automated test suite from Warrior-only to encompass all 4 hero classes (Warrior, Elf, Wizard, Valkyrie) with dedicated combat mechanics, weapon switching, and boss victory verification.
14. **[RESOLVED] Missing Procedural Meshes for Spear and Shield:** Added bespoke 3D meshes in `Weapons.js` for Valkyrie's spear and shield instead of defaulting to a generic box geometry.
15. **[RESOLVED] UI Overlay Leakage Across Game Restarts:** Added explicit overlay hiding (`victory-screen`, `game-over`, `pause-menu`) inside `startGame()` in `main.js` to ensure clean transitions between playthrough runs.
16. **[RESOLVED] Checkpoint and Respawn Mana Reset:** Fixed `Player.js` `restAtCheckpoint()` and `respawn()` where `mana` was omitted, causing mana-using classes (Wizard, Elf, Valkyrie) to remain depleted of mana after resting or dying.
17. **[RESOLVED] Save/Load Mana and Room Loss:** Fixed `main.js` save serialization and load restoration to include `mana` and `room`, preventing lost mana state and `Room NaN` display in the continue button.
18. **[RESOLVED] Weapon Mesh GPU Leak and Mid-Swing Switch Glitch:** Fixed `Weapons.js` `_switchTo()` to dispose previous meshes and cancel active in-flight swing animations, preventing animation and hit-detection corruption across weapon switches.
19. **[RESOLVED] Shield Mesh Position Drift and Missing Block Stance:** Fixed `Weapons.js` post-swing reset to respect weapon-specific default mesh offsets (shield at `0.18, -0.22, -0.4`), and implemented active defensive blocking stance visuals for shields and weapons.
20. **[RESOLVED] Test Tampering and Artificial Bypasses in Playthrough Suite:** Removed `p.mana += 12` test injection in Wizard test and `enemy.takeDamage(100)` bypass in Elf test; replaced with authentic 90-frame natural mana regeneration (+12.0 mana) and natural multi-arrow projectile combat kills. Added empirical reach advantage verification (secondary misses at 3.2m, spear hits at 3.2m).

### Fatal Functional Bugs
- *None.* All 22/22 automated gauntlet tests pass cleanly across consecutive runs.

### Shallow Verification
1. **Audio Context Autoplay in Headless Environments:** Web Audio API synthesis executes and synthesizes all SFX and music waveforms, but audio output is muted via `--mute-audio` flag in headless Chrome. Audio fidelity was verified via procedural waveform synthesis tests and manual browser launch.

### Minor Robustness Risks
1. **Multiple Simultaneous Collisions in Corners:** Player and enemy collision resolves X and Z axes independently against AABB wall bounding boxes. In rare high-speed sprint into 90-degree internal corners, micro-jitter (sub-pixel) can occasionally occur before sliding resolves.
