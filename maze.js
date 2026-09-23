const fs = require('fs');

function generateMazeCode() {
  const code = `
  _buildBeach(wallMat) {
    const THREE = window.THREE;
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xc2b280 });
    const waterMat = new THREE.MeshBasicMaterial({ color: 0x2266cc, transparent: true, opacity: 0.65 });
    
    // Beach zone spans Z: -180 to 0, Y = 0 (sea level)
    this._addFloor(0, -90, 120, 180, sandMat, 0); // Z: -180 to 0

    // Ocean water plane at Z: -180 to -120, Y = -0.3
    const waterGeo = new THREE.PlaneGeometry(200, 60);
    const wMesh = new THREE.Mesh(waterGeo, waterMat);
    wMesh.rotation.x = -Math.PI / 2;
    wMesh.position.set(0, -0.3, -150);
    this.scene.add(wMesh);
    this._meshes.push(wMesh);

    // Coastal cliffs/walls along the X edges from Z: -60 to 0
    this._addWall(-60, -30, 2, 60, wallMat, 0, false, 20);
    this._addWall(60, -30, 2, 60, wallMat, 0, false, 20);

    // The Labyrinth Portal: A grand archway entrance at Z = 0
    this._addWall(-35, 0, 50, 4, wallMat, 0, false, 20);
    this._addWall(35, 0, 50, 4, wallMat, 0, false, 20);
    // Arch over the top
    this._addWall(0, 0, 20, 4, wallMat, 8, false, 12);
  }

  _buildFloor1_Crypt(wallMat, floorMat, ceilMat, player, audio, hud) {
    const THREE = window.THREE;
    const floorY = 0;
    
    // Floor 1 spans Z: 0 to 120. X: -60 to 60.
    this._addFloor(0, 60, 120, 120, floorMat, floorY);
    this._addCeiling(0, 60, 120, 120, ceilMat, floorY);
    
    // Outer walls for maze
    this._addWall(-60, 60, 2, 120, wallMat, floorY, false, 3.5);
    this._addWall(60, 60, 2, 120, wallMat, floorY, false, 3.5);
    this._addWall(0, 120, 120, 2, wallMat, floorY, false, 3.5);
    
    // Maze internal walls
    // We want 4m wide corridors and 3.5m high walls.
    // Let's lay out some walls.
    this._addWall(-20, 20, 80, 2, wallMat, floorY, false, 3.5);
    this._addWall(40, 40, 2, 40, wallMat, floorY, false, 3.5);
    this._addWall(-40, 60, 2, 40, wallMat, floorY, false, 3.5);
    this._addWall(0, 80, 80, 2, wallMat, floorY, false, 3.5);
    this._addWall(20, 100, 2, 40, wallMat, floorY, false, 3.5);
    this._addWall(-20, 100, 2, 20, wallMat, floorY, false, 3.5);
    
    // Hide a small passage to the stairs
    this._addWall(40, 110, 40, 2, wallMat, floorY, false, 3.5);

    // Torches
    this._addTorch(0, 2.5, 8);
    this._addTorch(-4.8, 2.5, 26);
    this._addTorch(4.8, 2.5, 26);
    this._addTorch(-14, 2.5, 36, 0x44aaff);

    // Relic Chest (can stay roughly same relative place if we want)
    this._buildRelicChest(player, audio, hud);

    // Grand Staircase 1: Rising from Floor 1 (Y=0, Z=120) to Floor 2 (Y=4, Z=138)
    // Needs to be tucked behind a corner: Staircase placed at X: 50, Z: 120
    this._addStaircase(50, 120, 138, 8, 0, 4, floorMat, wallMat);
  }
`;
  return code;
}
