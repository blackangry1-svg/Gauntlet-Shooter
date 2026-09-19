/**
 * Enemy.js — Billboard Sprite Enemy Base + All Enemy Archetypes
 * Pre-rendered 3D sprite billboard presentation with clean transparent alpha,
 * UV sprite sheet frame animation, readable attack telegraphs, active strike frames,
 * and vulnerable punish recovery windows.
 */

// Shared Texture Cache for zero redundant memory
const TEXTURE_CACHE = new Map();

function getOrCreateSpriteTexture(path) {
  if (TEXTURE_CACHE.has(path)) {
    return TEXTURE_CACHE.get(path);
  }
  const loader = new THREE.TextureLoader();
  const tex = loader.load(path);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  TEXTURE_CACHE.set(path, tex);
  return tex;
}

export class Enemy {
  constructor(scene, audio, config) {
    this.scene  = scene;
    this.audio  = audio;

    this.enemyType      = config.type    || 'orc';
    this.maxHealth      = config.hp      || 50;
    this.health         = this.maxHealth;
    this.speed          = config.speed   || 2.4;
    this.damage         = config.damage  || 12;
    this.attackRange    = config.range   || 2.2;
    this.detectRange    = config.detect  || 18;
    this.telegraphTime  = config.telegraph || 0.45;
    this.recoverTime    = config.recover || 0.6;
    this.attackCooldown = config.atkCD   || 1.5;
    this.scoreValue     = config.score   || 100;
    this.isBoss         = false;

    // Sprite sheet grid definition
    this.sheetRows = config.rows || 6;
    this.sheetCols = config.cols || 6;
    this.animSets  = config.anims || {
      idle:    { row: 0, count: 6, speed: 6 },
      chase:   { row: 2, count: 6, speed: 9 },
      windup:  { row: 4, count: 3, speed: 5 },
      attack:  { row: 4, count: 6, speed: 12 },
      recover: { row: 0, count: 1, speed: 1 },
      dead:    { row: 5, count: 6, speed: 6 },
    };

    // AI State: 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'stagger' | 'dead'
    this.state       = 'idle';
    this._stateT     = 0;
    this._cooldownT  = 0;
    this._animFrame  = 0;
    this._animTimer  = 0;
    this._hitTimer   = 0;
    this.dead        = false;

    this.player = null;
    this.camera = null;
    this.onDeath = null;

    // Build billboard mesh with cloned texture for independent UV offsets
    this._buildMesh(config.size || 1.6, config.spritePath, config.color || 0x228833);
    this.setAnimation('idle');
  }

  _buildMesh(size, spritePath, fallbackColor) {
    this.mesh = new THREE.Group();

    if (spritePath) {
      const masterTex = getOrCreateSpriteTexture(spritePath);
      this.tex = masterTex.clone();
      this.tex.repeat.set(1 / this.sheetCols, 1 / this.sheetRows);

      this.material = new THREE.MeshLambertMaterial({
        map: this.tex,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true,
      });
    } else {
      this.material = new THREE.MeshLambertMaterial({
        color: fallbackColor,
        side: THREE.DoubleSide,
      });
    }

    const spriteGeo = new THREE.PlaneGeometry(size, size * 1.35);
    this.spriteMesh = new THREE.Mesh(spriteGeo, this.material);
    this.spriteMesh.position.y = (size * 1.35) / 2;
    this.spriteMesh.userData.isSprite = true;
    this.mesh.add(this.spriteMesh);

    // Hitbox cylinder approximation — transparent 0 opacity so Raycaster can intersect it
    const hitGeo = new THREE.CylinderGeometry(size * 0.45, size * 0.45, size * 1.4, 8);
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.hitbox = new THREE.Mesh(hitGeo, hitMat);
    this.hitbox.position.y = (size * 1.4) / 2;
    this.hitbox.userData.isHitbox = true;
    this.mesh.add(this.hitbox);

    // Ground shadow blob
    const shadowGeo = new THREE.PlaneGeometry(size * 0.8, size * 0.45);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.mesh.add(shadow);
  }

  setAnimation(animName) {
    if (this._currentAnim === animName) return;
    this._currentAnim = animName;
    this._animFrame = 0;
    this._animTimer = 0;
    this._updateUV();
  }

  _updateUV() {
    if (!this.tex) return;
    const def = this.animSets[this._currentAnim] || this.animSets.idle;
    const row = Math.min(this.sheetRows - 1, def.row);
    const col = this._animFrame % (def.count || 1);

    this.tex.offset.x = col / this.sheetCols;
    this.tex.offset.y = (this.sheetRows - 1 - row) / this.sheetRows;
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.health -= amount;
    this._hitTimer = 0.15;

    // Emissive flash
    if (this.material) {
      this.material.emissive = new THREE.Color(1, 0.4, 0.4);
      this.material.emissiveIntensity = 1.2;
    }

    if (this.health <= 0) {
      this._die();
    } else if (this.state === 'idle') {
      this.state = 'chase';
      this.setAnimation('chase');
    }
  }

  _die() {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.setAnimation('dead');

    // Fade and sink
    let t = 0;
    const startY = this.mesh.position.y;
    const interval = setInterval(() => {
      t += 0.05;
      if (this.material) this.material.opacity = Math.max(0, 1 - t);
      this.mesh.position.y = startY - t * 0.4;
      if (t >= 1.0) {
        clearInterval(interval);
        this.dispose();
      }
    }, 20);

    if (this.onDeath) this.onDeath();
  }

  update(dt, playerPos) {
    if (this.dead) return;

    // Billboard: face camera
    if (this.camera) {
      this.mesh.lookAt(this.camera.position.x, this.mesh.position.y, this.camera.position.z);
    }

    // Hit flash decay
    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      if (this._hitTimer <= 0 && this.material) {
        if (this.state === 'windup') {
          // Keep telegraph glow
          this.material.emissive = new THREE.Color(1, 0.6, 0.1);
          this.material.emissiveIntensity = 1.0;
        } else {
          this.material.emissiveIntensity = 0;
        }
      }
    }

    // Frame animation timer
    const def = this.animSets[this._currentAnim] || this.animSets.idle;
    this._animTimer += dt * (def.speed || 6);
    if (this._animTimer >= 1.0) {
      this._animTimer -= 1.0;
      this._animFrame = (this._animFrame + 1) % def.count;
      this._updateUV();
    }

    // Cooldown
    if (this._cooldownT > 0) this._cooldownT -= dt;
    this._stateT += dt;

    if (!playerPos) return;
    const distToPlayer = this.mesh.position.distanceTo(playerPos);

    // AI State Machine
    switch (this.state) {
      case 'idle':
        if (distToPlayer < this.detectRange) {
          this.state = 'chase';
          this.setAnimation('chase');
          this._stateT = 0;
        }
        break;

      case 'chase':
        if (distToPlayer <= this.attackRange && this._cooldownT <= 0) {
          // Begin Telegraph / Wind-up phase
          this.state = 'windup';
          this.setAnimation('windup');
          this._stateT = 0;
          this.audio.playSFX('telegraphWarn', 0.6);
          if (this.material) {
            this.material.emissive = new THREE.Color(1, 0.6, 0.1);
            this.material.emissiveIntensity = 1.2;
          }
        } else {
          // Move toward player
          const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
          dir.y = 0;
          if (dir.lengthSq() > 0.01) {
            dir.normalize();
            this.mesh.position.addScaledVector(dir, this.speed * dt);
          }
        }
        break;

      case 'windup':
        // Anticipation / Telegraph window
        if (this._stateT >= this.telegraphTime) {
          // Transition to Active Attack
          this.state = 'attack';
          this.setAnimation('attack');
          this._stateT = 0;
          if (this.material) this.material.emissiveIntensity = 0;
          this._executeAttack(playerPos, distToPlayer);
        }
        break;

      case 'attack':
        // Active strike duration (0.2s)
        if (this._stateT >= 0.22) {
          // Enter Recovery / Punish Window
          this.state = 'recover';
          this.setAnimation('recover');
          this._stateT = 0;
        }
        break;

      case 'recover':
        // Vulnerable recovery state
        if (this._stateT >= this.recoverTime) {
          this.state = 'chase';
          this.setAnimation('chase');
          this._cooldownT = this.attackCooldown;
          this._stateT = 0;
        }
        break;
    }
  }

  _executeAttack(playerPos, dist) {
    if (dist <= this.attackRange * 1.2 && this.player) {
      this.player.takeDamage(this.damage, this.mesh.position);
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    if (this.spriteMesh) {
      this.spriteMesh.geometry.dispose();
      this.spriteMesh.material.dispose();
    }
    if (this.hitbox) {
      this.hitbox.geometry.dispose();
      this.hitbox.material.dispose();
    }
    if (this.tex) {
      this.tex.dispose();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// ENEMY ARCHETYPES
// ─────────────────────────────────────────────────────────────

export class OrcGrunt extends Enemy {
  constructor(scene, audio) {
    super(scene, audio, {
      type: 'orc',
      hp: 60,
      speed: 2.5,
      damage: 16,
      range: 2.2,
      detect: 16,
      telegraph: 0.45,
      recover: 0.55,
      atkCD: 1.4,
      score: 100,
      size: 1.7,
      spritePath: '/assets/sprites/orc_grunt.png',
      rows: 6,
      cols: 6,
      anims: {
        idle:    { row: 0, count: 6, speed: 5 },
        chase:   { row: 2, count: 6, speed: 8 },
        windup:  { row: 4, count: 4, speed: 8 },
        attack:  { row: 4, count: 6, speed: 14 },
        recover: { row: 0, count: 1, speed: 1 },
        dead:    { row: 5, count: 6, speed: 6 },
      }
    });
  }
}

export class SkeletonArcher extends Enemy {
  constructor(scene, audio) {
    super(scene, audio, {
      type: 'archer',
      hp: 45,
      speed: 1.8,
      damage: 18,
      range: 16.0,
      detect: 22,
      telegraph: 0.65,
      recover: 0.85,
      atkCD: 2.2,
      score: 150,
      size: 1.6,
      spritePath: '/assets/sprites/skeleton_archer.png',
      rows: 6,
      cols: 6,
      anims: {
        idle:    { row: 0, count: 6, speed: 4 },
        chase:   { row: 1, count: 6, speed: 6 },
        windup:  { row: 2, count: 4, speed: 6 },
        attack:  { row: 3, count: 6, speed: 12 },
        recover: { row: 0, count: 1, speed: 1 },
        dead:    { row: 5, count: 6, speed: 6 },
      }
    });
  }

  _executeAttack(playerPos, dist) {
    this.audio.playSFX('arrowFire', 0.8);
    // Spawn enemy arrow toward player
    if (this.player) {
      setTimeout(() => {
        if (!this.dead && this.player) {
          const currentDist = this.mesh.position.distanceTo(this.player.camera.position);
          if (currentDist < 25) {
            this.player.takeDamage(this.damage, this.mesh.position);
          }
        }
      }, 250);
    }
  }
}

export class DeathBat extends Enemy {
  constructor(scene, audio) {
    super(scene, audio, {
      type: 'bat',
      hp: 35,
      speed: 4.2,
      damage: 12,
      range: 2.0,
      detect: 20,
      telegraph: 0.32,
      recover: 0.45,
      atkCD: 1.2,
      score: 80,
      size: 1.3,
      spritePath: '/assets/sprites/death_bat.png',
      rows: 6,
      cols: 4,
      anims: {
        idle:    { row: 0, count: 4, speed: 8 },
        chase:   { row: 2, count: 4, speed: 12 },
        windup:  { row: 1, count: 4, speed: 10 },
        attack:  { row: 4, count: 4, speed: 14 },
        recover: { row: 0, count: 1, speed: 1 },
        dead:    { row: 5, count: 4, speed: 8 },
      }
    });
    this.mesh.position.y = 1.2; // flying
  }
}

export class StoneGolem extends Enemy {
  constructor(scene, audio) {
    super(scene, audio, {
      type: 'golem',
      hp: 240,
      speed: 1.6,
      damage: 32,
      range: 2.8,
      detect: 16,
      telegraph: 0.85,
      recover: 1.10,
      atkCD: 2.4,
      score: 400,
      size: 2.4,
      spritePath: '/assets/sprites/stone_golem.png',
      rows: 4,
      cols: 4,
      anims: {
        idle:    { row: 0, count: 4, speed: 4 },
        chase:   { row: 1, count: 4, speed: 5 },
        windup:  { row: 2, count: 3, speed: 4 },
        attack:  { row: 2, count: 4, speed: 8 },
        recover: { row: 0, count: 1, speed: 1 },
        dead:    { row: 3, count: 4, speed: 4 },
      }
    });
  }

  _executeAttack(playerPos, dist) {
    this.audio.playSFX('boom', 1.0);
    super._executeAttack(playerPos, dist);
  }
}

export class DeathKnight extends Enemy {
  constructor(scene, audio) {
    super(scene, audio, {
      type: 'boss',
      hp: 550,
      speed: 2.8,
      damage: 28,
      range: 3.2,
      detect: 30,
      telegraph: 0.65,
      recover: 0.80,
      atkCD: 1.8,
      score: 2500,
      size: 2.6,
      spritePath: '/assets/sprites/death_knight.png',
      rows: 3,
      cols: 6,
      anims: {
        idle:    { row: 0, count: 6, speed: 6 },
        chase:   { row: 0, count: 6, speed: 8 },
        windup:  { row: 1, count: 3, speed: 6 },
        attack:  { row: 1, count: 6, speed: 12 },
        recover: { row: 0, count: 1, speed: 1 },
        dead:    { row: 2, count: 6, speed: 5 },
      }
    });
    this.isBoss = true;
    this.phase = 1;
  }

  update(dt, playerPos) {
    if (this.dead) return;

    // Phase 2 transition at 50% HP
    if (this.phase === 1 && this.health <= this.maxHealth * 0.5) {
      this.phase = 2;
      this.speed = 3.6;
      this.damage = 36;
      this.telegraphTime = 0.45;
      this.recoverTime = 0.55;
      this.audio.playSFX('bossPhase', 1.2);
    }

    super.update(dt, playerPos);
  }

  _executeAttack(playerPos, dist) {
    this.audio.playSFX('heavySwing', 1.0);
    super._executeAttack(playerPos, dist);
  }
}
