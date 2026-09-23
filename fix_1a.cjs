const fs = require('fs');

let f1 = 'src/combat/PickupSystem.js';
let content = fs.readFileSync(f1, 'utf8').replace(/\r\n/g, '\n');

// 1A
content = content.replace(/new THREE\.MeshLambertMaterial\(\{[\s\S]*?\}\);/, `new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
      color: def.glow
    });`);

content = content.replace(/(\s*\/\/ Point light for glow\n\s*const light = new THREE\.PointLight[\s\S]*?mesh\.add\(light\);)/, '');
content = content.replace(/(\s*\/\/ Pulse glow\n\s*if \(item\.mesh\.children\[0\]\) \{\n\s*item\.mesh\.children\[0\]\.intensity = 0\.6 \+ Math\.sin\(item\.bobT \* 2\) \* 0\.25;\n\s*\})/, `
      // Pulse scale
      const s = 1.0 + Math.sin(item.bobT * 2) * 0.15;
      item.mesh.scale.set(s, s, s);`);
fs.writeFileSync(f1, content, 'utf8');
