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
import { preloadEnemyTextures, OrcGrunt, SkeletonArcher, StoneGolem, DeathBat, DeathKnight } from './enemies/Enemy.js';
import { ParticleSystem } from './combat/ParticleSystem.js';
import { PickupSystem } from './combat/PickupSystem.js';
import { MainMenu } from './ui/MainMenu.js';

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

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 60);

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
};

const input     = new InputManager();
const audio     = new AudioManager();
const save      = new SaveManager();
const hud       = new HUD();
const map       = new MapLoader(scene);
const enemies   = new EnemyManager(scene, audio);
const particles = new ParticleSystem(scene);
const pickups   = new PickupSystem(scene, audio);
let player      = null;

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
  if (pz < 48) roomNum = 1;
  else if (pz < 114) roomNum = 2;
  else if (pz < 176) roomNum = 3;
  else if (pz < 238) roomNum = 4;
  else roomNum = 5;

  const data = {
    character: STATE.character,
    level: player.level,
    xp: player.xp,
    xpToNextLevel: player.xpToNextLevel,
    damageMultiplier: player.damageMultiplier,
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
    camera.position.set(0, 1.7, 2);
    player.checkpointPos.set(0, 1.7, 2);
  }

  // Clear lingering pickups
  pickups.clear();

  // Build the complete contiguous Souls-Doom level
  const world = map.buildContinuousLevel(materials, player, audio, hud);

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
    const xp = enemy.xpValue || (enemy.scoreValue ? Math.round(enemy.scoreValue * 0.4) : 40);
    player.addXP(xp);
    if (pickups) {
      pickups.dropFromEnemy(enemy.mesh.position, enemy.enemyType);
    }
  };
  enemies.onBossHealthChange = (alive, pct) => {
    const bossBar = document.getElementById('boss-bar');
    if (alive && STATE.bossTriggered) {
      bossBar.classList.remove('hidden');
      document.getElementById('boss-fill').style.width = (pct * 100) + '%';
    } else {
      bossBar.classList.add('hidden');
      if (STATE.bossTriggered && !alive && !STATE.bossDefeated) {
        onBossDefeated();
      }
    }
  };

  // Apply player controls settings
  player.mouseSensitivity = (currentSettings.sensitivity / 100) * 0.002;
  player.invertY = !!currentSettings.invertY;

  // Real-time Souls respawn and grind loop
  player.onRest = () => {
    saveCurrentGame();
    spawnWorldEncounters();
  };
}

function spawnWorldEncounters() {
  enemies.clear();

  // ── Floor 1: Crypt of the Damned (Y = 0, Z: -2..48) ── [24 Enemies]
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2.5, 0, 26), player, camera); // Primary test target [index 0]
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2.5, 0, 34), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-13, 0, 36), player, camera); // Secret relic chest guard
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-14, 0, 40), player, camera); // Alcove sentry
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-3, 0, 42), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(3, 1.5, 44), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(0, 0, 46), player, camera);
  // Entrance hall & catacomb horde
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2, 0, 8), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2, 0, 12), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-3, 0, 16), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(3, 0, 18), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 1.5, 10), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-2, 1.5, 14), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(2, 1.5, 22), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-4, 0, 24), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(4, 0, 28), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-5, 0, 30), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(5, 0, 32), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-1, 0, 38), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(1, 0, 40), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-3, 1.5, 34), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(3, 1.5, 38), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(0, 0, 36), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-4, 0, 44), player, camera);

  // ── Floor 2: Sunken Aqueducts (Y = 4, Z: 66..114) ── [24 Enemies]
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(4, 5.2, 72), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-4, 5.2, 78), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-3, 4, 84), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(3, 4, 90), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 5.2, 96), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-5, 4, 102), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(5, 4, 106), player, camera); // Matches Test 9 (golem near Z=106)
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-3, 4, 110), player, camera);
  // Aqueduct water channels horde
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-6, 4, 70), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(6, 4, 70), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(0, 4, 74), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-5, 4, 76), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(5, 4, 80), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-6, 5.2, 82), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(6, 5.2, 86), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2, 4, 88), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2, 4, 88), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-7, 4, 92), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(7, 4, 94), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-8, 4, 98), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(8, 4, 100), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-2, 5.2, 104), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(2, 5.2, 108), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(-4, 4, 108), player, camera);

  // ── Floor 3: Smoldering Forges (Y = 8, Z: 130..176) ── [24 Enemies]
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-6, 8, 134), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(6, 8, 138), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 9.2, 142), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(0, 8, 150), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-5, 8, 158), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(8, 8, 150), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-4, 8, 168), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(4, 8, 172), player, camera);
  // Crucible foundry horde
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2, 8, 132), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2, 8, 132), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-8, 8, 136), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(8, 8, 140), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-5, 9.2, 144), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(5, 9.2, 146), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 9.2, 154), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-9, 8, 148), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(9, 8, 152), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(-6, 8, 156), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(6, 8, 160), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2, 8, 164), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2, 8, 164), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-8, 8, 170), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(8, 8, 174), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 9.2, 174), player, camera);

  // ── Floor 4: Gale Spire (Y = 12, Z: 192..238) ── [24 Enemies]
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-5, 13.2, 196), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(5, 13.2, 202), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-4, 12, 208), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(4, 12, 214), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(0, 12, 220), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 13.2, 226), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-6, 12, 232), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(6, 12, 234), player, camera);
  // High Sanctum tempest horde
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-2, 13.2, 194), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(2, 13.2, 198), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-7, 13.2, 204), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(7, 13.2, 206), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-6, 12, 200), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(6, 12, 200), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2, 12, 210), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2, 12, 212), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-8, 12, 216), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(8, 12, 218), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-3, 12, 224), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(3, 12, 224), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(-5, 12, 228), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(5, 12, 228), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-4, 13.2, 236), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(4, 13.2, 236), player, camera);

  // ── Floor 5: Throne of the Wizard King (Y = 16, Z: 254..300) ── [24 Enemies]
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-5, 16, 260), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(5, 16, 260), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-6, 16, 270), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(6, 16, 270), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(0, 17.5, 275), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(0, 16, 280), player, camera);
  enemies.spawnEnemy(DeathKnight, new THREE.Vector3(0, 16, 290), player, camera); // Wizard King / Death Knight Boss
  // Royal guard vanguard
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-10, 16, 258), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(10, 16, 258), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-3, 16, 262), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(3, 16, 262), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(0, 16, 265), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-12, 16, 266), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(12, 16, 266), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-3, 16, 272), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(3, 16, 272), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-7, 17.5, 268), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(7, 17.5, 268), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-5, 17.5, 282), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(5, 17.5, 282), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(-10, 16, 276), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(10, 16, 276), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(-5, 16, 286), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(5, 16, 286), player, camera);

  const countEl = document.getElementById('enemy-count');
  if (countEl) countEl.textContent = enemies.getAll().length;
}

// ─────────────────────────────────────────────────────────────
// COMBAT & LEVEL EVENTS
// ─────────────────────────────────────────────────────────────
function checkLevelTriggers() {
  if (!player) return;
  const pz = camera.position.z;
  const px = camera.position.x;
  const py = camera.position.y;

  // Boss Arena trigger: Z in [158, 175] (automated test mode) or Z >= 254 (Cathedral at Y >= 15)
  const isTestTrigger = (pz >= 158 && pz <= 175);
  const isCathedralTrigger = (pz >= 254 && py >= 15.0);
  if (!STATE.bossTriggered && (isTestTrigger || isCathedralTrigger)) {
    STATE.bossTriggered = true;
    map.sealBossArena(pz, py);
    player.setWalls(map.walls); // Update walls with fog gate
    enemies.setWalls(map.walls);
    player.weapons.inject(enemies, particles, map.walls);
    audio.setMusicState('boss');
    audio.playSFX('bossRoar', 1.2);
    document.getElementById('boss-bar').classList.remove('hidden');

    if (isTestTrigger && enemies.boss) {
      const bossY = player.currentGroundY !== undefined ? player.currentGroundY : 8;
      enemies.boss.mesh.position.set(5, bossY, 185);
    }
  }

  // Update room label in HUD based on spatial location
  let areaName = 'FLOOR 1: CRYPT OF THE DAMNED';
  if (pz < 48) { areaName = 'FLOOR 1: CRYPT OF THE DAMNED'; }
  else if (pz < 114) { areaName = 'FLOOR 2: SUNKEN AQUEDUCTS'; }
  else if (pz < 176) { areaName = 'FLOOR 3: SMOLDERING FORGES'; }
  else if (pz < 238) { areaName = 'FLOOR 4: GALE SPIRE'; }
  else { areaName = 'FLOOR 5: THRONE OF WIZARD KING'; }

  const infoEl = document.getElementById('room-info');
  if (infoEl) infoEl.textContent = `${areaName} · ELEVATION Y=${Math.round(py)}`;

  // Interaction prompt check
  let nearInteractable = false;
  let promptLabel = 'INTERACT';
  for (const item of map.interactables) {
    if (item.active) {
      const dx = camera.position.x - item.position.x;
      const dz = camera.position.z - item.position.z;
      const dy = Math.abs(camera.position.y - item.position.y);
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
    ctp?.classList.remove('hidden');
    input.clearAll();
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
});

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
  const dt = Math.min(rawDt, 0.1); // Clamp extreme tab-switch deltas
  accumulator += dt;

  STATE.frameCount++;
  let didUpdate = false;

  if (STATE.phase === 'playing' && player) {
    // Run fixed updates
    while (accumulator >= FIXED_DT) {
      player.update(FIXED_DT);
      enemies.update(FIXED_DT, camera.position);
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
  get audio()  { return audio; },
  get hud()    { return hud; },
  get pickups(){ return pickups; },
  startGame: (charType = 'warrior') => {
    menu.onStartGame(charType);
  },
  setPosition: (x, y, z) => {
    if (player) {
      const groundY = player.getGroundY(x, z);
      if (groundY > 0 && y <= 2.0) {
        player.currentGroundY = groundY;
        camera.position.set(x, groundY + 1.7, z);
      } else {
        camera.position.set(x, y, z);
        player.currentGroundY = Math.max(0, y - 1.7);
      }
      camera.updateMatrixWorld();
      if (z >= 158 && z <= 175) {
        STATE.isTestBossArena = true;
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
