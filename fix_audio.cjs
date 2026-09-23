const fs = require('fs');
let c = fs.readFileSync('src/engine/AudioManager.js', 'utf8');
c = c.replace(/\\} catch \\(e\\) \\{\\n\\s*console\\.warn\\('\\[Audio\\] Web Audio not available:', e\\);\\n\\s*\\}\\n\\s*\\}\\n\\s*\\}/m, '} catch (e) {\\n      console.warn(\\'[Audio] Web Audio not available:\\', e);\\n    }\\n  }');
fs.writeFileSync('src/engine/AudioManager.js', c);
