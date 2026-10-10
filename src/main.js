/**
 * GAUNTLET SOUL-DOOM: Gauntlet Legends Shooter
 * main.js — Master Game Orchestration & Gauntlet Loop Engine
 * 60Hz fixed simulation, Souls-Doom interconnected world,
 * pre-rendered billboarding, shader warmup, and deterministic testing interface.
 */

import { InputManager } from './engine/InputManager.js';
import { AudioManager } from './engine/AudioManager.js';
import { SaveManager } from './engine/SaveManager.js';
import { Player } from './player/Player.js';
import { HUD } from './player/HUD.js';
import { MapLoader } from './world/MapLoader.js';
import { EnemyManager } from './enemies/EnemyManager.js';
import { preloadEnemyTextures, OrcGrunt, SkeletonArcher, StoneGolem, DeathBat, DeathKnight, LavaGolem, StormHarpy, DarkAcolyte, ChampionOrc } from './enemies/Enemy.js';
import { ParticleSystem } from './combat/ParticleSystem.js';
import { PickupSystem } from './combat/PickupSystem.js';
import { MainMenu } from './ui/MainMenu.js';
import { MinotaurStalker } from './enemies/MinotaurStalker.js';
import { SpriteTestRoom } from './world/SpriteTestRoom.js';

// Preload enemy sprite sheets into memory immediately
preloadEnemyTextures();

// ─────────────────────────────────────────────────────────────
// RENDERER & SCENE
// ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // Performance on Intel UHD
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0609);
scene.fog = new THREE.Fog(0x0a0609, 10, 42); // Atmospheric dungeon fog
const sunLight = new THREE.DirectionalLight(0xfffae0, 1.3);
scene.add(sunLight);
const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0xd2b48c, 0.6);
scene.add(hemiLight);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 250);
scene.add(camera); // Crucial: renders child viewmodels (weapons, slash arcs) attached to camera

// Global ambient lighting
const ambientLight = new THREE.AmbientLight(0x281c14, 0.7);
scene.add(ambientLight);

// ─────────────────────────────────────────────────────────────
// GLOBAL STATE & SUBSYSTEMS
// ─────────────────────────────────────────────────────────────
const STATE = {
  phase: 'menu', // 'menu' | 'playing' | 'paused' | 'dead' | 'victory'
  character: 'warrior',
  score: 0,
  frameCount: 0,
  bossTriggered: false,
  bossDefeated: false,
  keys: 0,          // dungeon keys collected
  lastFloor: 0,     // floor tracker for entry banners (1-5)
};

const input           = new InputManager();
const audio           = new AudioManager();
const save            = new SaveManager();
const hud             = new HUD();
const map             = new MapLoader(scene);
const enemies         = new EnemyManager(scene, audio);
const minotaurStalker = new MinotaurStalker(scene, audio, enemies);
const particles       = new ParticleSystem(scene, renderer, camera);
const pickups         = new PickupSystem(scene, audio);
let player            = null;
let spriteTestRoom    = null;

// ─────────────────────────────────────────────────────────────
// SETTINGS MANAGEMENT & PERSISTENCE
// ─────────────────────────────────────────────────────────────
const SETTINGS_KEY = 'gauntlet_shooter_settings';
const DEFAULT_SETTINGS = {
  sensitivity: 100, // percentage (100% = 0.002)
  volume: 60,       // percentage (60% = 0.6)
  invertY: false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

const currentSettings = loadSettings();

function applySettings(settings) {
  if (player) {
    player.mouseSensitivity = (settings.sensitivity / 100) * 0.002;
    player.invertY = !!settings.invertY;
  }
  audio.setVolume(settings.volume / 100);

  const sensInput = document.getElementById('setting-sens');
  const sensVal = document.getElementById('val-sens');
  const volInput = document.getElementById('setting-vol');
  const volVal = document.getElementById('val-vol');
  const invertInput = document.getElementById('setting-invert-y');

  if (sensInput) sensInput.value = settings.sensitivity;
  if (sensVal) sensVal.textContent = `${settings.sensitivity}%`;
  if (volInput) volInput.value = settings.volume;
  if (volVal) volVal.textContent = `${settings.volume}%`;
  if (invertInput) invertInput.checked = !!settings.invertY;
}

function initSettingsUI() {
  const sensInput = document.getElementById('setting-sens');
  const sensVal = document.getElementById('val-sens');
  const volInput = document.getElementById('setting-vol');
  const volVal = document.getElementById('val-vol');
  const invertInput = document.getElementById('setting-invert-y');

  if (sensInput) {
    sensInput.addEventListener('input', (e) => {
      currentSettings.sensitivity = parseInt(e.target.value, 10);
      if (sensVal) sensVal.textContent = `${currentSettings.sensitivity}%`;
      applySettings(currentSettings);
      saveSettings(currentSettings);
    });
  }

  if (volInput) {
    volInput.addEventListener('input', (e) => {
      currentSettings.volume = parseInt(e.target.value, 10);
      if (volVal) volVal.textContent = `${currentSettings.volume}%`;
      applySettings(currentSettings);
      saveSettings(currentSettings);
    });
  }

  if (invertInput) {
    invertInput.addEventListener('change', (e) => {
      currentSettings.invertY = e.target.checked;
      applySettings(currentSettings);
      saveSettings(currentSettings);
    });
  }

  applySettings(currentSettings);
}

initSettingsUI();

// ─────────────────────────────────────────────────────────────
// PROCEDURAL & ASSET MATERIALS
// ─────────────────────────────────────────────────────────────
function createCeilingTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f0c0a';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#1a1612';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 64) {
    for (let x = 0; x < size; x += 64) {
      ctx.fillStyle = `rgb(${16 + Math.random() * 8},${12 + Math.random() * 6},${9 + Math.random() * 5})`;
      ctx.fillRect(x + 1, y + 1, 62, 62);
      ctx.strokeRect(x, y, 64, 64);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

const texLoader = new THREE.TextureLoader();

function loadTexture(path, repeatX = 2, repeatY = 2) {
  const tex = texLoader.load(path);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

const wallTex = loadTexture('/assets/textures/wall.jpg', 2, 2);
const floorTex = loadTexture('/assets/textures/floor.jpg', 3, 3);
const ceilTex = createCeilingTexture();

const aqueductWallTex = loadTexture('/assets/textures/aqueduct_wall.jpg', 2, 2);
const aqueductFloorTex = loadTexture('/assets/textures/aqueduct_floor.jpg', 3, 3);
const forgeWallTex = loadTexture('/assets/textures/forge_wall.jpg', 2, 2);
const forgeFloorTex = loadTexture('/assets/textures/forge_floor.jpg', 3, 3);
const galeWallTex = loadTexture('/assets/textures/gale_wall.jpg', 2, 2);
const galeFloorTex = loadTexture('/assets/textures/gale_floor.jpg', 3, 3);
const throneWallTex = loadTexture('/assets/textures/throne_wall.jpg', 2, 2);
const throneFloorTex = loadTexture('/assets/textures/throne_floor.jpg', 3, 3);

const materials = {
  wall:          new THREE.MeshLambertMaterial({ map: wallTex }),
  floor:         new THREE.MeshLambertMaterial({ map: floorTex }),
  ceil:          new THREE.MeshLambertMaterial({ map: ceilTex }),
  aqueductWall:  new THREE.MeshLambertMaterial({ map: aqueductWallTex }),
  aqueductFloor: new THREE.MeshLambertMaterial({ map: aqueductFloorTex }),
  forgeWall:     new THREE.MeshLambertMaterial({ map: forgeWallTex }),
  forgeFloor:    new THREE.MeshLambertMaterial({ map: forgeFloorTex }),
  galeWall:      new THREE.MeshLambertMaterial({ map: galeWallTex }),
  galeFloor:     new THREE.MeshLambertMaterial({ map: galeFloorTex }),
  throneWall:    new THREE.MeshLambertMaterial({ map: throneWallTex }),
  throneFloor:   new THREE.MeshLambertMaterial({ map: throneFloorTex }),
};

// ─────────────────────────────────────────────────────────────
// SHADER WARMUP (Section 30)
// Prewarm renderer against representative geometry & materials
// ─────────────────────────────────────────────────────────────
function warmupShaders() {
  const warmupGroup = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (const mat of Object.values(materials)) {
    warmupGroup.add(new THREE.Mesh(boxGeo, mat));
  }
  scene.add(warmupGroup);

  // Perform dummy render to compile shaders before player sees action
  renderer.render(scene, camera);
  scene.remove(warmupGroup);
  boxGeo.dispose();
}

warmupShaders();

// ─────────────────────────────────────────────────────────────
// MAIN MENU SETUP
// ─────────────────────────────────────────────────────────────
const menu = new MainMenu(save);
menu.onStartGame = (charType) => {
  STATE.character = charType;
  STATE.phase = 'playing';
  STATE.score = 0;
  STATE.bossTriggered = false;
  STATE.bossDefeated  = false;
  startGame(charType, false);
};

menu.onContinue = () => {
  const saved = save.load();
  if (saved) {
    STATE.character = saved.character || 'warrior';
    STATE.score     = saved.score || 0;
    STATE.phase     = 'playing';
    startGame(STATE.character, true, saved);
  }
};

function saveCurrentGame() {
  if (!player) return null;
  const pz = camera.position.z;
  const px = camera.position.x;
  let roomNum = 1;
  if (pz < 138) roomNum = 1;
  else if (pz < 202) roomNum = 2;
  else if (pz < 264) roomNum = 3;
  else if (pz < 326) roomNum = 4;
  else roomNum = 5;

  const data = {
    character: STATE.character,
    level: player.level,
    xp: player.xp,
    xpToNextLevel: player.xpToNextLevel,
    damageMultiplier: player.damageMultiplier,
    damageReduction: player.damageReduction || 1.0,
    hasAegis: !!player.hasAegis,
    woodCount: player.woodCount || 0,
    shelterBuilt: map.shelterInteractable ? !!map.shelterInteractable.isBuilt : false,
    health: player.health,
    maxHealth: player.maxHealth,
    stamina: player.stamina,
    maxStamina: player.maxStamina,
    mana: player.mana,
    maxMana: player.maxMana,
    flasks: player.flasks,
    maxFlasks: player.maxFlasks,
    checkpointPos: { x: player.checkpointPos.x, y: player.checkpointPos.y, z: player.checkpointPos.z },
    score: STATE.score,
    room: roomNum,
  };
  save.save(data);
  const status = document.getElementById('save-status');
  if (status) {
    status.textContent = '✓ Progress Saved at Checkpoint';
    setTimeout(() => { status.textContent = ''; }, 2000);
  }
  return data;
}

// ─────────────────────────────────────────────────────────────
// GAME START & LEVEL INITIALIZATION
// ─────────────────────────────────────────────────────────────
function startGame(charType, fromSave = false, savedData = null) {
  STATE.phase = 'playing';
  STATE.bossTriggered = false;
  STATE.bossDefeated  = false;
  STATE.isTestBossArena = false;
  STATE.keys = 0;
  STATE.lastFloor = 0;

  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');
  document.getElementById('click-to-play').classList.remove('hidden');
  const victoryScreen = document.getElementById('victory-screen');
  if (victoryScreen) victoryScreen.classList.add('hidden');
  const gameOverScreen = document.getElementById('game-over');
  if (gameOverScreen) gameOverScreen.classList.add('hidden');
  const pauseMenu = document.getElementById('pause-menu');
  if (pauseMenu) pauseMenu.classList.add('hidden');

  audio.startMusic();
  audio.setMusicState('explore');

  // Dispose previous player subsystem cleanly
  if (player && typeof player.destroy === 'function') {
    player.destroy();
  }

  // Instantiate player
  player = new Player(camera, scene, input, audio, charType);

  // Update portrait icon in HUD
  const portraitIcons = {
    warrior: '🛡️',
    elf: '🏹',
    wizard: '🔮',
    valkyrie: '⚡',
  };
  const portIcon = document.getElementById('portrait-icon');
  if (portIcon) portIcon.textContent = portraitIcons[charType] || '🛡️';
  if (fromSave && savedData) {
    player.level = savedData.level ?? player.level;
    player.xp = savedData.xp ?? player.xp;
    player.xpToNextLevel = savedData.xpToNextLevel ?? player.xpToNextLevel;
    player.damageMultiplier = savedData.damageMultiplier ?? player.damageMultiplier;
    player.maxHealth = savedData.maxHealth ?? player.maxHealth;
    player.health = savedData.health ?? player.maxHealth;
    player.maxStamina = savedData.maxStamina ?? player.maxStamina;
    player.stamina = savedData.stamina ?? player.maxStamina;
    player.maxMana = savedData.maxMana ?? player.maxMana;
    player.mana = savedData.mana ?? player.maxMana;
    player.maxFlasks = savedData.maxFlasks ?? player.maxFlasks;
    player.flasks = savedData.flasks ?? player.maxFlasks;
    if (savedData.checkpointPos) {
      player.checkpointPos.copy(savedData.checkpointPos);
      camera.position.copy(player.checkpointPos);
      player.currentGroundY = Math.max(0, player.checkpointPos.y - 1.7);
    }
  } else {
    // Start at Crypt Entrance
    camera.position.set(0, 1.7, -140);
    player.checkpointPos.set(0, 1.7, -140);
  }

  // Clear lingering pickups
  pickups.clear();

  // Build the complete contiguous Souls-Doom level
  const world = map.buildContinuousLevel(materials, player, audio, hud);
  if (!spriteTestRoom) {
    spriteTestRoom = new SpriteTestRoom(scene, renderer);
  }

  // Restore persistent player data (wood, shelter, aegis)
  if (savedData) {
    if (savedData.woodCount !== undefined) player.woodCount = savedData.woodCount;
    if (savedData.shelterBuilt && map.shelterInteractable) {
      map.shelterInteractable.isBuilt = true;
      map.shelterInteractable.prompt = 'REST AT SHELTER [E]';
    }
    if (savedData.hasAegis) {
      player.hasAegis = true;
      player.damageReduction = 0.5;
      if (savedData.damageMultiplier === undefined) {
        player.damageMultiplier *= 2.0;
      }
    }
  }
  player.onRest = () => saveCurrentGame();

  // Critical architectural bindings
  player.setWalls(world.walls);
  player.setInteractables(world.interactables);
  player.setHUD(hud);
  enemies.setWalls(world.walls);
  enemies.setFloorRamps(world.floorRamps);
  player.weapons.inject(enemies, particles, world.walls);

  // Spawn enemy encounters across the interconnected level
  spawnWorldEncounters();

  // Wire score, kill XP, pickups & boss callbacks
  enemies.onScore = addScore;
  enemies.onKill = (enemy) => {
    const xp = (enemy.xpValue !== undefined) ? enemy.xpValue : (enemy.scoreValue ? Math.round(enemy.scoreValue * 0.4) : 40);
    if (xp > 0) player.addXP(xp);
    if (pickups) {
      pickups.dropFromEnemy(enemy.mesh.position, enemy.enemyType);
    }
    // Key drop logic
    if (enemy.dropKey) {
      STATE.keys += 1;
      player.keys = (player.keys || 0) + 1;
      hud.updateKeys(STATE.keys);
      hud.showKeyPickupBanner();
    }
  };
  enemies.onBossHealthChange = (alive, pct, bossObj) => {
    const bossBar = document.getElementById('boss-bar');
    const bossName = document.getElementById('boss-name');
    const bossFill = document.getElementById('boss-fill');

    const px = (player && player.isThirdPerson && player.worldPos) ? player.worldPos.x : camera.position.x;
    const pz = (player && player.isThirdPerson && player.worldPos) ? player.worldPos.z : camera.position.z;
    const isSecretLair = (px <= -75 && pz >= 35 && pz <= 85);
    const isCathedral = (pz >= 326);

    if (isSecretLair && map.secretBossMinotaur && !map.secretBossMinotaur.dead) {
      if (bossBar) bossBar.classList.remove('hidden');
      if (bossName) bossName.textContent = 'ASTERION, GUARDIAN OF THE LABYRINTH';
      const mPct = Math.max(0, map.secretBossMinotaur.health / map.secretBossMinotaur.maxHealth);
      if (bossFill) bossFill.style.width = (mPct * 100) + '%';
    } else if (alive && STATE.bossTriggered && isCathedral) {
      if (bossBar) bossBar.classList.remove('hidden');
      if (bossName) bossName.textContent = 'THE WIZARD KING · DEATH KNIGHT';
      if (bossFill) bossFill.style.width = (pct * 100) + '%';
    } else {
      if (bossBar) bossBar.classList.add('hidden');
      if (STATE.bossTriggered && !alive && !STATE.bossDefeated && isCathedral) {
        onBossDefeated();
      }
    }
  };

  // Apply player controls settings
  player.mouseSensitivity = (currentSettings.sensitivity / 100) * 0.002;
  player.invertY = !!currentSettings.invertY;

  // Bind Minotaur Stalker AI
  minotaurStalker.setPlayer(player, camera);

  // Real-time Souls respawn and grind loop
  player.onRest = () => {
    saveCurrentGame();
    spawnWorldEncounters();
    minotaurStalker.escapeMinotaur();
  };
}

function spawnWorldEncounters() {
  enemies.clear();

  // ── Floor 1: Crypt of the Damned (Y = 0, Z: 0..120) ── [Packs spread through the maze, clear entrance]
  // Solo Scout / Sentry (Z = 26) - matches Test index 0
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2.5, 0, 26), player, camera);

  // Pack 1: Secret Relic Chamber Guardians (West Alcove, X: -14, Z: 36)
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-13, 0, 35), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-15, 0, 39), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-12, 0, 43), player, camera);

  // Pack 2: East Corridor Ambush (X: 12..25, Z: 38..52)
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(16, 0, 40), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(22, 0, 46), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(18, 0, 50), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(20, 1.5, 42), player, camera);

  // Pack 3: Catacomb Central Swarm (Z: 58..75)
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-4, 1.5, 60), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(4, 1.5, 66), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(0, 0, 68), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-8, 0, 72), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(8, 0, 74), player, camera);

  // Pack 4: West Wing Patrol (X: -26..-12, Z: 80..96)
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-20, 0, 82), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-16, 0, 90), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(-22, 0, 88), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-18, 1.5, 94), player, camera);

  // Pack 5: East Wing Patrol (X: 12..28, Z: 80..96)
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(18, 0, 84), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(24, 0, 92), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(20, 0, 88), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(22, 0, 96), player, camera);

  // Pack 6: Grand Staircase Vanguard (Floor 2 Portal Guards, Z: 104..116)
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(0, 0, 108), player, camera); // Colossal staircase guardian
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-5, 0, 104), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(5, 0, 104), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-7, 0, 114), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(7, 0, 114), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(0, 0, 116), player, camera);

  // ── Floor 2: Sunken Aqueducts (Y = 4, Z: 138..186) ── [~16 Enemies]
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(4, 5.2, 144), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-4, 5.2, 150), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 5.2, 168), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(2, 5.2, 180), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-3, 4, 156), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(3, 4, 160), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-5, 4, 174), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(0, 4, 146), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(3, 4, 162), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-3, 4, 182), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-5, 4, 148), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(5, 4, 152), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(5, 4, 178), player, camera); // Matches Test 9 (golem near Z=178)
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(-4, 4, 180), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(-8, 4, 146), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(8, 4, 184), player, camera);

  // ── Floor 3: Smoldering Forges (Y = 8, Z: 202..248) ── [~24 Enemies]
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-6, 8, 206), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(6, 8, 210), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 9.2, 214), player, camera);
  enemies.spawnEnemy(LavaGolem, new THREE.Vector3(0, 8, 222), player, camera);    // MINI-BOSS: Lava Forge Guardian
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-5, 8, 230), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(8, 8, 222), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-4, 8, 240), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(4, 8, 244), player, camera);
  // Crucible foundry horde
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2, 8, 204), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2, 8, 204), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-8, 8, 208), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(8, 8, 212), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-5, 9.2, 216), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(5, 9.2, 218), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 9.2, 226), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-9, 8, 220), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(9, 8, 224), player, camera);
  enemies.spawnEnemy(LavaGolem, new THREE.Vector3(-6, 8, 228), player, camera);   // MINI-BOSS: Lava Golem
  enemies.spawnEnemy(LavaGolem, new THREE.Vector3(6, 8, 232), player, camera);    // MINI-BOSS: Lava Golem
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2, 8, 236), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2, 8, 236), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-8, 8, 242), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(8, 8, 246), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 9.2, 246), player, camera);
  // Elite sentinels (Floor 3)
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(-4, 8, 212), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(4, 8, 238), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(-9, 8, 244), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(9, 8, 206), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(0, 8, 248), player, camera);

  // ── Floor 4: Gale Spire (Y = 12, Z: 264..310) ── [~28 Enemies]
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(-5, 13.8, 268), player, camera); // NEW: Storm Harpy
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(5, 13.8, 274), player, camera);  // NEW: Storm Harpy
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-4, 12, 280), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(4, 12, 286), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(0, 12, 292), player, camera);
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(0, 13.8, 298), player, camera);  // NEW: Storm Harpy
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-6, 12, 304), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(6, 12, 306), player, camera);
  // High Sanctum tempest horde
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(-2, 13.8, 266), player, camera); // NEW
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(2, 13.8, 270), player, camera);  // NEW
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(-7, 13.8, 276), player, camera); // NEW
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(7, 13.8, 278), player, camera);  // NEW
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-6, 12, 272), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(6, 12, 272), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2, 12, 282), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2, 12, 284), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-8, 12, 288), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(8, 12, 290), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-3, 12, 296), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(3, 12, 296), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(-5, 12, 300), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(5, 12, 300), player, camera);
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(-4, 13.8, 308), player, camera); // NEW
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(4, 13.8, 308), player, camera);  // NEW
  // Elite sentinels (Floor 4)
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(-5, 12, 292), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(5, 12, 302), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(0, 12, 267), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(-9, 12, 310), player, camera);

  // ── Floor 5: Throne of the Wizard King (Y = 16, Z: 326..372) ── [~30 Enemies]
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-5, 16, 332), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(5, 16, 332), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-6, 16, 342), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(6, 16, 342), player, camera);
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(0, 17.8, 347), player, camera);  // NEW: Storm Harpy guard
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(0, 16, 352), player, camera);
  enemies.spawnEnemy(DeathKnight, new THREE.Vector3(0, 16, 362), player, camera);   // Wizard King / Death Knight Boss
  // Royal guard vanguard
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-10, 16, 330), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(10, 16, 330), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-3, 16, 334), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(3, 16, 334), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(0, 16, 337), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-12, 16, 338), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(12, 16, 338), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-3, 16, 344), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(3, 16, 344), player, camera);
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(-7, 17.8, 340), player, camera); // NEW
  enemies.spawnEnemy(StormHarpy, new THREE.Vector3(7, 17.8, 340), player, camera);  // NEW
  enemies.spawnEnemy(DarkAcolyte, new THREE.Vector3(-5, 16, 336), player, camera);  // NEW: Dark Acolyte
  enemies.spawnEnemy(DarkAcolyte, new THREE.Vector3(5, 16, 346), player, camera);   // NEW: Dark Acolyte
  enemies.spawnEnemy(DarkAcolyte, new THREE.Vector3(-8, 16, 354), player, camera);  // NEW: Dark Acolyte
  enemies.spawnEnemy(DarkAcolyte, new THREE.Vector3(8, 16, 350), player, camera);   // NEW: Dark Acolyte
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(-10, 16, 348), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(10, 16, 348), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(-5, 16, 358), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(5, 16, 358), player, camera);
  // Elite royal guards (Floor 5)
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(-12, 16, 330), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(12, 16, 336), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(-4, 16, 342), player, camera);
  enemies.spawnEnemy(ChampionOrc, new THREE.Vector3(4, 16, 352), player, camera);

  const countEl = document.getElementById('enemy-count');
  if (countEl) countEl.textContent = enemies.getAll().length;
}


// ─────────────────────────────────────────────────────────────
// COMBAT & LEVEL EVENTS
// ─────────────────────────────────────────────────────────────
function checkLevelTriggers() {
  if (!player) return;
  const pz = (player && player.isThirdPerson && player.worldPos) ? player.worldPos.z : camera.position.z;
  const px = (player && player.isThirdPerson && player.worldPos) ? player.worldPos.x : camera.position.x;
  const py = (player && player.isThirdPerson) ? player.currentGroundY + 1.7 : camera.position.y;

    // Smooth transition for lighting & fog between beach (Z <= 0) and dungeon (Z >= 15)
  const t = Math.max(0, Math.min(1, pz / 15.0)); // 0 = Beach, 1 = Dungeon
  
  const cBeachBg = new THREE.Color(0x5da0d8);
  const cDungBg = new THREE.Color(0x0a0609);
  scene.background.copy(cBeachBg).lerp(cDungBg, t);
  
  const cBeachFog = new THREE.Color(0x8cb8d8);
  const cDungFog = new THREE.Color(0x080608);
  scene.fog.color.copy(cBeachFog).lerp(cDungFog, t);
  
  scene.fog.near = 40 + (5 - 40) * t;
  scene.fog.far = 220 + (45 - 220) * t;
  
  sunLight.intensity = 1.3 - 1.3 * t;
  hemiLight.intensity = 0.6 - 0.6 * t;

  // Boss Arena trigger: Cathedral entrance at Z >= 326 (Cathedral at Y >= 14.5)
  const isCathedralTrigger = (pz >= 326 && py >= 14.5);
  if (!STATE.bossTriggered && isCathedralTrigger) {
    STATE.bossTriggered = true;
    map.sealBossArena(pz, py);
    player.setWalls(map.walls); // Update walls with fog gate
    enemies.setWalls(map.walls);
    player.weapons.inject(enemies, particles, map.walls);
    audio.setMusicState('boss');
    audio.playSFX('bossRoar', 1.2);
    const bossBar = document.getElementById('boss-bar');
    if (bossBar) bossBar.classList.remove('hidden');
    const bossName = document.getElementById('boss-name');
    if (bossName) bossName.textContent = 'THE WIZARD KING · DEATH KNIGHT';
  }

  // Update room label in HUD based on spatial location
  let areaName = 'THE SHORELINE';
  let currentFloor = 0;
  if (px <= -75 && pz >= 35 && pz <= 85) {
    areaName = 'SECRET LAIR: THE LABYRINTHIAN HEART';
    currentFloor = 1;
  } else if (pz < 0) {
    areaName = 'THE SHORELINE';
    currentFloor = 0;
  } else if (pz < 138) {
    areaName = 'FLOOR 1: CRYPT OF THE DAMNED';
    currentFloor = 1;
  } else if (pz < 202) {
    areaName = 'FLOOR 2: SUNKEN AQUEDUCTS';
    currentFloor = 2;
  } else if (pz < 264) {
    areaName = 'FLOOR 3: SMOLDERING FORGES';
    currentFloor = 3;
  } else if (pz < 326) {
    areaName = 'FLOOR 4: GALE SPIRE';
    currentFloor = 4;
  } else {
    areaName = 'FLOOR 5: THRONE OF WIZARD KING';
    currentFloor = 5;
  }

  const infoEl = document.getElementById('room-info');
  if (infoEl) infoEl.textContent = `${areaName} · ELEVATION Y=${Math.round(py)}`;

  // Fire floor-entry banner on first crossing per run
  if (currentFloor !== STATE.lastFloor && currentFloor > 0) {
    STATE.lastFloor = currentFloor;
    if (currentFloor > 1) {
      hud.showFloorBanner(currentFloor, areaName);
    }
  }

  // Interaction prompt check
  let nearInteractable = false;
  let promptLabel = 'INTERACT';
  for (const item of map.interactables) {
    if (item.active) {
      const dx = px - item.position.x;
      const dz = pz - item.position.z;
      const dy = Math.abs(py - item.position.y);
      if (Math.hypot(dx, dz) <= (item.radius || 2.5) && dy <= 5.0) {
        nearInteractable = true;
        if (item.prompt) promptLabel = item.prompt;
        else if (item === map.interactables[0]) promptLabel = 'OPEN RELIC CHEST [E]';
        else if (item.position.z > 200) promptLabel = 'REST AT HIGH SANCTUM [E]';
        else if (item.position.x < -10) promptLabel = 'REST AT SHRINE OF ASH [E]';
        else promptLabel = 'PULL SHORTCUT LEVER [E]';
        break;
      }
    }
  }
  if (nearInteractable) hud.showInteractPrompt(promptLabel);
  else hud.hideInteractPrompt();
}

function onBossDefeated() {
  if (STATE.bossDefeated) return;
  STATE.bossDefeated = true;
  if (player) player._iframes = 999;
  addScore(5000);
  audio.playSFX('roomClear');
  audio.setMusicState('explore');

  STATE.phase = 'victory';
  try { document.exitPointerLock(); } catch (_) {}
  try { save.clear(); } catch (_) {}
  const scoreVal = document.getElementById('vic-score-val');
  if (scoreVal) scoreVal.textContent = STATE.score;
  const vicScreen = document.getElementById('victory-screen');
  if (vicScreen) vicScreen.classList.remove('hidden');
}

function onPlayerDead() {
  if (STATE.phase === 'dead' || STATE.bossDefeated) return;
  STATE.phase = 'dead';
  minotaurStalker.clear();
  try { document.exitPointerLock(); } catch (_) {}

  const scoreVal = document.getElementById('go-score-val');
  if (scoreVal) scoreVal.textContent = STATE.score;
  const roomVal = document.getElementById('go-room-val');
  if (roomVal) roomVal.textContent = 'Shrine of Ash';
  const goScreen = document.getElementById('game-over');
  if (goScreen) goScreen.classList.remove('hidden');
}

function respawnPlayer() {
  document.getElementById('game-over').classList.add('hidden');
  STATE.phase = 'playing';
  minotaurStalker.clear();
  player.respawn();
  // Respawn non-boss enemies in open sectors
  spawnWorldEncounters();
  audio.setMusicState('explore');
  document.getElementById('click-to-play').classList.remove('hidden');
}

function addScore(amount) {
  STATE.score += amount;
  hud.updateScore(STATE.score);
}

// ─────────────────────────────────────────────────────────────
// POINTER LOCK & PAUSE LOGIC
// ─────────────────────────────────────────────────────────────
function requestGamePointerLock() {
  if (STATE.phase !== 'playing') return;
  try {
    const p = canvas.requestPointerLock();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  } catch (e) {}
}

const ctp = document.getElementById('click-to-play');
if (ctp) {
  ctp.addEventListener('click', (e) => {
    e.stopPropagation();
    input.clearMouse();
    requestGamePointerLock();
  });
}

canvas.addEventListener('click', () => {
  if (STATE.phase === 'playing' && document.pointerLockElement !== canvas) {
    input.clearMouse();
    requestGamePointerLock();
  }
});

const gameContainer = document.getElementById('game-container');
if (gameContainer) {
  gameContainer.addEventListener('click', (e) => {
    if (STATE.phase === 'playing' && document.pointerLockElement !== canvas) {
      if (e.target.closest('#hud-center button, #pause-menu, button, input')) {
        return;
      }
      input.clearMouse();
      requestGamePointerLock();
    }
  });
}

document.addEventListener('pointerlockchange', () => {
  const isLocked = !!(document.pointerLockElement && (document.pointerLockElement === canvas || document.pointerLockElement === document.body));
  if (isLocked) {
    ctp?.classList.add('hidden');
  } else if (STATE.phase === 'playing') {
    if (!input.isGamepadActive) {
      ctp?.classList.remove('hidden');
      input.clearAll();
    }
  }
});

document.addEventListener('pointerlockerror', (e) => {
  console.warn('[PointerLock] pointerlockerror event:', e);
});

function pauseGame() {
  if (STATE.phase !== 'playing') return;
  STATE.phase = 'paused';
  if (document.pointerLockElement) {
    try { document.exitPointerLock(); } catch (e) {}
  }
  input.clearAll();
  ctp?.classList.add('hidden');
  document.getElementById('pause-menu')?.classList.remove('hidden');
}

function resumeGame() {
  if (STATE.phase !== 'paused') return;
  STATE.phase = 'playing';
  input.clearAll();
  document.getElementById('pause-menu')?.classList.add('hidden');
  requestGamePointerLock();
}

function togglePause() {
  if (STATE.phase === 'playing') {
    pauseGame();
  } else if (STATE.phase === 'paused') {
    resumeGame();
  }
}

// Global Escape listener for pause menu toggle
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (STATE.phase === 'playing' || STATE.phase === 'paused') {
      e.preventDefault();
      togglePause();
    }
  }
  // Tab or I key toggles the character stat panel
  if (e.code === 'Tab' || e.code === 'KeyI') {
    if (STATE.phase === 'playing' || STATE.phase === 'paused') {
      e.preventDefault();
      toggleStatPanel();
    }
  }
});

function toggleStatPanel() {
  const panel = document.getElementById('stat-panel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    // Populate stats from player
    if (player) {
      const classNames = { warrior: 'Warrior', elf: 'Elf', wizard: 'Wizard', valkyrie: 'Valkyrie' };
      document.getElementById('sp-class').textContent = classNames[player.charType] || player.charType;
      document.getElementById('sp-level').textContent = player.level || 1;
      document.getElementById('sp-hp').textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;
      document.getElementById('sp-stamina').textContent = `${Math.ceil(player.stamina)} / ${player.maxStamina}`;
      document.getElementById('sp-mana').textContent = `${Math.ceil(player.mana)} / ${player.maxMana}`;
      document.getElementById('sp-damage').textContent = `+${Math.round(((player.damageMultiplier || 1.0) - 1.0) * 100)}%`;
      document.getElementById('sp-xp').textContent = `${player.xp || 0} / ${player.xpToNextLevel}`;
      document.getElementById('sp-keys').textContent = STATE.keys || 0;
      document.getElementById('sp-score').textContent = STATE.score || 0;
    }
    panel.classList.remove('hidden');
    if (STATE.phase === 'playing') {
      STATE.phase = 'paused';
      if (document.pointerLockElement) try { document.exitPointerLock(); } catch (_) {}
      input.clearAll();
    }
  } else {
    panel.classList.add('hidden');
    if (STATE.phase === 'paused') {
      STATE.phase = 'playing';
      input.clearAll();
      requestGamePointerLock();
    }
  }
}


// ─────────────────────────────────────────────────────────────
// UI BUTTONS
// ─────────────────────────────────────────────────────────────
document.getElementById('btn-resume')?.addEventListener('click', (e) => {
  e.stopPropagation();
  resumeGame();
});
document.getElementById('btn-hud-pause')?.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePause();
});
document.getElementById('pause-menu')?.addEventListener('click', (e) => {
  if (e.target.id === 'pause-menu') {
    resumeGame();
  }
});

document.getElementById('btn-save')?.addEventListener('click', () => {
  saveCurrentGame();
});

document.getElementById('btn-quit').addEventListener('click', () => {
  STATE.phase = 'menu';
  minotaurStalker.clear();
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('game-container').classList.add('hidden');
  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('victory-screen').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
  map.clear();
  enemies.clear();
  particles.clear();
  pickups.clear();
  if (player && typeof player.destroy === 'function') {
    player.destroy();
  }
  player = null;
});

document.getElementById('btn-retry').addEventListener('click', respawnPlayer);
document.getElementById('btn-menu').addEventListener('click', () => document.getElementById('btn-quit').click());
document.getElementById('btn-play-again').addEventListener('click', () => {
  document.getElementById('victory-screen').classList.add('hidden');
  startGame(STATE.character, false);
});
document.getElementById('btn-menu2').addEventListener('click', () => document.getElementById('btn-quit').click());

// ─────────────────────────────────────────────────────────────
// RESIZE
// ─────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ─────────────────────────────────────────────────────────────
// FIXED 60Hz TIMESTEP SIMULATION (Section 13)
// ─────────────────────────────────────────────────────────────
const FIXED_DT = 1 / 60;
let lastTime = performance.now();
let accumulator = 0;

function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  const isHeadless = typeof navigator !== 'undefined' && navigator.userAgent.includes('HeadlessChrome');
  const dt = isHeadless ? Math.min(rawDt, 0.1) : Math.min(rawDt, 0.033); // Clamp extreme tab-switch deltas
  accumulator += dt;

  STATE.frameCount++;
  let didUpdate = false;

  // Handle gamepad pause (button 9)
  if (input.pause && (STATE.phase === 'playing' || STATE.phase === 'paused')) {
    togglePause();
  }

  if (STATE.phase === 'playing' && player) {
    // Water animation
    if (map.waterMeshes && map.waterMeshes.length > 0) {
      const time = performance.now() * 0.001;
      for (const wMesh of map.waterMeshes) {
        const pos = wMesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          pos.setZ(i, Math.sin(x * 0.2 + time) * 0.3 + Math.cos(y * 0.2 + time) * 0.3);
        }
        pos.needsUpdate = true;
      }
    }
    // Run fixed updates
    while (accumulator >= FIXED_DT) {
      player.update(FIXED_DT);
      enemies.update(FIXED_DT, camera.position);
      minotaurStalker.update(FIXED_DT);
      if (spriteTestRoom) spriteTestRoom.update(FIXED_DT);
      pickups.update(FIXED_DT, camera.position, player, addScore);
      particles.update(FIXED_DT);
      checkLevelTriggers();
      didUpdate = true;

      if (player.health <= 0) {
        onPlayerDead();
        break;
      }
      accumulator -= FIXED_DT;
    }

    hud.update(player);
    hud.drawMinimap(map, enemies, camera.position, player.getForwardDir());
  } else {
    if (STATE.phase === 'menu') {
      menu.update(input);
    }
    accumulator = 0;
    didUpdate = true;
  }

  renderer.render(scene, camera);
  if (didUpdate) {
    input.endFrame();
  }
}

requestAnimationFrame(gameLoop);

// ─────────────────────────────────────────────────────────────
// DETERMINISTIC TESTING INTERFACE (Section 33, 34)
// Expose test controls on window for headless automated gauntlet
// ─────────────────────────────────────────────────────────────
window.GAME = {
  STATE,
  get player() { return player; },
  get map()    { return map; },
  get enemies(){ return enemies; },
  get minotaurStalker(){ return minotaurStalker; },
  get audio()  { return audio; },
  get hud()    { return hud; },
  get pickups(){ return pickups; },
  get spriteTestRoom(){ return spriteTestRoom; },
  enterSpriteTestRoom: () => {
    if (spriteTestRoom && player) spriteTestRoom.teleportPlayerToRoom(player);
  },
  exitSpriteTestRoom: () => {
    if (spriteTestRoom && player) spriteTestRoom.teleportPlayerFromRoom(player);
  },
  toggleThirdPerson: () => {
    if (player && typeof player.toggleThirdPerson === 'function') {
      player.toggleThirdPerson();
    }
  },
  startGame: (charType = 'warrior') => {
    menu.onStartGame(charType);
  },
  setPosition: (x, y, z) => {
    if (player) {
      if (typeof player.teleport === 'function') {
        player.teleport(x, y, z);
      } else {
        const groundY = player.getGroundY(x, z);
        player.currentGroundY = groundY > 0 ? groundY : Math.max(0, y - 1.7);
        if (!player.worldPos) player.worldPos = new THREE.Vector3();
        player.worldPos.set(x, player.currentGroundY, z);
        camera.position.set(x, player.currentGroundY + 1.7, z);
        camera.updateMatrixWorld();
      }
      checkLevelTriggers();
    }
  },
  lookAt: (x, z) => {
    if (player) {
      player.lookAt(x, z);
    }
  },
  triggerDamage: (amount, sourcePos = null) => {
    if (player) {
      player._iframes = 0;
      player.takeDamage(amount, sourcePos);
    }
  },
  setBlocking: (active = true) => {
    if (player && typeof player.setBlocking === 'function') {
      player.setBlocking(active);
    }
  },
  triggerDodge: () => {
    if (player) {
      input._pressed.add('Space');
    }
  },
  triggerAttack: (isHeavy = false) => {
    if (player && player.weapons) {
      return player.weapons.triggerAttack(isHeavy);
    }
    return false;
  },
  triggerHeavyAttack: () => {
    if (player && player.weapons) {
      return player.weapons.triggerAttack(true);
    }
    return false;
  },
  switchWeapon: (idx) => {
    if (player && player.weapons) {
      player.weapons._switchTo(idx);
    }
  },
  triggerInteract: () => {
    if (player) {
      input._pressed.add('KeyE');
    }
  },
  respawn: respawnPlayer,
  saveGame: () => {
    document.getElementById('btn-save').click();
    return save.load();
  },
  save,
  menu,
  get settings() { return currentSettings; },
  setSettings: (s) => {
    Object.assign(currentSettings, s);
    applySettings(currentSettings);
    saveSettings(currentSettings);
  },
  togglePause,
  pauseGame,
  resumeGame,
};
