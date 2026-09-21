/**
 * Enemy.js — Billboard Sprite Enemy Base + All Enemy Archetypes
 * Pre-rendered 3D sprite billboard presentation with clean transparent alpha,
 * UV sprite sheet frame animation, readable attack telegraphs, active strike frames,
 * and vulnerable punish recovery windows.
 */

// Shared Image Cache for sprite sheets
const SPRITE_IMAGE_CACHE = new Map();

export function getSharedSpriteImage(path, onReady) {
  let entry = SPRITE_IMAGE_CACHE.get(path);
  if (!entry) {
    entry = { image: null, callbacks: [] };
    SPRITE_IMAGE_CACHE.set(path, entry);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      entry.image = img;
      for (const cb of entry.callbacks) cb(img);
      entry.callbacks.length = 0;
    };
    img.onerror = (e) => {
      console.error('[Enemy] Failed to load sprite texture:', path, e);
      for (const cb of entry.callbacks) cb(null);
      entry.callbacks.length = 0;
    };
    img.src = path;
  }
  if (entry.image) {
    onReady(entry.image);
  } else {
    entry.callbacks.push(onReady);
  }
}

export function preloadEnemyTextures() {
  const paths = [
    '/assets/sprites/orc_grunt.png',
    '/assets/sprites/skeleton_archer.png',
    '/assets/sprites/death_bat.png',
    '/assets/sprites/stone_golem.png',
    '/assets/sprites/death_knight.png',
  ];
  paths.forEach(p => getSharedSpriteImage(p, () => {}));
}

export class Enemy {
  constructor(scene, audio, config, manager = null) {
    this.scene   = scene;
    this.audio   = audio;
    this.manager = manager;

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
    this.xpValue        = config.xp      || Math.round(this.scoreValue * 0.4) || 35;
    this.isBoss         = false;
    this.walls          = [];
    this.enemyRadius    = (config.size || 1.6) * 0.35;

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

  setWalls(walls) {
    this.walls = Array.isArray(walls) ? walls : [];
  }

  setFloorRamps(ramps) {
    this.floorRamps = Array.isArray(ramps) ? ramps : [];
  }

  getGroundY(x, z) {
    if (!this.floorRamps || this.floorRamps.length === 0) return this.mesh.position.y;
    let bestY = 0;
    let found = false;
    for (const r of this.floorRamps) {
      if (x >= r.minX - 0.6 && x <= r.maxX + 0.6 && z >= r.minZ - 0.6 && z <= r.maxZ + 0.6) {
        let groundY = r.y !== undefined ? r.y : 0;
        if (r.isSlope) {
          const factor = Math.max(0, Math.min(1, (z - r.startZ) / (r.endZ - r.startZ)));
          groundY = r.startY + factor * (r.endY - r.startY);
        }
        if (!found || Math.abs(groundY - this.mesh.position.y) < Math.abs(bestY - this.mesh.position.y)) {
          bestY = groundY;
          found = true;
        }
      }
    }
    return found ? bestY : this.mesh.position.y;
  }

  _resolveX(oldPos, newPos) {
    const r = this.enemyRadius || 0.4;
    const enemyY = this.mesh.position.y;
    for (const wall of this.walls) {
      if (wall.floorY !== undefined) {
        const wallH = wall.wallH || 4.2;
        if (enemyY < wall.floorY - 0.5 || enemyY > wall.floorY + wallH - 0.2) continue;
      }
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
    const r = this.enemyRadius || 0.4;
    const enemyY = this.mesh.position.y;
    for (const wall of this.walls) {
      if (wall.floorY !== undefined) {
        const wallH = wall.wallH || 4.2;
        if (enemyY < wall.floorY - 0.5 || enemyY > wall.floorY + wallH - 0.2) continue;
      }
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

  _buildMesh(size, spritePath, fallbackColor) {
    this.mesh = new THREE.Group();

    if (spritePath) {
      this.tex = new THREE.Texture();
      this.tex.magFilter = THREE.NearestFilter;
      this.tex.minFilter = THREE.LinearMipmapLinearFilter;
      this.tex.generateMipmaps = true;
      const insetScaleX = 0.02;
      const insetScaleY = 0.02;
      this.tex.repeat.set((1 / this.sheetCols) - insetScaleX, (1 / this.sheetRows) - insetScaleY);


      // Check if image is already cached from preload
      const cached = SPRITE_IMAGE_CACHE.get(spritePath);
      if (cached && cached.image) {
        this.tex.image = cached.image;
        this.tex.needsUpdate = true;
      }

      getSharedSpriteImage(spritePath, (img) => {
        if (!img) {
          if (this.material) {
            this.material.map = null;
            this.material.emissiveMap = null;
            this.material.color = new THREE.Color(fallbackColor);
            this.material.emissive = new THREE.Color(fallbackColor);
            this.material.alphaTest = 0;
            this.material.needsUpdate = true;
          }
          return;
        }
        this.tex.image = img;
        this.tex.needsUpdate = true;
        this._updateUV();
        if (this.material) {
          this.material.map = this.tex;
          this.material.emissiveMap = this.tex;
          this.material.needsUpdate = true;
        }
      });

      this.material = new THREE.MeshLambertMaterial({
        map: this.tex,
        emissiveMap: this.tex,
        emissive: new THREE.Color(0.85, 0.85, 0.85),
        emissiveIntensity: 0.85,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true,
      });
    } else {
      this.material = new THREE.MeshLambertMaterial({
        color: fallbackColor,
        emissive: new THREE.Color(fallbackColor),
        emissiveIntensity: 0.5,
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
    const insetX = 0.01;
    const insetY = 0.01;

    this.tex.offset.x = (col / this.sheetCols) + insetX;
    this.tex.offset.y = ((this.sheetRows - 1 - row) / this.sheetRows) + insetY;
  }


  takeDamage(amount, isHeavy = false) {
    if (this.dead) return;
    this.health -= amount;
    this._hitTimer = 0.15;

    // Emissive flash
    if (this.material) {
      this.material.emissive.setRGB(1.0, 0.35, 0.35);
      this.material.emissiveIntensity = 1.4;
    }

    if (this.health <= 0) {
      this._die();
    } else if (isHeavy && !this.isBoss) {
      this.state = 'stagger';
      this.setAnimation('recover');
      this._stateT = 0;
      this._staggerDuration = 0.65;
      if (this.material) {
        this.material.emissive.setRGB(1.0, 0.85, 0.2);
        this.material.emissiveIntensity = 1.2;
      }
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
      if (this.material) {
        this.material.opacity = Math.max(0, 1 - t);
        this.material.emissiveIntensity = Math.max(0, 0.85 * (1 - t));
      }
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
          this.material.emissive.setRGB(1.0, 0.65, 0.15);
          this.material.emissiveIntensity = 1.3;
        } else if (this.state === 'stagger') {
          this.material.emissive.setRGB(1.0, 0.85, 0.2);
          this.material.emissiveIntensity = 1.2;
        } else {
          this.material.emissive.setRGB(0.85, 0.85, 0.85);
          this.material.emissiveIntensity = 0.85;
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
            this.material.emissive.setRGB(1.0, 0.65, 0.15);
            this.material.emissiveIntensity = 1.3;
          }
        } else {
          // Move toward player with AABB wall collision resolution
          const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
          dir.y = 0;
          if (dir.lengthSq() > 0.01) {
            dir.normalize();
            const moveDist = this.speed * dt;
            const oldPos = this.mesh.position.clone();
            const newPos = oldPos.clone();
            newPos.x += dir.x * moveDist;
            newPos.z += dir.z * moveDist;

            newPos.x = this._resolveX(oldPos, newPos);
            newPos.z = this._resolveZ(oldPos, newPos);
            if (this.enemyType === 'bat') {
              newPos.y = this.getGroundY(newPos.x, newPos.z) + 1.3;
            } else {
              newPos.y = this.getGroundY(newPos.x, newPos.z);
            }
            this.mesh.position.copy(newPos);
          }
        }
        break;

      case 'stagger':
        // Punish window caused by heavy attack interrupt
        if (this._stateT >= (this._staggerDuration || 0.65)) {
          this.state = 'chase';
          this.setAnimation('chase');
          this._stateT = 0;
          this._cooldownT = 0.5;
          if (this.material) {
            this.material.emissive.setRGB(0.85, 0.85, 0.85);
            this.material.emissiveIntensity = 0.85;
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
          if (this.material) {
            this.material.emissive.setRGB(0.85, 0.85, 0.85);
            this.material.emissiveIntensity = 0.85;
          }
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
          if (this.material) {
            this.material.emissive.setRGB(0.85, 0.85, 0.85);
            this.material.emissiveIntensity = 0.85;
          }
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
// ENEMY PROJECTILES (Physical arrows, etc.)
// ─────────────────────────────────────────────────────────────

export class EnemyProjectile {
  constructor(scene, startPos, targetPos, damage, speed, color, player, audio, walls = []) {
    this.scene  = scene;
    this.damage = damage;
    this.speed  = speed;
    this.player = player;
    this.audio  = audio;
    this.walls  = walls;
    this.dead   = false;
    this._traveled = 0;
    this.maxRange  = 35;

    this.direction = new THREE.Vector3().subVectors(targetPos, startPos);
    this.direction.y = 0;
    if (this.direction.lengthSq() > 0.001) {
      this.direction.normalize();
    } else {
      this.direction.set(0, 0, 1);
    }

    const geo = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(startPos);
    this.mesh.position.y += 1.1; // chest height
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.direction);
    scene.add(this.mesh);
  }

  update(dt) {
    if (this.dead) return;

    const prevPos = this.mesh.position.clone();
    const step = this.speed * dt;
    this.mesh.position.addScaledVector(this.direction, step);
    this._traveled += step;

    if (this._traveled >= this.maxRange) {
      this.dead = true;
      return;
    }

    // World wall collision (swept segment)
    if (this.walls && this.walls.length > 0) {
      const minPx = Math.min(prevPos.x, this.mesh.position.x);
      const maxPx = Math.max(prevPos.x, this.mesh.position.x);
      const minPz = Math.min(prevPos.z, this.mesh.position.z);
      const maxPz = Math.max(prevPos.z, this.mesh.position.z);
      for (const w of this.walls) {
        const minX = w.x - w.w / 2;
        const maxX = w.x + w.w / 2;
        const minZ = w.z - w.d / 2;
        const maxZ = w.z + w.d / 2;
        if (maxPx >= minX && minPx <= maxX && maxPz >= minZ && minPz <= maxZ) {
          this.dead = true;
          this.audio.playSFX('arrowHit', 0.4);
          return;
        }
      }
    }

    // Player collision
    if (this.player) {
      const pPos = this.player.camera.position;
      const dist = Math.hypot(this.mesh.position.x - pPos.x, this.mesh.position.z - pPos.z);
      if (dist < 0.75) {
        this.player.takeDamage(this.damage, this.mesh.position);
        this.dead = true;
      }
    }
  }

  removeFromScene() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ─────────────────────────────────────────────────────────────
// ENEMY ARCHETYPES
// ─────────────────────────────────────────────────────────────

export class OrcGrunt extends Enemy {
  constructor(scene, audio, manager = null) {
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
      xp: 40,
      size: 1.7,
      spritePath: '/assets/sprites/orc_grunt.png',
      rows: 6,
      cols: 6,
      anims: {
        idle:    { row: 0, count: 6, speed: 5 },
        chase:   { row: 1, count: 6, speed: 8 },
        windup:  { row: 2, count: 4, speed: 8 },
        attack:  { row: 3, count: 6, speed: 14 },
        recover: { row: 0, count: 1, speed: 1 },
        dead:    { row: 5, count: 6, speed: 6 },
      }
    }, manager);
  }
}

export class SkeletonArcher extends Enemy {
  constructor(scene, audio, manager = null) {
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
      xp: 50,
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
    }, manager);
  }

  _executeAttack(playerPos, dist) {
    this.audio.playSFX('arrowFire', 0.8);
    // Spawn physical arrow projectile that travels and can be blocked or dodged
    if (this.manager && this.player) {
      const proj = new EnemyProjectile(
        this.scene,
        this.mesh.position,
        this.player.camera.position,
        this.damage,
        22,
        0xeecc44,
        this.player,
        this.audio,
        this.walls
      );
      this.manager.spawnProjectile(proj);
    }
  }
}

export class DeathBat extends Enemy {
  constructor(scene, audio, manager = null) {
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
      xp: 30,
      size: 1.3,
      spritePath: '/assets/sprites/death_bat.png',
      rows: 6,
      cols: 4,
      anims: {
        idle:    { row: 0, count: 4, speed: 8 },
        chase:   { row: 1, count: 4, speed: 12 },
        windup:  { row: 2, count: 4, speed: 10 },
        attack:  { row: 3, count: 4, speed: 14 },
        recover: { row: 0, count: 1, speed: 1 },
        dead:    { row: 5, count: 4, speed: 8 },
      }
    }, manager);
    this.mesh.position.y = 1.2; // flying
  }
}

export class StoneGolem extends Enemy {
  constructor(scene, audio, manager = null) {
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
      xp: 120,
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
    }, manager);
  }

  _executeAttack(playerPos, dist) {
    this.audio.playSFX('boom', 1.0);
    super._executeAttack(playerPos, dist);
  }
}

export class DeathKnight extends Enemy {
  constructor(scene, audio, manager = null) {
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
      xp: 600,
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
    }, manager);
    this.isBoss = true;
    this.phase = 1;
    this.currentAttackType = 'cleave';
  }

  update(dt, playerPos) {
    if (this.dead) return;

    // Phase 2 transition at 50% HP
    if (this.phase === 1 && this.health <= this.maxHealth * 0.5) {
      this.phase = 2;
      this.speed = 3.5;
      this.damage = 36;
      this.attackCooldown = 1.3;
      this.audio.playSFX('bossPhase', 1.2);
    }

    // Phase 2 red/purple aura pulse
    if (this.phase === 2 && this.material && this.state !== 'windup' && this.state !== 'stagger') {
      const pulse = Math.sin(Date.now() * 0.007) * 0.3 + 0.5;
      this.material.emissive.setRGB(0.7 * pulse + 0.3, 0.15 * pulse + 0.2, 0.5 * pulse + 0.3);
      this.material.emissiveIntensity = 1.0;
    }

    // Intelligent Boss Attack Selection
    if (this.state === 'chase' && playerPos && this._cooldownT <= 0) {
      const dist = this.mesh.position.distanceTo(playerPos);
      if (this.phase === 2 && dist <= 6.5 && Math.random() < 0.4) {
        // Phase 2 Ground Shatter Slam
        this.currentAttackType = 'slam';
        this.telegraphTime = 0.80;
        this.recoverTime = 0.65;
        this.attackRange = 6.5;
      } else if (dist > 3.4 && dist <= 7.5) {
        // Abyssal Lunge Thrust
        this.currentAttackType = 'thrust';
        this.telegraphTime = this.phase === 2 ? 0.45 : 0.55;
        this.recoverTime = 0.70;
        this.attackRange = 7.5;
      } else if (dist <= 3.4) {
        // Heavy Cleave
        this.currentAttackType = 'cleave';
        this.telegraphTime = this.phase === 2 ? 0.45 : 0.65;
        this.recoverTime = 0.75;
        this.attackRange = 3.4;
      }
    }

    super.update(dt, playerPos);
  }

  _executeAttack(playerPos, dist) {
    if (this.currentAttackType === 'slam') {
      // Area-of-effect ground shockwave
      this.audio.playSFX('boom', 1.2);
      if (dist <= 6.0 && this.player) {
        this.player.takeDamage(Math.round(this.damage * 1.15), this.mesh.position);
      }
    } else if (this.currentAttackType === 'thrust') {
      // Lunging thrust forward
      this.audio.playSFX('heavySwing', 1.1);
      const lunge = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
      lunge.y = 0;
      if (lunge.lengthSq() > 0.01) {
        lunge.normalize();
        const oldPos = this.mesh.position.clone();
        const newPos = oldPos.clone().addScaledVector(lunge, 3.2);
        newPos.x = this._resolveX(oldPos, newPos);
        newPos.z = this._resolveZ(oldPos, newPos);
        this.mesh.position.copy(newPos);
      }
      const newDist = this.mesh.position.distanceTo(playerPos);
      if (newDist <= 3.4 && this.player) {
        this.player.takeDamage(this.damage, this.mesh.position);
      }
    } else {
      // Standard heavy cleaving slash
      this.audio.playSFX('heavySwing', 1.0);
      super._executeAttack(playerPos, dist);
    }
  }
}

