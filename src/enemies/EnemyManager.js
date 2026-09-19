/**
 * EnemyManager.js — Spawns and manages all enemies
 * Billboard sprite enemies with simple AI
 * AI updated at 20Hz from main loop (every 3 frames)
 */
import { Enemy, OrcGrunt, SkeletonArcher, DeathBat, StoneGolem, DeathKnight } from './Enemy.js';
import { spawnDamageNumber } from '../combat/HitDetection.js';


export class EnemyManager {
  constructor(scene, audio) {
    this.scene  = scene;
    this.audio  = audio;
    this._enemies = [];
    this._hitboxes = [];
    this._onAllDead = null;
    this.onBossHealthChange = null;
    this.onScore = null;   // injected by main.js — (points) => void

    // Score values per enemy type
    this._scoreMap = {
      orc: 100, archer: 150, bat: 80, golem: 300, boss: 2000
    };
  }


  spawnForRoom(roomIndex, isBoss, player, camera, state, onCleared) {
    this._enemies = [];
    this._hitboxes = [];
    this._onAllDead = onCleared;

    // Get open spawn positions from MapLoader (injected externally)
    const spawnPositions = this._getSpawnPositions(roomIndex, isBoss);

    if (isBoss) {
      // Boss room — one Death Knight + some minions
      const boss = new DeathKnight(this.scene, this.audio);
      boss.isBoss = true;
      boss.mesh.position.copy(spawnPositions[0] || new THREE.Vector3(10, 0, 10));
      boss.player = player;
      boss.camera = camera;
      this._addEnemy(boss);

      // 4 orc minions
      for (let i = 1; i < Math.min(5, spawnPositions.length); i++) {
        const orc = new OrcGrunt(this.scene, this.audio);
        orc.mesh.position.copy(spawnPositions[i]);
        orc.player = player;
        orc.camera = camera;
        this._addEnemy(orc);
      }
    } else {
      // Normal room — escalating difficulty by room
      const count = 3 + roomIndex * 2;
      const types = this._getRoomEnemyTypes(roomIndex);

      for (let i = 0; i < Math.min(count, spawnPositions.length); i++) {
        const TypeClass = types[i % types.length];
        const enemy = new TypeClass(this.scene, this.audio);
        enemy.mesh.position.copy(spawnPositions[i]);
        enemy.player = player;
        enemy.camera = camera;
        this._addEnemy(enemy);
      }
    }

    // Update enemy count HUD
    document.getElementById('enemy-count').textContent = this._enemies.length;
  }

  _getRoomEnemyTypes(roomIndex) {
    if (roomIndex === 0) return [OrcGrunt];
    if (roomIndex === 1) return [OrcGrunt, SkeletonArcher];
    if (roomIndex === 2) return [OrcGrunt, SkeletonArcher, DeathBat];
    if (roomIndex === 3) return [SkeletonArcher, DeathBat];
    if (roomIndex === 4) return [OrcGrunt, StoneGolem, SkeletonArcher];
    if (roomIndex === 5) return [StoneGolem, DeathBat, SkeletonArcher];
    if (roomIndex === 6) return [OrcGrunt, StoneGolem, DeathBat, SkeletonArcher];
    return [OrcGrunt, SkeletonArcher];
  }

  _getSpawnPositions(roomIndex, isBoss) {
    // Simple deterministic spawn grid (MapLoader not directly accessible here)
    // Generate grid positions across room
    const count = isBoss ? 8 : 16;
    const positions = [];
    const baseX = roomIndex * 2;
    const baseZ = roomIndex * 40; // rooms are ~40 units apart
    for (let i = 0; i < count; i++) {
      positions.push(new THREE.Vector3(
        baseX + 3 + (i % 4) * 6 + Math.random() * 2,
        0,
        baseZ + 6 + Math.floor(i / 4) * 5 + Math.random() * 2
      ));
    }
    return positions;
  }

  setSpawnPositions(roomIndex, openPositions) {
    // Called by main.js after MapLoader provides positions
    // Repositions already-spawned enemies to actual open cells
    let i = 0;
    for (const enemy of this._enemies) {
      if (openPositions[i]) {
        enemy.mesh.position.copy(openPositions[i]);
        enemy.mesh.position.y = 0;
        i++;
      }
    }
  }

  _addEnemy(enemy) {
    this._enemies.push(enemy);
    this.scene.add(enemy.mesh);

    // Build hitbox list
    enemy.mesh.traverse(child => {
      if (child.isMesh) {
        child.userData.enemy = enemy;
        this._hitboxes.push(child);
      }
    });

    // Hook death callback
    enemy.onDeath = () => {
      this._onEnemyDied(enemy);
    };
  }

  _onEnemyDied(enemy) {
    this.audio.playSFX('enemyDeath');

    // Score
    const pts = this._scoreMap[enemy.enemyType] || 100;
    if (this.onScore) this.onScore(pts);


    // Update HUD
    const alive = this._enemies.filter(e => !e.dead).length;
    document.getElementById('enemy-count').textContent = alive;

    // Check all dead
    if (alive === 0 && this._onAllDead) {
      this._onAllDead();
    }
  }

  update(dt, playerPos, frameCount) {
    let bossAlive = false;
    let bossHpPct = 0;

    for (const enemy of this._enemies) {
      if (!enemy.dead) {
        enemy.update(dt, playerPos);

        if (enemy.isBoss) {
          bossAlive = true;
          bossHpPct = enemy.health / enemy.maxHealth;
        }
      }
    }

    // Boss health bar
    if (bossAlive && this.onBossHealthChange) {
      this.onBossHealthChange(bossHpPct);
    }
  }

  getHitboxes()   { return this._hitboxes.filter(h => h.userData.enemy && !h.userData.enemy.dead); }
  getAll()        { return this._enemies; }

  getEnemyByObject(obj) {
    // Walk up the object tree looking for userData.enemy
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
      e.dispose();
    }
    this._enemies = [];
    this._hitboxes = [];
  }
}
