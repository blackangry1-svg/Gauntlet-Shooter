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
    this.waterMeshes = [];
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
    this.secretBossMinotaur = null;
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
    this._buildBeach(wallMat, floorMat);
    this._buildFloor1_Crypt(wallMat, floorMat, ceilMat, player, audio, hud);
    this._buildFloor2_Aqueducts(aqueductWall, aqueductFloor, ceilMat, player, audio, hud);
    this._buildFloor3_Forges(forgeWall, forgeFloor, ceilMat, audio, hud);
    this._buildFloor4_GaleSpire(galeWall, galeFloor, ceilMat, player, audio, hud);
    this._buildFloor5_Throne(throneWall, throneFloor, ceilMat);
    this._buildSecretMinotaurLair(wallMat, floorMat, ceilMat, player, audio, hud);

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

  _buildBeach(wallMat, floorMat) {
    const THREE = window.THREE;
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xc2b280 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0077be, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.8 });
    
    // Beach zone spans Z: -150 to 0, Y = 0 (sea level)
    this._addFloor(0, -75, 120, 150, sandMat, 0); // Z: -150 to 0

    // Ocean water plane at Z: -120 to -300, Y = -0.3
    const waterGeo = new THREE.PlaneGeometry(300, 180, 32, 32);
    const wMesh = new THREE.Mesh(waterGeo, waterMat);
    wMesh.rotation.x = -Math.PI / 2;
    wMesh.position.set(0, -0.3, -210);
    this.scene.add(wMesh);
    this._meshes.push(wMesh);
    this.waterMeshes = [wMesh];

    // Coastal cliffs/walls
    this._addWall(-50, -75, 20, 150, wallMat, 0, false, 20);
    this._addWall(50, -75, 20, 150, wallMat, 0, false, 20);

    // The Labyrinth Portal: A grand archway entrance at Z = 0
    this._addWall(-35, 0, 58, 4, wallMat, 0, false, 20);
    this._addWall(35, 0, 58, 4, wallMat, 0, false, 20);
    this._addWall(0, 0, 12, 4, wallMat, 8, false, 12); 

    this._addWall(-6, 0, 2, 4, wallMat, 0, false, 8);
    this._addWall(6, 0, 2, 4, wallMat, 0, false, 8);

    this._addTorch(-5, 2, 2, 0xff6600, 2.0, 20);
    this._addTorch(5, 2, 2, 0xff6600, 2.0, 20);

    // Icarus NPC
    const icarusMat = new THREE.MeshBasicMaterial({ color: 0xddaa77 }); 
    const icarusMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), icarusMat);
    icarusMesh.position.set(5, 0.9, -100);
    this.scene.add(icarusMesh);
    this._meshes.push(icarusMesh);

    this.interactables.push({
      position: new THREE.Vector3(5, 0.9, -100),
      radius: 4.0,
      active: true,
      prompt: 'TALK TO ICARUS [E]',
      onInteract: () => {
        const hudEl = document.querySelector('#checkpoint-banner');
        if (hudEl) {
          hudEl.classList.remove('hidden');
          const bTxt = hudEl.querySelector('.banner-text');
          const bSub = hudEl.querySelector('.banner-sub');
          if (bTxt) bTxt.textContent = 'ICARUS';
          if (bSub) bSub.textContent = '"Father, the sun is high. We must find feathers and bronze spars within Minos\'s maze before we can craft our wings and escape this island!"';
          setTimeout(() => hudEl.classList.add('hidden'), 5000);
        }
      }
    });

    // Campfire & Resting Mat
    this._addTorch(-5, 0.5, -100, 0xffaa33, 1.5, 10);
    
    this.shelterInteractable = {
      position: new THREE.Vector3(-5, 0.5, -100),
      radius: 4.0,
      active: true,
      prompt: 'BUILD SHELTER (REQUIRES 10 WOOD) [E]',
      isBuilt: false,
      onInteract: () => {
        if (!this.shelterInteractable.isBuilt) {
          const w = window.GAME && window.GAME.player ? window.GAME.player.woodCount || 0 : 0;
          if (w >= 10) {
             window.GAME.player.woodCount -= 10;
             this.shelterInteractable.isBuilt = true;
             this.shelterInteractable.prompt = 'REST AT SHELTER [E]';
             const tent = new THREE.Mesh(new THREE.ConeGeometry(2, 2.5, 4), new THREE.MeshLambertMaterial({color: 0x8b4513}));
             tent.position.set(-8, 1.25, -100);
             this.scene.add(tent);
             this._meshes.push(tent);
             if (window.GAME && window.GAME.audio) window.GAME.audio.playSFX('chestOpen');
          }
        } else {
          this.isCheckpointActive = true;
          if (window.GAME && window.GAME.player) window.GAME.player.restAtCheckpoint(new THREE.Vector3(-5, 1.7, -98));
          if (window.GAME && window.GAME.audio) window.GAME.audio.playSFX('bonfireRest');
          if (window.GAME && window.GAME.hud && typeof window.GAME.hud.showCheckpointBanner === 'function') {
            window.GAME.hud.showCheckpointBanner();
            const bTxt = document.querySelector('#checkpoint-banner .banner-text');
            const bSub = document.querySelector('#checkpoint-banner .banner-sub');
            if (bTxt) bTxt.textContent = '⛺ SHELTER RESTED';
            if (bSub) bSub.textContent = 'Health & Flasks Restored · Progress Saved';
          }
        }
      }
    };
    this.interactables.push(this.shelterInteractable);

    // Driftwood logs — 20 logs scattered along shoreline and beach dunes (Z: -145 to -20)
    const logPositions = [
      { x: -18, z: -140 }, { x: -8, z: -135 }, { x: 12, z: -138 }, { x: 22, z: -130 },
      { x: -28, z: -120 }, { x: -14, z: -115 }, { x: 4, z: -118 }, { x: 18, z: -112 },
      { x: -35, z: -100 }, { x: -22, z: -95 },  { x: 15, z: -92 },  { x: 30, z: -98 },
      { x: -12, z: -80 },  { x: 2, z: -75 },   { x: 25, z: -70 },  { x: -25, z: -60 },
      { x: -5, z: -50 },   { x: 14, z: -45 },  { x: -18, z: -35 }, { x: 8, z: -25 },
    ];

    for (let i = 0; i < logPositions.length; i++) {
       const lp = logPositions[i];
       const lx = lp.x + (Math.random() * 4 - 2);
       const lz = lp.z + (Math.random() * 4 - 2);
       const log = new THREE.Mesh(
         new THREE.CylinderGeometry(0.22, 0.26, 1.8, 8),
         new THREE.MeshLambertMaterial({ color: 0x5c4033, roughness: 0.85 })
       );
       log.rotation.z = Math.PI / 2;
       log.rotation.y = Math.random() * Math.PI;
       log.position.set(lx, 0.22, lz);
       this.scene.add(log);
       this._meshes.push(log);

       const interactObj = {
         position: new THREE.Vector3(lx, 0.22, lz),
         radius: 3.2,
         active: true,
         prompt: 'GATHER DRIFTWOOD [E] / [O]',
         onInteract: () => {
            if (!interactObj.active) return;
            interactObj.active = false;
            log.visible = false;
            let currentWood = 0;
            if (window.GAME && window.GAME.player) {
              if (!window.GAME.player.woodCount) window.GAME.player.woodCount = 0;
              window.GAME.player.woodCount++;
              currentWood = window.GAME.player.woodCount;
            }
            if (window.GAME && window.GAME.audio) window.GAME.audio.playSFX('pickup', 0.8);
            const hudEl = document.querySelector('#checkpoint-banner'); 
            if (hudEl) {
              hudEl.classList.remove('hidden');
              const bTxt = hudEl.querySelector('.banner-text');
              const bSub = hudEl.querySelector('.banner-sub');
              if (bTxt) bTxt.textContent = '🪵 DRIFTWOOD GATHERED';
              if (bSub) bSub.textContent = `+1 Island Wood (${currentWood}/10 needed to build Shelter)`;
              setTimeout(() => hudEl.classList.add('hidden'), 2200);
            }
            if (this.shelterInteractable && !this.shelterInteractable.isBuilt) {
              if (currentWood >= 10) {
                this.shelterInteractable.prompt = 'BUILD ICARUS SHELTER [READY] [E] / [O]';
              } else {
                this.shelterInteractable.prompt = `BUILD SHELTER (${currentWood}/10 WOOD) [E] / [O]`;
              }
            }
         }
       };
       this.interactables.push(interactObj);
    }

    // Tide pool fishing spots
    for(let i=0; i<2; i++) {
       const fx = -10 + i * 20;
       const fz = -140;
       const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({color: 0x4488ff}));
       spot.rotation.x = -Math.PI / 2;
       spot.position.set(fx, 0.05, fz);
       this.scene.add(spot);
       this._meshes.push(spot);

       const fishObj = {
         position: new THREE.Vector3(fx, 0.05, fz),
         radius: 3.0,
         active: true,
         prompt: 'FISH [E]',
         onInteract: () => {
            if (!fishObj.active) return;
            fishObj.active = false;
            spot.visible = false;
            const item = Math.random() > 0.5 ? 'Raw Sea Bass' : 'Raw Mackerel';
            if (window.GAME && window.GAME.player) {
              if (!window.GAME.player.inventory) window.GAME.player.inventory = [];
              window.GAME.player.inventory.push(item);
            }
            const hudEl = document.querySelector('#checkpoint-banner'); 
            if (hudEl) {
              hudEl.classList.remove('hidden');
              const bTxt = hudEl.querySelector('.banner-text');
              const bSub = hudEl.querySelector('.banner-sub');
              if (bTxt) bTxt.textContent = 'FISHING SUCCESS';
              if (bSub) bSub.textContent = 'Caught ' + item + '!';
              setTimeout(() => hudEl.classList.add('hidden'), 2000);
            }
         }
       };
       this.interactables.push(fishObj);
    }

    // 3D Sprite Test Chamber Portal Monolith at (10, 0, -80)
    const monolithGeo = new THREE.BoxGeometry(1.6, 3.2, 0.8);
    const monolithMat = new THREE.MeshStandardMaterial({ color: 0x224466, roughness: 0.4, metalness: 0.7 });
    const monolithMesh = new THREE.Mesh(monolithGeo, monolithMat);
    monolithMesh.position.set(10, 1.6, -80);
    this.scene.add(monolithMesh);
    this._meshes.push(monolithMesh);

    this._addTorch(10, 2.5, -79.5, 0x00ccff, 2.0, 12);

    this.interactables.push({
      position: new THREE.Vector3(10, 1.0, -80),
      radius: 3.5,
      active: true,
      prompt: 'ENTER 3D SPRITE TEST CHAMBER [E]',
      onInteract: () => {
        if (window.GAME && window.GAME.spriteTestRoom && player) {
          window.GAME.spriteTestRoom.teleportPlayerToRoom(player);
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 1: CRYPT OF THE DAMNED (Y = 0)

  // X: -20..20, Z: -3..48
  // ─────────────────────────────────────────────────────────────
  _buildFloor1_Crypt(wallMat, floorMat, ceilMat, player, audio, hud) {
    const THREE = window.THREE;
    const floorY = 0;
    
    // Floor 1 spans Z: 0 to 120. X: -60 to 60.
    this._addFloor(0, 60, 120, 120, floorMat, floorY);
    this._addCeiling(0, 60, 120, 120, ceilMat, floorY);
    
    // Outer walls for maze
    this._addWall(-60, 60, 2, 120, wallMat, floorY, false, 4.2);
    this._addWall(60, 60, 2, 120, wallMat, floorY, false, 4.2);
    // North boundary portal flanking Grand Staircase 1 (Opening at X: -6..6)
    this._addWall(-33, 120, 54, 2, wallMat, floorY, false, 4.2);
    this._addWall(33, 120, 54, 2, wallMat, floorY, false, 4.2);
    
    // Original entrance corridor so early tests pass
    this._addWall(-6, 9, 2, 24, wallMat, floorY);
    this._addWall(6, 9, 2, 24, wallMat, floorY);
    
    this._addWall(-8, 34, 2, 28, wallMat, floorY);
    this._addWall(8, 34, 2, 28, wallMat, floorY);
    this._addWall(-3, 30, 2, 2, wallMat, floorY);
    this._addWall(3, 30, 2, 2, wallMat, floorY);

    // Secret Chest Alcove on West side (X: -14, Z: 36)
    this._addFloor(-13, 36, 10, 10, floorMat, 0);
    this._addCeiling(-13, 36, 10, 10, ceilMat, 0);
    this._addWall(-18, 36, 2, 10, wallMat, 0); // West alcove wall
    this._addWall(-13, 41, 10, 2, wallMat, 0); // North alcove wall
    this._addWall(-13, 31, 10, 2, wallMat, 0); // South alcove wall
    
    // Maze internal walls extending to Z=120
    this._addWall(-20, 70, 40, 2, wallMat, floorY, false, 4.2);
    this._addWall(20, 70, 40, 2, wallMat, floorY, false, 4.2);
    this._addWall(0, 90, 2, 40, wallMat, floorY, false, 4.2);
    this._addWall(-30, 90, 2, 40, wallMat, floorY, false, 4.2);
    this._addWall(30, 90, 2, 40, wallMat, floorY, false, 4.2);
    
    // Nave passage leading directly to Grand Staircase 1 portal
    this._addWall(-26, 110, 36, 2, wallMat, floorY, false, 4.2);
    this._addWall(26, 110, 36, 2, wallMat, floorY, false, 4.2);

    // Torches
    this._addTorch(0, 2.5, 8);
    this._addTorch(-4.8, 2.5, 26);
    this._addTorch(4.8, 2.5, 26);
    this._addTorch(-14, 2.5, 36, 0x44aaff);
    
    this._addTorch(-10, 2.5, 80);
    this._addTorch(10, 2.5, 80);

    // Relic Chest
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
        const stepOpen = () => {
          angle += 0.08;
          lidGroup.rotation.x = -Math.min(Math.PI * 0.55, angle);
          if (angle < Math.PI * 0.55) requestAnimationFrame(stepOpen);
        };
        requestAnimationFrame(stepOpen);

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

    // North portal walls flanking Staircase 1 (Z: 120, stairs at X: -4..4)
    this._addWall(-6.5, 120, 5, 2, wallMat, 0);
    this._addWall(6.5, 120, 5, 2, wallMat, 0);

    // Grand Stone Archway framing the portal to Floor 2
    const archPillarGeo = new THREE.BoxGeometry(1.2, 5.0, 1.2);
    const archMat = new THREE.MeshStandardMaterial({ color: 0x3a4555, roughness: 0.6, metalness: 0.2 });
    const pLeft = new THREE.Mesh(archPillarGeo, archMat);
    pLeft.position.set(-4.5, 2.5, 119.5);
    const pRight = new THREE.Mesh(archPillarGeo, archMat);
    pRight.position.set(4.5, 2.5, 119.5);
    const pLintel = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.9, 1.4), archMat);
    pLintel.position.set(0, 4.6, 119.5);
    this.scene.add(pLeft);
    this.scene.add(pRight);
    this.scene.add(pLintel);
    this._meshes.push(pLeft, pRight, pLintel);

    // Glowing Azure Torches illuminating the Grand Ascent to Floor 2
    this._addTorch(-4.5, 2.8, 119, 0x44bbff, 2.2, 16);
    this._addTorch(4.5, 2.8, 119, 0x44bbff, 2.2, 16);
    this._addTorch(0, 3.2, 128, 0x55ccff, 2.0, 18);

    // Grand Staircase 1: Rising from Floor 1 (Y=0, Z=120) to Floor 2 (Y=4, Z=138)
    this._addStaircase(0, 120, 138, 8, 0, 4, floorMat, wallMat);
  }

  _buildFloor2_Aqueducts(wallMat, floorMat, ceilMat, player, audio, hud) {
    const THREE = window.THREE;
    const floorY = 4;

    // Floor 2 Main Hall (Z: 138..186)
    this._addFloor(0, 162, 28, 48, floorMat, floorY);
    this._addCeiling(0, 162, 28, 48, ceilMat, floorY);
    this._addWall(-14, 162, 2, 48, wallMat, floorY);
    this._addWall(14, 162, 2, 48, wallMat, floorY);

    // Central Water Basin at Z=83
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.5, 0.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x113355, roughness: 0.1, metalness: 0.8 })
    );
    basin.position.set(0, floorY + 0.2, 155);
    this.scene.add(basin);
    this._meshes.push(basin);

    // Shrine of Ash (Bonfire Checkpoint) at (-16, floorY, 87)
    // Extra floor extension for shrine chamber
    this._addFloor(-18, 159, 12, 16, floorMat, floorY);
    this._addWall(-24, 159, 2, 16, wallMat, floorY);

    const shrineLight = new THREE.PointLight(0xffb833, 2.6, 16);
    shrineLight.position.set(-16, floorY + 1.2, 159);
    this.scene.add(shrineLight);
    this._meshes.push(shrineLight);

    const flameMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdd44 })
    );
    flameMesh.position.set(-16, floorY + 0.9, 159);
    this.scene.add(flameMesh);
    this._meshes.push(flameMesh);

    // South portal walls flanking arrival from Staircase 1 (Z: 66, stairs at X: -4..4, hall width 28: X: -14..14)
    this._addWall(-9, 138, 10, 2, wallMat, floorY);
    this._addWall(9, 138, 10, 2, wallMat, floorY);

    // North portal walls flanking departure to Staircase 2 (Z: 114, stairs at X: -4..4, hall width 28: X: -14..14)
    this._addWall(-9, 186, 10, 2, wallMat, floorY);
    this._addWall(9, 186, 10, 2, wallMat, floorY);

    // Shortcut Lever situated at (X: 2.8, Z: 73)
    const leverBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.7, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x332211 })
    );
    leverBase.position.set(2.8, floorY + 0.35, 145);
    this.scene.add(leverBase);
    this._meshes.push(leverBase);

    const leverHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xdaa520, metalness: 0.9 })
    );
    leverHandle.position.set(2.8, floorY + 0.75, 145);
    leverHandle.rotation.z = 0.4;
    this.scene.add(leverHandle);
    this._meshes.push(leverHandle);

    this.interactables.push({
      position: new THREE.Vector3(2.8, floorY + 1.0, 145),
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
    this._addStaircase(0, 186, 202, 8, 4, 8, floorMat, wallMat);

    this._addTorch(-12, floorY + 2.5, 148, 0x33bbff);
    this._addTorch(12, floorY + 2.5, 148, 0x33bbff);
    this._addTorch(-16, floorY + 2.5, 159, 0xffaa33);
    this._addTorch(0, floorY + 2.5, 174, 0x33bbff);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 3: SMOLDERING FORGES (Y = 8)
  // X: -28..28, Z: 202..248
  // Fire/Earth themed, Stone Golem Elite & Lava Fissures
  // ─────────────────────────────────────────────────────────────
  _buildFloor3_Forges(wallMat, floorMat, ceilMat, audio, hud) {
    const floorY = 8;

    // Forge Arena (Z: 202..248)
    this._addFloor(0, 225, 30, 46, floorMat, floorY);
    this._addCeiling(0, 225, 30, 46, ceilMat, floorY);
    this._addWall(-15, 225, 2, 46, wallMat, floorY);
    this._addWall(15, 225, 2, 46, wallMat, floorY);

    // South portal walls flanking arrival from Staircase 2 (Z: 130, stairs at X: -4..4, hall width 30: X: -15..15)
    this._addWall(-9.5, 202, 11, 2, wallMat, floorY);
    this._addWall(9.5, 202, 11, 2, wallMat, floorY);

    // North portal walls flanking departure to Staircase 3 (Z: 176, stairs at X: -4..4, hall width 30: X: -15..15)
    this._addWall(-9.5, 248, 11, 2, wallMat, floorY);
    this._addWall(9.5, 248, 11, 2, wallMat, floorY);

    // Grand Staircase 3: Rising from Floor 3 (Y=8, Z=176) to Floor 4 (Y=12, Z=192)
    this._addStaircase(0, 248, 264, 8, 8, 12, floorMat, wallMat);

    this._addTorch(-13, floorY + 2.5, 208, 0xff4411, 1.8);
    this._addTorch(13, floorY + 2.5, 208, 0xff4411, 1.8);
    this._addTorch(-13, floorY + 2.5, 228, 0xff4411, 1.8);
    this._addTorch(13, floorY + 2.5, 228, 0xff4411, 1.8);
    this._addTorch(0, floorY + 2.5, 242, 0xff8811, 1.8);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 4: GALE SPIRE (Y = 12)
  // X: -26..26, Z: 264..310
  // Wind/Thunder themed, High Sanctum Shrine
  // ─────────────────────────────────────────────────────────────
  _buildFloor4_GaleSpire(wallMat, floorMat, ceilMat, player, audio, hud) {
    const floorY = 12;

    this._addFloor(0, 287, 28, 46, floorMat, floorY);
    this._addCeiling(0, 287, 28, 46, ceilMat, floorY);
    this._addWall(-14, 287, 2, 46, wallMat, floorY);
    this._addWall(14, 287, 2, 46, wallMat, floorY);

    // South portal walls flanking arrival from Staircase 3 (Z: 192, stairs at X: -4..4, hall width 28: X: -14..14)
    this._addWall(-9, 264, 10, 2, wallMat, floorY);
    this._addWall(9, 264, 10, 2, wallMat, floorY);

    // North portal walls flanking departure to Staircase 4 (Z: 238, stairs at X: -5..5, hall width 28: X: -14..14)
    this._addWall(-9.5, 310, 9, 2, wallMat, floorY);
    this._addWall(9.5, 310, 9, 2, wallMat, floorY);

    // Shrine 2 (High Sanctum Bonfire) at (8, floorY, 210)
    const shrineLight2 = new window.THREE.PointLight(0xffb833, 2.6, 16);
    shrineLight2.position.set(8, floorY + 1.2, 282);
    this.scene.add(shrineLight2);
    this._meshes.push(shrineLight2);

    const flameMesh2 = new window.THREE.Mesh(
      new window.THREE.SphereGeometry(0.3, 8, 8),
      new window.THREE.MeshBasicMaterial({ color: 0xffdd44 })
    );
    flameMesh2.position.set(8, floorY + 0.9, 282);
    this.scene.add(flameMesh2);
    this._meshes.push(flameMesh2);
// Grand Staircase 4: Rising from Floor 4 (Y=12, Z=238) to Floor 5 (Y=16, Z=254)
    this._addStaircase(0, 310, 326, 10, 12, 16, floorMat, wallMat);

    this._addTorch(-12, floorY + 2.5, 272, 0xffdd44);
    this._addTorch(12, floorY + 2.5, 272, 0xffdd44);
    this._addTorch(8, floorY + 2.5, 282, 0xffaa33);
    this._addTorch(0, floorY + 2.5, 302, 0xffdd44);
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 5: THRONE OF THE WIZARD KING (Y = 16)
  // X: -28..28, Z: 326..372
  // Final Boss Cathedral Arena
  // ─────────────────────────────────────────────────────────────
  _buildFloor5_Throne(wallMat, floorMat, ceilMat) {
    const floorY = 16;

    // Vast Cathedral Arena
    this._addFloor(0, 349, 36, 46, floorMat, floorY);
    this._addCeiling(0, 349, 36, 46, ceilMat, floorY);

    this._addWall(-18, 349, 2, 46, wallMat, floorY); // West
    this._addWall(18, 349, 2, 46, wallMat, floorY);  // East
    this._addWall(0, 372, 36, 2, wallMat, floorY);   // North (Back of throne)

    // South portal walls flanking arrival from Staircase 4 (Z: 254, stairs at X: -5..5, hall width 36: X: -18..18)
    this._addWall(-11.5, 326, 13, 2, wallMat, floorY);
    this._addWall(11.5, 326, 13, 2, wallMat, floorY);

    // Boss Pillars
    this._addWall(-8, 340, 2.5, 2.5, wallMat, floorY);
    this._addWall(8, 340, 2.5, 2.5, wallMat, floorY);
    this._addWall(-8, 356, 2.5, 2.5, wallMat, floorY);
    this._addWall(8, 356, 2.5, 2.5, wallMat, floorY);

    // Dark Purple Torches
    this._addTorch(-15, floorY + 3.0, 334, 0xaa22ff, 2.0);
    this._addTorch(15, floorY + 3.0, 334, 0xaa22ff, 2.0);
    this._addTorch(-15, floorY + 3.0, 362, 0xaa22ff, 2.0);
    this._addTorch(15, floorY + 3.0, 362, 0xaa22ff, 2.0);
  }

  sealBossArena(triggerZ = 326, triggerY = 16) {
    if (this.bossFogMesh) return;
    const THREE = window.THREE;
    const fogZ = 326;
    const fogY = 16;
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

  _buildSecretMinotaurLair(wallMat, floorMat, ceilMat, player, audio, hud) {
    const THREE = window.THREE;
    const arenaX = -100;
    const arenaZ = 60;
    const size = 36;
    const floorY = 0;

    // Secret Labyrinth Heart Arena
    this._addFloor(arenaX, arenaZ, size, size, floorMat, floorY);
    this._addCeiling(arenaX, arenaZ, size, size, ceilMat, floorY);

    this._addWall(arenaX - size / 2, arenaZ, 2, size, wallMat, floorY); // West
    this._addWall(arenaX + size / 2, arenaZ, 2, size, wallMat, floorY); // East
    this._addWall(arenaX, arenaZ + size / 2, size, 2, wallMat, floorY); // North
    this._addWall(arenaX, arenaZ - size / 2, size, 2, wallMat, floorY); // South

    // Arena colosseum pillars
    this._addWall(arenaX - 8, arenaZ - 8, 2.5, 2.5, wallMat, floorY);
    this._addWall(arenaX + 8, arenaZ - 8, 2.5, 2.5, wallMat, floorY);
    this._addWall(arenaX - 8, arenaZ + 8, 2.5, 2.5, wallMat, floorY);
    this._addWall(arenaX + 8, arenaZ + 8, 2.5, 2.5, wallMat, floorY);

    // Blood-red sacrificial torches
    this._addTorch(arenaX - 14, 2.8, arenaZ - 14, 0xee2200, 2.2, 18);
    this._addTorch(arenaX + 14, 2.8, arenaZ - 14, 0xee2200, 2.2, 18);
    this._addTorch(arenaX - 14, 2.8, arenaZ + 14, 0xee2200, 2.2, 18);
    this._addTorch(arenaX + 14, 2.8, arenaZ + 14, 0xee2200, 2.2, 18);

    // Floor 1 Entry Portal at (-30, 0, 90)
    const portalArch = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 4.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x442222, roughness: 0.6 })
    );
    portalArch.position.set(-30, 2.1, 90);
    this.scene.add(portalArch);
    this._meshes.push(portalArch);

    this._addTorch(-30, 3.0, 89.5, 0xff1100, 2.0, 10);

    this.interactables.push({
      position: new THREE.Vector3(-30, 1.0, 90),
      radius: 3.5,
      active: true,
      prompt: 'CHALLENGE THE MINOTAUR [E] (SECRET BOSS - ONLY FOR THE BRAVE)',
      onInteract: () => {
        if (player) {
          if (typeof player.teleport === 'function') player.teleport(arenaX, 1.7, arenaZ - 12);
          else {
            player.camera.position.set(arenaX, 1.7, arenaZ - 12);
            if (player.worldPos) player.worldPos.set(arenaX, 0, arenaZ - 12);
          }
          player.lookAt(arenaX, arenaZ);
        }
        if (audio) {
          audio.playSFX('bossRoar', 1.6);
          audio.setMusicState('boss');
        }
        if (hud && typeof hud.showCheckpointBanner === 'function') {
          hud.showCheckpointBanner();
          const bTxt = document.querySelector('#checkpoint-banner .banner-text');
          const bSub = document.querySelector('#checkpoint-banner .banner-sub');
          if (bTxt) bTxt.textContent = '🐂 THE MINOTAUR\'S INNER LAIR';
          if (bSub) bSub.textContent = 'Secret Ordeal · Slay the Guardian to claim the Legendary Aegis!';
        }

        // Spawn Secret Boss Minotaur if not already spawned
        if (window.GAME && window.GAME.enemies && !this.secretBossMinotaur) {
          import('../enemies/Enemy.js').then(({ Minotaur }) => {
            const m = window.GAME.enemies.spawnEnemy(Minotaur, new THREE.Vector3(arenaX, 0, arenaZ + 4), player, player.camera);
            if (m) {
              m.isBoss = true;
              m.isMinotaurStalker = false;
              m.maxHealth = 900;
              m.health = 900;
              m.speed = 4.2;
              m.xpValue = 0;
              m.scoreValue = 2500;
              this.secretBossMinotaur = m;

              const bBar = document.getElementById('boss-bar');
              if (bBar) bBar.classList.remove('hidden');
              const bName = document.getElementById('boss-name');
              if (bName) bName.textContent = 'ASTERION, GUARDIAN OF THE LABYRINTH';

              const origOnDeath = m.onDeath;
              m.onDeath = () => {
                if (origOnDeath) origOnDeath();
                this._spawnLegendaryArtifact(arenaX, arenaZ, player, audio, hud);
              };
            }
          });
        }
      }
    });

    // Return Portal in Lair back to Labyrinth Corridor
    this.interactables.push({
      position: new THREE.Vector3(arenaX, 1.0, arenaZ - 15),
      radius: 3.5,
      active: true,
      prompt: 'RETURN TO LABYRINTH CORRIDOR [E]',
      onInteract: () => {
        if (player) {
          if (typeof player.teleport === 'function') player.teleport(-30, 1.7, 85);
          else {
            player.camera.position.set(-30, 1.7, 85);
            if (player.worldPos) player.worldPos.set(-30, 0, 85);
          }
          player.lookAt(0, 100);
        }
        if (audio) audio.setMusicState('explore');
      }
    });
  }

  _spawnLegendaryArtifact(arenaX, arenaZ, player, audio, hud) {
    const THREE = window.THREE;
    const hornGeo = new THREE.ConeGeometry(0.35, 1.4, 8);
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0xaa7700,
      emissiveIntensity: 0.6
    });
    const artifactMesh = new THREE.Mesh(hornGeo, hornMat);
    artifactMesh.position.set(arenaX, 1.0, arenaZ);
    this.scene.add(artifactMesh);
    this._meshes.push(artifactMesh);

    const artifactLight = new THREE.PointLight(0xffcc00, 3.0, 12);
    artifactLight.position.set(arenaX, 1.5, arenaZ);
    this.scene.add(artifactLight);
    this._meshes.push(artifactLight);

    const artifactItem = {
      position: new THREE.Vector3(arenaX, 1.0, arenaZ),
      radius: 3.5,
      active: true,
      prompt: 'CLAIM AEGIS OF THE MINOTAUR [E]',
      onInteract: () => {
        if (!artifactItem.active) return;
        artifactItem.active = false;
        artifactMesh.visible = false;
        artifactLight.visible = false;

        if (player) {
          player.hasAegis = true;
          player.damageMultiplier = (1.0 + (player.level - 1) * 0.12) * 2.0;
          player.damageReduction = 0.5;   // Halve incoming damage
          player.health = player.maxHealth;
          player.flasks = player.maxFlasks;
        }

        if (audio) {
          audio.playSFX('levelUp', 1.6);
          audio.playSFX('roomClear', 1.2);
        }

        if (hud && typeof hud.showCheckpointBanner === 'function') {
          hud.showCheckpointBanner();
          const bTxt = document.querySelector('#checkpoint-banner .banner-text');
          const bSub = document.querySelector('#checkpoint-banner .banner-sub');
          if (bTxt) bTxt.textContent = '🏆 AEGIS OF THE MINOTAUR CLAIMED!';
          if (bSub) bSub.textContent = 'Legendary Blessing: Attack Damage x2 · Damage Taken -50% against Wizard King!';
        }
      }
    };
    this.interactables.push(artifactItem);
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
    this.waterMeshes = [];
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
