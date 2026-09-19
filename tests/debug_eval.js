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
    const dir = await h.evaluate(`
      (() => {
        const v = new THREE.Vector3();
        window.GAME.player.camera.getWorldDirection(v);
        return { x: v.x, y: v.y, z: v.z, yaw: window.GAME.player.yaw };
      })()
    `);
    console.log('Forward dir:', dir);
  } finally {
    await h.close();
  }
}

test();
