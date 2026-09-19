/**
 * Enemy.js — Billboard Sprite Enemy Base + All Enemy Types
 * Pre-rendered 3D sprite style — always faces camera (billboard)
 * AI: simple seek/patrol/attack state machine
 */

const PINK = new THREE.Color(1, 0, 1); // #FF00FF chromakey

// ─────────────────────────────────────────────────────────────
// BASE ENEMY CLASS
// ─────────────────────────────────────────────────────────────
export class Enemy {
  constructor(scene, audio, config) {
    this.scene  = scene;
    this.audio  = audio;

    this.enemyType  = config.type    || 'orc';
    this.maxHealth  = config.hp      || 50;
    this.health     = this.maxHealth;
    this.speed      = config.speed   || 2.5;
    this.damage     = config.damage  || 10;
    this.attackRange= config.range   || 1.8;
    this.detectRange= config.detect  || 15;
    this.attackCooldown = config.atkCD || 1.2;
    this.scoreValue = config.score   || 100;
    this.isBoss     = false;

    // AI state
    this.state      = 'idle'; // idle | patrol | chase | attack | dead
    this._atkTimer  = 0;
    this._stateT    = 0;
    this._patrolDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();

    // Billboard sprite mesh
    this.mesh = this._buildBillboard(config.size || 1.0, config.color || 0xaa6622, config.spriteTex || null);


    // Callbacks
    this.onDeath = null;
    this.player  = null;
    this.camera  = null;
    this.dead    = false;

    // Hit flash
    this._hitTimer = 0;
  }

  _buildBillboard(size, color, spriteTexPath) {
    const group = new THREE.Group();

    // Load sprite texture if available
    let mat;
    if (spriteTexPath) {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(spriteTexPath, () => {}, undefined, () => {
        // Fallback to color on load error
        mat.color.set(color);
      });
      mat = new THREE.MeshLambertMaterial({
        map: tex,
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.15,
      });
    } else {
      mat = new THREE.MeshLambertMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.1,
      });
    }

    // Sprite plane (always faces camera)
    const geo = new THREE.PlaneGeometry(size, size * 1.5);
    const sprite = new THREE.Mesh(geo, mat);
    sprite.position.y = size * 0.75; // lift off floor
    sprite.userData.isSprite = true;
    group.add(sprite);


    // Invisible hitbox (AABB cylinder approximation)
    const hitGeo = new THREE.BoxGeometry(size * 0.6, size * 1.4, size * 0.6);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitGeo, hitMat);
    hitbox.position.y = size * 0.7;
    hitbox.userData.isHitbox = true;
    group.add(hitbox);

    // Shadow blob
    const shadowGeo = new THREE.PlaneGeometry(size * 0.7, size * 0.35);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    group.add(shadow);

    return group;
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.health -= amount;
    this._hitTimer = 0.15;

    // Flash white on hit
    this.mesh.traverse(child => {
      if (child.isMesh && child.userData.isSprite) {
        child.material.emissive = new THREE.Color(1, 0.5, 0.5);
        child.material.emissiveIntensity = 1;
      }
    });

    if (this.health <= 0) {
      this._die();
    } else {
      // Chase player when hit
      this.state = 'chase';
    }
  }

  _die() {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';

    // Death animation — fall down
    const group = this.mesh;
    let t = 0;
    const startY = group.position.y;
    const anim = setInterval(() => {
      t += 0.05;
      group.rotation.z = t * 2;
      group.position.y = startY - t * 0.3;
      if (t >= 1) {
        clearInterval(anim);
        this.scene.remove(group);
      }
    }, 16);

    if (this.onDeath) this.onDeath();
  }

  update(dt, playerPos) {
    if (this.dead) return;

    // Billboard — always face camera
    if (this.camera) {
      this.mesh.lookAt(this.camera.position.x, this.mesh.position.y, this.camera.position.z);
    }

    // Hit flash clear
    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      if (this._hitTimer <= 0) {
        this.mesh.traverse(child => {
          if (child.isMesh && child.userData.isSprite) {
            child.material.emissiveIntensity = 0;
          }
        });
      }
    }

    // AI timers
    this._atkTimer = Math.max(0, this._atkTimer - dt);
    this._stateT  += dt;

    if (!playerPos) return;
    const distSq = this.mesh.position.distanceToSquared(playerPos);

    // State machine
    switch (this.state) {
      case 'idle':
        if (distSq < this.detectRange * this.detectRange) {
          this.state = 'chase';
          this._stateT = 0;
        } else if (this._stateT > 3) {
          this.state = 'patrol';
          this._stateT = 0;
        }
        break;

      case 'patrol':
        this._moveInDir(this._patrolDir, dt);
        if (this._stateT > 2) {
          // New random direction
          this._patrolDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
          this._stateT = 0;
        }
        if (distSq < this.detectRange * this.detectRange) {
          this.state = 'chase';
        }
        break;

      case 'chase':
        const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position).setY(0).normalize();
        this._moveInDir(toPlayer, dt);

        if (distSq < this.attackRange * this.attackRange) {
          this.state = 'attack';
          this._stateT = 0;
        } else if (distSq > (this.detectRange * 1.5) ** 2) {
          this.state = 'patrol';
        }
        break;

      case 'attack':
        if (this._atkTimer <= 0) {
          this._doAttack();
          this._atkTimer = this.attackCooldown;
        }
        // Return to chase if player moved away
        if (distSq > this.attackRange * this.attackRange * 1.5) {
          this.state = 'chase';
        }
        break;
    }
  }

  _moveInDir(dir, dt) {
    const newPos = this.mesh.position.clone().addScaledVector(dir, this.speed * dt);
    // Simple ground clamp
    newPos.y = 0;
    this.mesh.position.copy(newPos);
  }

  _doAttack() {
    if (!this.player) return;
    // Direct damage to player (called when in range)
    this.player.takeDamage(this.damage);
    this.audio.playSFX('swordHit', 0.5);
  }

  dispose() {
    this.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}

// ─────────────────────────────────────────────────────────────
// ORC GRUNT — Melee charger
// ─────────────────────────────────────────────────────────────
export class OrcGrunt extends Enemy {
  constructor(scene, audio) {
    super(scene, audio, {
      type: 'orc', hp: 60, speed: 3.5, damage: 12,
      range: 2.0, detect: 14, atkCD: 1.0,
      size: 1.1, color: 0x2d5a1a, score: 100,
      spriteTex: '/assets/sprites/orc_grunt.jpg',
    });
  }
}

// ─────────────────────────────────────────────────────────────
// SKELETON ARCHER — Ranged kiter
// ─────────────────────────────────────────────────────────────
export class SkeletonArcher extends Enemy {
  constructor(scene, audio) {
    super(scene, audio, {
      type: 'archer', hp: 35, speed: 2.0, damage: 10,
      range: 12, detect: 18, atkCD: 2.0,
      size: 0.9, color: 0xc8b090, score: 150,
      spriteTex: '/assets/sprites/skeleton_archer.jpg',
    });
    this._arrowCooldown = 0;
    this.PREF_DIST = 8; // preferred attack distance
  }


  update(dt, playerPos) {
    if (this.dead) return;

    // Billboard
    if (this.camera) {
      this.mesh.lookAt(this.camera.position.x, this.mesh.position.y, this.camera.position.z);
    }

    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      if (this._hitTimer <= 0) {
        this.mesh.traverse(c => {
          if (c.isMesh && c.userData.isSprite) c.material.emissiveIntensity = 0;
        });
      }
    }

    this._atkTimer = Math.max(0, this._atkTimer - dt);
    if (!playerPos) return;

    const dist = this.mesh.position.distanceTo(playerPos);
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position).setY(0).normalize();
    const awayFromPlayer = toPlayer.clone().negate();

    if (dist > this.detectRange) {
      // Out of range — idle
      return;
    }

    // Kite: maintain preferred distance
    if (dist < this.PREF_DIST - 1) {
      // Too close — back away
      this._moveInDir(awayFromPlayer, dt);
    } else if (dist > this.PREF_DIST + 2) {
      // Too far — move closer
      this._moveInDir(toPlayer, dt * 0.5);
    }

    // Shoot arrow
    if (dist < this.attackRange && this._atkTimer <= 0) {
      this._shootArrow(playerPos);
      this._atkTimer = this.attackCooldown;
    }
  }

  _shootArrow(targetPos) {
    if (!this.player) return;
    // Simplified: deal damage with accuracy falloff based on range
    const dist = this.mesh.position.distanceTo(targetPos);
    const hitChance = Math.max(0.2, 1 - dist / 20);
    if (Math.random() < hitChance) {
      this.player.takeDamage(this.damage);
    }
    this.audio.playSFX('arrowFire', 0.5);
  }
}

// ─────────────────────────────────────────────────────────────
// DEATH BAT — Flying swooper
// ─────────────────────────────────────────────────────────────
export class DeathBat extends Enemy {
  constructor(scene, audio) {
    super(scene, audio, {
      type: 'bat', hp: 30, speed: 5.0, damage: 14,
      range: 1.5, detect: 20, atkCD: 0.8,
      size: 0.75, color: 0x220033, score: 80,
      spriteTex: '/assets/sprites/death_bat.jpg',
    });
    this._flyT = Math.random() * Math.PI * 2; // phase offset
  }

  update(dt, playerPos) {
    if (this.dead) return;

    this._flyT += dt * 3;
    // Hover up and down
    this.mesh.position.y = 1.2 + Math.sin(this._flyT) * 0.4;

    // Billboard
    if (this.camera) {
      this.mesh.lookAt(this.camera.position.x, this.mesh.position.y, this.camera.position.z);
    }

    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
    }

    this._atkTimer = Math.max(0, this._atkTimer - dt);
    if (!playerPos) return;

    const distSq = this.mesh.position.distanceToSquared(playerPos);
    if (distSq < this.detectRange * this.detectRange) {
      // Dive toward player
      const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
      this.mesh.position.addScaledVector(dir, this.speed * dt);
      this.mesh.position.y = Math.max(0.5, this.mesh.position.y); // don't go underground

      if (distSq < this.attackRange * this.attackRange && this._atkTimer <= 0) {
        this._doAttack();
        this._atkTimer = this.attackCooldown;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// STONE GOLEM — Slow heavy tank
// ─────────────────────────────────────────────────────────────
export class StoneGolem extends Enemy {
  constructor(scene, audio) {
    super(scene, audio, {
      type: 'golem', hp: 180, speed: 1.2, damage: 30,
      range: 2.5, detect: 12, atkCD: 2.5,
      size: 1.6, color: 0x556677, score: 300,
      spriteTex: '/assets/sprites/stone_golem.jpg',
    });
  }


  _doAttack() {
    if (!this.player) return;
    // Stomp — deals heavy damage
    this.player.takeDamage(this.damage);
    this.audio.playSFX('bossRoar', 0.4);
  }
}

// ─────────────────────────────────────────────────────────────
// DEATH KNIGHT — Final Boss
// Two phases: Phase 1 sword, Phase 2 magic
// ─────────────────────────────────────────────────────────────
export class DeathKnight extends Enemy {
  constructor(scene, audio) {
    super(scene, audio, {
      type: 'boss', hp: 600, speed: 2.8, damage: 35,
      range: 3.0, detect: 50, atkCD: 1.5,
      size: 2.0, color: 0x110022, score: 2000,
      spriteTex: '/assets/sprites/death_knight.jpg',
    });
    this.isBoss   = true;
    this._phase   = 1;
    this._roarT   = 0;
    this._magicT  = 0;

    // Glow effect
    this.mesh.traverse(c => {
      if (c.isMesh && c.userData.isSprite) {
        c.material.emissive = new THREE.Color(0.4, 0, 0.8);
        c.material.emissiveIntensity = 0.3;
      }
    });

    // Add boss aura light
    this._auraLight = new THREE.PointLight(0x440088, 1.0, 8);
    this._auraLight.position.y = 1.5;
    this.mesh.add(this._auraLight);
  }

  update(dt, playerPos) {
    if (this.dead) return;

    // Phase transition at 50% HP
    if (this._phase === 1 && this.health < this.maxHealth * 0.5) {
      this._enterPhase2();
    }

    // Aura flicker
    this._roarT += dt;
    this._auraLight.intensity = 1.0 + Math.sin(this._roarT * 4) * 0.3;

    // Call base update
    super.update(dt, playerPos);

    // Phase 2: periodic magic nova
    if (this._phase === 2) {
      this._magicT += dt;
      if (this._magicT > 5) {
        this._castMagicNova(playerPos);
        this._magicT = 0;
      }
    }
  }

  _enterPhase2() {
    this._phase = 2;
    this.speed  = 3.5;
    this.damage = 50;
    this.attackCooldown = 1.0;

    // Visual change
    this.mesh.traverse(c => {
      if (c.isMesh && c.userData.isSprite) {
        c.material.emissive = new THREE.Color(0.8, 0, 0.2);
        c.material.emissiveIntensity = 0.6;
      }
    });
    this._auraLight.color.set(0xff0044);

    this.audio.playSFX('bossRoar', 1.0);
  }

  _castMagicNova(playerPos) {
    if (!this.player || !playerPos) return;
    const dist = this.mesh.position.distanceTo(playerPos);
    // Magic nova hits if in range
    if (dist < 8) {
      const dmg = 20 + Math.random() * 20;
      this.player.takeDamage(Math.round(dmg));
      this.audio.playSFX('fireballExplode', 1.0);
    }
  }
}
