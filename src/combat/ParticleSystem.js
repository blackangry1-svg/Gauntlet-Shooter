/**
 * ParticleSystem.js — Object-pooled particle effects
 * Blood splats, sparks, magic dust
 * Pool size: 200 particles (safe for Intel UHD)
 */

const POOL_SIZE = 200;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this._pool = [];
    this._active = [];

    // Pre-allocate pool
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = this._createParticle();
      p.mesh.visible = false;
      this._pool.push(p);
      scene.add(p.mesh);
    }
  }

  _createParticle() {
    const geo = new THREE.PlaneGeometry(0.08, 0.08);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    return {
      mesh,
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
      dead: true,
    };
  }

  _getParticle() {
    const p = this._pool.pop();
    if (p) {
      p.dead = false;
      p.mesh.visible = true;
      this._active.push(p);
      return p;
    }
    return null;
  }

  _returnParticle(p) {
    p.dead = true;
    p.mesh.visible = false;
    this._pool.push(p);
  }

  /**
   * Spawn a burst at world position
   * type: 'blood' | 'slash' | 'magic' | 'spark'
   */
  spawnHit(pos, type = 'blood') {
    const count = type === 'magic' ? 12 : 8;
    const cfg = this._getConfig(type);

    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) break;

      p.mesh.position.copy(pos);
      p.mesh.material.color.set(cfg.color);
      p.mesh.material.opacity = 1.0;

      // Random velocity burst
      p.velocity.set(
        (Math.random() - 0.5) * cfg.speed,
        Math.random() * cfg.speed * 0.8 + 0.5,
        (Math.random() - 0.5) * cfg.speed
      );

      p.life    = cfg.life + Math.random() * cfg.life * 0.5;
      p.maxLife = p.life;
    }
  }

  _getConfig(type) {
    switch (type) {
      case 'blood':  return { color: 0xcc1111, speed: 3, life: 0.5 };
      case 'slash':  return { color: 0xffcc44, speed: 4, life: 0.3 };
      case 'magic':  return { color: 0x4488ff, speed: 3.5, life: 0.6 };
      case 'spark':  return { color: 0xffaa22, speed: 5, life: 0.4 };
      default:       return { color: 0xff4422, speed: 3, life: 0.4 };
    }
  }

  update(dt) {
    const gravity = -6;

    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];

      p.life -= dt;
      if (p.life <= 0) {
        this._active.splice(i, 1);
        this._returnParticle(p);
        continue;
      }

      // Physics
      p.velocity.y += gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Fade out
      const alpha = Math.max(0, p.life / p.maxLife);
      p.mesh.material.opacity = alpha;

      // Scale down
      const scale = alpha * 0.8 + 0.2;
      p.mesh.scale.setScalar(scale);
    }
  }

  clear() {
    for (const p of this._active) {
      this._returnParticle(p);
    }
    this._active = [];
  }
}
