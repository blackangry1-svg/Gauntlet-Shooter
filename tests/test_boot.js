import { CDPHarness } from './cdp_harness.js';

async function run() {
  console.log('--- Starting CDP Harness ---');
  const harness = new CDPHarness({ port: 9222 });
  try {
    await harness.launch();
    console.log('Chrome launched, navigating to http://localhost:3000/...');
    await harness.navigate('http://localhost:3000/');

    // Wait a moment for page scripts to load and execute
    await new Promise(r => setTimeout(r, 2000));

    // Check title
    const title = await harness.evaluate('document.title');
    console.log('Document Title:', title);

    // Check errors
    console.log('Console errors recorded:', harness.errors);
    console.log('Console logs recorded:', harness.consoleLogs);

    // Check game canvas
    const canvasExists = await harness.evaluate('!!document.getElementById("game-canvas")');
    console.log('Canvas exists:', canvasExists);

    // Check Three.js
    const threeLoaded = await harness.evaluate('typeof THREE !== "undefined"');
    console.log('THREE loaded:', threeLoaded);

    // Capture baseline menu screenshot
    const screenshotPath = 'screenshots/00_baseline_menu.png';
    await harness.captureScreenshot(screenshotPath);
    console.log(`Saved screenshot to ${screenshotPath}`);

    // Click on Warrior character card to select it
    await harness.evaluate(`
      const warriorCard = document.querySelector('.char-card[data-char="warrior"]');
      if (warriorCard) warriorCard.click();
    `);
    await new Promise(r => setTimeout(r, 500));

    // Click New Game
    const startBtnDisabled = await harness.evaluate(`document.getElementById('btn-new-game').disabled`);
    console.log('New Game button disabled before/after click:', startBtnDisabled);
    await harness.evaluate(`document.getElementById('btn-new-game').click()`);

    await new Promise(r => setTimeout(r, 2000));

    // Check phase
    const gameState = await harness.evaluate(`
      window.STATE ? { phase: window.STATE.phase, room: window.STATE.currentRoom } : 'no window.STATE'
    `);
    console.log('Game state:', gameState);

    // Capture in-game screenshot
    const inGameScreenshot = 'screenshots/01_baseline_ingame.png';
    await harness.captureScreenshot(inGameScreenshot);
    console.log(`Saved screenshot to ${inGameScreenshot}`);

    // Check console errors again
    console.log('Total console errors after starting game:', harness.errors);

  } catch (err) {
    console.error('Error during boot test:', err);
  } finally {
    await harness.close();
  }
}

run();
