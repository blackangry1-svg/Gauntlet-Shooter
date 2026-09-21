/**
 * EnemyManager.js — Spawns and manages all enemies
 * Billboard sprite enemies with Souls AI (telegraphs, punish windows)
 */
import { Enemy, OrcGrunt, SkeletonArcher, DeathBat, StoneGolem, DeathKnight } from './Enemy.js';

export class EnemyManager {
  constructor(scene, audio) {
    this.scene  = scene;
    this.audio  = audio;
    this._enemies = [];
    this._hitboxes = [];
    this.enemyProjectiles = [];
    this.walls = [];
    this.floorRamps = [];
    this.onBossHealthChange = null;
    this.onScore = null;
    this.onKill = null;
    this.boss = null;
  }

  setWalls(walls) {
    this.walls = Array.isArray(walls) ? walls : [];
    for (const e of this._enemies) {
      e.setWalls(this.walls);
    }
  }

  setFloorRamps(ramps) {
    this.floorRamps = Array.isArray(ramps) ? ramps : [];
    for (const e of this._enemies) {
      e.setFloorRamps(this.floorRamps);
    }
  }

  spawnEnemy(TypeClass, position, player, camera) {
    const enemy = new TypeClass(this.scene, this.audio, this);
    enemy.mesh.position.copy(position);
    enemy.player = player;
    enemy.camera = camera;
    enemy.setWalls(this.walls);
    enemy.setFloorRamps(this.floorRamps);
    this._addEnemy(enemy);
    if (enemy.isBoss) this.boss = enemy;
    return enemy;
  }

  _addEnemy(enemy) {
    this._enemies.push(enemy);
    this.scene.add(enemy.mesh);

    // Track hitbox mesh
    if (enemy.hitbox) {
      enemy.hitbox.userData.enemy = enemy;
      this._hitboxes.push(enemy.hitbox);
    }

    enemy.onDeath = () => {
      this._onEnemyDied(enemy);
    };
  }

  _onEnemyDied(enemy) {
    this.audio.playSFX('enemyDeath');
    if (this.onScore) this.onScore(enemy.scoreValue);
    if (this.onKill) this.onKill(enemy);

    const alive = this._enemies.filter(e => !e.dead).length;
    const countEl = document.getElementById('enemy-count');
    if (countEl) countEl.textContent = alive;

    if (enemy.isBoss && this.onBossHealthChange) {
      this.onBossHealthChange(false, 0);
    }
  }

  spawnProjectile(proj) {
    this.enemyProjectiles.push(proj);
  }

  update(dt, playerPos) {
    let bossAlive = false;
    let bossHpPct = 0;

    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const enemy = this._enemies[i];
      if (!enemy.dead) {
        enemy.update(dt, playerPos);
        if (enemy.isBoss) {
          bossAlive = true;
          bossHpPct = Math.max(0, enemy.health / enemy.maxHealth);
        }
      }
    }

    // Update enemy projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.update(dt);
      if (p.dead) {
        p.removeFromScene();
        this.enemyProjectiles.splice(i, 1);
      }
    }

    if (this.onBossHealthChange) {
      this.onBossHealthChange(bossAlive, bossHpPct);
    }
  }

  getHitboxes() {
    return this._hitboxes.filter(h => h.userData.enemy && !h.userData.enemy.dead);
  }

  getAll() {
    return this._enemies;
  }

  getEnemyByObject(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.enemy) return o.userData.enemy;
      o = o.parent;
    }
    return null;
  }

  clear() {
    for (const e of this._enemies) {
      this.scene.remove(e.mesh);
      if (typeof e.dispose === 'function') {
        e.dispose();
      }
    }
    for (const p of this.enemyProjectiles) {
      p.removeFromScene();
    }
    this.enemyProjectiles = [];
    this._enemies = [];
    this._hitboxes = [];
    this.boss = null;
  }
}
