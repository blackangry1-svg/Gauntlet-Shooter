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
import { MainMenu } from './ui/MainMenu.js';
import { PartyManager } from './battle/PartyManager.js';
import { BattleArena } from './battle/BattleArena.js';
import { BattleUI } from './battle/BattleUI.js';
import { BattleSystem } from './battle/BattleSystem.js';
import { Element } from './battle/ElementalSystem.js';

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
const party       = new PartyManager();
const battleArena = new BattleArena(scene);
const battleUI    = new BattleUI();
const battleSystem = new BattleSystem(party, battleArena, battleUI, audio, camera);
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
const wallTex = texLoader.load('/assets/textures/wall.jpg');
wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
wallTex.repeat.set(2, 2);

const floorTex = texLoader.load('/assets/textures/floor.jpg');
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(3, 3);

const ceilTex = createCeilingTexture();

const materials = {
  wall:  new THREE.MeshLambertMaterial({ map: wallTex }),
  floor: new THREE.MeshLambertMaterial({ map: floorTex }),
  ceil:  new THREE.MeshLambertMaterial({ map: ceilTex }),
};

// ─────────────────────────────────────────────────────────────
// SHADER WARMUP (Section 30)
// Prewarm renderer against representative geometry & materials
// ─────────────────────────────────────────────────────────────
function warmupShaders() {
  const warmupGroup = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const meshW = new THREE.Mesh(boxGeo, materials.wall);
  const meshF = new THREE.Mesh(boxGeo, materials.floor);
  const meshC = new THREE.Mesh(boxGeo, materials.ceil);
  warmupGroup.add(meshW, meshF, meshC);
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

// ─────────────────────────────────────────────────────────────
// GAME START & LEVEL INITIALIZATION
// ─────────────────────────────────────────────────────────────
function startGame(charType, fromSave = false, savedData = null) {
  STATE.phase = 'playing';
  STATE.bossTriggered = false;
  STATE.bossDefeated  = false;

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
    player.health  = savedData.health ?? player.health;
    player.stamina = savedData.stamina ?? player.stamina;
    player.mana    = savedData.mana ?? player.mana;
    if (savedData.checkpointPos) {
      player.checkpointPos.copy(savedData.checkpointPos);
      camera.position.copy(player.checkpointPos);
    }
  } else {
    // Start at Crypt Entrance
    camera.position.set(0, 1.7, 2);
    player.checkpointPos.set(0, 1.7, 2);
  }

  // Build the complete contiguous Souls-Doom level
  const world = map.buildContinuousLevel(materials, player, audio, hud);

  // Critical architectural bindings
  player.setWalls(world.walls);
  player.setInteractables(world.interactables);
  enemies.setWalls(world.walls);
  player.weapons.inject(enemies, particles, world.walls);

  // Spawn enemy encounters across the interconnected level
  spawnWorldEncounters();

  // Wire score & boss callbacks
  enemies.onScore = addScore;
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

  // Wire hybrid tactical Paper Mario combat triggers
  player.weapons.onMeleeHit = (hitEnemy) => {
    triggerEncounter(hitEnemy, true, false); // ⚔️ Melee First Strike!
  };
  player.weapons.onRangedHit = (hitEnemy) => {
    triggerEncounter(hitEnemy, false, false); // Ranged engage
  };
  player.onAttacked = (sourcePos) => {
    const living = enemies.getAll().filter(e => !e.dead);
    living.sort((a, b) => a.mesh.position.distanceTo(player.camera.position) - b.mesh.position.distanceTo(player.camera.position));
    if (living[0]) {
      triggerEncounter(living[0], false, true); // ⚠️ Ambushed!
    }
  };
  player.onRest = () => {
    party.restAtShrine();
    spawnWorldEncounters();
  };
}

function triggerEncounter(overworldEnemy, isFirstStrike = false, isAmbush = false) {
  if (STATE.phase !== 'playing' || battleSystem.inBattle) return;

  const savedPlayerPos = player.camera.position.clone();
  const savedPlayerYaw = player.yaw;
  const savedPlayerPitch = player.pitch;

  let squad = [];
  if (overworldEnemy instanceof StoneGolem) {
    squad = [
      { name: 'Smoldering Golem', hp: 120, maxHp: 120, damage: 26, speed: 8, element: Element.FIRE, spritePath: 'assets/sprites/stone_golem.png', cols: 4, rows: 6, width: 2.8, height: 3.2, xp: 95 },
      { name: 'Forge Grunt', hp: 55, maxHp: 55, damage: 16, speed: 13, element: Element.EARTH, spritePath: 'assets/sprites/orc_grunt.png', cols: 4, rows: 5, width: 2.0, height: 2.5, xp: 40 }
    ];
  } else if (overworldEnemy instanceof DeathKnight) {
    squad = [
      { name: 'Death Knight', hp: 280, maxHp: 280, damage: 32, speed: 16, element: Element.SHADOW, spritePath: 'assets/sprites/death_knight_boss.png', cols: 4, rows: 6, width: 3.2, height: 3.8, isBoss: true, xp: 400 },
      { name: 'Dark Acolyte', hp: 60, maxHp: 60, damage: 22, speed: 17, element: Element.THUNDER, spritePath: 'assets/sprites/skeleton_archer.png', cols: 4, rows: 6, width: 1.8, height: 2.4, xp: 80 }
    ];
  } else if (overworldEnemy instanceof DeathBat) {
    squad = [
      { name: 'Frost Bat', hp: 32, maxHp: 32, damage: 14, speed: 22, element: Element.ICE, spritePath: 'assets/sprites/death_bat.png', cols: 4, rows: 5, width: 1.6, height: 1.6, xp: 25 },
      { name: 'Frost Bat Alpha', hp: 38, maxHp: 38, damage: 16, speed: 24, element: Element.ICE, spritePath: 'assets/sprites/death_bat.png', cols: 4, rows: 5, width: 1.8, height: 1.8, xp: 30 }
    ];
  } else if (overworldEnemy instanceof SkeletonArcher) {
    squad = [
      { name: 'Skeleton Archer', hp: 45, maxHp: 45, damage: 18, speed: 18, element: Element.WIND, spritePath: 'assets/sprites/skeleton_archer.png', cols: 4, rows: 6, width: 1.8, height: 2.4, xp: 40 },
      { name: 'Orc Sentry', hp: 50, maxHp: 50, damage: 15, speed: 11, element: Element.EARTH, spritePath: 'assets/sprites/orc_grunt.png', cols: 4, rows: 5, width: 2.0, height: 2.5, xp: 35 }
    ];
  } else {
    squad = [
      { name: 'Orc Grunt', hp: 55, maxHp: 55, damage: 16, speed: 12, element: Element.EARTH, spritePath: 'assets/sprites/orc_grunt.png', cols: 4, rows: 5, width: 2.0, height: 2.5, xp: 35 },
      { name: 'Orc Vanguard', hp: 65, maxHp: 65, damage: 18, speed: 14, element: Element.EARTH, spritePath: 'assets/sprites/orc_grunt.png', cols: 4, rows: 5, width: 2.0, height: 2.5, xp: 45 }
    ];
  }

  STATE.phase = 'battle';
  if (document.pointerLockElement) {
    try { document.exitPointerLock(); } catch (e) {}
  }

  battleSystem.startBattle(squad, isFirstStrike, isAmbush, (isVictory, isWiped) => {
    if (isVictory) {
      overworldEnemy.dead = true;
      if (overworldEnemy.mesh) overworldEnemy.mesh.visible = false;
      enemies._onEnemyDied(overworldEnemy);

      if (overworldEnemy.isBoss || squad.some(e => e.isBoss)) {
        onBossDefeated();
      }

      player.camera.position.copy(savedPlayerPos);
      player.yaw = savedPlayerYaw;
      player.pitch = savedPlayerPitch;
      player.camera.rotation.set(savedPlayerPitch, savedPlayerYaw, 0, 'YXZ');
      STATE.phase = 'playing';
    } else if (isWiped) {
      player.respawn();
      party.restAtShrine();
      spawnWorldEncounters();
      STATE.phase = 'playing';
      if (hud && typeof hud.showCheckpointBanner === 'function') {
        hud.showCheckpointBanner();
        const bTxt = document.querySelector('#checkpoint-banner .banner-text');
        const bSub = document.querySelector('#checkpoint-banner .banner-sub');
        if (bTxt) bTxt.textContent = '💀 PARTY RESURRECTED';
        if (bSub) bSub.textContent = 'Returned to Shrine · Foes Resurgent';
      }
    } else {
      const backDir = player.getForwardDir().multiplyScalar(-2.5);
      player.camera.position.add(backDir);
      player.camera.rotation.set(savedPlayerPitch, savedPlayerYaw, 0, 'YXZ');
      STATE.phase = 'playing';
    }
  });
}

function spawnWorldEncounters() {
  enemies.clear();

  // ── Floor 1: Crypt of the Damned (Y = 0) ──
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2.5, 0, 26), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2.5, 0, 34), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-2, 0, 42), player, camera);

  // ── Floor 2: Sunken Aqueducts (Y = 4) ──
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(3, 5.2, 74), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-3, 5.2, 82), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(0, 4, 92), player, camera);

  // ── Floor 3: Smoldering Forges (Y = 8) ──
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-4, 8, 126), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(4, 8, 132), player, camera);
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(0, 8, 142), player, camera);

  // ── Floor 4: Gale Spire (Y = 12) ──
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(-3, 13.2, 176), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(4, 12, 184), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-4, 12, 196), player, camera);

  // ── Floor 5: Throne of the Wizard King (Y = 16) ──
  enemies.spawnEnemy(DeathKnight, new THREE.Vector3(0, 16, 242), player, camera);

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

  // Proximity body encounter check
  if (STATE.phase === 'playing') {
    for (const e of enemies.getAll()) {
      if (!e.dead && e.mesh) {
        const dist = camera.position.distanceTo(e.mesh.position);
        if (dist <= 1.8) {
          triggerEncounter(e, false, true); // Ambush on touch!
          break;
        }
      }
    }
  }

  // Boss Arena trigger (Z >= 158)
  if (!STATE.bossTriggered && pz >= 158 && px >= -8 && px <= 18) {
    STATE.bossTriggered = true;
    map.sealBossArena();
    player.setWalls(map.walls); // Update walls with fog gate
    enemies.setWalls(map.walls);
    player.weapons.inject(enemies, particles, map.walls);
    audio.setMusicState('boss');
    audio.playSFX('bossRoar', 1.2);
    document.getElementById('boss-bar').classList.remove('hidden');
  }

  // Update room label in HUD based on spatial location
  let areaName = 'FLOOR 1: CRYPT OF THE DAMNED';
  if (pz < 48) { areaName = 'FLOOR 1: CRYPT OF THE DAMNED'; }
  else if (pz < 100) { areaName = 'FLOOR 2: SUNKEN AQUEDUCTS'; }
  else if (pz < 150) { areaName = 'FLOOR 3: SMOLDERING FORGES'; }
  else if (pz < 204) { areaName = 'FLOOR 4: GALE SPIRE'; }
  else { areaName = 'FLOOR 5: THRONE OF WIZARD KING'; }

  const infoEl = document.getElementById('room-info');
  if (infoEl) infoEl.textContent = `${areaName} · ELEVATION Y=${Math.round(py)}`;;

  // Interaction prompt check
  let nearInteractable = false;
  let promptLabel = 'INTERACT';
  for (const item of map.interactables) {
    if (item.active && camera.position.distanceTo(item.position) <= (item.radius || 2.5)) {
      nearInteractable = true;
      if (item === map.interactables[0]) promptLabel = 'OPEN CHEST [E]';
      else if (item === map.interactables[1]) promptLabel = 'REST AT SHRINE [E]';
      else if (item === map.interactables[2]) promptLabel = 'PULL LEVER [E]';
      break;
    }
  }
  if (nearInteractable) hud.showInteractPrompt(promptLabel);
  else hud.hideInteractPrompt();
}

function onBossDefeated() {
  STATE.bossDefeated = true;
  addScore(5000);
  audio.playSFX('roomClear');
  audio.setMusicState('explore');

  setTimeout(() => {
    STATE.phase = 'victory';
    document.exitPointerLock();
    save.clear();
    document.getElementById('vic-score-val').textContent = STATE.score;
    document.getElementById('victory-screen').classList.remove('hidden');
  }, 2200);
}

function onPlayerDead() {
  if (STATE.phase === 'dead') return;
  STATE.phase = 'dead';
  document.exitPointerLock();

  setTimeout(() => {
    document.getElementById('go-score-val').textContent = STATE.score;
    document.getElementById('go-room-val').textContent = 'Shrine of Ash';
    document.getElementById('game-over').classList.remove('hidden');
  }, 1200);
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

document.getElementById('btn-save').addEventListener('click', () => {
  if (player) {
    const pz = camera.position.z;
    const px = camera.position.x;
    let roomNum = 1;
    if (pz < 18) roomNum = 1;
    else if (pz < 44) roomNum = 2;
    else if (pz < 68 && px >= -10) roomNum = 3;
    else if (px < -10 && pz < 76) roomNum = 4;
    else if (px < -6 && pz >= 76) roomNum = 5;
    else if (pz >= 70 && pz < 125) roomNum = 6;
    else if (pz < 156) roomNum = 7;
    else roomNum = 8;

    save.save({
      character: STATE.character,
      health: player.health,
      stamina: player.stamina,
      mana: player.mana,
      checkpointPos: player.checkpointPos,
      score: STATE.score,
      room: roomNum,
    });
    const status = document.getElementById('save-status');
    status.textContent = '✓ Progress Saved at Checkpoint';
    setTimeout(() => { status.textContent = ''; }, 2000);
  }
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
  } else if (STATE.phase === 'battle') {
    while (accumulator >= FIXED_DT) {
      particles.update(FIXED_DT);
      accumulator -= FIXED_DT;
      didUpdate = true;
    }
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
  get party() { return party; },
  get battleSystem() { return battleSystem; },
  get battleArena() { return battleArena; },
  get battleUI() { return battleUI; },
  triggerEncounter,
  get player() { return player; },
  get map()    { return map; },
  get enemies(){ return enemies; },
  get audio()  { return audio; },
  get hud()    { return hud; },
  startGame: (charType = 'warrior') => {
    menu.onStartGame(charType);
  },
  setPosition: (x, y, z) => {
    if (player) {
      camera.position.set(x, y, z);
      camera.updateMatrixWorld();
    }
  },
  lookAt: (x, z) => {
    if (player) {
      player.lookAt(x, z);
    }
  },
  triggerDamage: (amount, sourcePos = null) => {
    if (player) player.takeDamage(amount, sourcePos);
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
