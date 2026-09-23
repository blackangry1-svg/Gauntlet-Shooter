const fs = require('fs');

let content = fs.readFileSync('src/main.js', 'utf8');

// Update player spawn
content = content.replace(
  '    camera.position.set(0, 1.7, 2);\n    player.checkpointPos.set(0, 1.7, 2);',
  '    camera.position.set(0, 1.7, -140);\n    player.checkpointPos.set(0, 1.7, -140);'
);

// Shift enemies in spawnWorldEncounters
const Z_SHIFT = 72;

const startF2 = content.indexOf('── Floor 2');
if (startF2 !== -1) {
  let endIdx = content.indexOf('const countEl = document.getElementById', startF2);
  let methodText = content.substring(startF2, endIdx);
  
  // Shift Vector3 arguments: Vector3(x, y, z)
  methodText = methodText.replace(/Vector3\(([^,]+),\s*([^,]+),\s*(\d+)/g, (m, x, y, z) => 'Vector3(' + x + ', ' + y + ', ' + (parseInt(z) + Z_SHIFT));
  
  content = content.substring(0, startF2) + methodText + content.substring(endIdx);
}

fs.writeFileSync('src/main.js', content);
console.log('main.js patched!');
