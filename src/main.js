/**
 * GAUNTLET LEGENDS SHOOTER
 * main.js — Game Boot & Loop
 * Optimized for Intel UHD integrated graphics
 */

import { InputManager } from './engine/InputManager.js';
import { AudioManager } from './engine/AudioManager.js';
import { SaveManager } from './engine/SaveManager.js';
import { Player } from './player/Player.js';
import { HUD } from './player/HUD.js';
import { MapLoader } from './world/MapLoader.js';
import { EnemyManager } from './enemies/EnemyManager.js';
import { ParticleSystem } from './combat/ParticleSystem.js';
import { MainMenu } from './ui/MainMenu.js';

// ─────────────────────────────────────────────────────────────
// SCENE SETUP
// ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');

// Renderer — tuned for Intel UHD (no MSAA, pixel ratio capped)
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,          // Off for perf on iGPU
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0)); // Cap at 1x
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;                // No real-time shadows
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1.0;

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0608);
scene.fog = new THREE.Fog(0x0a0608, 8, 28);       // Dungeon fog

// Camera (FPS — 75° FOV feels right for a dungeon)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 50);

// Lighting — single directional + ambient only (no shadows)
const ambientLight = new THREE.AmbientLight(0x221810, 0.6);
scene.add(ambientLight);

const torchLight1 = new THREE.PointLight(0xff8833, 1.2, 10);
torchLight1.position.set(0, 2.5, 0);
scene.add(torchLight1);

// Subtle light flicker
let flickerT = 0;
function flickerLights(dt) {
  flickerT += dt * 8;
  torchLight1.intensity = 1.2 + Math.sin(flickerT) * 0.15 + Math.sin(flickerT * 2.3) * 0.08;
}

// ─────────────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────────────
const STATE = {
  phase: 'menu',    // 'menu' | 'playing' | 'paused' | 'dead' | 'victory'
  character: null,
  currentRoom: 0,
  totalRooms: 8,
  score: 0,
  frameCount: 0,
};

// ─────────────────────────────────────────────────────────────
// SYSTEMS
// ─────────────────────────────────────────────────────────────
const input   = new InputManager();
const audio   = new AudioManager();
const save    = new SaveManager();
const hud     = new HUD();
const map     = new MapLoader(scene);
const enemies = new EnemyManager(scene, audio);
const particles = new ParticleSystem(scene);
let player = null;

// ─────────────────────────────────────────────────────────────
// MAIN MENU SETUP
// ─────────────────────────────────────────────────────────────
const menu = new MainMenu(save);
menu.onStartGame = (charType) => {
  STATE.character = charType;
  STATE.phase = 'playing';
  STATE.score = 0;
  STATE.currentRoom = 0;
  startGame(charType, false);
};
menu.onContinue = () => {
  const saved = save.load();
  if (saved) {
    STATE.character = saved.character;
    STATE.currentRoom = saved.room;
    STATE.score = saved.score;
    STATE.phase = 'playing';
    startGame(saved.character, true, saved);
  }
};

// ─────────────────────────────────────────────────────────────
// GAME START
// ─────────────────────────────────────────────────────────────
function startGame(charType, fromSave = false, savedData = null) {
  // Hide menu, show game
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');
  document.getElementById('click-to-play').classList.remove('hidden');

  // Create player
  player = new Player(camera, scene, input, audio, charType);
  if (fromSave && savedData) {
    player.health = savedData.health;
    player.mana   = savedData.mana;
  }

  // Load the first (or saved) room
  loadRoom(STATE.currentRoom);

  // Update HUD portrait
  const icons = { warrior:'🛡️', elf:'🏹', wizard:'🔮', valkyrie:'⚡' };
  document.getElementById('portrait-icon').textContent = icons[charType] || '⚔️';

  // Enable pointer lock on click
  const ctp = document.getElementById('click-to-play');
  ctp.addEventListener('click', () => {
    canvas.requestPointerLock();
  }, { once: false });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      ctp.classList.add('hidden');
    } else {
      if (STATE.phase === 'playing') {
        ctp.classList.remove('hidden');
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// ROOM MANAGEMENT
// ─────────────────────────────────────────────────────────────
function loadRoom(roomIndex) {
  // Clear old geometry
  map.clearRoom();
  enemies.clear();
  particles.clear();

  const isBoss = (roomIndex === STATE.totalRooms - 1);

  // Build room
  map.buildRoom(roomIndex, isBoss);

  // Spawn enemies for this room
  enemies.spawnForRoom(roomIndex, isBoss, player, camera, STATE, () => {
    onRoomCleared(roomIndex);
  });

  // Move torch light to room center
  const roomPos = map.getRoomCenter(roomIndex);
  if (roomPos) {
    torchLight1.position.set(roomPos.x, 2.5, roomPos.z);
  }

  // Update HUD
  hud.setRoom(roomIndex + 1, STATE.totalRooms);
  document.getElementById('room-num').textContent = roomIndex + 1;
  document.getElementById('boss-bar').classList.toggle('hidden', !isBoss);

  // Boss bar hookup
  if (isBoss) {
    enemies.onBossHealthChange = (pct) => {
      document.getElementById('boss-fill').style.width = (pct * 100) + '%';
    };
  }

  // Auto-save on room enter
  save.save({
    character: STATE.character,
    room: roomIndex,
    health: player ? player.health : 100,
    mana:   player ? player.mana   : 80,
    score:  STATE.score,
  });
}

function onRoomCleared(roomIndex) {
  // Show banner
  const banner = document.getElementById('room-clear');
  banner.classList.remove('hidden');

  // Score bonus
  const bonus = (roomIndex + 1) * 500;
  addScore(bonus);
  audio.playSFX('roomClear');

  setTimeout(() => {
    banner.classList.add('hidden');
    const nextRoom = roomIndex + 1;
    if (nextRoom >= STATE.totalRooms) {
      onVictory();
    } else {
      STATE.currentRoom = nextRoom;
      // Teleport player to new room start
      if (player) {
        const startPos = map.getRoomStart(nextRoom);
        if (startPos) camera.position.copy(startPos);
      }
      loadRoom(nextRoom);
    }
  }, 2500);
}

// ─────────────────────────────────────────────────────────────
// SCORE
// ─────────────────────────────────────────────────────────────
function addScore(amount) {
  STATE.score += amount;
  const el = document.getElementById('score-value');
  if (el) el.textContent = String(STATE.score).padStart(6, '0');
}

// Wire score callback on enemies system
enemies.onScore = addScore;


// ─────────────────────────────────────────────────────────────
// DEATH & VICTORY
// ─────────────────────────────────────────────────────────────
function onPlayerDead() {
  if (STATE.phase === 'dead') return;
  STATE.phase = 'dead';

  document.exitPointerLock();
  document.getElementById('click-to-play').classList.add('hidden');

  setTimeout(() => {
    document.getElementById('go-score-val').textContent = STATE.score;
    document.getElementById('go-room-val').textContent = STATE.currentRoom + 1;
    document.getElementById('game-over').classList.remove('hidden');
  }, 1500);
}

function onVictory() {
  STATE.phase = 'victory';
  document.exitPointerLock();
  save.clear();

  setTimeout(() => {
    document.getElementById('vic-score-val').textContent = STATE.score;
    document.getElementById('victory-screen').classList.remove('hidden');
  }, 1000);
}

// ─────────────────────────────────────────────────────────────
// UI BUTTON WIRING
// ─────────────────────────────────────────────────────────────
// Pause
document.getElementById('btn-resume').addEventListener('click', () => {
  STATE.phase = 'playing';
  document.getElementById('pause-menu').classList.add('hidden');
  canvas.requestPointerLock();
});

document.getElementById('btn-save').addEventListener('click', () => {
  if (player) {
    save.save({
      character: STATE.character,
      room: STATE.currentRoom,
      health: player.health,
      mana:   player.mana,
      score:  STATE.score,
    });
    document.getElementById('save-status').textContent = '✓ Saved!';
    setTimeout(() => { document.getElementById('save-status').textContent = ''; }, 2000);
  }
});

document.getElementById('btn-quit').addEventListener('click', () => {
  STATE.phase = 'menu';
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('game-container').classList.add('hidden');
  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('victory-screen').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
  map.clearRoom();
  enemies.clear();
  particles.clear();
  player = null;
});

// Game Over
document.getElementById('btn-retry').addEventListener('click', () => {
  document.getElementById('game-over').classList.add('hidden');
  STATE.phase = 'playing';
  STATE.score = 0;
  STATE.currentRoom = 0;
  player = new Player(camera, scene, input, audio, STATE.character);
  loadRoom(0);
  document.getElementById('click-to-play').classList.remove('hidden');
});
document.getElementById('btn-menu').addEventListener('click', () => {
  document.getElementById('btn-quit').click();
});
document.getElementById('btn-play-again').addEventListener('click', () => {
  document.getElementById('victory-screen').classList.add('hidden');
  document.getElementById('btn-retry').click();
});
document.getElementById('btn-menu2').addEventListener('click', () => {
  document.getElementById('btn-quit').click();
});

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
// GAME LOOP
// ─────────────────────────────────────────────────────────────
let lastTime = performance.now();
const TARGET_DT = 1 / 60;

function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  // Clamp dt to avoid spiral of death on tab-switch
  const dt = Math.min(rawDt, 0.05);

  STATE.frameCount++;

  if (STATE.phase === 'playing' && player) {
    // ESC → pause (only when pointer is locked)
    if (input.justPressed('Escape') && document.pointerLockElement === canvas) {
      STATE.phase = 'paused';
      document.exitPointerLock();
      document.getElementById('pause-menu').classList.remove('hidden');
    }

    if (STATE.phase === 'playing') {
      // Update systems
      player.update(dt);
      // Enemy AI at 20Hz (every 3 frames) to save CPU
      if (STATE.frameCount % 3 === 0) {
        enemies.update(dt * 3, camera.position, STATE.frameCount);
      }
      particles.update(dt);
      flickerLights(dt);

      // Check player dead
      if (player.health <= 0) onPlayerDead();

      // Update HUD bars
      hud.update(player);

      // Update minimap
      hud.drawMinimap(map, enemies, camera.position);
    }
  }

  // Render
  renderer.render(scene, camera);
  input.endFrame();
}

requestAnimationFrame(gameLoop);
