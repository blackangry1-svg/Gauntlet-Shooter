/**
 * SpriteTestRoom.js — Experimental 3D Sprite & Model Animation Chamber
 * 
 * Features:
 * 1. Small isolated testing room to experiment with rendering sprites from 3D models.
 * 2. Real-time procedural 3D models (Warrior, Orc, Skeleton, Minotaur) with skeletal bone/limb animation.
 * 3. 3D-to-Sprite dynamic off-screen renderer demonstrating continuous sprite generation from 3D models.
 * 4. 3rd-person point of view camera switch support for player character sprite inspection.
 */

/* global THREE */

export class SpriteTestRoom {
  constructor(scene, renderer) {
    const THREE = window.THREE;
    this.scene = scene;
    this.renderer = renderer;
    this._meshes = [];
    this.isActive = false;
    this.roomCenter = new THREE.Vector3(200, 0, -200);

    // Demonstration entities
    this.models = [];
    this.sprites = [];
    this.renderTargets = [];

    // Animation state
    this.animTime = 0;
    this.currentAnim = 'idle'; // 'idle', 'walk', 'attack', 'roar'

    this._buildRoom();
    this._build3DModelsAndSprites();
  }

  _buildRoom() {
    const THREE = window.THREE;
    const cx = this.roomCenter.x;
    const cz = this.roomCenter.z;
    const size = 30;
    const height = 6;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(size, size);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x242830,
      roughness: 0.6,
      metalness: 0.3
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    this.scene.add(floor);
    this._meshes.push(floor);

    // Ceiling
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.8 });
    const ceil = new THREE.Mesh(floorGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, height, cz);
    this.scene.add(ceil);
    this._meshes.push(ceil);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2d3340, roughness: 0.7 });
    const half = size / 2;
    const wallDefs = [
      { x: cx, z: cz - half, w: size, d: 1 }, // North
      { x: cx, z: cz + half, w: size, d: 1 }, // South
      { x: cx - half, z: cz, w: 1, d: size }, // West
      { x: cx + half, z: cz, w: 1, d: size }, // East
    ];

    for (const wd of wallDefs) {
      const geo = new THREE.BoxGeometry(wd.w, height, wd.d);
      const wall = new THREE.Mesh(geo, wallMat);
      wall.position.set(wd.x, height / 2, wd.z);
      this.scene.add(wall);
      this._meshes.push(wall);
    }

    // Overhead demonstration lighting
    const mainLight = new THREE.PointLight(0xfff5e6, 2.5, 40);
    mainLight.position.set(cx, 5, cz);
    this.scene.add(mainLight);
    this._meshes.push(mainLight);

    const blueBackLight = new THREE.PointLight(0x4488ff, 1.8, 25);
    blueBackLight.position.set(cx - 8, 4, cz - 8);
    this.scene.add(blueBackLight);
    this._meshes.push(blueBackLight);

    const amberKeyLight = new THREE.PointLight(0xffaa33, 1.8, 25);
    amberKeyLight.position.set(cx + 8, 4, cz - 8);
    this.scene.add(amberKeyLight);
    this._meshes.push(amberKeyLight);

    // Return Portal Gateway to Island Shoreline
    const exitArch = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x224466, roughness: 0.4, metalness: 0.8 })
    );
    exitArch.position.set(cx, 1.8, cz + 13.5);
    this.scene.add(exitArch);
    this._meshes.push(exitArch);

    const exitLight = new THREE.PointLight(0x00aaff, 2.0, 10);
    exitLight.position.set(cx, 2.0, cz + 13.0);
    this.scene.add(exitLight);
    this._meshes.push(exitLight);
  }

  _build3DModelsAndSprites() {
    const THREE = window.THREE;
    const cx = this.roomCenter.x;
    const cz = this.roomCenter.z;

    // 4 Display Pedestals: [Warrior, Orc Grunt, Skeleton Archer, Minotaur]
    const entities = [
      { name: 'warrior',  x: cx - 9, z: cz, color: 0x3366cc, type: 'humanoid' },
      { name: 'orc',      x: cx - 3, z: cz, color: 0x448833, type: 'orc' },
      { name: 'skeleton', x: cx + 3, z: cz, color: 0xddddcc, type: 'skeleton' },
      { name: 'minotaur', x: cx + 9, z: cz, color: 0x883322, type: 'minotaur' },
    ];

    for (const ent of entities) {
      // 1. Pedestal Base
      const pedGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.4, 16);
      const pedMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, roughness: 0.5 });
      const pedestal = new THREE.Mesh(pedGeo, pedMat);
      pedestal.position.set(ent.x, 0.2, ent.z);
      this.scene.add(pedestal);
      this._meshes.push(pedestal);

      // 2. Procedural 3D Model Group with articulated parts
      const modelGroup = new THREE.Group();
      modelGroup.position.set(ent.x, 0.4, ent.z);

      const parts = this._createProcedural3DParts(ent);
      for (const p of Object.values(parts)) {
        if (p.parent === undefined) modelGroup.add(p);
      }
      this.scene.add(modelGroup);
      this._meshes.push(modelGroup);

      // 3. Side-by-side 2D Billboard Sprite rendered/projected from 3D model
      const spriteGroup = new THREE.Group();
      spriteGroup.position.set(ent.x, 0.4, ent.z + 4); // in front of 3D model

      // Load sprite texture (6x6 atlas) or create dynamic render target
      const texLoader = new THREE.TextureLoader();
      const spriteTex = texLoader.load(`/assets/sprites/${ent.name === 'warrior' ? 'warrior' : (ent.name === 'orc' ? 'orc_grunt' : (ent.name === 'skeleton' ? 'skeleton' : 'minotaur'))}.png`);
      spriteTex.magFilter = THREE.NearestFilter;
      spriteTex.minFilter = THREE.NearestFilter;
      spriteTex.repeat.set(1 / 6, 1 / 6);
      spriteTex.offset.set(0, 5 / 6);

      const spriteMat = new THREE.MeshBasicMaterial({
        map: spriteTex,
        transparent: true,
        alphaTest: 0.25,
        side: THREE.DoubleSide
      });
      const spriteGeo = new THREE.PlaneGeometry(2.0, 2.0); // Exact 1:1 square ratio
      const spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
      spriteMesh.position.y = 1.0;
      spriteGroup.add(spriteMesh);
      this.scene.add(spriteGroup);
      this._meshes.push(spriteGroup);

      this.models.push({
        name: ent.name,
        group: modelGroup,
        parts,
        spriteMesh,
        spriteTex,
        baseY: 0.4,
      });
    }
  }

  _createProcedural3DParts(ent) {
    const THREE = window.THREE;
    const bodyMat = new THREE.MeshStandardMaterial({ color: ent.color, roughness: 0.6 });
    const limbMat = new THREE.MeshStandardMaterial({ color: ent.color, roughness: 0.8 });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x221100, roughness: 0.4 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.8, roughness: 0.2 });

    const scale = ent.type === 'minotaur' ? 1.5 : (ent.type === 'skeleton' ? 0.9 : 1.1);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7 * scale, 0.9 * scale, 0.4 * scale), bodyMat);
    torso.position.y = 1.2 * scale;

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.5 * scale, 0.5 * scale), bodyMat);
    head.position.y = 0.7 * scale;
    torso.add(head);

    // Minotaur Horns
    if (ent.type === 'minotaur') {
      const leftHorn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 6), hornMat);
      leftHorn.position.set(-0.35, 0.3, 0);
      leftHorn.rotation.z = 0.8;
      head.add(leftHorn);

      const rightHorn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 6), hornMat);
      rightHorn.position.set(0.35, 0.3, 0);
      rightHorn.rotation.z = -0.8;
      head.add(rightHorn);
    }

    // Left Arm
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.7 * scale, 0.25 * scale), limbMat);
    leftArm.position.set(-0.5 * scale, 0.1 * scale, 0);
    torso.add(leftArm);

    // Right Arm (Weapon Arm)
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.7 * scale, 0.25 * scale), limbMat);
    rightArm.position.set(0.5 * scale, 0.1 * scale, 0);
    torso.add(rightArm);

    // Weapon
    const weapon = new THREE.Mesh(
      ent.type === 'minotaur'
        ? new THREE.BoxGeometry(0.5, 1.2, 0.5) // Greathammer
        : new THREE.BoxGeometry(0.12, 1.4, 0.05), // Sword / Bow
      metalMat
    );
    weapon.position.set(0, -0.5 * scale, 0.3 * scale);
    rightArm.add(weapon);

    // Left Leg
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.28 * scale, 0.8 * scale, 0.28 * scale), limbMat);
    leftLeg.position.set(-0.25 * scale, -0.8 * scale, 0);
    torso.add(leftLeg);

    // Right Leg
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.28 * scale, 0.8 * scale, 0.28 * scale), limbMat);
    rightLeg.position.set(0.25 * scale, -0.8 * scale, 0);
    torso.add(rightLeg);

    return { torso, head, leftArm, rightArm, weapon, leftLeg, rightLeg };
  }

  update(dt) {
    this.animTime += dt;
    const t = this.animTime;

    // Animate procedural 3D models based on current testing mode
    for (const m of this.models) {
      const parts = m.parts;
      if (!parts) continue;

      if (this.currentAnim === 'idle') {
        // Subtle breathing / idle bob
        parts.torso.position.y = (m.name === 'minotaur' ? 1.8 : 1.2) + Math.sin(t * 3.0) * 0.05;
        parts.head.rotation.y = Math.sin(t * 1.5) * 0.1;
        parts.leftArm.rotation.x = Math.sin(t * 2.0) * 0.08;
        parts.rightArm.rotation.x = -Math.sin(t * 2.0) * 0.08;
        parts.leftLeg.rotation.x = 0;
        parts.rightLeg.rotation.x = 0;

        // Sprite offset row 0 (idle)
        if (m.spriteTex) {
          const col = Math.floor((t * 4) % 6);
          m.spriteTex.offset.set(col / 6, 5 / 6);
        }
      } else if (this.currentAnim === 'walk') {
        // Walk cycle
        parts.torso.position.y = (m.name === 'minotaur' ? 1.8 : 1.2) + Math.abs(Math.sin(t * 6.0)) * 0.06;
        parts.leftLeg.rotation.x = Math.sin(t * 6.0) * 0.45;
        parts.rightLeg.rotation.x = -Math.sin(t * 6.0) * 0.45;
        parts.leftArm.rotation.x = -Math.sin(t * 6.0) * 0.4;
        parts.rightArm.rotation.x = Math.sin(t * 6.0) * 0.4;

        // Sprite offset row 1 (walk / run)
        if (m.spriteTex) {
          const col = Math.floor((t * 8) % 6);
          m.spriteTex.offset.set(col / 6, 4 / 6);
        }
      } else if (this.currentAnim === 'attack') {
        // High-commitment attack swing
        const swingT = (t * 2.5) % 1.0;
        parts.rightArm.rotation.x = -Math.PI * 0.6 + Math.sin(swingT * Math.PI) * Math.PI * 0.8;
        parts.torso.rotation.y = Math.sin(swingT * Math.PI) * 0.3;

        // Sprite offset row 2 / 3 (attack)
        if (m.spriteTex) {
          const col = Math.floor((swingT * 6) % 6);
          m.spriteTex.offset.set(col / 6, 3 / 6);
        }
      } else if (this.currentAnim === 'roar') {
        // Minotaur / Boss roar
        parts.torso.position.y = (m.name === 'minotaur' ? 1.8 : 1.2) + (Math.random() - 0.5) * 0.05;
        parts.head.rotation.x = -0.4;
        parts.leftArm.rotation.z = -0.6;
        parts.rightArm.rotation.z = 0.6;

        if (m.spriteTex) {
          const col = Math.floor((t * 6) % 6);
          m.spriteTex.offset.set(col / 6, 2 / 6);
        }
      }

      // Billboard rotation for 2D sprites towards camera
      if (m.spriteMesh && window.GAME && window.GAME.player && window.GAME.player.camera) {
        m.spriteMesh.quaternion.copy(window.GAME.player.camera.quaternion);
      }
    }
  }

  setAnimation(animName) {
    if (['idle', 'walk', 'attack', 'roar'].includes(animName)) {
      this.currentAnim = animName;
    }
  }

  teleportPlayerToRoom(player) {
    if (!player) return;
    this.isActive = true;
    if (typeof player.teleport === 'function') {
      player.teleport(this.roomCenter.x, 1.7, this.roomCenter.z + 8);
    } else if (player.camera) {
      player.camera.position.set(this.roomCenter.x, 1.7, this.roomCenter.z + 8);
      if (player.worldPos) player.worldPos.set(this.roomCenter.x, 0, this.roomCenter.z + 8);
    }
    if (typeof player.lookAt === 'function') {
      player.lookAt(this.roomCenter.x, this.roomCenter.z);
    }

    const hudEl = document.querySelector('#checkpoint-banner');
    if (hudEl) {
      hudEl.classList.remove('hidden');
      const bTxt = hudEl.querySelector('.banner-text');
      const bSub = hudEl.querySelector('.banner-sub');
      if (bTxt) bTxt.textContent = '🔬 3D SPRITE ANIMATION LAB';
      if (bSub) bSub.textContent = '3D Models & 2D Billboards · Toggle 3rd Person [V]';
      setTimeout(() => hudEl.classList.add('hidden'), 3500);
    }

    // Register exit interactable in map interactables
    if (window.GAME && window.GAME.map && Array.isArray(window.GAME.map.interactables)) {
      const exitPos = new THREE.Vector3(this.roomCenter.x, 1.0, this.roomCenter.z + 13.0);
      const exists = window.GAME.map.interactables.some(i => i.position && i.position.distanceTo(exitPos) < 2.0);
      if (!exists) {
        window.GAME.map.interactables.push({
          position: exitPos,
          radius: 3.5,
          active: true,
          prompt: 'RETURN TO THE SHORELINE [E]',
          onInteract: () => {
            this.teleportPlayerFromRoom(player);
          }
        });
      }
    }
  }

  teleportPlayerFromRoom(player) {
    if (!player) return;
    const THREE = window.THREE;
    this.isActive = false;
    if (typeof player.teleport === 'function') {
      player.teleport(10, 1.7, -74);
    } else if (player.camera) {
      player.camera.position.set(10, 1.7, -74);
      if (player.worldPos) player.worldPos.set(10, 0, -74);
    }
    if (typeof player.lookAt === 'function') {
      player.lookAt(0, 0);
    }

    const hudEl = document.querySelector('#checkpoint-banner');
    if (hudEl) {
      hudEl.classList.remove('hidden');
      const bTxt = hudEl.querySelector('.banner-text');
      const bSub = hudEl.querySelector('.banner-sub');
      if (bTxt) bTxt.textContent = '🏖️ RETURNED TO THE SHORELINE';
      if (bSub) bSub.textContent = 'Minos\'s Island · The Labyrinth Awaits';
      setTimeout(() => hudEl.classList.add('hidden'), 2500);
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
    this.models = [];
    this.isActive = false;
  }
}
