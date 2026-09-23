const fs = require('fs');

let content = fs.readFileSync('tests/run_gauntlet_suite.js', 'utf8');
const Z_SHIFT = 72;

// We can just regex replace specific values based on the test code we saw
content = content.replace(/setPosition\(-16, 1.7, 87\)/g, 'setPosition(-16, 1.7, ' + (87 + Z_SHIFT) + ')');
content = content.replace(/setPosition\(2.8, 1.7, 73\)/g, 'setPosition(2.8, 1.7, ' + (73 + Z_SHIFT) + ')');
content = content.replace(/setPosition\(0, 1.7, 66\); window.GAME.lookAt\(0, 72\);/g, 'setPosition(0, 1.7, ' + (66 + Z_SHIFT) + '); window.GAME.lookAt(0, ' + (72 + Z_SHIFT) + ');');
content = content.replace(/setPosition\(5, 1.7, 103\)/g, 'setPosition(5, 1.7, ' + (103 + Z_SHIFT) + ')');
content = content.replace(/lookAt\(5, 106\)/g, 'lookAt(5, ' + (106 + Z_SHIFT) + ')');
content = content.replace(/setPosition\(5, 1.7, 162\)/g, 'setPosition(5, 1.7, ' + (162 + Z_SHIFT) + ')');
content = content.replace(/lookAt\(5, 185\)/g, 'lookAt(5, ' + (185 + Z_SHIFT) + ')');
content = content.replace(/setPosition\(5, 1.7, 180\)/g, 'setPosition(5, 1.7, ' + (180 + Z_SHIFT) + ')');

fs.writeFileSync('tests/run_gauntlet_suite.js', content);
console.log('Tests patched!');
