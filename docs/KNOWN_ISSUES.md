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

### Fatal Functional Bugs
- *None.* All 19/19 automated gauntlet tests pass cleanly across consecutive runs.

### Shallow Verification
1. **Audio Context Autoplay in Headless Environments:** Web Audio API synthesis executes and synthesizes all SFX and music waveforms, but audio output is muted via `--mute-audio` flag in headless Chrome. Audio fidelity was verified via procedural waveform synthesis tests and manual browser launch.

### Minor Robustness Risks
1. **Full Playthrough Class Coverage:** Automated full-level completion specifically benchmarks Warrior (Sword & Shield). While Elf, Wizard, and Valkyrie mechanics (bow/staff projectiles, mana deduction, weapon switching) are covered by dedicated automated unit tests (TEST 15), automated boss defeat has only been run on Warrior.
2. **Multiple Simultaneous Collisions in Corners:** Player and enemy collision resolves X and Z axes independently against AABB wall bounding boxes. In rare high-speed sprint into 90-degree internal corners, micro-jitter (sub-pixel) can occasionally occur before sliding resolves.
