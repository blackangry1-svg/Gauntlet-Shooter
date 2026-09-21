/**
 * MapLoader.js — The 5-Floor Elemental Tower Citadel
 * Complete zero-void geometry enclosure with seamless staircases & elevation:
 * Floor 1 (Y=0):  Crypt of the Damned (Earth/Undead) + Ornate Relic Chest
 * Floor 2 (Y=4):  Sunken Aqueducts (Water/Ice) + Shrine of Ash
 * Floor 3 (Y=8):  Smoldering Forges (Fire/Earth) + Golem Elite & Shortcut Lever
 * Floor 4 (Y=12): Gale Spire (Wind/Thunder) + High Sanctum Shrine
 * Floor 5 (Y=16): Throne of the Wizard King (Dark/Chaos) + Boss Arena
 */

/* global THREE */

const CELL = 3.0;
const WALL_H = 4.2;

export class MapLoader {
  constructor(scene) {
    this.scene = scene;
    this._meshes = [];
    this.walls = [];
    this.miniWalls = [];
    this.interactables = [];
    this.floorRamps = [];
    this.currentRoomBounds = { minX: -40, minZ: -5, maxX: 35, maxZ: 260 };

    // Shortcut gate reference
    this.shortcutGateWall = null;
    this.shortcutGateMesh = null;
    this.isShortcutUnlocked = false;

    // Boss fog gate reference
    this.bossFogMesh = null;
    this.bossFogWall = null;

    // Chest & Checkpoint
    this.isChestOpened = false;
    this.isCheckpointActive = false;
  }

  buildContinuousLevel(materials, player, audio, hud) {
    this.clear();

    const wallMat  = materials.wall;
    const floorMat = materials.floor;
    const ceilMat  = materials.ceil;

    // Build the 5 Ascending Tower Floors
    this._buildFloor1_Crypt(wallMat, floorMat, ceilMat, player, audio, hud);
    this._buildFloor2_Aqueducts(wallMat, floorMat, ceilMat, player, audio, hud);
    this._buildFloor3_Forges(wallMat, floorMat, ceilMat, audio, hud);
    this._buildFloor4_GaleSpire(wallMat, floorMat, ceilMat, player, audio, hud);
    this._buildFloor5_Throne(wallMat, floorMat, ceilMat);

    if (player && typeof player.setFloorRamps === 'function') {
      player.setFloorRamps(this.floorRamps);
    }

    return {
      walls: this.walls,
      interactables: this.interactables,
      floorRamps: this.floorRamps,
      bounds: this.currentRoomBounds,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GEOMETRY HELPERS (With explicit floor elevation Y support)
  // ─────────────────────────────────────────────────────────────
  _addWall(x, z, w, d, mat, floorY = 0, isShortcut = false) {
    const THREE = window.THREE;
    const geo = new THREE.BoxGeometry(w, WALL_H, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, floorY + WALL_H / 2, z);
    this.scene.add(mesh);
    this._meshes.push(mesh);

    const aabb = { x, z, w, d, floorY, isShortcut };
    this.walls.push(aabb);
    this.miniWalls.push(aabb);
    return { mesh, aabb };
  }

  _addFloor(x, z, w, d, mat, floorY = 0) {
    const THREE = window.THREE;
    const geo = new THREE.PlaneGeometry(w, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, floorY, z);
    this.scene.add(mesh);
    this._meshes.push(mesh);

    this.floorRamps.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      y: floorY,
      isSlope: false
    });
  }

  _addCeiling(x, z, w, d, mat, floorY = 0) {
    const THREE = window.THREE;
    const geo = new THREE.PlaneGeometry(w, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, floorY + WALL_H, z);
    this.scene.add(mesh);
    this._meshes.push(mesh);
  }

  _addStaircase(x, startZ, endZ, w, startY, endY, mat, wallMat) {
    const THREE = window.THREE;
    const length = Math.abs(endZ - startZ);
    const centerZ = (startZ + endZ) / 2;
    const heightDiff = endY - startY;

    // Sloped Ramp Mesh
    const rampGeo = new THREE.PlaneGeometry(w, length);
    const rampMesh = new THREE.Mesh(rampGeo, mat);
    const angle = Math.atan2(heightDiff, length);
    rampMesh.rotation.x = -Math.PI / 2 + angle;
    rampMesh.position.set(x, (startY + endY) / 2, centerZ);
    this.scene.add(rampMesh);
    this._meshes.push(rampMesh);

    // Ceiling over staircase
    const ceilMesh = new THREE.Mesh(rampGeo, mat);
    ceilMesh.rotation.x = Math.PI / 2 - angle;
    ceilMesh.position.set(x, (startY + endY) / 2 + WALL_H, centerZ);
    this.scene.add(ceilMesh);
    this._meshes.push(ceilMesh);

    // Side retaining walls along staircase
    this._addWall(x - w / 2 - 0.5, centerZ, 1.0, length, wallMat, Math.min(startY, endY));
    this._addWall(x + w / 2 + 0.5, centerZ, 1.0, length, wallMat, Math.min(startY, endY));

    // Register ramp in player physics
    this.floorRamps.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: Math.min(startZ, endZ), maxZ: Math.max(startZ, endZ),
      startY, endY, startZ, endZ,
      isSlope: true
    });
  }

  _addTorch(x, y, z, color = 0xff8833, intensity = 1.3) {
    const THREE = window.THREE;
    const light = new THREE.PointLight(color, intensity, 14);
    light.position.set(x, y, z);
    this.scene.add(light);
    this._meshes.push(light);

    // Sconce mesh
    const sconce = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.04, 0.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x332211, metalness: 0.8 })
    );
    sconce.position.set(x, y - 0.2, z);
    this.scene.add(sconce);
    this._meshes.push(sconce);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 1: CRYPT OF THE DAMNED (Y = 0)
  // X: -20..20, Z: -2..48
  // ─────────────────────────────────────────────────────────────
  _buildFloor1_Crypt(wallMat, floorMat, ceilMat, player, audio, hud) {
    const THREE = window.THREE;

    // Entrance Chamber (Z: -2..20)
    this._addFloor(0, 9, 10, 22, floorMat, 0);
    this._addCeiling(0, 9, 10, 22, ceilMat, 0);
    this._addWall(-5, 9, 1, 22, wallMat, 0);
    this._addWall(5, 9, 1, 22, wallMat, 0);
    this._addWall(0, -2, 10, 1, wallMat, 0); // South entrance boundary

    // Hall of the Damned (Z: 20..48)
    this._addFloor(0, 34, 16, 28, floorMat, 0);
    this._addCeiling(0, 34, 16, 28, ceilMat, 0);
    this._addWall(-8, 34, 1, 28, wallMat, 0);
    this._addWall(8, 34, 1, 28, wallMat, 0);

    // Pillars
    this._addWall(-3, 30, 2, 2, wallMat, 0);
    this._addWall(3, 30, 2, 2, wallMat, 0);

    // Secret Chest Alcove on West side (X: -14, Z: 36)
    this._addFloor(-12, 36, 8, 8, floorMat, 0);
    this._addCeiling(-12, 36, 8, 8, ceilMat, 0);
    this._addWall(-16, 36, 1, 8, wallMat, 0); // West alcove wall
    this._addWall(-12, 40, 8, 1, wallMat, 0); // North alcove wall
    this._addWall(-12, 32, 8, 1, wallMat, 0); // South alcove wall

    // ── TWO-PART ANIMATED RELIC CHEST ──
    const chestGroup = new THREE.Group();
    chestGroup.position.set(-14, 0, 36);

    const baseGeo = new THREE.BoxGeometry(1.4, 0.7, 1.0);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x6e451f, roughness: 0.6, metalness: 0.3 });
    const chestBase = new THREE.Mesh(baseGeo, baseMat);
    chestBase.position.y = 0.35;
    chestGroup.add(chestBase);

    // Hinged Lid (pivot at back edge)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 0.7, -0.5);
    const lidGeo = new THREE.BoxGeometry(1.44, 0.25, 1.04);
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x8a5525, roughness: 0.5, metalness: 0.4 });
    const lidMesh = new THREE.Mesh(lidGeo, lidMat);
    lidMesh.position.set(0, 0.12, 0.5);
    lidGroup.add(lidMesh);

    // Golden lock clasp
    const lockGeo = new THREE.BoxGeometry(0.24, 0.28, 0.12);
    const lockMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 });
    const lockMesh = new THREE.Mesh(lockGeo, lockMat);
    lockMesh.position.set(0, 0.05, 1.04);
    lidGroup.add(lockMesh);

    chestGroup.add(lidGroup);
    this.scene.add(chestGroup);
    this._meshes.push(chestGroup);

    // Interactive Chest Definition
    const chestItem = {
      position: new THREE.Vector3(-14, 1.0, 36),
      radius: 2.4,
      active: true,
      onInteract: () => {
        if (this.isChestOpened) return;
        this.isChestOpened = true;
        chestItem.active = false; // Immediately dismiss prompt

        audio.playSFX('chestOpen');

        // Smoothly animate lid swing backwards
        let angle = 0;
        const openAnim = setInterval(() => {
          angle += 0.08;
          lidGroup.rotation.x = -Math.min(Math.PI * 0.55, angle);
          if (angle >= Math.PI * 0.55) clearInterval(openAnim);
        }, 16);

        // Golden light erupts from chest
        const lootLight = new THREE.PointLight(0xffea44, 3.0, 8);
        lootLight.position.set(-14, 1.2, 36);
        this.scene.add(lootLight);
        this._meshes.push(lootLight);

        if (player) {
          player.maxHealth += 40;
          player.health = player.maxHealth;
          player.maxStamina += 25;
          player.stamina = player.maxStamina;
          player.maxFlasks += 1;
          player.flasks = player.maxFlasks;
        }

        if (hud && typeof hud.showCheckpointBanner === 'function') {
          hud.showCheckpointBanner();
          const bTxt = document.querySelector('#checkpoint-banner .banner-text');
          const bSub = document.querySelector('#checkpoint-banner .banner-sub');
          if (bTxt) bTxt.textContent = '👑 CREST OF FORTITUDE';
          if (bSub) bSub.textContent = '+40 HP · +25 Stamina · +1 Soul Flask (All Restored)';
        }
      }
    };
    this.interactables.push(chestItem);

    // Grand Staircase 1: Rising from Floor 1 (Y=0, Z=48) to Floor 2 (Y=4, Z=66)
    this._addStaircase(0, 48, 66, 8, 0, 4, floorMat, wallMat);

    this._addTorch(0, 2.5, 8);
    this._addTorch(-4.2, 2.5, 26);
    this._addTorch(4.2, 2.5, 26);
    this._addTorch(-14, 2.5, 36, 0x44aaff);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 2: SUNKEN AQUEDUCTS (Y = 4)
  // X: -25..25, Z: 66..116
  // Water/Ice themed, Shrine of Ash at (-12, 4, 88)
  // ─────────────────────────────────────────────────────────────
  _buildFloor2_Aqueducts(wallMat, floorMat, ceilMat, player, audio, hud) {
    const THREE = window.THREE;
    const floorY = 4;

    // Floor 2 Main Hall (Z: 66..100)
    this._addFloor(0, 83, 24, 34, floorMat, floorY);
    this._addCeiling(0, 83, 24, 34, ceilMat, floorY);
    this._addWall(-12, 83, 1, 34, wallMat, floorY);
    this._addWall(12, 83, 1, 34, wallMat, floorY);

    // Central Water Basin
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.5, 0.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x113355, roughness: 0.1, metalness: 0.8 })
    );
    basin.position.set(0, floorY + 0.2, 83);
    this.scene.add(basin);
    this._meshes.push(basin);

    // Shrine of Ash (Bonfire Checkpoint) at (-8, floorY, 88)
    const shrineLight = new THREE.PointLight(0xffb833, 2.4, 14);
    shrineLight.position.set(-8, floorY + 1.2, 88);
    this.scene.add(shrineLight);
    this._meshes.push(shrineLight);

    const flameMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdd44 })
    );
    flameMesh.position.set(-8, floorY + 0.9, 88);
    this.scene.add(flameMesh);
    this._meshes.push(flameMesh);

    // Shrine Interactable
    this.interactables.push({
      position: new THREE.Vector3(-8, floorY + 1.0, 88),
      radius: 3.2,
      active: true,
      onInteract: () => {
        this.isCheckpointActive = true;
        if (player) {
          player.restAtCheckpoint(new THREE.Vector3(-8, floorY + 1.7, 85));
        }
        audio.playSFX('bonfireRest');
        if (hud && typeof hud.showCheckpointBanner === 'function') {
          hud.showCheckpointBanner();
          const bTxt = document.querySelector('#checkpoint-banner .banner-text');
          const bSub = document.querySelector('#checkpoint-banner .banner-sub');
          if (bTxt) bTxt.textContent = '🔥 SHRINE OF ASH RESTED';
          if (bSub) bSub.textContent = 'Party Restored · Enemies Respawned · Progress Saved';
        }
      }
    });

    // Grand Staircase 2: Rising from Floor 2 (Y=4, Z=100) to Floor 3 (Y=8, Z=118)
    this._addStaircase(0, 100, 118, 8, 4, 8, floorMat, wallMat);

    this._addTorch(-10, floorY + 2.5, 74, 0x33bbff);
    this._addTorch(10, floorY + 2.5, 74, 0x33bbff);
    this._addTorch(-8, floorY + 2.5, 88, 0xffaa33);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 3: SMOLDERING FORGES (Y = 8)
  // X: -25..25, Z: 118..166
  // Fire/Earth themed, Stone Golem Arena, Shortcut Lever
  // ─────────────────────────────────────────────────────────────
  _buildFloor3_Forges(wallMat, floorMat, ceilMat, audio, hud) {
    const floorY = 8;

    // Forge Arena (Z: 118..150)
    this._addFloor(0, 134, 28, 32, floorMat, floorY);
    this._addCeiling(0, 134, 28, 32, ceilMat, floorY);
    this._addWall(-14, 134, 1, 32, wallMat, floorY);
    this._addWall(14, 134, 1, 32, wallMat, floorY);

    // Shortcut Lever on West Wall (X: -12, Z: 135)
    this.interactables.push({
      position: new window.THREE.Vector3(-12, floorY + 1.0, 135),
      radius: 2.8,
      active: true,
      onInteract: () => {
        if (this.isShortcutUnlocked) return;
        this.isShortcutUnlocked = true;
        audio.playSFX('leverPull');
        if (hud && typeof hud.showCheckpointBanner === 'function') {
          hud.showCheckpointBanner();
          const bTxt = document.querySelector('#checkpoint-banner .banner-text');
          const bSub = document.querySelector('#checkpoint-banner .banner-sub');
          if (bTxt) bTxt.textContent = '⚙️ IRON PORTCULLIS OPENED';
          if (bSub) bSub.textContent = 'Shortcut to Lower Catacombs is now unsealed!';
        }
      }
    });

    // Grand Staircase 3: Rising from Floor 3 (Y=8, Z=150) to Floor 4 (Y=12, Z=168)
    this._addStaircase(0, 150, 168, 8, 8, 12, floorMat, wallMat);

    this._addTorch(-12, floorY + 2.5, 126, 0xff4411);
    this._addTorch(12, floorY + 2.5, 126, 0xff4411);
    this._addTorch(-12, floorY + 2.5, 142, 0xff4411);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 4: GALE SPIRE (Y = 12)
  // X: -25..25, Z: 168..214
  // Wind/Thunder themed, High Battlement, Shrine 2
  // ─────────────────────────────────────────────────────────────
  _buildFloor4_GaleSpire(wallMat, floorMat, ceilMat, player, audio, hud) {
    const floorY = 12;

    this._addFloor(0, 186, 26, 36, floorMat, floorY);
    this._addCeiling(0, 186, 26, 36, ceilMat, floorY);
    this._addWall(-13, 186, 1, 36, wallMat, floorY);
    this._addWall(13, 186, 1, 36, wallMat, floorY);

    // Shrine 2 (High Sanctum Bonfire) at (8, floorY, 192)
    const shrineLight2 = new window.THREE.PointLight(0xffb833, 2.4, 14);
    shrineLight2.position.set(8, floorY + 1.2, 192);
    this.scene.add(shrineLight2);
    this._meshes.push(shrineLight2);

    this.interactables.push({
      position: new window.THREE.Vector3(8, floorY + 1.0, 192),
      radius: 3.2,
      active: true,
      onInteract: () => {
        this.isCheckpointActive = true;
        if (player) player.restAtCheckpoint(new window.THREE.Vector3(8, floorY + 1.7, 189));
        audio.playSFX('bonfireRest');
        if (hud && typeof hud.showCheckpointBanner === 'function') {
          hud.showCheckpointBanner();
          const bTxt = document.querySelector('#checkpoint-banner .banner-text');
          const bSub = document.querySelector('#checkpoint-banner .banner-sub');
          if (bTxt) bTxt.textContent = '⚡ HIGH SANCTUM SHRINE';
          if (bSub) bSub.textContent = 'Party Restored · Enemies Respawned · Progress Saved';
        }
      }
    });

    // Grand Staircase 4: Rising from Floor 4 (Y=12, Z=204) to Floor 5 (Y=16, Z=222)
    this._addStaircase(0, 204, 222, 10, 12, 16, floorMat, wallMat);

    this._addTorch(-11, floorY + 2.5, 178, 0xffdd22);
    this._addTorch(11, floorY + 2.5, 178, 0xffdd22);
    this._addTorch(8, floorY + 2.5, 192, 0xffaa33);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 5: THRONE OF THE WIZARD KING (Y = 16)
  // X: -25..25, Z: 222..265
  // Final Boss Cathedral & Rescue the Queen
  // ─────────────────────────────────────────────────────────────
  _buildFloor5_Throne(wallMat, floorMat, ceilMat) {
    const floorY = 16;

    // Vast Cathedral Arena
    this._addFloor(0, 244, 34, 44, floorMat, floorY);
    this._addCeiling(0, 244, 34, 44, ceilMat, floorY);

    this._addWall(-17, 244, 1, 44, wallMat, floorY); // West
    this._addWall(17, 244, 1, 44, wallMat, floorY);  // East
    this._addWall(0, 266, 34, 1, wallMat, floorY);   // North (Back of throne)

    // Boss Pillars
    this._addWall(-8, 238, 2.5, 2.5, wallMat, floorY);
    this._addWall(8, 238, 2.5, 2.5, wallMat, floorY);
    this._addWall(-8, 252, 2.5, 2.5, wallMat, floorY);
    this._addWall(8, 252, 2.5, 2.5, wallMat, floorY);

    // Dark Purple Torches
    this._addTorch(-15, floorY + 3.0, 232, 0xaa22ff, 1.8);
    this._addTorch(15, floorY + 3.0, 232, 0xaa22ff, 1.8);
    this._addTorch(-15, floorY + 3.0, 256, 0xaa22ff, 1.8);
    this._addTorch(15, floorY + 3.0, 256, 0xaa22ff, 1.8);
  }

  sealBossArena() {
    if (this.bossFogMesh) return;
    const THREE = window.THREE;
    const geo = new THREE.PlaneGeometry(10, WALL_H);
    const mat = new THREE.MeshBasicMaterial({ color: 0xaa22ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
    this.bossFogMesh = new THREE.Mesh(geo, mat);
    this.bossFogMesh.position.set(0, 16 + WALL_H / 2, 222);
    this.scene.add(this.bossFogMesh);
    this._meshes.push(this.bossFogMesh);

    const aabb = { x: 0, z: 222, w: 10, d: 1.0, isFogWall: true };
    this.walls.push(aabb);
    this.bossFogWall = aabb;
  }

  clear() {
    for (const m of this._meshes) {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
        else m.material.dispose();
      }
    }
    this._meshes = [];
    this.walls = [];
    this.miniWalls = [];
    this.interactables = [];
    this.floorRamps = [];
    this.bossFogMesh = null;
    this.bossFogWall = null;
    this.isChestOpened = false;
    this.isCheckpointActive = false;
  }
}
