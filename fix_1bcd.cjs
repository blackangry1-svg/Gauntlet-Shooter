const fs = require('fs');

// main.js
let mainJs = fs.readFileSync('src/main.js', 'utf8').replace(/\r\n/g, '\n');
mainJs = mainJs.replace('const dt = Math.min(rawDt, 0.1);', 'const dt = Math.min(rawDt, 0.033);');
mainJs = mainJs.replace('const particles = new ParticleSystem(scene);', 'const particles = new ParticleSystem(scene, renderer, camera);');
fs.writeFileSync('src/main.js', mainJs, 'utf8');

// ParticleSystem.js
let partJs = fs.readFileSync('src/combat/ParticleSystem.js', 'utf8').replace(/\r\n/g, '\n');

partJs = partJs.replace(/constructor\(scene\) \{/, `constructor(scene, renderer, camera) {
    this._sharedMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });`);

partJs = partJs.replace(/scene\.add\(p\.mesh\);\n\s*\}/, `scene.add(p.mesh);
    }
    if (renderer && camera && this._pool.length > 0) {
      this._pool[0].mesh.visible = true;
      renderer.compile(scene, camera);
      this._pool[0].mesh.visible = false;
    }
}`);

partJs = partJs.replace(/const mat = new THREE\.MeshBasicMaterial\(\{[\s\S]*?\}\);/, 'const mat = this._sharedMat;');

fs.writeFileSync('src/combat/ParticleSystem.js', partJs, 'utf8');
