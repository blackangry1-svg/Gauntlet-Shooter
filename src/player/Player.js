/**
 * Player.js — FPS Player Controller
 * WASD movement + mouse look + weapon system
 * Collision against map walls via AABB
 */
import { Weapons } from './Weapons.js';

const PLAYER_HEIGHT  = 1.7;
const PLAYER_SPEED   = 5.0;
const SPRINT_SPEED   = 8.5;
const MOUSE_SENS     = 0.002;
const MAX_PITCH      = Math.PI / 2 - 0.05;

// Character base stats
const CHAR_STATS = {
  warrior:  { hp: 150, mana: 60,  speed: 4.5, weapons: ['sword', 'shield'] },
  elf:      { hp: 90,  mana: 100, speed: 6.0, weapons: ['bow', 'sword'] },
  wizard:   { hp: 75,  mana: 150, speed: 5.0, weapons: ['staff', 'sword'] },
  valkyrie: { hp: 120, mana: 80,  speed: 5.5, weapons: ['spear', 'sword'] },
};

export class Player {
  constructor(camera, scene, input, audio, charType) {
    this.camera = camera;
    this.scene  = scene;
    this.input  = input;
    this.audio  = audio;
    this.charType = charType;

    const stats = CHAR_STATS[charType] || CHAR_STATS.warrior;
    this.maxHealth = stats.hp;
    this.maxMana   = stats.mana;
    this.baseSpeed = stats.speed;
    this.health    = stats.hp;
    this.mana      = stats.mana;
    this.manaRegen = 8; // per second

    // Camera state
    this.yaw   = 0;
    this.pitch = 0;
    camera.rotation.order = 'YXZ';
    camera.position.set(2, PLAYER_HEIGHT, 2);

    // Movement
    this._velocity = new THREE.Vector3();
    this._moveDir  = new THREE.Vector3();

    // Bobbing
    this._bobT = 0;
    this._bobBase = PLAYER_HEIGHT;

    // Footstep timer
    this._footstepT = 0;
    this._footstepInterval = 0.4;

    // Weapons
    this.weapons = new Weapons(scene, camera, input, audio, stats.weapons, charType);

    // Invincibility frames after being hit
    this._iframes = 0;

    // Damage flash el
    this._hitFlash = document.getElementById('hit-flash');
    this._damageVignette = document.getElementById('damage-vignette');

    // Collision AABB (set from MapLoader via setWalls)
    this.walls = [];
  }

  setWalls(walls) {
    this.walls = walls;
  }

  takeDamage(amount) {
    if (this._iframes > 0) return;
    this.health = Math.max(0, this.health - amount);
    this._iframes = 0.4; // 400ms invincibility

    // Flash red
    this._hitFlash.classList.add('flash');
    this._damageVignette.classList.add('hurt');
    setTimeout(() => {
      this._hitFlash.classList.remove('flash');
    }, 80);
    setTimeout(() => {
      this._damageVignette.classList.remove('hurt');
    }, 600);

    this.audio.playSFX('playerHurt');
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  update(dt) {
    if (this._iframes > 0) this._iframes -= dt;

    // Mouse look (only when pointer locked)
    if (document.pointerLockElement) {
      this.yaw   -= this.input.mouseX * MOUSE_SENS;
      this.pitch -= this.input.mouseY * MOUSE_SENS;
      this.pitch  = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    }

    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Movement
    const speed  = this.input.sprint ? SPRINT_SPEED : this.baseSpeed;
    const fw = this.input.moveForward  ? 1 : (this.input.moveBackward ? -1 : 0);
    const rt = this.input.moveRight    ? 1 : (this.input.moveLeft     ? -1 : 0);
    const isMoving = (fw !== 0 || rt !== 0);

    // Direction relative to yaw only
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);

    this._moveDir.set(
      rt * cosY - fw * sinY,
      0,
      rt * sinY + fw * cosY
    );

    if (this._moveDir.lengthSq() > 0) {
      this._moveDir.normalize();
    }

    const moveDist = speed * dt;
    const newPos = this.camera.position.clone();
    newPos.x += this._moveDir.x * moveDist;
    newPos.z += this._moveDir.z * moveDist;

    // Wall collision
    newPos.x = this._resolveX(this.camera.position, newPos);
    newPos.z = this._resolveZ(this.camera.position, newPos);
    this.camera.position.copy(newPos);
    this.camera.position.y = PLAYER_HEIGHT;

    // Head bob
    if (isMoving) {
      this._bobT += dt * (this.input.sprint ? 14 : 9);
      const bobY = Math.sin(this._bobT) * 0.04;
      this.camera.position.y = PLAYER_HEIGHT + bobY;
    }

    // Footstep sounds
    if (isMoving) {
      this._footstepT -= dt;
      if (this._footstepT <= 0) {
        this.audio.playSFX('footstep', 0.4);
        this._footstepT = this._footstepInterval / (this.input.sprint ? 1.5 : 1);
      }
    } else {
      this._footstepT = 0;
    }

    // Mana regen
    if (this.mana < this.maxMana) {
      this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);
    }

    // Weapons
    this.weapons.update(dt);
  }

  // Resolve X movement against wall AABBs
  _resolveX(oldPos, newPos) {
    const r = 0.3; // player radius
    for (const wall of this.walls) {
      const minX = wall.x - wall.w / 2 - r;
      const maxX = wall.x + wall.w / 2 + r;
      const minZ = wall.z - wall.d / 2 - r;
      const maxZ = wall.z + wall.d / 2 + r;
      if (newPos.x > minX && newPos.x < maxX && oldPos.z > minZ && oldPos.z < maxZ) {
        return oldPos.x; // block X
      }
    }
    return newPos.x;
  }

  _resolveZ(oldPos, newPos) {
    const r = 0.3;
    for (const wall of this.walls) {
      const minX = wall.x - wall.w / 2 - r;
      const maxX = wall.x + wall.w / 2 + r;
      const minZ = wall.z - wall.d / 2 - r;
      const maxZ = wall.z + wall.d / 2 + r;
      if (newPos.z > minZ && newPos.z < maxZ && newPos.x > minX && newPos.x < maxX) {
        return oldPos.z; // block Z
      }
    }
    return newPos.z;
  }

  getForwardDir() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }
}
