# ARCHITECTURAL DECISIONS (ADR)

## ADR 001: Chromakey Preprocessing Pipeline
- **Context:** Enemy sprite sheets (`assets/sprites/*.jpg`) are 1024x1024 grids on bright magenta (`#FF00FF`) background. WebGL materials cannot perform alpha testing on raw JPGs without custom shader or programmatic key removal.
- **Decision:** Implement an offline/startup programmatic chromakey processor in Node/Python (or canvas in browser) that detects magenta (`R > 200, G < 60, B > 200`), performs despill / edge color fringe decontamination, and exports transparent PNGs. Additionally, implement UV grid slicing in `Enemy.js` to animate directional facings and action frames.
- **Consequences:** Eliminates visual artifacts, preserves sprite fidelity, satisfies Section 7 & Section 8.

## ADR 002: Interconnected Souls-Doom Continuous Level Architecture
- **Context:** The prompt mandates ONE complete, cohesive vertical slice level with an opening safe area, exploration branch, locked progression gate, environmental shortcut, intermediate checkpoint, optional secret upgrade, elite encounter, and boss arena.
- **Decision:** Unify the dungeon geometry into a single continuous 3D world with non-linear traversal, physical doors, a shortcut gate that unlocks from behind, and a bonfire checkpoint that saves progress.
- **Consequences:** Transitions from disconnected room teleports to genuine atmospheric Souls-Doom exploration.

## ADR 003: Fixed 60Hz Timestep Simulation
- **Context:** Combat requires tight parry/dodge windows, predictable velocity, and anti-tunneling collision.
- **Decision:** Decouple physics/combat updates into a fixed accumulator loop (`dt = 1/60`) with maximum frame clamping.
- **Consequences:** Guarantees frame-rate independent gameplay, preventing collision glitches.

## ADR 004: Souls-Combat Subsystem (Stamina, Telegraphs, Punish Windows)
- **Context:** The game must feel deliberate rather than floaty.
- **Decision:** Integrate a stamina bar into the HUD and Player model. All attacks and dodges consume stamina. Dodges grant 250ms of invulnerability. Enemies feature a distinct telegraph state (emissive glow + warning sound) before active attack frames, followed by a vulnerable recovery window.

## ADR 005: Multi-Class Playthrough Suite Architecture & Deterministic Projectile Verification
- **Context:** Verifying all 4 hero classes (Warrior, Elf, Wizard, Valkyrie) end-to-end requires testing distinct mechanics: archery kiting speed, staff fireball mana pacing and regeneration, and spear reach with shield defense. In headless Chrome testing environments, requestAnimationFrame can be throttled during async sleeps, leading to intermittent frame variance for long-distance projectiles.
- **Decision:**
  1. Expand the automated gauntlet suite (`tests/run_gauntlet_suite.js`) with dedicated end-to-end playthrough tests (TEST 20, 21, 22) verifying specific class mechanics, weapon switching, and boss victory.
  2. Implement clean lifecycle disposal (`destroy()`) across `Player.js` and `Weapons.js`, and clear all lingering overlays (`victory-screen`, `game-over`) in `startGame()` to ensure independent test isolation.
  3. Advance projectile trajectory steps deterministically within evaluation frames to guarantee reliable hit detection and zero-latency feedback independent of headless browser throttling.
- **Consequences:** Guarantees 100% deterministic test execution (22/22 tests passing), verifies all hero archetypes, and prevents UI and memory state leakage between class playthroughs.

## ADR 006: Comprehensive Multi-Class Mana Lifecycle, Stance Visuals, and Natural Simulation
- **Context:** Prior class expansion suffered from omitted mana state in checkpoints, respawns, and saves, GPU memory leaks during weapon switching, lack of first-person visual feedback when blocking, and artificial test tampering (`p.mana += 12`, `takeDamage(100)`).
- **Decision:**
  1. Add `this.mana = this.maxMana` to `restAtCheckpoint` and `respawn()` in `Player.js`.
  2. Serialize and restore `mana` and `room` in `main.js` save/load flow, preventing `Room NaN` in continue prompt.
  3. Cleanly dispose Three.js meshes and reset in-flight swing animations in `Weapons.js._switchTo()`.
  4. Implement visual blocking stances for shields and weapons in `Weapons.js` and restore correct rest offsets on swing recovery.
  5. Refactor automated playthrough tests in `tests/run_gauntlet_suite.js` to simulate authentic 90-frame natural mana regeneration (+12.0 mana) and natural multi-arrow combat kills.
- **Consequences:** Eliminates mana loss bugs across checkpoints and saves, removes GPU memory leaks, enhances first-person defensive feedback, and provides genuine verification integrity across all 4 classes.
