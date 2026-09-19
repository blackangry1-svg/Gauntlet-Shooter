/**
 * MapLoader.js — Dungeon Room Builder
 * Builds 3D geometry for dungeon rooms
 * All walls have AABB collision data exported
 */

const WALL_H   = 4;     // Wall height
const CELL     = 3;     // Grid cell size in world units
const FLOOR_Y  = 0;
const CEIL_Y   = WALL_H;

// Pre-defined room layouts as 2D grids
// 1 = wall, 0 = floor, S = start, E = exit
const ROOM_LAYOUTS = [
  // Room 0 — Entry Hall (long corridor)
  [
    '1111111111',
    '1000000001',
    '1000000001',
    '1000000001',
    '1111010111',
    '1000000001',
    '1000000001',
    '1111111111',
  ],
  // Room 1 — Open arena
  [
    '1111111111',
    '1000000001',
    '1011011011',
    '1000000001',
    '1000000001',
    '1011011011',
    '1000000001',
    '1111111111',
  ],
  // Room 2 — Maze-like
  [
    '1111111111',
    '1000001001',
    '1011100001',
    '1001100001',
    '1001011101',
    '1000000001',
    '1001110001',
    '1111111111',
  ],
  // Room 3 — Cross shape
  [
    '1110111',
    '1000001',
    '0000000',
    '0001000',
    '0000000',
    '1000001',
    '1110111',
  ],
  // Room 4 — Ring/courtyard
  [
    '111111111',
    '100000001',
    '100111001',
    '100101001',
    '100111001',
    '100000001',
    '111111111',
  ],
  // Room 5 — Pillared hall
  [
    '11111111111',
    '10000000001',
    '10100010101',
    '10000000001',
    '10000000001',
    '10100010101',
    '10000000001',
    '11111111111',
  ],
  // Room 6 — Narrow passages
  [
    '111111111111',
    '100000000001',
    '101110111101',
    '100000000001',
    '101101101101',
    '100100000001',
    '101111110101',
    '100000000001',
    '111111111111',
  ],
  // Room 7 — Boss chamber (large square)
  [
    '111111111111111',
    '100000000000001',
    '100000000000001',
    '100000000000001',
    '100011100011001',
    '100010100010001',
    '100011100011001',
    '100000000000001',
    '100000000000001',
    '100000000000001',
    '111111111111111',
  ],
];

export class MapLoader {
  constructor(scene) {
    this.scene = scene;
    this._meshes   = [];
    this.walls     = [];       // AABB data for collision
    this.miniWalls = [];       // For minimap
    this.currentRoomBounds = null;
    this._roomOffsets = this._computeRoomOffsets();
  }

  _computeRoomOffsets() {
    // Place rooms side by side along Z axis with corridors
    const offsets = [];
    let z = 0;
    for (let i = 0; i < ROOM_LAYOUTS.length; i++) {
      const rows = ROOM_LAYOUTS[i].length;
      offsets.push({ x: 0, z });
      z += rows * CELL + CELL * 2; // gap between rooms
    }
    return offsets;
  }

  buildRoom(roomIndex, isBoss) {
    const layout = ROOM_LAYOUTS[Math.min(roomIndex, ROOM_LAYOUTS.length - 1)];
    const offset = this._roomOffsets[roomIndex] || { x: 0, z: 0 };
    const rows = layout.length;
    const cols = layout[0].length;

    // Try loading real AI-generated textures, fall back to procedural
    const wallTex  = this._loadTexture('wall.jpg');
    const floorTex = this._loadTexture('floor.jpg');
    const ceilTex  = this._makeProceduralTexture('ceil'); // no ceiling asset yet


    const wallMat  = new THREE.MeshLambertMaterial({ map: wallTex });
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
    const ceilMat  = new THREE.MeshLambertMaterial({ map: ceilTex });

    // Track bounds for minimap
    const minX = offset.x;
    const minZ = offset.z;
    const maxX = offset.x + cols * CELL;
    const maxZ = offset.z + rows * CELL;
    this.currentRoomBounds = { minX, minZ, maxX, maxZ };

    this.walls = [];
    this.miniWalls = [];

    // Floor (single large plane)
    const floorGeo = new THREE.PlaneGeometry(cols * CELL, rows * CELL);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(
      offset.x + (cols * CELL) / 2,
      FLOOR_Y,
      offset.z + (rows * CELL) / 2
    );
    this.scene.add(floorMesh);
    this._meshes.push(floorMesh);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(cols * CELL, rows * CELL);
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(
      offset.x + (cols * CELL) / 2,
      CEIL_Y,
      offset.z + (rows * CELL) / 2
    );
    this.scene.add(ceilMesh);
    this._meshes.push(ceilMesh);

    // Walls
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = layout[r][c];
        if (ch === '1') {
          const wx = offset.x + c * CELL + CELL / 2;
          const wz = offset.z + r * CELL + CELL / 2;

          const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
          const wallMesh = new THREE.Mesh(wallGeo, wallMat);
          wallMesh.position.set(wx, WALL_H / 2, wz);
          this.scene.add(wallMesh);
          this._meshes.push(wallMesh);

          // Collision AABB
          const aabb = { x: wx, z: wz, w: CELL, d: CELL };
          this.walls.push(aabb);
          this.miniWalls.push(aabb);
        }
      }
    }

    // Add torches at corners of open areas
    this._placeTorches(layout, offset, isBoss);

    return { walls: this.walls, layout, offset, rows, cols };
  }

  _placeTorches(layout, offset, isBoss) {
    const color = isBoss ? 0xff2200 : 0xff8833;
    const rows = layout.length;
    const cols = layout[0].length;
    let placed = 0;
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (layout[r][c] === '1' && placed < (isBoss ? 6 : 3)) {
          // Check at least one neighbor is open
          const neighbors = [
            layout[r-1]?.[c], layout[r+1]?.[c],
            layout[r]?.[c-1], layout[r]?.[c+1]
          ];
          if (neighbors.some(n => n === '0')) {
            const light = new THREE.PointLight(color, 0.8, 6);
            light.position.set(
              offset.x + c * CELL + CELL / 2,
              WALL_H - 0.5,
              offset.z + r * CELL + CELL / 2
            );
            this.scene.add(light);
            this._meshes.push(light);
            placed++;
          }
        }
      }
    }
  }

  getRoomStart(roomIndex) {
    const layout = ROOM_LAYOUTS[Math.min(roomIndex, ROOM_LAYOUTS.length - 1)];
    const offset = this._roomOffsets[roomIndex] || { x: 0, z: 0 };
    // Find first open cell
    for (let r = 0; r < layout.length; r++) {
      for (let c = 0; c < layout[r].length; c++) {
        if (layout[r][c] === '0') {
          return new THREE.Vector3(
            offset.x + c * CELL + CELL / 2,
            1.7,
            offset.z + r * CELL + CELL / 2
          );
        }
      }
    }
    return new THREE.Vector3(offset.x + CELL, 1.7, offset.z + CELL);
  }

  getRoomCenter(roomIndex) {
    const layout = ROOM_LAYOUTS[Math.min(roomIndex, ROOM_LAYOUTS.length - 1)];
    const offset = this._roomOffsets[roomIndex] || { x: 0, z: 0 };
    return {
      x: offset.x + layout[0].length * CELL / 2,
      z: offset.z + layout.length * CELL / 2,
    };
  }

  // Open spawn positions (for enemy placement)
  getOpenPositions(roomIndex, count) {
    const layout = ROOM_LAYOUTS[Math.min(roomIndex, ROOM_LAYOUTS.length - 1)];
    const offset = this._roomOffsets[roomIndex] || { x: 0, z: 0 };
    const opens = [];
    for (let r = 1; r < layout.length - 1; r++) {
      for (let c = 1; c < layout[r].length - 1; c++) {
        if (layout[r][c] === '0') {
          opens.push(new THREE.Vector3(
            offset.x + c * CELL + (Math.random() - 0.5) * 1.5,
            0,
            offset.z + r * CELL + (Math.random() - 0.5) * 1.5
          ));
        }
      }
    }
    // Shuffle and slice
    for (let i = opens.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opens[i], opens[j]] = [opens[j], opens[i]];
    }
    return opens.slice(0, count);
  }

  clearRoom() {
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
    this.currentRoomBounds = null;
  }

  /**
   * Load texture from assets folder with procedural fallback
   * Real AI-generated textures loaded from /assets/textures/
   */
  _loadTexture(filename) {
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/assets/textures/' + filename, undefined, undefined, () => {
      // On error — fallback already set as data texture, do nothing
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  /**
   * Procedurally generate textures as canvas data
   * Used as fallback if AI textures haven't loaded yet
   */
  _makeProceduralTexture(type) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (type === 'wall') {
      // Stone wall
      ctx.fillStyle = '#2a2420';
      ctx.fillRect(0, 0, size, size);
      // Stone blocks
      ctx.strokeStyle = '#1a1210';
      ctx.lineWidth = 3;
      for (let y = 0; y < size; y += 48) {
        const offset = (Math.floor(y / 48) % 2) * 32;
        for (let x = -32; x < size; x += 64) {
          const bx = x + offset;
          ctx.fillStyle = `rgb(${50 + Math.random() * 20},${40 + Math.random() * 20},${35 + Math.random() * 15})`;
          ctx.fillRect(bx + 2, y + 2, 60, 44);
          ctx.strokeRect(bx, y, 64, 48);
        }
      }
      // Moss patches
      for (let i = 0; i < 8; i++) {
        const mx = Math.random() * size, my = Math.random() * size;
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 12);
        g.addColorStop(0, 'rgba(40,80,20,0.4)');
        g.addColorStop(1, 'rgba(40,80,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(mx - 12, my - 12, 24, 24);
      }

    } else if (type === 'floor') {
      // Flagstone
      ctx.fillStyle = '#1a1812';
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 40) {
        for (let x = 0; x < size; x += 40) {
          const v = 20 + Math.random() * 15;
          ctx.fillStyle = `rgb(${v},${v - 5},${v - 8})`;
          ctx.fillRect(x + 1, y + 1, 38, 38);
          // Rune scratches
          if (Math.random() < 0.2) {
            ctx.strokeStyle = 'rgba(80,60,40,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 8, y + 20);
            ctx.lineTo(x + 32, y + 20);
            ctx.stroke();
          }
        }
      }

    } else if (type === 'ceil') {
      // Dark stone ceiling
      ctx.fillStyle = '#0e0c0a';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#1a1612';
      ctx.lineWidth = 2;
      for (let y = 0; y < size; y += 64) {
        for (let x = 0; x < size; x += 64) {
          ctx.fillStyle = `rgb(${18 + Math.random() * 8},${14 + Math.random() * 6},${10 + Math.random() * 5})`;
          ctx.fillRect(x + 1, y + 1, 62, 62);
          ctx.strokeRect(x, y, 64, 64);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }
}
