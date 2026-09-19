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
