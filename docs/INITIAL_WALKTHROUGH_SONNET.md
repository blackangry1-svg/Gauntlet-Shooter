# ⚔️ Gauntlet Legends Shooter — Walkthrough

## 🚀 How to Play RIGHT NOW

```
http://localhost:3000
```

Server is already running! Open that URL in your browser.

> [!IMPORTANT]
> Server is running at **port 3000** (8080 & 5237were skipped as requested).
> If you restart the PC, run: `node server.js` from `Gauntlet Shooter\`

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| `WASD` / `Arrow Keys` | Move |
| `Mouse` | Look / Aim |
| `Left Click` | Attack / Swing / Shoot |
| `Right Click` | Block / Aim |
| `1` | Sword |
| `2` | Bow / Secondary |
| `3` | Staff / Magic |
| `Shift` | Sprint |
| `F` | Interact |
| `ESC` | Pause / Release Mouse |

---

## 📁 What Was Built

### 🎨 AI-Generated Art Assets (Nano Banana)
| Asset | File | Used For |
|-------|------|----------|
| Warrior Spritesheet | `sprites/warrior.jpg` | Hero character ref |
| Orc Grunt Spritesheet | `sprites/orc_grunt.jpg` | Enemy billboards |
| Skeleton Archer Spritesheet | `sprites/skeleton_archer.jpg` | Enemy billboards |
| Death Bat Spritesheet | `sprites/death_bat.jpg` | Flying enemies |
| Stone Golem Spritesheet | `sprites/stone_golem.jpg` | Tank enemies |
| Death Knight Boss | `sprites/death_knight.jpg` | Final boss |
| Dungeon Wall Texture | `textures/wall.jpg` | All room walls |
| Dungeon Floor Texture | `textures/floor.jpg` | All room floors |
| HUD Frame | `ui/hud_frame.jpg` | UI art ref |
| Title Screen | `ui/title_bg.jpg` | Main menu BG |
| FPS Sword | `ui/sword_fp.jpg` | First-person ref |

### 🔧 Game Engine (Three.js + Pure JS)

| File | Purpose |
|------|---------|
| `index.html` | Entry point, all screens |
| `style.css` | Dark gothic UI system |
| `server.js` | Static server port 3000 |
| `src/main.js` | Game loop, scene, orchestration |
| `src/engine/InputManager.js` | WASD + mouse look + pointer lock |
| `src/engine/AudioManager.js` | Procedural Web Audio SFX |
| `src/engine/SaveManager.js` | localStorage save/load |
| `src/player/Player.js` | FPS movement + collision |
| `src/player/Weapons.js` | Sword/Bow/Staff + projectiles |
| `src/player/HUD.js` | Health bars + minimap |
| `src/world/MapLoader.js` | 8 dungeon rooms + wall collision |
| `src/enemies/Enemy.js` | 5 enemy types + boss (full AI) |
| `src/enemies/EnemyManager.js` | Spawn system + death callbacks |
| `src/combat/HitDetection.js` | Raycasting + damage numbers |
| `src/combat/ParticleSystem.js` | 200-particle pool effects |
| `src/ui/MainMenu.js` | Character select + save detect |

---

## 🛡️ Characters

| Hero | Weapon | HP | Speed | Special |
|------|--------|----|-------|---------|
| ⚔️ Warrior | Sword + Shield | 150 | Medium | Melee power |
| 🏹 Elf | Magic Bow | 90 | Fast | Ranged kiting |
| 🔮 Wizard | Fire Staff | 75 | Medium | AoE magic |
| ⚡ Valkyrie | Holy Spear | 120 | Fast | Balanced |

## 👹 Enemy Roster

| Enemy | HP | Behavior |
|-------|-----|---------|
| Orc Grunt | 60 | Melee charger |
| Skeleton Archer | 35 | Kiting ranged |
| Death Bat | 30 | Flying swooper |
| Stone Golem | 180 | Slow tank |
| **Death Knight** | **600** | **2-phase boss** |

---

## ⚡ Performance (Intel UHD Optimized)

- ❌ No real-time shadows
- ❌ No post-processing / SSAO
- ✅ Pixel ratio capped at 1×
- ✅ Enemy AI at 20Hz (every 3 frames)
- ✅ 200-particle pool (no GC pressure)
- ✅ Billboard sprites (2 draw calls each)
- ✅ Single ambient + point light only
- ✅ Dungeon fog limits draw distance

---

## 💾 Save System
- Auto-saves on every room clear
- Manual save in pause menu (ESC)
- Saves: character, room, health, mana, score
- Press `Continue` on main menu to resume

---

## 🗺️ Dungeon Map (8 Rooms)

```
Room 0: Entry Hall     → Orc Grunts only
Room 1: Open Arena     → Orcs + Archers  
Room 2: Maze           → Orcs + Archers + Bats
Room 3: Cross Shape    → Archers + Bats
Room 4: Courtyard      → Orcs + Golems + Archers
Room 5: Pillared Hall  → Golems + Bats + Archers
Room 6: Passages       → All types mixed
Room 7: BOSS CHAMBER   → Death Knight + Orc guards
```

---

> [!TIP]
> **Pro tip**: As Wizard, use the Fire Staff against Stone Golems — they're slow so you can kite them around pillars. Death Knight Phase 2 at 50% HP — watch for the magic nova (range 8 units), back up when his aura pulses!
