/**
 * Player.js — Souls-Doom First Person Player Controller
 * Deliberate movement, stamina management, dodge timing, attack commitment,
 * blocking, guard break, healing charges, and robust collision.
 */
import { Weapons } from './Weapons.js';

const PLAYER_HEIGHT  = 1.7;
const PLAYER_SPEED   = 4.8;
const SPRINT_SPEED   = 7.2;
const DODGE_SPEED    = 13.0;
const MOUSE_SENS     = 0.002;
const MAX_PITCH      = Math.PI / 2 - 0.05;

const CHAR_STATS = {
  warrior:  { hp: 160, stamina: 110, mana: 50,  speed: 4.8, weapons: ['sword', 'shield'] },
  elf:      { hp: 100, stamina: 120, mana: 90,  speed: 5.6, weapons: ['bow', 'sword'] },
  wizard:   { hp: 90,  stamina: 90,  mana: 140, speed: 4.8, weapons: ['staff', 'sword'] },
  valkyrie: { hp: 130, stamina: 100, mana: 80,  speed: 5.2, weapons: ['spear', 'sword'] },
};

export class Player {
  constructor(camera, scene, input, audio, charType = 'warrior') {
    this.camera = camera;
    this.scene  = scene;
    this.input  = input;
    this.audio  = audio;
    this.charType = charType;

    const stats = CHAR_STATS[charType] || CHAR_STATS.warrior;
    this.maxHealth  = stats.hp;
    this.health     = stats.hp;
    this.maxStamina = stats.stamina;
    this.stamina    = stats.stamina;
    this.staminaRegen = 38; // units per second
    this.staminaRegenDelay = 0.7; // delay after spending stamina
    this._staminaTimer = 0;

    this.maxMana    = stats.mana;
    this.mana       = stats.mana;
    this.manaRegen  = 8;
    this.baseSpeed  = stats.speed || PLAYER_SPEED;

    // Healing charges (Souls Soul Flask)
    this.maxFlasks  = 3;
    this.flasks     = 3;
    this.flaskHealAmount = 55;

    // Camera & orientation (starts facing down the dungeon along +Z)
    this.yaw   = Math.PI;
    this.pitch = 0;
    camera.rotation.order = 'YXZ';
    camera.position.set(0, PLAYER_HEIGHT, 0);

    // Movement & Dodge
    this._velocity = new THREE.Vector3();
    this._moveDir  = new THREE.Vector3();
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeDuration = 0.35;
    this._dodgeDir = new THREE.Vector3();

    // Blocking & Stun
    this.isBlocking = false;
    this.isStunned  = false;
    this.stunTimer  = 0;

    // Bobbing & Audio
    this._bobT = 0;
    this._footstepT = 0;
    this._footstepInterval = 0.42;

    // Weapons subsystem
    this.weapons = new Weapons(scene, camera, input, audio, stats.weapons, charType);
    this.weapons.player = this;

    // Invulnerability frames (iframes)
    this._iframes = 0;

    // UI overlays
    this._hitFlash = document.getElementById('hit-flash');
    this._damageVignette = document.getElementById('damage-vignette');

    // Wall collision list
    this.walls = [];
    this.interactables = [];
    this.checkpointPos = new THREE.Vector3(0, PLAYER_HEIGHT, 2);
  }

  setWalls(walls) {
    this.walls = Array.isArray(walls) ? walls : [];
  }

  setInteractables(interactables) {
    this.interactables = Array.isArray(interactables) ? interactables : [];
  }

  lookAt(targetX, targetZ) {
    const dx = targetX - this.camera.position.x;
    const dz = targetZ - this.camera.position.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = 0;
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  consumeStamina(amount) {
    if (this.stamina < amount) return false;
    this.stamina = Math.max(0, this.stamina - amount);
    this._staminaTimer = this.staminaRegenDelay;
    return true;
  }

  hasStamina(amount) {
    return this.stamina >= amount;
  }

  takeDamage(amount, sourcePos = null) {
    if (this._iframes > 0) return; // Perfect dodge or iframe

    // Check block
    if (this.isBlocking && !this.isStunned) {
      const isFrontal = this._isDamageFrontal(sourcePos);
      if (isFrontal) {
        const stamCost = amount * 0.45;
        if (this.stamina >= stamCost) {
          this.consumeStamina(stamCost);
          this.health = Math.max(0, this.health - (amount * 0.25));
          this.audio.playSFX('block');
          this._flashHurt(40);
          return;
        } else {
          // Guard break!
          this.stamina = 0;
          this.guardBreak();
          this.health = Math.max(0, this.health - amount);
          this._flashHurt(100);
          return;
        }
      }
    }

    // Direct hit
    this.health = Math.max(0, this.health - amount);
    this._iframes = 0.35;
    this._flashHurt(80);
    this.audio.playSFX('playerHurt');
  }

  guardBreak() {
    this.isStunned = true;
    this.stunTimer = 0.9;
    this.isBlocking = false;
    this.audio.playSFX('guardBreak');
  }

  _isDamageFrontal(sourcePos) {
    if (!sourcePos) return true;
    const forward = this.getForwardDir();
    const toSource = new THREE.Vector3().subVectors(sourcePos, this.camera.position).normalize();
    return forward.dot(toSource) > 0.1;
  }

  _flashHurt(duration) {
    if (this._hitFlash) {
      this._hitFlash.classList.add('flash');
      setTimeout(() => this._hitFlash?.classList.remove('flash'), duration);
    }
    if (this._damageVignette) {
      this._damageVignette.classList.add('hurt');
      setTimeout(() => this._damageVignette?.classList.remove('hurt'), 500);
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  useFlask() {
    if (this.flasks <= 0 || this.health >= this.maxHealth) return false;
    this.flasks--;
    this.heal(this.flaskHealAmount);
    this.audio.playSFX('pickup');
    return true;
  }

  restAtCheckpoint(pos) {
    this.checkpointPos.copy(pos);
    this.health  = this.maxHealth;
    this.stamina = this.maxStamina;
    this.flasks  = this.maxFlasks;
    this.audio.playSFX('bonfireRest');
  }

  respawn() {
    this.camera.position.copy(this.checkpointPos);
    this.health  = this.maxHealth;
    this.stamina = this.maxStamina;
    this.flasks  = this.maxFlasks;
    this.isDodging = false;
    this.isStunned = false;
    this._iframes = 0;
  }

  update(dt) {
    // Iframes
    if (this._iframes > 0) this._iframes -= dt;

    // Stun state
    if (this.isStunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) this.isStunned = false;
    }

    // Mouse look
    if (document.pointerLockElement) {
      this.yaw   -= this.input.mouseX * MOUSE_SENS;
      this.pitch -= this.input.mouseY * MOUSE_SENS;
      this.pitch  = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    }
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Flask healing key (Q)
    if (this.input.useFlask) {
      this.useFlask();
    }

    // Interaction key (E / F)
    if (this.input.interact) {
      this._checkInteraction();
    }

    // Blocking (Hold Right Mouse Button)
    this.isBlocking = !this.isStunned && !this.isDodging && this.input.mouseDown(2) && this.stamina > 5;

    // Movement calculation
    const fw = this.input.moveForward  ? 1 : (this.input.moveBackward ? -1 : 0);
    const rt = this.input.moveRight    ? 1 : (this.input.moveLeft     ? -1 : 0);
    const isTryingMove = (fw !== 0 || rt !== 0);

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    this._moveDir.set(
      rt * cosY - fw * sinY,
      0,
      rt * sinY + fw * cosY
    );
    if (this._moveDir.lengthSq() > 0) this._moveDir.normalize();

    // Dodge execution (Space)
    if (!this.isDodging && !this.isStunned && this.input.dodge && this.consumeStamina(22)) {
      this.isDodging = true;
      this.dodgeTimer = this.dodgeDuration;
      this._iframes = 0.25; // 250ms invulnerability window
      if (isTryingMove) {
        this._dodgeDir.copy(this._moveDir);
      } else {
        // Dodge backward if stationary
        this._dodgeDir.set(sinY, 0, -cosY).normalize();
      }
      this.audio.playSFX('dodge');
    }

    // Movement physics
    let speed = this.baseSpeed;
    if (this.isDodging) {
      speed = DODGE_SPEED;
      this.dodgeTimer -= dt;
      if (this.dodgeTimer <= 0) this.isDodging = false;
    } else if (this.isBlocking) {
      speed = this.baseSpeed * 0.45;
    } else if (this.input.sprint && this.consumeStamina(15 * dt)) {
      speed = SPRINT_SPEED;
    }

    const currentMoveDir = this.isDodging ? this._dodgeDir : this._moveDir;
    const moveDist = (this.isDodging || isTryingMove) ? speed * dt : 0;

    const newPos = this.camera.position.clone();
    newPos.x += currentMoveDir.x * moveDist;
    newPos.z += currentMoveDir.z * moveDist;

    // Wall collision resolution (sliding against AABB walls)
    newPos.x = this._resolveX(this.camera.position, newPos);
    newPos.z = this._resolveZ(this.camera.position, newPos);
    this.camera.position.copy(newPos);
    this.camera.position.y = PLAYER_HEIGHT;

    // Head bob & footsteps
    if (isTryingMove && !this.isDodging) {
      this._bobT += dt * (this.input.sprint ? 14 : 9);
      this.camera.position.y = PLAYER_HEIGHT + Math.sin(this._bobT) * 0.04;

      this._footstepT -= dt;
      if (this._footstepT <= 0) {
        this.audio.playSFX('footstep', 0.35);
        this._footstepT = this._footstepInterval / (this.input.sprint ? 1.5 : 1.0);
      }
    } else {
      this._footstepT = 0;
    }

    // Stamina Regeneration (delayed after use)
    if (this._staminaTimer > 0) {
      this._staminaTimer -= dt;
    } else if (!this.isBlocking && this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * dt);
    }

    // Mana Regeneration
    if (this.mana < this.maxMana) {
      this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);
    }

    // Weapons update
    this.weapons.update(dt);
  }

  _checkInteraction() {
    const playerPos = this.camera.position;
    for (const item of this.interactables) {
      if (item.active && item.position) {
        const dist = playerPos.distanceTo(item.position);
        if (dist <= (item.radius || 2.5)) {
          item.onInteract(this);
          break;
        }
      }
    }
  }

  _resolveX(oldPos, newPos) {
    const r = 0.35; // collision radius
    for (const wall of this.walls) {
      const minX = wall.x - wall.w / 2 - r;
      const maxX = wall.x + wall.w / 2 + r;
      const minZ = wall.z - wall.d / 2 - r;
      const maxZ = wall.z + wall.d / 2 + r;
      if (newPos.x > minX && newPos.x < maxX && oldPos.z > minZ && oldPos.z < maxZ) {
        return oldPos.x;
      }
    }
    return newPos.x;
  }

  _resolveZ(oldPos, newPos) {
    const r = 0.35;
    for (const wall of this.walls) {
      const minX = wall.x - wall.w / 2 - r;
      const maxX = wall.x + wall.w / 2 + r;
      const minZ = wall.z - wall.d / 2 - r;
      const maxZ = wall.z + wall.d / 2 + r;
      if (newPos.z > minZ && newPos.z < maxZ && newPos.x > minX && newPos.x < maxX) {
        return oldPos.z;
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
