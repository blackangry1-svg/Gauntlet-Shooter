const fs = require('fs');
let content = fs.readFileSync('src/enemies/EnemyManager.js', 'utf8').replace(/\r\n/g, '\n');

const constructorRepl = `
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
`;
content = content.replace(/constructor\(scene, audio\) \{[\s\S]*?\}\s*(?=setWalls)/, constructorRepl.trim() + '\n\n  ');

const dieRepl = `
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
`;
content = content.replace(/_onEnemyDied\(enemy\) \{[\s\S]*?\}\s*(?=spawnProjectile)/, dieRepl.trim() + '\n\n  ');

const updateRepl = `
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
`;
content = content.replace(/update\(dt, playerPos\) \{[\s\S]*?\}\s*(?=getHitboxes)/, updateRepl.trim() + '\n\n  ');

fs.writeFileSync('src/enemies/EnemyManager.js', content, 'utf8');
