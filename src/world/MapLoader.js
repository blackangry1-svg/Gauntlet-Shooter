/**
 * MapLoader.js — Continuous Interconnected Souls-Doom Level
 * Single cohesive level featuring:
 * 1. Crypt Entrance (safe tutorial)
 * 2. Hall of the Damned (first combat)
 * 3. Catacomb Junction (hub with locked shortcut gate)
 * 4. Sunken Vault (branch with skeleton archers & secret upgrade chest)
 * 5. Shrine of Ash (bonfire checkpoint)
 * 6. High Ramparts & Lever (Stone Golem elite + shortcut lever opening iron gate)
 * 7. Blood Cloister (bats & grunts final approach)
 * 8. Throne of the Death Knight (epic boss arena with fog gate)
 */

const CELL = 3.0;
const WALL_H = 4.2;

export class MapLoader {
  constructor(scene) {
    this.scene = scene;
    this._meshes = [];
    this.walls = [];
    this.miniWalls = [];
    this.interactables = [];
    this.currentRoomBounds = { minX: -35, minZ: -5, maxX: 30, maxZ: 215 };

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

    // Build regions
    this._buildCryptEntrance(wallMat, floorMat, ceilMat);
    this._buildHallOfDamned(wallMat, floorMat, ceilMat);
    this._buildCatacombJunction(wallMat, floorMat, ceilMat);
    this._buildSunkenVault(wallMat, floorMat, ceilMat, player, audio, hud);
    this._buildShrineOfAsh(wallMat, floorMat, ceilMat, player, audio, hud);
    this._buildHighRamparts(wallMat, floorMat, ceilMat, audio, hud);
    this._buildBloodCloister(wallMat, floorMat, ceilMat);
    this._buildBossArena(wallMat, floorMat, ceilMat);

    return {
      walls: this.walls,
      interactables: this.interactables,
      bounds: this.currentRoomBounds,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GEOMETRY HELPERS
  // ─────────────────────────────────────────────────────────────
  _addWall(x, z, w, d, mat, isShortcut = false) {
    const geo = new THREE.BoxGeometry(w, WALL_H, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, WALL_H / 2, z);
    this.scene.add(mesh);
    this._meshes.push(mesh);

    const aabb = { x, z, w, d, isShortcut };
    this.walls.push(aabb);
    this.miniWalls.push(aabb);
    return { mesh, aabb };
  }

  _addFloor(x, z, w, d, mat) {
    const geo = new THREE.PlaneGeometry(w, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this._meshes.push(mesh);
  }

  _addCeiling(x, z, w, d, mat) {
    const geo = new THREE.PlaneGeometry(w, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, WALL_H, z);
    this.scene.add(mesh);
    this._meshes.push(mesh);
  }

  _addTorch(x, y, z, color = 0xff7722, intensity = 1.4, distance = 9) {
    const light = new THREE.PointLight(color, intensity, distance);
    light.position.set(x, y, z);
    this.scene.add(light);
    this._meshes.push(light);

    // Torch sconce mesh
    const sconceGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.4, 6);
    const sconceMat = new THREE.MeshStandardMaterial({ color: 0x221810, metalness: 0.8, roughness: 0.4 });
    const sconce = new THREE.Mesh(sconceGeo, sconceMat);
    sconce.position.set(x, y - 0.2, z);
    this.scene.add(sconce);
    this._meshes.push(sconce);

    // Glowing flame sphere
    const flameGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const flameMat = new THREE.MeshBasicMaterial({ color });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(x, y, z);
    this.scene.add(flame);
    this._meshes.push(flame);
  }

  // ─────────────────────────────────────────────────────────────
  // 1. CRYPT ENTRANCE (Safe tutorial zone)
  // X: -5..5, Z: -2..18
  // ─────────────────────────────────────────────────────────────
  _buildCryptEntrance(wallMat, floorMat, ceilMat) {
    this._addFloor(0, 8, 12, 22, floorMat);
    this._addCeiling(0, 8, 12, 22, ceilMat);

    // Back wall
    this._addWall(0, -3, 14, 2, wallMat);
    // Left & Right boundary walls
    this._addWall(-6, 8, 2, 24, wallMat);
    this._addWall(6, 8, 2, 24, wallMat);

    // Entrance arch torches
    this._addTorch(-4.8, 2.4, 2);
    this._addTorch(4.8, 2.4, 2);
    this._addTorch(-4.8, 2.4, 14);
    this._addTorch(4.8, 2.4, 14);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. HALL OF THE DAMNED (First encounter)
  // X: -8..8, Z: 18..44
  // ─────────────────────────────────────────────────────────────
  _buildHallOfDamned(wallMat, floorMat, ceilMat) {
    this._addFloor(0, 31, 18, 28, floorMat);
    this._addCeiling(0, 31, 18, 28, ceilMat);

    this._addWall(-8, 31, 2, 28, wallMat);
    this._addWall(8, 31, 2, 28, wallMat);

    // Middle pillars
    this._addWall(-3, 31, 2, 2, wallMat);
    this._addWall(3, 31, 2, 2, wallMat);

    this._addTorch(-6.8, 2.5, 26);
    this._addTorch(6.8, 2.5, 26);
    this._addTorch(-6.8, 2.5, 38);
    this._addTorch(6.8, 2.5, 38);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CATACOMB JUNCTION (Hub with locked shortcut gate)
  // X: -10..10, Z: 44..68
  // ─────────────────────────────────────────────────────────────
  _buildCatacombJunction(wallMat, floorMat, ceilMat) {
    this._addFloor(0, 56, 22, 26, floorMat);
    this._addCeiling(0, 56, 22, 26, ceilMat);

    this._addWall(8, 56, 2, 26, wallMat); // Right wall

    // Left wall has passage opening to Sunken Vault (Z: 50..62 open)
    this._addWall(-8, 46, 2, 8, wallMat);
    this._addWall(-8, 66, 2, 8, wallMat);

    // North wall has the LOCKED SHORTCUT PORTCULLIS at X: -2..2, Z: 68
    this._addWall(-5, 68, 6, 2, wallMat);
    this._addWall(5, 68, 6, 2, wallMat);

    // Iron Gate in the center of north wall
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.3 });
    const { mesh, aabb } = this._addWall(0, 68, 4, 1.2, gateMat, true);
    this.shortcutGateMesh = mesh;
    this.shortcutGateWall = aabb;

    this._addTorch(-6.8, 2.5, 52);
    this._addTorch(6.8, 2.5, 52);
    this._addTorch(0, 3.2, 66, 0xffaa33, 1.6); // Highlight locked gate
  }

  // ─────────────────────────────────────────────────────────────
  // 4. SUNKEN VAULT (Skeleton archers & Secret Upgrade Chest)
  // X: -32..-8, Z: 48..76
  // ─────────────────────────────────────────────────────────────
  _buildSunkenVault(wallMat, floorMat, ceilMat, player, audio, hud) {
    this._addFloor(-20, 62, 26, 30, floorMat);
    this._addCeiling(-20, 62, 26, 30, ceilMat);

    this._addWall(-20, 48, 26, 2, wallMat); // South wall
    this._addWall(-32, 62, 2, 30, wallMat); // West wall
    // North wall with passage to Shrine of Ash (X: -24..-16 open)
    this._addWall(-30, 76, 6, 2, wallMat);
    this._addWall(-10, 76, 6, 2, wallMat);

    // Secret chest alcove in northwest corner (X: -29, Z: 54)
    const chestGeo = new THREE.BoxGeometry(1.2, 0.8, 0.9);
    const chestMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, metalness: 0.3, roughness: 0.6 });
    const chestMesh = new THREE.Mesh(chestGeo, chestMat);
    chestMesh.position.set(-28, 0.4, 52);
    this.scene.add(chestMesh);
    this._meshes.push(chestMesh);

    // Chest latch
    const latchGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
    const latchMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9 });
    const latch = new THREE.Mesh(latchGeo, latchMat);
    latch.position.set(-28, 0.4, 52.46);
    this.scene.add(latch);
    this._meshes.push(latch);

    // Chest Interactable
    this.interactables.push({
      position: new THREE.Vector3(-28, 1, 52),
      radius: 2.8,
      active: true,
      onInteract: () => {
        if (this.isChestOpened) return;
        this.isChestOpened = true;
        audio.playSFX('chestOpen');
        player.maxHealth += 30;
        player.health = player.maxHealth;
        player.maxStamina += 20;
        player.stamina = player.maxStamina;
        player.maxFlasks += 1;
        player.flasks = player.maxFlasks;
        chestMesh.rotation.x = -0.4; // opened lid effect
        hud.showCheckpointBanner();
        const bannerText = document.querySelector('#checkpoint-banner .banner-text');
        const bannerSub  = document.querySelector('#checkpoint-banner .banner-sub');
        if (bannerText) bannerText.textContent = 'CREST OF FORTITUDE';
        if (bannerSub)  bannerSub.textContent  = '+30 HP · +20 Stamina · +1 Soul Flask';
      }
    });

    this._addTorch(-28, 2.5, 62, 0x55bbff, 1.2); // Eerie blue light in vault
    this._addTorch(-14, 2.5, 62);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. SHRINE OF ASH (Bonfire Checkpoint)
  // X: -24..-8, Z: 76..102
  // ─────────────────────────────────────────────────────────────
  _buildShrineOfAsh(wallMat, floorMat, ceilMat, player, audio, hud) {
    this._addFloor(-16, 89, 18, 28, floorMat);
    this._addCeiling(-16, 89, 18, 28, ceilMat);

    this._addWall(-24, 89, 2, 28, wallMat); // West wall
    // East wall has opening connecting to the High Ramparts (Z: 96..102 open)
    this._addWall(-8, 83, 2, 16, wallMat);
    this._addWall(-16, 102, 18, 2, wallMat); // North wall

    // Checkpoint Bonfire Brazier (center of shrine: X: -16, Z: 89)
    const brazierGeo = new THREE.CylinderGeometry(0.8, 0.5, 0.7, 8);
    const brazierMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, metalness: 0.7, roughness: 0.4 });
    const brazier = new THREE.Mesh(brazierGeo, brazierMat);
    brazier.position.set(-16, 0.35, 89);
    this.scene.add(brazier);
    this._meshes.push(brazier);

    // Golden flame light
    const shrineLight = new THREE.PointLight(0xffb833, 2.2, 14);
    shrineLight.position.set(-16, 1.2, 89);
    this.scene.add(shrineLight);
    this._meshes.push(shrineLight);

    // Bonfire flame mesh
    const flameGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.set(-16, 0.9, 89);
    this.scene.add(flameMesh);
    this._meshes.push(flameMesh);

    // Checkpoint Interactable
    this.interactables.push({
      position: new THREE.Vector3(-16, 1, 89),
      radius: 3.2,
      active: true,
      onInteract: () => {
        this.isCheckpointActive = true;
        player.restAtCheckpoint(new THREE.Vector3(-16, 1.7, 86));
        hud.showCheckpointBanner();
        const bannerText = document.querySelector('#checkpoint-banner .banner-text');
        const bannerSub  = document.querySelector('#checkpoint-banner .banner-sub');
        if (bannerText) bannerText.textContent = 'SHRINE OF ASH RESTED';
        if (bannerSub)  bannerSub.textContent  = 'Health and Flasks Restored · Progress Saved';
      }
    });

    this._addTorch(-22.5, 2.5, 82, 0xffaa33, 1.4);
    this._addTorch(-22.5, 2.5, 96, 0xffaa33, 1.4);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. HIGH RAMPARTS & SHORTCUT LEVER
  // X: -8..18, Z: 92..124
  // Stone Golem Elite encounter + Lever that opens the gate at (0, 68)
  // ─────────────────────────────────────────────────────────────
  _buildHighRamparts(wallMat, floorMat, ceilMat, audio, hud) {
    this._addFloor(5, 108, 28, 34, floorMat);
    this._addCeiling(5, 108, 28, 34, ceilMat);

    this._addWall(18, 108, 2, 34, wallMat); // East wall
    this._addWall(-8, 114, 2, 22, wallMat); // West wall

    // Corridor running south back towards the shortcut gate (X: 0, Z: 70..92)
    this._addFloor(0, 80, 8, 24, floorMat);
    this._addCeiling(0, 80, 8, 24, ceilMat);
    this._addWall(-4, 80, 2, 24, wallMat);
    this._addWall(4, 80, 2, 24, wallMat);

    // Shortcut Lever situated at (X: 3, Z: 74)
    const leverBaseGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
    const leverBaseMat = new THREE.MeshStandardMaterial({ color: 0x332211 });
    const leverBase = new THREE.Mesh(leverBaseGeo, leverBaseMat);
    leverBase.position.set(2.8, 0.35, 73);
    this.scene.add(leverBase);
    this._meshes.push(leverBase);

    const leverHandleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6);
    const leverHandleMat = new THREE.MeshStandardMaterial({ color: 0xdaa520, metalness: 0.9 });
    const leverHandle = new THREE.Mesh(leverHandleGeo, leverHandleMat);
    leverHandle.position.set(2.8, 0.75, 73);
    leverHandle.rotation.z = 0.4;
    this.scene.add(leverHandle);
    this._meshes.push(leverHandle);

    // Lever Interactable
    this.interactables.push({
      position: new THREE.Vector3(2.8, 1, 73),
      radius: 2.8,
      active: true,
      onInteract: () => {
        if (this.isShortcutUnlocked) return;
        this.unlockShortcut(audio, hud);
        leverHandle.rotation.z = -0.4;
      }
    });

    this._addTorch(16.5, 2.6, 98, 0xff8833, 1.4);
    this._addTorch(16.5, 2.6, 118, 0xff8833, 1.4);
    this._addTorch(2.8, 2.4, 76, 0xffaa33, 1.3);
  }

  unlockShortcut(audio, hud) {
    this.isShortcutUnlocked = true;
    audio.playSFX('leverPull');

    // Animate gate lifting up
    if (this.shortcutGateMesh) {
      let step = 0;
      const lift = setInterval(() => {
        step += 0.05;
        this.shortcutGateMesh.position.y += 0.18;
        if (step >= 1.0) {
          clearInterval(lift);
          this.scene.remove(this.shortcutGateMesh);
        }
      }, 30);
    }

    // Remove gate collision AABB
    if (this.shortcutGateWall) {
      const idx = this.walls.indexOf(this.shortcutGateWall);
      if (idx !== -1) this.walls.splice(idx, 1);
    }

    if (hud) {
      hud.showCheckpointBanner();
      const bannerText = document.querySelector('#checkpoint-banner .banner-text');
      const bannerSub  = document.querySelector('#checkpoint-banner .banner-sub');
      if (bannerText) bannerText.textContent = 'SHORTCUT UNLOCKED';
      if (bannerSub)  bannerSub.textContent  = 'The Iron Portcullis to Catacomb Junction is Open';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 7. BLOOD CLOISTER (Final approach with Death Bats)
  // X: -6..16, Z: 124..155
  // ─────────────────────────────────────────────────────────────
  _buildBloodCloister(wallMat, floorMat, ceilMat) {
    this._addFloor(5, 139, 24, 32, floorMat);
    this._addCeiling(5, 139, 24, 32, ceilMat);

    this._addWall(-6, 139, 2, 32, wallMat); // West wall
    this._addWall(16, 139, 2, 32, wallMat); // East wall

    // Grand archway leading to boss room at Z: 155
    this._addWall(-2, 155, 8, 2, wallMat);
    this._addWall(12, 155, 8, 2, wallMat);
    // Opening at X: 3..7, Z: 155

    this._addTorch(-4.8, 2.5, 130, 0xaa2266, 1.4);
    this._addTorch(14.8, 2.5, 130, 0xaa2266, 1.4);
    this._addTorch(-4.8, 2.5, 148, 0xaa2266, 1.4);
    this._addTorch(14.8, 2.5, 148, 0xaa2266, 1.4);
  }

  // ─────────────────────────────────────────────────────────────
  // 8. THRONE OF THE DEATH KNIGHT (Boss Arena)
  // X: -10..20, Z: 155..205
  // ─────────────────────────────────────────────────────────────
  _buildBossArena(wallMat, floorMat, ceilMat) {
    this._addFloor(5, 180, 32, 52, floorMat);
    this._addCeiling(5, 180, 32, 52, ceilMat);

    this._addWall(-10, 180, 2, 52, wallMat); // West wall
    this._addWall(20, 180, 2, 52, wallMat);  // East wall
    this._addWall(5, 205, 32, 2, wallMat);   // North wall behind throne

    // Grand Arena Pillars
    this._addWall(-3, 172, 2.2, 2.2, wallMat);
    this._addWall(13, 172, 2.2, 2.2, wallMat);
    this._addWall(-3, 192, 2.2, 2.2, wallMat);
    this._addWall(13, 192, 2.2, 2.2, wallMat);

    // Stone Throne at north wall (X: 5, Z: 202)
    const throneBaseGeo = new THREE.BoxGeometry(3.6, 1.0, 2.2);
    const throneBaseMat = new THREE.MeshStandardMaterial({ color: 0x1f1822, metalness: 0.4, roughness: 0.6 });
    const throne = new THREE.Mesh(throneBaseGeo, throneBaseMat);
    throne.position.set(5, 0.5, 201);
    this.scene.add(throne);
    this._meshes.push(throne);

    const throneBackGeo = new THREE.BoxGeometry(3.6, 3.2, 0.6);
    const throneBack = new THREE.Mesh(throneBackGeo, throneBaseMat);
    throneBack.position.set(5, 2.4, 202);
    this.scene.add(throneBack);
    this._meshes.push(throneBack);

    // Boss arena torches (Ominous dark purple / crimson)
    this._addTorch(-8.5, 2.8, 165, 0x9922cc, 1.8, 14);
    this._addTorch(18.5, 2.8, 165, 0x9922cc, 1.8, 14);
    this._addTorch(-8.5, 2.8, 195, 0xcc2244, 1.8, 14);
    this._addTorch(18.5, 2.8, 195, 0xcc2244, 1.8, 14);
    this._addTorch(5, 3.8, 199, 0x9911ee, 2.2, 16);
  }

  sealBossArena() {
    if (this.bossFogMesh) return;
    // Seal the entrance at X: 5, Z: 155 with a dark purple mist barrier
    const fogGeo = new THREE.BoxGeometry(6, WALL_H, 1.5);
    const fogMat = new THREE.MeshStandardMaterial({
      color: 0x6611aa,
      emissive: 0x440088,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.85,
    });
    this.bossFogMesh = new THREE.Mesh(fogGeo, fogMat);
    this.bossFogMesh.position.set(5, WALL_H / 2, 155);
    this.scene.add(this.bossFogMesh);
    this._meshes.push(this.bossFogMesh);

    this.bossFogWall = { x: 5, z: 155, w: 6, d: 1.5 };
    this.walls.push(this.bossFogWall);
  }

  clear() {
    for (const m of this._meshes) {
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (m.material.map) m.material.map.dispose();
        m.material.dispose();
      }
      this.scene.remove(m);
    }
    this._meshes = [];
    this.walls = [];
    this.miniWalls = [];
    this.interactables = [];
    this.shortcutGateMesh = null;
    this.shortcutGateWall = null;
    this.bossFogMesh = null;
    this.bossFogWall = null;
    this.isShortcutUnlocked = false;
  }
}
