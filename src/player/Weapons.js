/**
 * Weapons.js — First-Person Weapon System
 * Melee combat with wind-up, active frames, recovery, stamina integration,
 * hit IDs to prevent multi-hits, projectiles, and particle effects.
 */
import { spawnDamageNumber } from '../combat/HitDetection.js';

const WEAPON_DEFS = {
  sword:  { damage: 32, heavyDamage: 55, range: 2.8,  cooldown: 0.45, staminaCost: 16, type: 'melee',    manaCost: 0 },
  spear:  { damage: 26, heavyDamage: 46, range: 3.6,  cooldown: 0.42, staminaCost: 14, type: 'melee',    manaCost: 0 },
  bow:    { damage: 24, heavyDamage: 40, range: 45,   cooldown: 0.75, staminaCost: 12, type: 'projectile',manaCost: 0 },
  staff:  { damage: 45, heavyDamage: 75, range: 35,   cooldown: 1.10, staminaCost: 18, type: 'magic',    manaCost: 15 },
  shield: { damage: 18, heavyDamage: 30, range: 2.0,  cooldown: 0.35, staminaCost: 10, type: 'melee',    manaCost: 0 },
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

    this._cooldown = 0;
    this._swingT = 0;
    this._swinging = false;
    this._isHeavy = false;
    this._currentAttackId = 0;
    this._hitEnemiesThisSwing = new Set();

    this._weaponMesh = this._buildWeaponMesh(this.currentName);
    camera.add(this._weaponMesh);

    window.addEventListener('keydown', e => {
      if (e.code === 'Digit1') this._switchTo(0);
      if (e.code === 'Digit2') this._switchTo(1);
      if (e.code === 'Digit3') this._switchTo(2);
    });
  }

  get current()     { return WEAPON_DEFS[this.available[this.currentIdx]]; }
  get currentName() { return this.available[this.currentIdx]; }

  _switchTo(idx) {
    if (idx >= this.available.length || idx === this.currentIdx) return;
    this.currentIdx = idx;
    this.camera.remove(this._weaponMesh);
    this._weaponMesh = this._buildWeaponMesh(this.available[idx]);
    this.camera.add(this._weaponMesh);

    document.querySelectorAll('.weapon-slot').forEach((el, i) => {
      el.classList.toggle('active', i === idx);
    });
    this.audio.playSFX('uiClick', 0.5);
  }

  _buildWeaponMesh(name) {
    const group = new THREE.Group();
    group.position.set(0.24, -0.26, -0.45);

    switch (name) {
      case 'sword':
      case 'spear': {
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

  inject(enemies, particles) {
    this.enemies = enemies;
    this.particles = particles;
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
        this._weaponMesh.position.set(0.24, -0.26, -0.45);
      } else {
        const t = this._swingT;
        // Phase 1: Wind-up (0.0 - 0.3)
        // Phase 2: Active strike (0.3 - 0.6)
        // Phase 3: Recovery (0.6 - 1.0)
        if (t < 0.3) {
          const windup = t / 0.3;
          this._weaponMesh.rotation.x = windup * 0.4;
          this._weaponMesh.position.z = -0.45 + windup * 0.08;
        } else if (t < 0.6) {
          const strike = (t - 0.3) / 0.3;
          this._weaponMesh.rotation.x = 0.4 - strike * 1.6;
          this._weaponMesh.rotation.y = -strike * 0.5;
          this._weaponMesh.position.z = -0.37 - strike * 0.15;
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

    // Attack Trigger (Left Mouse Button)
    // Only attack when not blocking, not stunned, not in cooldown
    if (this.input.mouseJustDown(0)) {
      this.triggerAttack(false);
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
    const stamCost = weapon.staminaCost;

    // Check player stamina
    if (this.player && !this.player.consumeStamina(stamCost)) {
      return; // Not enough stamina
    }

    this._cooldown = weapon.cooldown;
    this._swinging = true;
    this._swingT = 0;
    this._currentAttackId++;
    this._hitEnemiesThisSwing.clear();

    if (weapon.type === 'melee') {
      this.audio.playSFX('swordSwing');
    } else if (weapon.type === 'projectile') {
      this.audio.playSFX('arrowFire');
      this._spawnProjectile('arrow', weapon.damage, weapon.range, 28, 0xd4af37);
    } else if (weapon.type === 'magic') {
      this.audio.playSFX('fireballCast');
      this._spawnProjectile('fireball', weapon.damage, weapon.range, 18, 0xff5522);
    }
  }

  _performMeleeHit() {
    if (!this.enemies) return;

    const weapon = this.current;
    const playerPos = this.camera.position;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    for (const enemy of this.enemies.getAll()) {
      if (enemy.dead || this._hitEnemiesThisSwing.has(enemy)) continue;

      const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, playerPos);
      toEnemy.y = 0; // horizontal plane
      const dist = toEnemy.length();

      if (dist <= weapon.range) {
        toEnemy.normalize();
        const dot = forward.dot(toEnemy);
        // Forward arc (cos >= 0.45, ~63 degrees)
        if (dot >= 0.45) {
          this._hitEnemiesThisSwing.add(enemy);
          enemy.takeDamage(weapon.damage);
          this.audio.playSFX('swordHit');
          if (this.particles) {
            const hitPoint = enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
            this.particles.spawnHit(hitPoint, 'slash');
          }
          spawnDamageNumber(enemy.mesh.position, weapon.damage, this.camera, '#ffdd44');
          break;
        }
      }
    }
  }

  _spawnProjectile(type, damage, maxRange, speed, color) {
    const proj = new Projectile(
      this.scene, this.camera, type, damage, maxRange, speed, color,
      this.enemies, this.particles, this.audio
    );
    this.projectiles.push(proj);
  }
}

class Projectile {
  constructor(scene, camera, type, damage, maxRange, speed, color, enemies, particles, audio) {
    this.scene    = scene;
    this.camera   = camera;
    this.damage   = damage;
    this.maxRange = maxRange;
    this.speed    = speed;
    this.enemies  = enemies;
    this.particles= particles;
    this.audio    = audio;
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

    const step = this.speed * dt;
    this.mesh.position.addScaledVector(this.direction, step);
    this._traveled += step;

    if (this._traveled >= this.maxRange) {
      this.dead = true;
      return;
    }

    if (this.enemies) {
      const raycaster = new THREE.Raycaster(
        this.mesh.position.clone(),
        this.direction.clone(),
        0, step + 0.3
      );
      const hits = raycaster.intersectObjects(this.enemies.getHitboxes(), true);
      if (hits.length > 0) {
        const enemy = this.enemies.getEnemyByObject(hits[0].object);
        if (enemy && !enemy.dead) {
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
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
