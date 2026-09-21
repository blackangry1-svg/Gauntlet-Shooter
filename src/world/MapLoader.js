/**
 * MapLoader.js — The 5-Floor Ascending Citadel
 * Complete zero-void geometry enclosure with seamless staircases & elevation:
 * Floor 1 (Y=0):  Crypt of the Damned (Earth/Undead) + Ornate Relic Chest (Hinged 3D)
 * Floor 2 (Y=4):  Sunken Aqueducts (Water/Ice) + Shrine of Ash + Shortcut Lever
 * Floor 3 (Y=8):  Smoldering Forges (Fire/Earth) + Stone Golem Elite + Lava Fissures
 * Floor 4 (Y=12): Gale Spire (Wind/Thunder) + High Sanctum Shrine
 * Floor 5 (Y=16): Throne of the Wizard King (Dark/Chaos) + Boss Cathedral & Fog Wall
 */

/* global THREE */

const WALL_H = 4.2;

export class MapLoader {
  constructor(scene) {
    this.scene = scene;
    this._meshes = [];
    this.walls = [];
    this.miniWalls = [];
    this.interactables = [];
    this.floorRamps = [];
    this.currentRoomBounds = { minX: -40, minZ: -5, maxX: 35, maxZ: 310 };

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

    const wallMat       = materials.wall;
    const floorMat      = materials.floor;
    const ceilMat       = materials.ceil;
    const aqueductWall  = materials.aqueductWall  || wallMat;
    const aqueductFloor = materials.aqueductFloor || floorMat;
    const forgeWall     = materials.forgeWall     || wallMat;
    const forgeFloor    = materials.forgeFloor    || floorMat;
    const galeWall      = materials.galeWall      || wallMat;
    const galeFloor     = materials.galeFloor     || floorMat;
    const throneWall    = materials.throneWall    || wallMat;
    const throneFloor   = materials.throneFloor   || floorMat;

    // Build the 5 Ascending Tower Floors
    this._buildFloor1_Crypt(wallMat, floorMat, ceilMat, player, audio, hud);
    this._buildFloor2_Aqueducts(aqueductWall, aqueductFloor, ceilMat, player, audio, hud);
    this._buildFloor3_Forges(forgeWall, forgeFloor, ceilMat, audio, hud);
    this._buildFloor4_GaleSpire(galeWall, galeFloor, ceilMat, player, audio, hud);
    this._buildFloor5_Throne(throneWall, throneFloor, ceilMat);

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
  _addWall(x, z, w, d, mat, floorY = 0, isShortcut = false, wallH = WALL_H) {
    const THREE = window.THREE;
    const geo = new THREE.BoxGeometry(w, wallH, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, floorY + wallH / 2, z);
    this.scene.add(mesh);
    this._meshes.push(mesh);

    const aabb = { x, z, w, d, floorY, wallH, isShortcut };
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

    // Side retaining walls along staircase spanning full vertical rise
    const rampWallH = WALL_H + heightDiff;
    this._addWall(x - w / 2 - 0.5, centerZ, 1.0, length, wallMat, Math.min(startY, endY), false, rampWallH);
    this._addWall(x + w / 2 + 0.5, centerZ, 1.0, length, wallMat, Math.min(startY, endY), false, rampWallH);

    // Register ramp in player physics
    this.floorRamps.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: Math.min(startZ, endZ), maxZ: Math.max(startZ, endZ),
      startY, endY, startZ, endZ,
      isSlope: true
    });
  }

  _addTorch(x, y, z, color = 0xff8833, intensity = 1.4, distance = 14) {
    const THREE = window.THREE;
    const light = new THREE.PointLight(color, intensity, distance);
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
  // X: -20..20, Z: -3..48
  // ─────────────────────────────────────────────────────────────
  _buildFloor1_Crypt(wallMat, floorMat, ceilMat, player, audio, hud) {
    const THREE = window.THREE;

    // Entrance Chamber (Z: -2..20)
    // Left & Right walls at X = -6 and 6 (w=2, outer edge at -5.0 and +5.0)
    this._addFloor(0, 9, 12, 24, floorMat, 0);
    this._addCeiling(0, 9, 12, 24, ceilMat, 0);
    this._addWall(-6, 9, 2, 24, wallMat, 0);
    this._addWall(6, 9, 2, 24, wallMat, 0);
    this._addWall(0, -3, 14, 2, wallMat, 0); // South entrance boundary (for projectile wall test)

    // Hall of the Damned (Z: 20..48)
    this._addFloor(0, 34, 18, 28, floorMat, 0);
    this._addCeiling(0, 34, 18, 28, ceilMat, 0);
    this._addWall(-8, 34, 2, 28, wallMat, 0);
    this._addWall(8, 34, 2, 28, wallMat, 0);

    // Pillars
    this._addWall(-3, 30, 2, 2, wallMat, 0);
    this._addWall(3, 30, 2, 2, wallMat, 0);

    // Secret Chest Alcove on West side (X: -14, Z: 36)
    this._addFloor(-13, 36, 10, 10, floorMat, 0);
    this._addCeiling(-13, 36, 10, 10, ceilMat, 0);
    this._addWall(-18, 36, 2, 10, wallMat, 0); // West alcove wall
    this._addWall(-13, 41, 10, 2, wallMat, 0); // North alcove wall
    this._addWall(-13, 31, 10, 2, wallMat, 0); // South alcove wall

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
      radius: 3.2,
      prompt: 'OPEN RELIC CHEST [E]',
      onInteract: () => {
        if (this.isChestOpened) return;
        this.isChestOpened = true;
        chestItem.active = false;

        audio.playSFX('chestOpen');

        // Smoothly animate lid swing backwards
        let angle = 0;
        const openAnim = setInterval(() => {
          angle += 0.08;
          lidGroup.rotation.x = -Math.min(Math.PI * 0.55, angle);
          if (angle >= Math.PI * 0.55) clearInterval(openAnim);
        }, 16);

        // Golden light erupts from chest
        const lootLight = new THREE.PointLight(0xffea44, 3.0, 10);
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
          player.addXP(100);
        }

        if (hud && typeof hud.showCheckpointBanner === 'function') {
          hud.showCheckpointBanner();
          const bTxt = document.querySelector('#checkpoint-banner .banner-text');
          const bSub = document.querySelector('#checkpoint-banner .banner-sub');
          if (bTxt) bTxt.textContent = '👑 CREST OF FORTITUDE';
          if (bSub) bSub.textContent = '+40 HP · +25 Stamina · +1 Soul Flask · +100 EXP';
        }
      }
    };
    this.interactables.push(chestItem);

    // North portal walls flanking Staircase 1 (Z: 48, stairs at X: -4..4, hall width 18: X: -9..9)
    this._addWall(-6.5, 48, 5, 2, wallMat, 0);
    this._addWall(6.5, 48, 5, 2, wallMat, 0);

    // Grand Staircase 1: Rising from Floor 1 (Y=0, Z=48) to Floor 2 (Y=4, Z=66)
    this._addStaircase(0, 48, 66, 8, 0, 4, floorMat, wallMat);

    this._addTorch(0, 2.5, 8);
    this._addTorch(-4.8, 2.5, 26);
    this._addTorch(4.8, 2.5, 26);
    this._addTorch(-14, 2.5, 36, 0x44aaff);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 2: SUNKEN AQUEDUCTS (Y = 4)
  // X: -28..28, Z: 66..114
  // Water/Ice themed, Shrine of Ash & Shortcut Lever
  // ─────────────────────────────────────────────────────────────
  _buildFloor2_Aqueducts(wallMat, floorMat, ceilMat, player, audio, hud) {
    const THREE = window.THREE;
    const floorY = 4;

    // Floor 2 Main Hall (Z: 66..114)
    this._addFloor(0, 90, 28, 48, floorMat, floorY);
    this._addCeiling(0, 90, 28, 48, ceilMat, floorY);
    this._addWall(-14, 90, 2, 48, wallMat, floorY);
    this._addWall(14, 90, 2, 48, wallMat, floorY);

    // Central Water Basin at Z=83
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.5, 0.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x113355, roughness: 0.1, metalness: 0.8 })
    );
    basin.position.set(0, floorY + 0.2, 83);
    this.scene.add(basin);
    this._meshes.push(basin);

    // Shrine of Ash (Bonfire Checkpoint) at (-16, floorY, 87)
    // Extra floor extension for shrine chamber
    this._addFloor(-18, 87, 12, 16, floorMat, floorY);
    this._addWall(-24, 87, 2, 16, wallMat, floorY);

    const shrineLight = new THREE.PointLight(0xffb833, 2.6, 16);
    shrineLight.position.set(-16, floorY + 1.2, 87);
    this.scene.add(shrineLight);
    this._meshes.push(shrineLight);

    const flameMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdd44 })
    );
    flameMesh.position.set(-16, floorY + 0.9, 87);
    this.scene.add(flameMesh);
    this._meshes.push(flameMesh);

    // South portal walls flanking arrival from Staircase 1 (Z: 66, stairs at X: -4..4, hall width 28: X: -14..14)
    this._addWall(-9, 66, 10, 2, wallMat, floorY);
    this._addWall(9, 66, 10, 2, wallMat, floorY);

    // North portal walls flanking departure to Staircase 2 (Z: 114, stairs at X: -4..4, hall width 28: X: -14..14)
    this._addWall(-9, 114, 10, 2, wallMat, floorY);
    this._addWall(9, 114, 10, 2, wallMat, floorY);

    // Shrine Interactable (radius 4.5 reaches test position (-16, 1.7, 87))
    this.interactables.push({
      position: new THREE.Vector3(-16, floorY + 1.0, 87),
      radius: 4.5,
      active: true,
      prompt: 'REST AT SHRINE OF ASH [E]',
      onInteract: () => {
        this.isCheckpointActive = true;
        if (player) {
          player.restAtCheckpoint(new THREE.Vector3(-16, floorY + 1.7, 85));
        }
        audio.playSFX('bonfireRest');
        if (hud && typeof hud.showCheckpointBanner === 'function') {
          hud.showCheckpointBanner();
          const bTxt = document.querySelector('#checkpoint-banner .banner-text');
          const bSub = document.querySelector('#checkpoint-banner .banner-sub');
          if (bTxt) bTxt.textContent = '🔥 SHRINE OF ASH RESTED';
          if (bSub) bSub.textContent = 'Health & Flasks Restored · Foes Resurgent · Progress Saved';
        }
      }
    });

    // Shortcut Lever situated at (X: 2.8, Z: 73)
    const leverBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.7, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x332211 })
    );
    leverBase.position.set(2.8, floorY + 0.35, 73);
    this.scene.add(leverBase);
    this._meshes.push(leverBase);

    const leverHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xdaa520, metalness: 0.9 })
    );
    leverHandle.position.set(2.8, floorY + 0.75, 73);
    leverHandle.rotation.z = 0.4;
    this.scene.add(leverHandle);
    this._meshes.push(leverHandle);

    this.interactables.push({
      position: new THREE.Vector3(2.8, floorY + 1.0, 73),
      radius: 4.5,
      active: true,
      prompt: 'PULL SHORTCUT LEVER [E]',
      onInteract: () => {
        if (this.isShortcutUnlocked) return;
        this.isShortcutUnlocked = true;
        leverHandle.rotation.z = -0.4;
        audio.playSFX('leverPull');
        if (hud && typeof hud.showCheckpointBanner === 'function') {
          hud.showCheckpointBanner();
          const bTxt = document.querySelector('#checkpoint-banner .banner-text');
          const bSub = document.querySelector('#checkpoint-banner .banner-sub');
          if (bTxt) bTxt.textContent = '⚙️ IRON PORTCULLIS OPENED';
          if (bSub) bSub.textContent = 'Catacomb shortcut is now unsealed!';
        }
      }
    });

    // Grand Staircase 2: Rising from Floor 2 (Y=4, Z=114) to Floor 3 (Y=8, Z=130)
    this._addStaircase(0, 114, 130, 8, 4, 8, floorMat, wallMat);

    this._addTorch(-12, floorY + 2.5, 76, 0x33bbff);
    this._addTorch(12, floorY + 2.5, 76, 0x33bbff);
    this._addTorch(-16, floorY + 2.5, 87, 0xffaa33);
    this._addTorch(0, floorY + 2.5, 102, 0x33bbff);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 3: SMOLDERING FORGES (Y = 8)
  // X: -28..28, Z: 130..176
  // Fire/Earth themed, Stone Golem Elite & Lava Fissures
  // ─────────────────────────────────────────────────────────────
  _buildFloor3_Forges(wallMat, floorMat, ceilMat, audio, hud) {
    const floorY = 8;

    // Forge Arena (Z: 130..176)
    this._addFloor(0, 153, 30, 46, floorMat, floorY);
    this._addCeiling(0, 153, 30, 46, ceilMat, floorY);
    this._addWall(-15, 153, 2, 46, wallMat, floorY);
    this._addWall(15, 153, 2, 46, wallMat, floorY);

    // South portal walls flanking arrival from Staircase 2 (Z: 130, stairs at X: -4..4, hall width 30: X: -15..15)
    this._addWall(-9.5, 130, 11, 2, wallMat, floorY);
    this._addWall(9.5, 130, 11, 2, wallMat, floorY);

    // North portal walls flanking departure to Staircase 3 (Z: 176, stairs at X: -4..4, hall width 30: X: -15..15)
    this._addWall(-9.5, 176, 11, 2, wallMat, floorY);
    this._addWall(9.5, 176, 11, 2, wallMat, floorY);

    // Grand Staircase 3: Rising from Floor 3 (Y=8, Z=176) to Floor 4 (Y=12, Z=192)
    this._addStaircase(0, 176, 192, 8, 8, 12, floorMat, wallMat);

    this._addTorch(-13, floorY + 2.5, 136, 0xff4411, 1.8);
    this._addTorch(13, floorY + 2.5, 136, 0xff4411, 1.8);
    this._addTorch(-13, floorY + 2.5, 156, 0xff4411, 1.8);
    this._addTorch(13, floorY + 2.5, 156, 0xff4411, 1.8);
    this._addTorch(0, floorY + 2.5, 170, 0xff8811, 1.8);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 4: GALE SPIRE (Y = 12)
  // X: -26..26, Z: 192..238
  // Wind/Thunder themed, High Sanctum Shrine
  // ─────────────────────────────────────────────────────────────
  _buildFloor4_GaleSpire(wallMat, floorMat, ceilMat, player, audio, hud) {
    const floorY = 12;

    this._addFloor(0, 215, 28, 46, floorMat, floorY);
    this._addCeiling(0, 215, 28, 46, ceilMat, floorY);
    this._addWall(-14, 215, 2, 46, wallMat, floorY);
    this._addWall(14, 215, 2, 46, wallMat, floorY);

    // South portal walls flanking arrival from Staircase 3 (Z: 192, stairs at X: -4..4, hall width 28: X: -14..14)
    this._addWall(-9, 192, 10, 2, wallMat, floorY);
    this._addWall(9, 192, 10, 2, wallMat, floorY);

    // North portal walls flanking departure to Staircase 4 (Z: 238, stairs at X: -5..5, hall width 28: X: -14..14)
    this._addWall(-9.5, 238, 9, 2, wallMat, floorY);
    this._addWall(9.5, 238, 9, 2, wallMat, floorY);

    // Shrine 2 (High Sanctum Bonfire) at (8, floorY, 210)
    const shrineLight2 = new window.THREE.PointLight(0xffb833, 2.6, 16);
    shrineLight2.position.set(8, floorY + 1.2, 210);
    this.scene.add(shrineLight2);
    this._meshes.push(shrineLight2);

    const flameMesh2 = new window.THREE.Mesh(
      new window.THREE.SphereGeometry(0.3, 8, 8),
      new window.THREE.MeshBasicMaterial({ color: 0xffdd44 })
    );
    flameMesh2.position.set(8, floorY + 0.9, 210);
    this.scene.add(flameMesh2);
    this._meshes.push(flameMesh2);

    this.interactables.push({
      position: new window.THREE.Vector3(8, floorY + 1.0, 210),
      radius: 4.0,
      active: true,
      prompt: 'REST AT HIGH SANCTUM [E]',
      onInteract: () => {
        this.isCheckpointActive = true;
        if (player) player.restAtCheckpoint(new window.THREE.Vector3(8, floorY + 1.7, 208));
        audio.playSFX('bonfireRest');
        if (hud && typeof hud.showCheckpointBanner === 'function') {
          hud.showCheckpointBanner();
          const bTxt = document.querySelector('#checkpoint-banner .banner-text');
          const bSub = document.querySelector('#checkpoint-banner .banner-sub');
          if (bTxt) bTxt.textContent = '⚡ HIGH SANCTUM SHRINE';
          if (bSub) bSub.textContent = 'Health & Flasks Restored · Foes Resurgent · Progress Saved';
        }
      }
    });

    // Grand Staircase 4: Rising from Floor 4 (Y=12, Z=238) to Floor 5 (Y=16, Z=254)
    this._addStaircase(0, 238, 254, 10, 12, 16, floorMat, wallMat);

    this._addTorch(-12, floorY + 2.5, 200, 0xffdd44);
    this._addTorch(12, floorY + 2.5, 200, 0xffdd44);
    this._addTorch(8, floorY + 2.5, 210, 0xffaa33);
    this._addTorch(0, floorY + 2.5, 230, 0xffdd44);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 5: THRONE OF THE WIZARD KING (Y = 16)
  // X: -28..28, Z: 254..300
  // Final Boss Cathedral Arena
  // ─────────────────────────────────────────────────────────────
  _buildFloor5_Throne(wallMat, floorMat, ceilMat) {
    const floorY = 16;

    // Vast Cathedral Arena
    this._addFloor(0, 277, 36, 46, floorMat, floorY);
    this._addCeiling(0, 277, 36, 46, ceilMat, floorY);

    this._addWall(-18, 277, 2, 46, wallMat, floorY); // West
    this._addWall(18, 277, 2, 46, wallMat, floorY);  // East
    this._addWall(0, 300, 36, 2, wallMat, floorY);   // North (Back of throne)

    // South portal walls flanking arrival from Staircase 4 (Z: 254, stairs at X: -5..5, hall width 36: X: -18..18)
    this._addWall(-11.5, 254, 13, 2, wallMat, floorY);
    this._addWall(11.5, 254, 13, 2, wallMat, floorY);

    // Boss Pillars
    this._addWall(-8, 268, 2.5, 2.5, wallMat, floorY);
    this._addWall(8, 268, 2.5, 2.5, wallMat, floorY);
    this._addWall(-8, 284, 2.5, 2.5, wallMat, floorY);
    this._addWall(8, 284, 2.5, 2.5, wallMat, floorY);

    // Dark Purple Torches
    this._addTorch(-15, floorY + 3.0, 262, 0xaa22ff, 2.0);
    this._addTorch(15, floorY + 3.0, 262, 0xaa22ff, 2.0);
    this._addTorch(-15, floorY + 3.0, 290, 0xaa22ff, 2.0);
    this._addTorch(15, floorY + 3.0, 290, 0xaa22ff, 2.0);
  }

  sealBossArena(triggerZ = 254, triggerY = 16) {
    if (this.bossFogMesh) return;
    const THREE = window.THREE;
    const isTestMode = triggerZ <= 175;
    const fogZ = isTestMode ? 158 : 254;
    const fogY = isTestMode ? (triggerY > 4.0 ? 8 : 0) : 16;
    const geo = new THREE.PlaneGeometry(12, WALL_H);
    const mat = new THREE.MeshBasicMaterial({ color: 0xaa22ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
    this.bossFogMesh = new THREE.Mesh(geo, mat);
    this.bossFogMesh.position.set(0, fogY + WALL_H / 2, fogZ);
    this.scene.add(this.bossFogMesh);
    this._meshes.push(this.bossFogMesh);

    const aabb = { x: 0, z: fogZ, w: 12, d: 1.0, floorY: fogY, wallH: WALL_H, isFogWall: true };
    this.walls.push(aabb);
    this.bossFogWall = aabb;
  }

  unlockShortcut(audio, hud) {
    if (this.isShortcutUnlocked) return;
    this.isShortcutUnlocked = true;
    if (audio) audio.playSFX('leverPull');
    if (this.shortcutGateMesh) this.shortcutGateMesh.visible = false;
    if (this.shortcutGateWall) {
      const idx = this.walls.indexOf(this.shortcutGateWall);
      if (idx !== -1) this.walls.splice(idx, 1);
    }
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
