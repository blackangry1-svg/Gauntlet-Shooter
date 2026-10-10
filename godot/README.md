# GAUNTLET SOULS-FPS (Godot Engine Edition)

An authentic first-person Souls-Doom hack-and-slash RPG hybrid ported to and built in **Godot Engine 4.7.2**.

---

## Key Features & Architecture

### 1. Four Distinct Hero Classes
- **Warrior**:
  - High resilience: 150 HP, 100 Stamina, 20 Mana.
  - Primary: *Iron Broadsword* (heavy swings stagger enemies for 0.85s).
  - Secondary: *Tower Shield* (absorbs 85% damage into stamina, can block heavy attacks).
- **Elf**:
  - Superior agility: 90 HP, 130 Stamina, 50 Mana, 5.8 m/s speed.
  - Extended dodge invulnerability frames (0.36s).
  - Primary: *Elven Longbow* (shoots physical high-velocity arrows, 32 m/s).
  - Secondary: *Elven Dagger* (fast rapid slashes).
- **Wizard**:
  - Devastating spellcaster: 80 HP, 80 Stamina, 120 Mana, 12 mana/s regeneration.
  - Primary: *Archmage Fireball* (15 mana per cast, explosive AoE, heavy stagger).
  - Secondary: *Arcane Ward* (absorbs 70% damage into mana).
- **Valkyrie**:
  - Hybrid vanguard: 120 HP, 110 Stamina, 40 Mana.
  - Primary: *War Spear* (extended melee reach advantage at 3.6m).
  - Secondary: *Kite Shield* (75% damage absorption into stamina, guard break on stamina exhaustion).

### 2. The 5 Ascending Citadel Floors
1. **Floor 1: Icarus Beach Shoreline & Crypt of the Damned** - Coastal shoreline ruins, skeleton archers, orc grunts, gateway portal.
2. **Floor 2: Sunken Aqueduct & The Labyrinth** - Aqueduct channels where the Minotaur enters the hunt, contains a Bonfire Sanctuary and the hidden seal leading to Asterion!
3. **Floor 3: Magma Foundry & Abyssal Forge** - Glowing magma channels, lava golems, atmospheric furnace chambers.
4. **Floor 4: Gale Ramparts & Sky High Walkway** - Windswept castle parapets and high battlements.
5. **Floor 5: Wizard King's Cathedral & Celestial Throne** - Gilded grand cathedral, Death Knight encounter, ascension victory portal.

### 3. Alien: Isolation Unkillable Minotaur Nemesis Stalker
- **Immortal Stalker**: Cannot be killed; taking damage only momentarily flinches or enrages him (`take_damage(9999)` survived).
- **Dread Meter (Tension Pacing)**: Dynamic tension builds based on player proximity and sound outside safe havens.
- **3D Spatial Audio Cues**: Positional low-frequency heartbeat pulses (accelerating as distance drops) and raspy breathing audio synthesized procedurally via `AudioStreamWAV`.
- **Dynamic Taunts**: Menacing procedurally triggered voice lines ("YOUR FLESH WILL FEED THE LABYRINTH!", "NO ESCAPE FROM THE HORNED GOD!").
- **Safe Haven Sanctuaries**: Bonfire zones where sacred wards repel the Minotaur stalker, restoring player HP, stamina, and Estus charges.

### 4. Asterion Secret Boss & The Legendary Aegis
- Hidden in the secret chamber of Floor 2 (The Labyrinth).
- Mortal Demigod boss with 800 Max HP.
- Moveset: Cleaving Axe Sweep, Horn Gore Rush, Ground Slam Shockwave.
- Vulnerable to Heavy Attack Stagger: hitting Asterion with heavy attacks builds posture stagger; once broken, he is stunned for 2.5s for massive punish.
- On defeat, drops the **Legendary Aegis of the Minotaur**, granting the player 75% dread reduction and passive defense buffs.

### 5. Native DualShock 4 Controller & Keyboard Layout
| Action | DualShock 4 | Keyboard / Mouse |
|---|---|---|
| Move | Left Analog Stick | W, A, S, D |
| Camera Look | Right Analog Stick | Mouse Motion |
| Light Attack | R1 (Right Bumper) | Left Mouse Click |
| Heavy Attack | R2 (Right Trigger) | R / Right Mouse Click |
| Block / Shield | L1 (Left Bumper) | Q Key |
| Dodge Roll (iframes) | Circle (Button B) | Spacebar |
| Estus Healing | Square (Button X) | F Key |
| Interact / Gate | Cross (Button A) | E Key |
| Switch Weapon | Triangle (Button Y) | X Key |
| Sprint | L3 (Left Stick Click) | Left Shift |
| Cycle Hero Class | D-Pad Left / Right | [ / ] Keys |

---

## Running the Automated Test Suite

To run the complete automated 44-assertion verification suite in headless mode:
```powershell
& "C:\Users\pdard\AppData\Local\Programs\Godot\4.7.2\Godot_v4.7.2-stable_win64_console.exe" --headless --path "c:\Users\pdard\OneDrive\Desktop\voxel games\gauntlet legends\Gauntlet Godot" -s tests/test_suite.gd
```
Result: **44/44 PASSED (100%)**.
