const fs = require('fs');

let content = fs.readFileSync('src/world/MapLoader.js', 'utf8');

// 1. Add _buildBeach call
content = content.replace(
  'this._buildFloor1_Crypt(wallMat, floorMat, ceilMat, player, audio, hud);',
  'this._buildBeach(wallMat, floorMat);\n    this._buildFloor1_Crypt(wallMat, floorMat, ceilMat, player, audio, hud);'
);

// 2. Add _buildBeach definition
const beachDef = `  _buildBeach(wallMat, floorMat) {
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
    this._addWall(0, 0, 20, 4, wallMat, 8, false, 12); // Arch over top
  }

  // ─────────────────────────────────────────────────────────────
  // FLOOR 1: CRYPT OF THE DAMNED (Y = 0)
`;

content = content.replace('  // ─────────────────────────────────────────────────────────────\r\n  // FLOOR 1: CRYPT OF THE DAMNED (Y = 0)', beachDef);

// 3. Replace _buildFloor1_Crypt
const cryptDef = `_buildFloor1_Crypt(wallMat, floorMat, ceilMat, player, audio, hud) {
    const THREE = window.THREE;
    const floorY = 0;
    
    // Floor 1 spans Z: 0 to 120. X: -60 to 60.
    this._addFloor(0, 60, 120, 120, floorMat, floorY);
    this._addCeiling(0, 60, 120, 120, ceilMat, floorY);
    
    // Outer walls for maze
    this._addWall(-60, 60, 2, 120, wallMat, floorY, false, 4.2);
    this._addWall(60, 60, 2, 120, wallMat, floorY, false, 4.2);
    this._addWall(0, 120, 120, 2, wallMat, floorY, false, 4.2); // North boundary
    
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
    
    // Hide a small passage to the stairs
    this._addWall(0, 110, 80, 2, wallMat, floorY, false, 4.2);

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

    // North portal walls flanking Staircase 1 (Z: 120, stairs at X: -4..4)
    this._addWall(-6.5, 120, 5, 2, wallMat, 0);
    this._addWall(6.5, 120, 5, 2, wallMat, 0);

    // Grand Staircase 1: Rising from Floor 1 (Y=0, Z=120) to Floor 2 (Y=4, Z=138)
    this._addStaircase(0, 120, 138, 8, 0, 4, floorMat, wallMat);
  }`;

// Find the start of Floor 2 to slice out the old Floor 1
const startF1 = content.indexOf('  _buildFloor1_Crypt(wallMat,');
const startF2 = content.indexOf('  _buildFloor2_Aqueducts(wallMat,');
content = content.substring(0, startF1) + '  ' + cryptDef + '\n\n' + content.substring(startF2);

// Now apply shifts to Z coordinates in Floor 2, 3, 4, 5
const Z_SHIFT = 72; // (138 - 66)

// Function to shift Z in specific methods
function shiftZInMethod(methodName, shiftAmount, text) {
  const startIdx = text.indexOf('  ' + methodName + '(');
  if (startIdx === -1) return text;
  
  let endIdx = text.indexOf('_buildFloor', startIdx + 20);
  if (endIdx === -1) endIdx = text.indexOf('sealBossArena', startIdx);
  if (endIdx === -1) endIdx = text.length;

  let methodText = text.substring(startIdx, endIdx);
  
  // Replace all numbers that look like Z coordinates (between 66 and 320)
  // This is risky with regex, better to match specific patterns
  methodText = methodText.replace(/Z:\s*(\d+)\.\.(\d+)/g, (m, a, b) => 'Z: ' + (parseInt(a) + shiftAmount) + '..' + (parseInt(b) + shiftAmount));
  methodText = methodText.replace(/_addFloor\(([^,]+),\s*(\d+)/g, (m, x, z) => '_addFloor(' + x + ', ' + (parseInt(z) + shiftAmount));
  methodText = methodText.replace(/_addCeiling\(([^,]+),\s*(\d+)/g, (m, x, z) => '_addCeiling(' + x + ', ' + (parseInt(z) + shiftAmount));
  methodText = methodText.replace(/_addWall\(([^,]+),\s*(\d+)/g, (m, x, z) => '_addWall(' + x + ', ' + (parseInt(z) + shiftAmount));
  methodText = methodText.replace(/_addStaircase\(([^,]+),\s*(\d+),\s*(\d+)/g, (m, x, z1, z2) => '_addStaircase(' + x + ', ' + (parseInt(z1) + shiftAmount) + ', ' + (parseInt(z2) + shiftAmount));
  methodText = methodText.replace(/_addTorch\(([^,]+),\s*([^,]+),\s*(\d+)/g, (m, x, y, z) => '_addTorch(' + x + ', ' + y + ', ' + (parseInt(z) + shiftAmount));
  methodText = methodText.replace(/position\.set\(([^,]+),\s*([^,]+),\s*(\d+)/g, (m, x, y, z) => 'position.set(' + x + ', ' + y + ', ' + (parseInt(z) + shiftAmount));
  methodText = methodText.replace(/Vector3\(([^,]+),\s*([^,]+),\s*(\d+)/g, (m, x, y, z) => 'Vector3(' + x + ', ' + y + ', ' + (parseInt(z) + shiftAmount));
  
  return text.substring(0, startIdx) + methodText + text.substring(endIdx);
}

content = shiftZInMethod('_buildFloor2_Aqueducts', Z_SHIFT, content);
content = shiftZInMethod('_buildFloor3_Forges', Z_SHIFT, content);
content = shiftZInMethod('_buildFloor4_GaleSpire', Z_SHIFT, content);
content = shiftZInMethod('_buildFloor5_Throne', Z_SHIFT, content);

// Shift sealBossArena bounds
content = content.replace(/triggerZ <= 175/g, 'triggerZ <= ' + (175 + Z_SHIFT));
content = content.replace(/fogZ = isTestMode \? 158 : 254;/g, 'fogZ = isTestMode ? ' + (158 + Z_SHIFT) + ' : ' + (254 + Z_SHIFT) + ';');

fs.writeFileSync('src/world/MapLoader.js', content);
console.log("MapLoader patched!");
