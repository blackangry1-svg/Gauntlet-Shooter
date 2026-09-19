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
    // Test enemy wall collision
    const enemyCollision = await h.evaluate(`
      (() => {
        const enemy = window.GAME.enemies.getAll()[0];
        // Position enemy at X: -4.0, Z: 26 (near wall at X: -6.0)
        enemy.mesh.position.set(-4.0, 0, 26);
        // Position player far behind the wall at X: -10, Z: 26
        const targetPos = new THREE.Vector3(-10, 1.7, 26);
        
        // Update enemy for 40 frames chasing player through wall
        for (let i = 0; i < 40; i++) {
          enemy.update(0.016, targetPos);
        }
        
        return {
          wallCount: enemy.walls.length,
          finalEnemyX: enemy.mesh.position.x
        };
      })()
    `);
    console.log('Enemy wall collision result:', enemyCollision);
  } finally {
    await h.close();
  }
}

test();
