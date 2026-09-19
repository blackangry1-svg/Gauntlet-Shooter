# 🎮 Gauntlet Legends Shooter — Implementation Plan

## Overview

A **browser-based first-person shooter** inspired by Gauntlet Legends, built with **Three.js** at maximum visual quality possible on weak integrated graphics. Pre-rendered 3D sprite style (like Doom/Blood meets modern lighting), all assets AI-generated.

**Save location:** `C:\Users\pdard\OneDrive\Desktop\voxel games\gauntlet legends\Gauntlet Shooter\`
**Server port:** `3000` (8080 & 5237 are taken)

---

## System Constraints (Optimize For)

| Spec | Value | Strategy |
|------|-------|----------|
| CPU | i5-1035G1 @ 1.0GHz, 4 cores | Keep JS game loop lean, 60fps cap |
| GPU | Intel UHD (integrated, 1GB shared) | No heavy post-FX, use sprites not real 3D meshes |
| RAM | 12GB | Preload assets, pool objects |
| OS | Windows 11 64-bit | No special concerns |

> [!IMPORTANT]
> **No discrete GPU.** Must stay under 2M polys, no real-time shadows (baked only), no heavy SSAO/bloom. Use sprite billboards for enemies — the pre-rendered 3D look is free on CPU.

---

## Architecture

```
Gauntlet Shooter/
├── index.html              # Entry point
├── style.css               # HUD + menu styles
├── server.js               # Simple Node.js static server (port 3000)
├── package.json
├── src/
│   ├── main.js             # Boot, scene setup, game loop
│   ├── engine/
│   │   ├── Renderer.js     # Three.js renderer config (perf-tuned)
│   │   ├── InputManager.js # WASD + mouse look + pointer lock
│   │   ├── AudioManager.js # Web Audio API — procedural SFX
│   │   └── SaveManager.js  # localStorage save/load
│   ├── world/
│   │   ├── MapLoader.js    # JSON map → geometry + collision walls
│   │   ├── DungeonMap.js   # Level 1 dungeon layout data
│   │   └── Skybox.js       # Dungeon ceiling/floor
│   ├── player/
│   │   ├── Player.js       # FPS camera, health, stamina
│   │   ├── Weapons.js      # Sword, bow, magic staff, crossbow
│   │   └── HUD.js          # Health bar, ammo, minimap
│   ├── enemies/
│   │   ├── EnemyManager.js # Spawn pool, AI director
│   │   ├── Enemy.js        # Base billboard sprite enemy
│   │   ├── Grunt.js        # Orc grunt — melee charger
│   │   ├── Archer.js       # Skeleton archer — ranged
│   │   ├── Demon.js        # Winged demon — flying
│   │   └── BossGauntlet.js # Level boss — Death Knight
│   ├── combat/
│   │   ├── Projectile.js   # Arrows, fireballs, magic bolts
│   │   ├── HitDetection.js # Raycasting + AABB collision
│   │   └── ParticleSystem.js # Blood splats, sparks, magic
│   └── ui/
│       ├── MainMenu.js     # Title screen
│       ├── PauseMenu.js    # Pause overlay
│       └── GameOver.js     # Death/victory screens
├── assets/
│   ├── sprites/            # AI-generated enemy/item sprites (PNG)
│   ├── textures/           # Wall, floor, ceiling textures (AI-generated)
│   ├── ui/                 # HUD elements, fonts
│   └── audio/              # Procedural audio (generated at runtime)
└── maps/
    └── level1.json         # Dungeon map data
```

---

## Game Design

### Setting & Story
You are a **Warrior of the Gauntlet**, last defender of the ancient dungeon fortress. Waves of orcs, skeletons, demons, and undead hordes pour through the gates. Fight to the final boss — the **Death Knight** — and seal the portal forever.

### Playable Characters (single player FPS)
| Hero | Weapon | Special |
|------|--------|---------|
| Warrior | Sword + Shield | Bash stun, spin attack |
| Elf | Magic Bow | Multi-shot, piercing arrows |
| Wizard | Staff | Fireball, frost nova |
| Valkyrie | Spear | Javelin throw, parry reflect |

### Enemies
| Enemy | Behavior | HP | Damage |
|-------|----------|-----|--------|
| Orc Grunt | Charge melee | 40 | 10/hit |
| Skeleton Archer | Kite & shoot | 25 | 8 arrow |
| Death Bat | Dive swoop | 20 | 12/hit |
| Stone Golem | Slow tank | 120 | 25/hit |
| Death Knight (Boss) | Phase 1: sword, Phase 2: magic | 500 | 30-50 |

### Weapons
- **Sword** — fast melee swing, 3-hit combo
- **Magic Bow** — charge to power shot, limited arrows
- **Fire Staff** — homing fireball, mana cost
- **Holy Shield** — block + reflect (Valkyrie only)

### Wave System
- Dungeon map has 8 rooms
- Each room cleared triggers next wave
- Final room = boss fight
- Persistent save between sessions (localStorage)

---

## Rendering Strategy (Perf-Optimized)

| Technique | Decision |
|-----------|----------|
| Enemy rendering | **Billboard sprites** (2 draw calls each) |
| Walls/floors | Simple BoxGeometry with texture atlas |
| Lighting | **Baked** ambient + single directional light, no shadows |
| Post-processing | **Disabled** — just Three.js tone mapping |
| Particle system | **Object pool** of 200 pre-allocated sprites |
| Raycasting | Player weapon raycast only (not per-frame per enemy) |
| Enemy AI | Update at **20Hz** (every 3 frames at 60fps) |
| Frustum culling | Three.js built-in (default) |
| Target framerate | **60fps locked** with delta-time physics |

---

## Asset Pipeline (Nano Banana / generate_image)

All assets generated via AI image generation:

### Character Sheets to Generate
1. **Warrior** — 8-direction spritesheet (idle, walk, attack, death)
2. **Elf Archer** — 8-direction spritesheet
3. **Wizard** — 8-direction spritesheet
4. **Valkyrie** — 8-direction spritesheet
5. **Orc Grunt** — enemy spritesheet (bright pink BG for keying)
6. **Skeleton Archer** — enemy spritesheet
7. **Death Bat** — enemy spritesheet
8. **Stone Golem** — enemy spritesheet
9. **Death Knight (Boss)** — large spritesheet

### Texture Assets
10. **Stone wall texture** — PBR, dungeon style
11. **Floor tiles** — dark stone, blood stains
12. **Ceiling texture** — arched stone
13. **HUD frame** — ornate medieval border
14. **Weapon sprites** — sword, bow, staff (first-person view)
15. **Projectile sprites** — arrow, fireball, magic bolt

---

## Verified Save System
- `localStorage` key: `gauntlet_save_v1`
- Saves: current level, health, character choice, score, wave progress
- Auto-save on room clear
- Manual save in pause menu

---

## Phases

### Phase 1 — Core Engine (Now)
- [x] Project scaffold + server
- [ ] Three.js scene, renderer, camera
- [ ] Input (WASD + mouse look + pointer lock)
- [ ] Map loader + collision walls
- [ ] Player movement + collision

### Phase 2 — Combat
- [ ] Enemy billboard system
- [ ] Basic AI (pathfinding via grid)
- [ ] Weapon raycast hit detection
- [ ] Projectile system

### Phase 3 — Art & Polish
- [ ] AI-generated sprite assets
- [ ] Texture atlas on walls
- [ ] HUD (health, ammo, minimap)
- [ ] Particle effects

### Phase 4 — Game Loop
- [ ] Wave/room system
- [ ] Boss fight
- [ ] Save/load
- [ ] Main menu + game over screens

---

## Verification Plan
- Run `node server.js` → open `localhost:3000` → playable FPS in browser
- Test on the Intel UHD machine at 60fps
- All enemies visible, all walls have collision
- Save game persists on page reload
