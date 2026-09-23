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
    this._frameCount = 0;

    const bloodGeo = new THREE.PlaneGeometry(1.2, 1.2);
    bloodGeo.rotateX(-Math.PI / 2);
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8b0000, transparent: true, opacity: 0.7, depthWrite: false });
    this.bloodInstanced = new THREE.InstancedMesh(bloodGeo, bloodMat, 500);
    this.bloodInstanced.count = 0;
    scene.add(this.bloodInstanced);
    this.bloodDummy = new THREE.Object3D();
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

    if (this.bloodInstanced && this.bloodInstanced.count < 500) {
      this.bloodDummy.position.copy(enemy.mesh.position);
      this.bloodDummy.position.y = enemy.getGroundY(enemy.mesh.position.x, enemy.mesh.position.z) + 0.02;
      this.bloodDummy.rotation.y = Math.random() * Math.PI * 2;
      this.bloodDummy.updateMatrix();
      this.bloodInstanced.setMatrixAt(this.bloodInstanced.count, this.bloodDummy.matrix);
      this.bloodInstanced.instanceMatrix.needsUpdate = true;
      this.bloodInstanced.count++;
    }
  }

  spawnProjectile(proj) {
    this.enemyProjectiles.push(proj);
  }

  update(dt, playerPos) {
    let bossAlive = false;
    let bossHpPct = 0;

    this._frameCount++;

    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const enemy = this._enemies[i];
      if (!enemy.dead) {
        if (enemy.isBoss) {
          enemy.update(dt, playerPos);
          bossAlive = true;
          bossHpPct = Math.max(0, enemy.health / enemy.maxHealth);
          continue;
        }

        if (playerPos) {
          const dist = enemy.mesh.position.distanceTo(playerPos);
          const yDiff = Math.abs(enemy.mesh.position.y - playerPos.y);

          if (dist > 50 || yDiff > 3.5) {
            enemy.mesh.visible = false;
          } else if (dist >= 25) {
            enemy.mesh.visible = true;
            if (this._frameCount % 12 === 0) {
              if (enemy.camera) {
                enemy.mesh.lookAt(enemy.camera.position.x, enemy.mesh.position.y, enemy.camera.position.z);
              }
              const dir = new THREE.Vector3().subVectors(playerPos, enemy.mesh.position);
              dir.y = 0;
              if (dir.lengthSq() > 0.01) {
                dir.normalize();
                const moveDist = enemy.speed * (dt * 12);
                enemy.mesh.position.addScaledVector(dir, moveDist);
                if (enemy.enemyType === 'bat') {
                  enemy.mesh.position.y = enemy.getGroundY(enemy.mesh.position.x, enemy.mesh.position.z) + 1.3;
                } else {
                  enemy.mesh.position.y = enemy.getGroundY(enemy.mesh.position.x, enemy.mesh.position.z);
                }
              }
            }
          } else {
            enemy.mesh.visible = true;
            enemy.update(dt, playerPos);
          }
        } else {
          enemy.update(dt, playerPos);
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
