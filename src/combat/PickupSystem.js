/**
 * PickupSystem.js — Health/Mana/Score pickups dropped by enemies
 * Billboard sprites using pickups.jpg sheet (2x3 grid)
 */

/* global THREE */

// Pickup types and their sheet positions (col, row in a 3x2 grid)
const PICKUP_DEFS = {
  health: { col: 0, row: 0, color: 0xff2222, label: '+HP',  glow: 0xff0000 },
  mana:   { col: 1, row: 0, color: 0x2244ff, label: '+MP',  glow: 0x0044ff },
  gold:   { col: 2, row: 0, color: 0xffcc00, label: '+500', glow: 0xffaa00 },
  armor:  { col: 0, row: 1, color: 0x44cc44, label: '+ARM', glow: 0x00ff44 },
  gem:    { col: 2, row: 1, color: 0xaa44ff, label: '+XP',  glow: 0x8800ff },
};

const CELL_W = 1 / 3;
const CELL_H = 1 / 2;

export class PickupSystem {
  constructor(scene, audio) {
    this.scene  = scene;
    this.audio  = audio;
    this._items = [];
    this._tex   = null;
    this._loadTex();
  }

  _loadTex() {
    const THREE = window.THREE;
    const loader = new THREE.TextureLoader();
    this._tex = loader.load('/assets/sprites/pickups.png');
  }

  /**
   * Drop pickups at a world position based on enemy type
   */
  dropFromEnemy(pos, enemyType) {
    const rand = Math.random();
    if (rand < 0.50)      this.spawnPickup(pos.clone(), 'health');
    else if (rand < 0.70) this.spawnPickup(pos.clone(), 'mana');
    else if (rand < 0.85) this.spawnPickup(pos.clone(), 'gold');
    else                  this.spawnPickup(pos.clone(), 'gem');
  }

  spawnPickup(pos, type) {
    const THREE = window.THREE;
    const def = PICKUP_DEFS[type];
    if (!def) return;

    // Clone texture and set UV offset to select the right cell
    const tex = this._tex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(CELL_W, CELL_H);
    tex.offset.set(def.col * CELL_W, (1 - def.row * CELL_H) - CELL_H);

    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(def.glow),
      emissiveIntensity: 0.5,
    });

    const geo  = new THREE.PlaneGeometry(0.6, 0.6);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    const baseY = pos.y !== undefined ? pos.y : 0;
    mesh.position.y = baseY + 0.35;

    // Point light for glow
    const light = new THREE.PointLight(def.glow, 0.8, 2.5);
    light.position.set(0, 0, 0);
    mesh.add(light);

    this.scene.add(mesh);

    const item = { mesh, type, pos: mesh.position, baseY, bobT: Math.random() * Math.PI * 2, alive: true };
    this._items.push(item);
    return item;
  }

  update(dt, playerPos, player, onScore) {
    const THREE = window.THREE;
    const PICKUP_RADIUS = 1.2;

    for (let i = this._items.length - 1; i >= 0; i--) {
      const item = this._items[i];
      if (!item.alive) { this._items.splice(i, 1); continue; }

      // Bob
      item.bobT += dt * 2.5;
      item.mesh.position.y = item.baseY + 0.35 + Math.sin(item.bobT) * 0.12;

      // Spin to face camera
      item.mesh.rotation.y += dt * 1.5;

      // Pulse glow
      if (item.mesh.children[0]) {
        item.mesh.children[0].intensity = 0.6 + Math.sin(item.bobT * 2) * 0.25;
      }

      // Collect
      if (playerPos && item.mesh.position.distanceTo(playerPos) < PICKUP_RADIUS) {
        this._collect(item, player, onScore);
        this.scene.remove(item.mesh);
        item.mesh.geometry.dispose();
        item.mesh.material.dispose();
        item.alive = false;
        this._items.splice(i, 1);
      }
    }
  }

  _collect(item, player, onScore) {
    if (!player) return;
    switch (item.type) {
      case 'health': player.heal(30);                    this.audio.playSFX('pickupHealth');  break;
      case 'mana':   player.mana = Math.min(player.maxMana, player.mana + 40);
                                                         this.audio.playSFX('pickupMana');    break;
      case 'gold':   if (onScore) onScore(500);          this.audio.playSFX('pickupGold');    break;
      case 'gem':    if (onScore) onScore(1000);
                     if (player.addXP) player.addXP(50);
                     this.audio.playSFX('pickupGold');    break;
    }
    this._showPickupText(item.type);
  }

  _showPickupText(type) {
    const def = PICKUP_DEFS[type];
    if (!def) return;
    const el = document.createElement('div');
    el.textContent = def.label;
    el.style.cssText = `
      position:fixed; left:50%; top:42%; transform:translateX(-50%);
      color:${def.color ? '#' + def.color.toString(16).padStart(6,'0') : '#fff'};
      font-size:28px; font-weight:bold; font-family:serif;
      text-shadow: 0 0 8px #000, 0 2px 4px #000;
      pointer-events:none; z-index:800;
      transition: transform 1s ease-out, opacity 1s ease-out;
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translateX(-50%) translateY(-40px)';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 1100);
  }

  clear() {
    for (const item of this._items) {
      this.scene.remove(item.mesh);
      if (item.mesh.geometry) item.mesh.geometry.dispose();
      if (item.mesh.material) item.mesh.material.dispose();
    }
    this._items = [];
  }
}
