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
    console.log('Player HP before:', await h.evaluate('window.GAME.player.health'));
    await h.evaluate('window.GAME.player.takeDamage(9999)');
    console.log('Player HP after:', await h.evaluate('window.GAME.player.health'));
    console.log('Phase immediately after:', await h.evaluate('window.GAME.STATE.phase'));
    await new Promise(r => setTimeout(r, 1800));
    console.log('Phase after 1.8s:', await h.evaluate('window.GAME.STATE.phase'));
    console.log('Game Over hidden?:', await h.evaluate('document.getElementById("game-over").classList.contains("hidden")'));
  } finally {
    await h.close();
  }
}

test();
