import { CDPHarness } from './cdp_harness.js';

async function test() {
  const h = new CDPHarness({ port: 9222 });
  try {
    await h.launch('http://localhost:3000/');
    await new Promise(r => setTimeout(r, 2000));
    await h.evaluate(`
      document.querySelector('.char-card[data-char="warrior"]').click();
      document.getElementById('btn-new-game').click();
    `);
    await new Promise(r => setTimeout(r, 1000));
    const badWalls = await h.evaluate(`
      window.GAME.player.walls.filter(w => isNaN(w.x) || isNaN(w.z) || isNaN(w.w) || isNaN(w.d))
    `);
    console.log('Bad walls count:', badWalls.length);
    if (badWalls.length > 0) console.log('Bad walls sample:', badWalls[0]);

    // Check first 5 walls
    const sample = await h.evaluate('window.GAME.player.walls.slice(0, 5)');
    console.log('Sample walls:', sample);

    // Check camera position and player speed/dt
    console.log('Camera pos:', await h.evaluate('({ x: window.GAME.player.camera.position.x, y: window.GAME.player.camera.position.y, z: window.GAME.player.camera.position.z })'));
    console.log('Base speed:', await h.evaluate('window.GAME.player.baseSpeed'));
    console.log('Yaw:', await h.evaluate('window.GAME.player.yaw'));

    // Step once manually
    await h.evaluate(`
      window.GAME.player.input._keys.add('KeyA');
      window.GAME.player.update(0.016);
    `);
    console.log('After 1 update step:', await h.evaluate('({ x: window.GAME.player.camera.position.x, y: window.GAME.player.camera.position.y, z: window.GAME.player.camera.position.z })'));

  } finally {
    await h.close();
  }
}

test();
