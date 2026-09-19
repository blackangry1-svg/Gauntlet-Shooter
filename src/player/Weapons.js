/**
 * Weapons.js — First-Person Weapon System
 * Sword, Bow, Staff — with animations & projectiles
 */
import { spawnDamageNumber } from '../combat/HitDetection.js';

const WEAPON_DEFS = {
  sword:  { damage: 30, range: 2.5,  cooldown: 0.5,  type: 'melee',    manaCost: 0,  ammo: -1 },
  spear:  { damage: 25, range: 3.5,  cooldown: 0.45, type: 'melee',    manaCost: 0,  ammo: -1 },
  bow:    { damage: 20, range: 40,   cooldown: 0.8,  type: 'projectile',manaCost: 0,  ammo: -1 },
  staff:  { damage: 40, range: 30,   cooldown: 1.2,  type: 'magic',    manaCost: 15, ammo: -1 },
  shield: { damage: 15, range: 1.5,  cooldown: 0.35, type: 'melee',    manaCost: 0,  ammo: -1 },
};

const SWING_DURATION = 0.25;

export class Weapons {
  constructor(scene, camera, input, audio, weaponList, charType) {
    this.scene  = scene;
    this.camera = camera;
    this.input  = input;
    this.audio  = audio;
    this.charType = charType;

    // Available weapons for this character
    this.available = weaponList;
    this.currentIdx = 0;
    // current weapon def and name are accessed via getters defined below


    // Active projectiles
    this.projectiles = [];

    // Enemies reference (injected)
    this.enemies = null;
    this.particles = null;

    // Cooldown
    this._cooldown = 0;

    // Swing animation
    this._swingT = 0;
    this._swinging = false;

    // Weapon model (simple geometry shown in FPS view)
    this._weaponMesh = this._buildWeaponMesh(this.currentName);
    camera.add(this._weaponMesh);

    // Weapon switch keys
    const self = this;
    window.addEventListener('keydown', e => {
      if (e.code === 'Digit1') self._switchTo(0);
      if (e.code === 'Digit2') self._switchTo(1);
      if (e.code === 'Digit3') self._switchTo(2);
      if (e.code === 'KeyR')   self._switchTo(self.currentIdx); // reload/special
    });
  }

  // ── Getters ────────────────────────────────────────────────
  get current()     { return WEAPON_DEFS[this.available[this.currentIdx]]; }
  get currentName() { return this.available[this.currentIdx]; }

  _switchTo(idx) {

    if (idx >= this.available.length) return;
    if (idx === this.currentIdx) return;
    this.currentIdx = idx;
    this.camera.remove(this._weaponMesh);
    this._weaponMesh = this._buildWeaponMesh(this.available[idx]);
    this.camera.add(this._weaponMesh);

    // Update HUD slots
    document.querySelectorAll('.weapon-slot').forEach((el, i) => {
      el.classList.toggle('active', i === idx);
    });
    this.audio.playSFX('uiClick', 0.5);
  }

  _buildWeaponMesh(name) {
    // Simple geometric first-person weapon representation
    let geo, mat;

    const group = new THREE.Group();
    // Position in bottom-right of view (FPS hand position)
    group.position.set(0.25, -0.28, -0.45);

    switch (name) {
      case 'sword':
      case 'spear': {
        // Blade
        geo = new THREE.BoxGeometry(0.04, 0.5, 0.02);
        mat = new THREE.MeshStandardMaterial({ color: 0xccddff, metalness: 0.9, roughness: 0.1 });
        const blade = new THREE.Mesh(geo, mat);
        blade.position.y = 0.1;
        group.add(blade);
        // Guard
        const guardGeo = new THREE.BoxGeometry(0.15, 0.03, 0.04);
        const guardMat = new THREE.MeshStandardMaterial({ color: 0xc8a84b, metalness: 0.8, roughness: 0.2 });
        const guard = new THREE.Mesh(guardGeo, guardMat);
        guard.position.y = -0.12;
        group.add(guard);
        // Grip
        const gripGeo = new THREE.BoxGeometry(0.04, 0.18, 0.04);
        const gripMat = new THREE.MeshStandardMaterial({ color: 0x3a2010 });
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.y = -0.22;
        group.add(grip);
        break;
      }
      case 'bow': {
        const bowGeo = new THREE.TorusGeometry(0.2, 0.015, 6, 20, Math.PI);
        const bowMat = new THREE.MeshStandardMaterial({ color: 0x5a3010, metalness: 0, roughness: 0.9 });
        const bow = new THREE.Mesh(bowGeo, bowMat);
        bow.rotation.z = Math.PI / 2;
        group.add(bow);
        break;
      }
      case 'staff': {
        const staffGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.6, 6);
        const staffMat = new THREE.MeshStandardMaterial({ color: 0x2a1540, metalness: 0, roughness: 0.7 });
        const staff = new THREE.Mesh(staffGeo, staffMat);
        staff.rotation.x = 0.3;
        group.add(staff);
        // Orb
        const orbGeo = new THREE.SphereGeometry(0.055, 8, 8);
        const orbMat = new THREE.MeshStandardMaterial({
          color: 0x3355ff, emissive: 0x1122cc, emissiveIntensity: 0.8,
          transparent: true, opacity: 0.85,
        });
        const orb = new THREE.Mesh(orbGeo, orbMat);
        orb.position.y = 0.32;
        group.add(orb);
        break;
      }
      default: {
        geo = new THREE.BoxGeometry(0.06, 0.4, 0.04);
        mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        group.add(new THREE.Mesh(geo, mat));
      }
    }

    return group;
  }

  update(dt) {
    if (this._cooldown > 0) this._cooldown -= dt;

    // Swing animation
    if (this._swinging) {
      this._swingT += dt / SWING_DURATION;
      if (this._swingT >= 1) {
        this._swingT = 0;
        this._swinging = false;
        this._weaponMesh.rotation.x = 0;
      } else {
        // Animate a swing arc
        const t = this._swingT;
        const swing = t < 0.5 ? t * 2 : (1 - t) * 2;
        this._weaponMesh.rotation.x = -swing * 1.2;
        this._weaponMesh.position.z = -0.45 - swing * 0.1;
      }
    }

    // Attack input
    if (this.input.mouseJustDown(0) && this._cooldown <= 0) {
      this._attack();
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

  _attack() {
    const weapon = WEAPON_DEFS[this.currentName];
    this._cooldown = weapon.cooldown;
    this._swinging = true;
    this._swingT = 0;

    if (weapon.type === 'melee') {
      this.audio.playSFX('swordSwing');
      // Raycast for melee
      if (this.enemies) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const hits = raycaster.intersectObjects(
          this.enemies.getHitboxes(), true
        );
        for (const hit of hits) {
          if (hit.distance <= weapon.range) {
            const enemy = this.enemies.getEnemyByObject(hit.object);
            if (enemy && !enemy.dead) {
              enemy.takeDamage(weapon.damage);
              this.audio.playSFX('swordHit');
              if (this.particles) {
                this.particles.spawnHit(hit.point, 'slash');
              }
              spawnDamageNumber(hit.point, weapon.damage, this.camera, '#ffdd44');
              break;
            }
          }
        }
      }

    } else if (weapon.type === 'projectile') {
      this.audio.playSFX('arrowFire');
      this._spawnProjectile('arrow', weapon.damage, weapon.range, 25, 0xddbb77);

    } else if (weapon.type === 'magic') {
      this.audio.playSFX('fireballCast');
      this._spawnProjectile('fireball', weapon.damage, weapon.range, 15, 0xff6622);
    }
  }

  _spawnProjectile(type, damage, maxRange, speed, color) {
    const proj = new Projectile(
      this.scene, this.camera, type, damage, maxRange, speed, color,
      this.enemies, this.particles, this.audio
    );
    this.projectiles.push(proj);
  }

  inject(enemies, particles) {
    this.enemies = enemies;
    this.particles = particles;
  }
}

// ─── Projectile ────────────────────────────────────────────────
class Projectile {
  constructor(scene, camera, type, damage, maxRange, speed, color, enemies, particles, audio) {
    this.scene    = scene;
    this.damage   = damage;
    this.maxRange = maxRange;
    this.speed    = speed;
    this.enemies  = enemies;
    this.particles= particles;
    this.audio    = audio;
    this.dead     = false;
    this._traveled= 0;

    // Direction from camera
    this.direction = new THREE.Vector3();
    camera.getWorldDirection(this.direction);

    // Mesh
    let geo;
    if (type === 'fireball') {
      geo = new THREE.SphereGeometry(0.08, 6, 6);
    } else {
      geo = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4);
    }
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: type === 'fireball' ? 1.5 : 0.5,
    });
    this.mesh = new THREE.Mesh(geo, mat);

    // Start at camera position + slight offset forward
    this.mesh.position.copy(camera.position).addScaledVector(this.direction, 0.5);
    if (type === 'arrow') {
      // Orient arrow along direction
      this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.direction);
    }
    scene.add(this.mesh);

    // Projectile light
    if (type === 'fireball') {
      this._light = new THREE.PointLight(color, 1.5, 4);
      this.mesh.add(this._light);
    }
  }

  update(dt) {
    if (this.dead) return;

    const step = this.speed * dt;
    this.mesh.position.addScaledVector(this.direction, step);
    this._traveled += step;

    // Check max range
    if (this._traveled >= this.maxRange) {
      this.dead = true;
      return;
    }

    // Check enemy hits
    if (this.enemies) {
      const raycaster = new THREE.Raycaster(
        this.mesh.position.clone(),
        this.direction.clone(),
        0, step + 0.2
      );
      const hits = raycaster.intersectObjects(this.enemies.getHitboxes(), true);
      if (hits.length > 0) {
        const enemy = this.enemies.getEnemyByObject(hits[0].object);
        if (enemy && !enemy.dead) {
          enemy.takeDamage(this.damage);
          this.audio.playSFX(this.damage > 25 ? 'fireballExplode' : 'arrowHit');
          if (this.particles) this.particles.spawnHit(hits[0].point, 'blood');
          spawnDamageNumber(hits[0].point, this.damage, null, '#ff8844');
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
