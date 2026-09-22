/**
 * Weapons.js — First-Person Weapon System
 * Melee combat with wind-up, active frames, recovery, stamina integration,
 * hit IDs to prevent multi-hits, projectiles, and particle effects.
 */
import { spawnDamageNumber } from '../combat/HitDetection.js';

const WEAPON_DEFS = {
  sword:  { damage: 26, heavyDamage: 44, range: 2.8,  cooldown: 0.45, staminaCost: 16, type: 'melee',    manaCost: 0 },
  spear:  { damage: 22, heavyDamage: 38, range: 3.6,  cooldown: 0.42, staminaCost: 14, type: 'melee',    manaCost: 0 },
  bow:    { damage: 12, heavyDamage: 20, range: 45,   cooldown: 0.75, staminaCost: 12, type: 'projectile',manaCost: 0 },
  staff:  { damage: 22, heavyDamage: 36, range: 35,   cooldown: 1.10, staminaCost: 18, type: 'magic',    manaCost: 15 },
  shield: { damage: 14, heavyDamage: 24, range: 2.0,  cooldown: 0.35, staminaCost: 10, type: 'melee',    manaCost: 0 },
};

const SWING_DURATION = 0.28;

export class Weapons {
  constructor(scene, camera, input, audio, weaponList, charType) {
    this.scene  = scene;
    this.camera = camera;
    this.input  = input;
    this.audio  = audio;
    this.charType = charType;
    this.player = null; // injected by Player

    this.available = weaponList;
    this.currentIdx = 0;
    this.projectiles = [];
    this.enemies = null;
    this.particles = null;
    this.onMeleeHit = null;
    this.onRangedHit = null;

    this._cooldown = 0;
    this._swingT = 0;
    this._swinging = false;
    this._isHeavy = false;
    this._currentAttackId = 0;
    this._hitEnemiesThisSwing = new Set();

    this._weaponMesh = this._buildWeaponMesh(this.currentName);
    camera.add(this._weaponMesh);

    this._onKeyDown = (e) => {
      if (e.code === 'Digit1') this._switchTo(0);
      if (e.code === 'Digit2') this._switchTo(1);
      if (e.code === 'Digit3') this._switchTo(2);
    };
    window.addEventListener('keydown', this._onKeyDown);
    this._updateHudSlots();
  }

  get current()     { return WEAPON_DEFS[this.available[this.currentIdx]]; }
  get currentName() { return this.available[this.currentIdx]; }

  _updateHudSlots() {
    const container = document.getElementById('weapon-slots');
    if (!container) return;
    const icons = {
      sword: '⚔️',
      shield: '🛡️',
      bow: '🏹',
      staff: '🔮',
      spear: '🔱',
    };
    container.innerHTML = this.available.map((wName, idx) => `
      <div class="weapon-slot ${idx === this.currentIdx ? 'active' : ''}" id="slot-${idx + 1}">
        <span class="slot-key">${idx + 1}</span>
        <span class="slot-icon">${icons[wName] || '⚔️'}</span>
        <span class="slot-name">${wName.toUpperCase()}</span>
      </div>
    `).join('');
  }

  _getDefaultMeshPos(name = this.currentName) {
    if (name === 'shield') {
      return new THREE.Vector3(0.18, -0.22, -0.4);
    }
    return new THREE.Vector3(0.24, -0.26, -0.45);
  }

  _disposeMesh(mesh) {
    if (!mesh) return;
    mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }

  _switchTo(idx) {
    if (idx >= this.available.length || idx === this.currentIdx) return;
    this.currentIdx = idx;

    // Cleanly cancel any in-flight swing animation and ready new weapon
    this._swinging = false;
    this._swingT = 0;
    this._cooldown = 0;
    this._hitEnemiesThisSwing.clear();

    if (this._weaponMesh) {
      this.camera.remove(this._weaponMesh);
      this._disposeMesh(this._weaponMesh);
      this._weaponMesh = null;
    }

    this._weaponMesh = this._buildWeaponMesh(this.available[idx]);
    this.camera.add(this._weaponMesh);

    this._updateHudSlots();
    this.audio.playSFX('uiClick', 0.5);
  }

  _buildWeaponMesh(name) {
    const group = new THREE.Group();
    group.position.copy(this._getDefaultMeshPos(name));

    switch (name) {
      case 'sword': {
        // Blade
        const bladeGeo = new THREE.BoxGeometry(0.04, 0.52, 0.02);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xddeeff, metalness: 0.9, roughness: 0.15 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 0.12;
        group.add(blade);
        // Crossguard
        const guardGeo = new THREE.BoxGeometry(0.16, 0.03, 0.04);
        const guardMat = new THREE.MeshStandardMaterial({ color: 0xdaa520, metalness: 0.85, roughness: 0.25 });
        const guard = new THREE.Mesh(guardGeo, guardMat);
        guard.position.y = -0.12;
        group.add(guard);
        // Hilt
        const gripGeo = new THREE.BoxGeometry(0.035, 0.16, 0.035);
        const gripMat = new THREE.MeshStandardMaterial({ color: 0x3d2010 });
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.y = -0.21;
        group.add(grip);
        break;
      }
      case 'spear': {
        // Long spear shaft
        const shaftGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.75, 6);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.7 });
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        shaft.position.y = -0.05;
        group.add(shaft);

        // Golden collar
        const collarGeo = new THREE.CylinderGeometry(0.024, 0.02, 0.04, 6);
        const collarMat = new THREE.MeshStandardMaterial({ color: 0xdaa520, metalness: 0.8, roughness: 0.2 });
        const collar = new THREE.Mesh(collarGeo, collarMat);
        collar.position.y = 0.32;
        group.add(collar);

        // Steel spearhead
        const headGeo = new THREE.ConeGeometry(0.045, 0.25, 4);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xe0e8f0, metalness: 0.92, roughness: 0.15 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.45;
        group.add(head);
        break;
      }
      case 'shield': {
        // Kite shield plate
        const plateGeo = new THREE.BoxGeometry(0.28, 0.38, 0.03);
        const plateMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, metalness: 0.5, roughness: 0.4 });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        group.add(plate);

        // Golden rim/boss
        const bossGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8);
        const bossMat = new THREE.MeshStandardMaterial({ color: 0xdaa520, metalness: 0.85, roughness: 0.2 });
        const boss = new THREE.Mesh(bossGeo, bossMat);
        boss.rotation.x = Math.PI / 2;
        group.add(boss);
        group.position.set(0.18, -0.22, -0.4);
        break;
      }
      case 'bow': {
        const bowGeo = new THREE.TorusGeometry(0.22, 0.015, 6, 20, Math.PI);
        const bowMat = new THREE.MeshStandardMaterial({ color: 0x6b3e18, metalness: 0.1, roughness: 0.8 });
        const bow = new THREE.Mesh(bowGeo, bowMat);
        bow.rotation.z = Math.PI / 2;
        group.add(bow);
        break;
      }
      case 'staff': {
        const staffGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.65, 6);
        const staffMat = new THREE.MeshStandardMaterial({ color: 0x221133, metalness: 0.1, roughness: 0.7 });
        const staff = new THREE.Mesh(staffGeo, staffMat);
        staff.rotation.x = 0.25;
        group.add(staff);

        const orbGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const orbMat = new THREE.MeshStandardMaterial({
          color: 0x4466ff, emissive: 0x2233cc, emissiveIntensity: 1.0,
          transparent: true, opacity: 0.9,
        });
        const orb = new THREE.Mesh(orbGeo, orbMat);
        orb.position.y = 0.35;
        group.add(orb);
        break;
      }
      default: {
        const geo = new THREE.BoxGeometry(0.06, 0.4, 0.04);
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        group.add(new THREE.Mesh(geo, mat));
      }
    }
    return group;
  }

  inject(enemies, particles, walls = []) {
    this.enemies = enemies;
    this.particles = particles;
    this.walls = walls;
  }

  update(dt) {
    if (this._cooldown > 0) this._cooldown -= dt;

    // Swing animation
    if (this._swinging) {
      const duration = this._isHeavy ? SWING_DURATION * 1.4 : SWING_DURATION;
      this._swingT += dt / duration;

      if (this._swingT >= 1.0) {
        this._swingT = 0;
        this._swinging = false;
        this._weaponMesh.rotation.x = 0;
        this._weaponMesh.rotation.y = 0;
        this._weaponMesh.position.copy(this._getDefaultMeshPos());
      } else {
        const t = this._swingT;
        // Phase 1: Wind-up (0.0 - 0.3)
        // Phase 2: Active strike (0.3 - 0.6)
        // Phase 3: Recovery (0.6 - 1.0)
        if (t < 0.3) {
          const windup = t / 0.3;
          this._weaponMesh.rotation.x = windup * (this._isHeavy ? 0.6 : 0.4);
          this._weaponMesh.position.z = -0.45 + windup * (this._isHeavy ? 0.12 : 0.08);
        } else if (t < 0.6) {
          const strike = (t - 0.3) / 0.3;
          this._weaponMesh.rotation.x = 0.4 - strike * (this._isHeavy ? 2.0 : 1.6);
          this._weaponMesh.rotation.y = -strike * (this._isHeavy ? 0.7 : 0.5);
          this._weaponMesh.position.z = -0.37 - strike * (this._isHeavy ? 0.22 : 0.15);
          // Trigger melee hit detection during active frames
          if (this.current.type === 'melee' && t >= 0.35 && t <= 0.55) {
            this._performMeleeHit();
          }
        } else {
          const recover = (t - 0.6) / 0.4;
          this._weaponMesh.rotation.x = -1.2 + recover * 1.2;
          this._weaponMesh.rotation.y = -0.5 + recover * 0.5;
          this._weaponMesh.position.z = -0.52 + recover * 0.07;
        }
      }
    }

    // Idle or Blocking stance visual
    if (!this._swinging && this._weaponMesh) {
      if (this.player && this.player.isBlocking) {
        if (this.currentName === 'shield') {
          this._weaponMesh.position.set(-0.02, -0.10, -0.32);
          this._weaponMesh.rotation.set(0.1, -0.15, 0.05);
        } else {
          this._weaponMesh.position.set(0.08, -0.14, -0.36);
          this._weaponMesh.rotation.set(0.35, 0.2, 0.5);
        }
      } else {
        const defPos = this._getDefaultMeshPos();
        this._weaponMesh.position.copy(defPos);
        this._weaponMesh.rotation.set(0, 0, 0);
      }
    }

    // Attack Trigger (Left Mouse = Light Attack, R = Heavy Attack)
    // Only attack when not blocking, not stunned, not in cooldown
    if (this.input.mouseJustDown(0)) {
      this.triggerAttack(false);
    } else if (this.input.heavyAttack) {
      this.triggerAttack(true);
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      if (p.dead) {
        p.removeFromScene();
        this.projectiles.splice(i, 1);
      }
    }
  }

  triggerAttack(isHeavy = false) {
    if (this._cooldown <= 0 && !this.player?.isBlocking && !this.player?.isStunned) {
      this._isHeavy = isHeavy;
      this._attack();
      return true;
    }
    return false;
  }

  _attack() {
    const weapon = this.current;
    const stamCost = this._isHeavy ? Math.round(weapon.staminaCost * 1.7) : weapon.staminaCost;
    const manaCost = weapon.manaCost || 0;

    // Check player stamina and mana before consuming either
    if (this.player) {
      if (this.player.stamina < stamCost) {
        return; // Not enough stamina
      }
      if (manaCost > 0 && this.player.mana < manaCost) {
        return; // Not enough mana
      }
      this.player.consumeStamina(stamCost);
      if (manaCost > 0) {
        this.player.consumeMana(manaCost);
      }
    }

    this._cooldown = this._isHeavy ? weapon.cooldown * 1.35 : weapon.cooldown;
    this._swinging = true;
    this._swingT = 0;
    this._currentAttackId++;
    this._hitEnemiesThisSwing.clear();

    const mult = this.player ? (this.player.damageMultiplier || 1.0) : 1.0;
    const dmg = Math.round((this._isHeavy ? weapon.heavyDamage : weapon.damage) * mult);
    if (weapon.type === 'melee') {
      this.audio.playSFX(this._isHeavy ? 'heavySwing' : 'swordSwing');
    } else if (weapon.type === 'projectile') {
      this.audio.playSFX('arrowFire');
      this._spawnProjectile('arrow', dmg, weapon.range, 28, 0xd4af37);
    } else if (weapon.type === 'magic') {
      this.audio.playSFX('fireballCast');
      this._spawnProjectile('fireball', dmg, weapon.range, 18, 0xff5522);
    }
  }

  _performMeleeHit() {
    if (!this.enemies) return;

    const weapon = this.current;
    const mult = this.player ? (this.player.damageMultiplier || 1.0) : 1.0;
    const damage = Math.round((this._isHeavy ? weapon.heavyDamage : weapon.damage) * mult);
    const playerPos = this.camera.position;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    for (const enemy of this.enemies.getAll()) {
      if (enemy.dead || this._hitEnemiesThisSwing.has(enemy)) continue;

      // Vertical elevation separation check (prevents hitting enemies through floors/ceilings)
      const enemyFeetY = enemy.mesh.position.y;
      const playerFeetY = playerPos.y - 1.7;
      if (Math.abs(enemyFeetY - playerFeetY) > 2.2) continue;

      const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, playerPos);
      toEnemy.y = 0; // horizontal plane
      const dist = toEnemy.length();

      if (dist <= weapon.range) {
        toEnemy.normalize();
        const dot = forward.dot(toEnemy);
        // Forward arc (cos >= 0.45, ~63 degrees)
        if (dot >= 0.45) {
          this._hitEnemiesThisSwing.add(enemy);
          if (this.onMeleeHit) this.onMeleeHit(enemy);
          enemy.takeDamage(damage, this._isHeavy);
          this.audio.playSFX(this._isHeavy ? 'heavySwing' : 'swordHit');
          if (this.particles) {
            const hitPoint = enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
            this.particles.spawnHit(hitPoint, this._isHeavy ? 'spark' : 'slash');
          }
          spawnDamageNumber(enemy.mesh.position, damage, this.camera, this._isHeavy ? '#ff6622' : '#ffdd44');
          break;
        }
      }
    }
  }

  _spawnProjectile(type, damage, maxRange, speed, color) {
    const proj = new Projectile(
      this.scene, this.camera, type, damage, maxRange, speed, color,
      this.enemies, this.particles, this.audio, this.walls, (hitEnemy) => { if (this.onRangedHit) this.onRangedHit(hitEnemy); }
    );
    this.projectiles.push(proj);
  }

  destroy() {
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    if (this._weaponMesh) {
      this.camera.remove(this._weaponMesh);
      this._disposeMesh(this._weaponMesh);
      this._weaponMesh = null;
    }
    for (const p of this.projectiles) {
      p.removeFromScene();
    }
    this.projectiles = [];
  }
}

class Projectile {
  constructor(scene, camera, type, damage, maxRange, speed, color, enemies, particles, audio, walls = [], onHitEnemy = null) {
    this.onHitEnemy = onHitEnemy;
    this.scene    = scene;
    this.camera   = camera;
    this.damage   = damage;
    this.maxRange = maxRange;
    this.speed    = speed;
    this.enemies  = enemies;
    this.particles= particles;
    this.audio    = audio;
    this.walls    = walls;
    this.dead     = false;
    this._traveled= 0;

    this.direction = new THREE.Vector3();
    camera.getWorldDirection(this.direction);

    let geo;
    if (type === 'fireball') {
      geo = new THREE.SphereGeometry(0.1, 8, 8);
    } else {
      geo = new THREE.CylinderGeometry(0.018, 0.018, 0.35, 4);
    }
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: type === 'fireball' ? 1.6 : 0.6,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(camera.position).addScaledVector(this.direction, 0.5);

    if (type === 'arrow') {
      this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.direction);
    }
    scene.add(this.mesh);

    if (type === 'fireball') {
      this._light = new THREE.PointLight(color, 1.8, 5);
      this.mesh.add(this._light);
    }
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

    // 1. Check world wall collision (swept segment prevents wall penetration/tunneling)
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
          if (this.particles) this.particles.spawnHit(this.mesh.position, 'spark');
          this.audio.playSFX('arrowHit', 0.5);
          return;
        }
      }
    }

    // 2. Check enemy hitboxes along segment
    if (this.enemies) {
      const raycaster = new THREE.Raycaster(
        prevPos,
        this.direction,
        0,
        step + 0.25
      );
      const hits = raycaster.intersectObjects(this.enemies.getHitboxes(), true);
      if (hits.length > 0) {
        const enemy = this.enemies.getEnemyByObject(hits[0].object);
        if (enemy && !enemy.dead) {
          if (this.onHitEnemy) this.onHitEnemy(enemy);
          enemy.takeDamage(this.damage);
          this.audio.playSFX(this.damage > 30 ? 'fireballExplode' : 'arrowHit');
          if (this.particles) this.particles.spawnHit(hits[0].point, 'blood');
          spawnDamageNumber(hits[0].point, this.damage, this.camera, '#ff8844');
        }
        this.dead = true;
      }
    }
  }

  removeFromScene() {
    if (this._light) {
      this.mesh.remove(this._light);
      if (this._light.dispose) this._light.dispose();
    }
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose());
    } else if (this.mesh.material) {
      this.mesh.material.dispose();
    }
  }
}
