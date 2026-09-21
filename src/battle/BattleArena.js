/**
 * BattleArena.js
 * 3D Staged Battle Arena for the 4-Hero Squad vs. Enemy Horde
 * Left: 4 Party Heroes (Pre-rendered 3D sprites)
 * Right: Enemy Formation (1 to 4 enemies)
 */

/* global THREE */

export class BattleArena {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    // Elevate arena into sky realm so it never intersects with the 5 dungeon floors
    this.group.position.set(0, 300, 0);
    this.scene.add(this.group);

    this.heroMeshes = [];
    this.enemyMeshes = [];
    this._arenaMeshes = [];

    this._buildStage();
  }

  _buildStage() {
    const THREE = window.THREE;

    // Arena Floor
    const floorGeo = new THREE.PlaneGeometry(24, 18);
    const floorMat = new THREE.MeshLambertMaterial({
      color: 0x1a1512,
      side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    this.group.add(floor);
    this._arenaMeshes.push(floor);

    // Arena Back Wall
    const wallGeo = new THREE.PlaneGeometry(24, 10);
    const wallMat = new THREE.MeshLambertMaterial({
      color: 0x221815,
      side: THREE.DoubleSide
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 5, -8);
    this.group.add(backWall);
    this._arenaMeshes.push(backWall);

    // Dramatic Combat Sconces / Lighting
    const leftLight = new THREE.PointLight(0xff7722, 2.0, 16);
    leftLight.position.set(-6, 4, -4);
    this.group.add(leftLight);
    this._arenaMeshes.push(leftLight);

    const rightLight = new THREE.PointLight(0x5599ff, 1.8, 16);
    rightLight.position.set(6, 4, -4);
    this.group.add(rightLight);
    this._arenaMeshes.push(rightLight);

    const rimLight = new THREE.DirectionalLight(0xfff0dd, 0.6);
    rimLight.position.set(0, 10, 6);
    this.group.add(rimLight);
    this._arenaMeshes.push(rimLight);
  }

  setupBattle(partyMembers, enemySquad, camera = null) {
    const THREE = window.THREE;
    this.clearEntities();

    // Position the 4 Heroes on the Left side
    // Formations: (X: -5.5 to -3.5, Z: -2.5 to 2.5)
    const heroPositions = [
      { x: -3.8, y: 1.2, z: -1.4 }, // Warrior (Front Top)
      { x: -3.8, y: 1.2, z:  1.4 }, // Valkyrie (Front Bottom)
      { x: -6.2, y: 1.2, z: -2.2 }, // Elf (Back Top)
      { x: -6.2, y: 1.2, z:  2.2 }, // Wizard (Back Bottom)
    ];

    const texLoader = new THREE.TextureLoader();

    partyMembers.forEach((hero, i) => {
      const pos = heroPositions[i] || { x: -4, y: 1.2, z: 0 };
      const tex = texLoader.load(hero.spritePath);
      tex.magFilter = THREE.NearestFilter;
      tex.repeat.set(0.25, 0.25); // sample single sprite cell
      tex.offset.set(0, 0.75);

      const mat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.2,
        side: THREE.DoubleSide
      });

      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4), mat);
      plane.position.set(pos.x, pos.y, pos.z);
      plane.rotation.y = Math.PI / 8; // angled slightly toward enemy squad

      this.group.add(plane);
      this.heroMeshes.push({ member: hero, mesh: plane, origPos: { ...pos } });
    });

    // Position Enemy Squad on the Right side
    // Up to 4 enemies in a staggered vanguard/rearguard
    const enemyPositions = [
      { x: 3.8, y: 1.2, z: -1.2 },
      { x: 3.8, y: 1.2, z:  1.2 },
      { x: 6.2, y: 1.2, z: -2.2 },
      { x: 6.2, y: 1.2, z:  2.2 },
    ];

    enemySquad.forEach((enemy, i) => {
      const pos = enemyPositions[i] || { x: 4, y: 1.2, z: 0 };
      const tex = texLoader.load(enemy.spritePath);
      tex.magFilter = THREE.NearestFilter;
      tex.repeat.set(1 / (enemy.cols || 4), 1 / (enemy.rows || 4));
      tex.offset.set(0, 1 - 1 / (enemy.rows || 4));

      const mat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.25,
        side: THREE.DoubleSide
      });

      const plane = new THREE.Mesh(new THREE.PlaneGeometry(enemy.width || 2.0, enemy.height || 2.5), mat);
      plane.position.set(pos.x, pos.y, pos.z);
      plane.rotation.y = -Math.PI / 8; // angled toward party

      this.group.add(plane);
      this.enemyMeshes.push({ enemy, mesh: plane, origPos: { ...pos } });
    });

    this.group.visible = true;

    // Position camera for cinematic Paper Mario / FF tactical view
    if (camera) {
      camera.position.set(0, 302.4, 7.8);
      camera.lookAt(0, 301.2, 0);
      camera.updateMatrixWorld();
    }
  }

  playHeroAttackAnimation(heroIndex, targetMesh, onImpact, onFinish) {
    const hero = this.heroMeshes[heroIndex];
    if (!hero) { if (onImpact) onImpact(); if (onFinish) onFinish(); return; }

    const orig = hero.origPos;
    const destX = targetMesh ? targetMesh.position.x - 1.5 : orig.x + 2.5;
    const destZ = targetMesh ? targetMesh.position.z : orig.z;

    // Quick lunge forward
    let t = 0;
    const lunge = setInterval(() => {
      t += 0.12;
      hero.mesh.position.x = orig.x + (destX - orig.x) * Math.min(1, t);
      hero.mesh.position.z = orig.z + (destZ - orig.z) * Math.min(1, t);

      if (t >= 1.0) {
        clearInterval(lunge);
        if (onImpact) onImpact();

        // Return back to formation
        setTimeout(() => {
          let r = 0;
          const retreat = setInterval(() => {
            r += 0.15;
            hero.mesh.position.x = destX + (orig.x - destX) * Math.min(1, r);
            hero.mesh.position.z = destZ + (orig.z - destZ) * Math.min(1, r);
            if (r >= 1.0) {
              clearInterval(retreat);
              hero.mesh.position.set(orig.x, orig.y, orig.z);
              if (onFinish) onFinish();
            }
          }, 20);
        }, 250);
      }
    }, 20);
  }

  playEnemyHitFlash(enemyIndex, colorHex = 0xff3333) {
    const entry = this.enemyMeshes[enemyIndex];
    if (!entry || !entry.mesh.material) return;
    const mat = entry.mesh.material;
    mat.emissive = new THREE.Color(colorHex);
    mat.emissiveIntensity = 1.6;
    setTimeout(() => {
      mat.emissive.setRGB(0, 0, 0);
      mat.emissiveIntensity = 0;
    }, 180);
  }

  hide() {
    this.group.visible = false;
    this.clearEntities();
  }

  clearEntities() {
    [...this.heroMeshes, ...this.enemyMeshes].forEach(entry => {
      this.group.remove(entry.mesh);
      if (entry.mesh.geometry) entry.mesh.geometry.dispose();
      if (entry.mesh.material) {
        if (entry.mesh.material.map) entry.mesh.material.map.dispose();
        entry.mesh.material.dispose();
      }
    });
    this.heroMeshes = [];
    this.enemyMeshes = [];
  }
}

