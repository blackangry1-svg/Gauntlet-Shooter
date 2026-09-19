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
import { OrcGrunt, SkeletonArcher, StoneGolem, DeathBat, DeathKnight } from './enemies/Enemy.js';
import { ParticleSystem } from './combat/ParticleSystem.js';
import { MainMenu } from './ui/MainMenu.js';

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
let player      = null;

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

  audio.startMusic();
  audio.setMusicState('explore');

  // Instantiate player
  player = new Player(camera, scene, input, audio, charType);
  if (fromSave && savedData) {
    player.health  = savedData.health ?? player.health;
    player.stamina = savedData.stamina ?? player.stamina;
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
  player.weapons.inject(enemies, particles);

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

  // Pointer lock handling
  const ctp = document.getElementById('click-to-play');
  ctp.onclick = () => canvas.requestPointerLock();

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      ctp.classList.add('hidden');
    } else if (STATE.phase === 'playing') {
      ctp.classList.remove('hidden');
    }
  });
}

function spawnWorldEncounters() {
  enemies.clear();

  // Area 2: Hall of the Damned (Z: 24..38)
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-2.5, 0, 26), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(2.5, 0, 34), player, camera);

  // Area 4: Sunken Vault (X: -26..-12, Z: 54..70)
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-24, 0, 60), player, camera);
  enemies.spawnEnemy(SkeletonArcher, new THREE.Vector3(-16, 0, 68), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(-20, 0, 56), player, camera);

  // Area 6: High Ramparts (Stone Golem Elite guarding shortcut lever)
  enemies.spawnEnemy(StoneGolem, new THREE.Vector3(5, 0, 106), player, camera);

  // Area 7: Blood Cloister (Bats & Grunt leading to boss)
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(2, 1.2, 134), player, camera);
  enemies.spawnEnemy(DeathBat, new THREE.Vector3(8, 1.2, 142), player, camera);
  enemies.spawnEnemy(OrcGrunt, new THREE.Vector3(5, 0, 148), player, camera);

  // Area 8: Boss Arena (Death Knight)
  enemies.spawnEnemy(DeathKnight, new THREE.Vector3(5, 0, 185), player, camera);

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

  // Boss Arena trigger (Z >= 158)
  if (!STATE.bossTriggered && pz >= 158 && px >= -8 && px <= 18) {
    STATE.bossTriggered = true;
    map.sealBossArena();
    player.setWalls(map.walls); // Update walls with fog gate
    audio.setMusicState('boss');
    audio.playSFX('bossRoar', 1.2);
    document.getElementById('boss-bar').classList.remove('hidden');
  }

  // Update room label in HUD based on spatial location
  let areaName = 'CRYPT ENTRANCE';
  let roomNum = 1;
  if (pz < 18) { areaName = 'CRYPT ENTRANCE'; roomNum = 1; }
  else if (pz < 44) { areaName = 'HALL OF DAMNED'; roomNum = 2; }
  else if (pz < 68 && px >= -10) { areaName = 'CATACOMB JUNCTION'; roomNum = 3; }
  else if (px < -10 && pz < 76) { areaName = 'SUNKEN VAULT'; roomNum = 4; }
  else if (px < -6 && pz >= 76) { areaName = 'SHRINE OF ASH'; roomNum = 5; }
  else if (pz >= 70 && pz < 125) { areaName = 'HIGH RAMPARTS'; roomNum = 6; }
  else if (pz < 156) { areaName = 'BLOOD CLOISTER'; roomNum = 7; }
  else { areaName = 'THRONE OF DEATH'; roomNum = 8; }

  const infoEl = document.getElementById('room-info');
  if (infoEl) infoEl.textContent = `${areaName} · SECTOR ${roomNum}/8`;

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
// UI BUTTONS
// ─────────────────────────────────────────────────────────────
document.getElementById('btn-resume').addEventListener('click', () => {
  STATE.phase = 'playing';
  document.getElementById('pause-menu').classList.add('hidden');
  canvas.requestPointerLock();
});

document.getElementById('btn-save').addEventListener('click', () => {
  if (player) {
    save.save({
      character: STATE.character,
      health: player.health,
      stamina: player.stamina,
      checkpointPos: player.checkpointPos,
      score: STATE.score,
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
    // Escape key pause
    if (input.justPressed('Escape') && document.pointerLockElement === canvas) {
      STATE.phase = 'paused';
      document.exitPointerLock();
      document.getElementById('pause-menu').classList.remove('hidden');
    }

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
    hud.drawMinimap(map, enemies, camera.position);
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
  triggerDamage: (amount) => {
    if (player) player.takeDamage(amount);
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
  triggerInteract: () => {
    if (player) {
      input._pressed.add('KeyE');
    }
  },
  respawn: respawnPlayer,
};
