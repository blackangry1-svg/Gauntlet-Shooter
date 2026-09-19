import { CDPHarness } from './cdp_harness.js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('========================================================');
  console.log('   GAUNTLET SOUL-DOOM: COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('========================================================\n');

  const harness = new CDPHarness({ port: 9222, width: 1280, height: 720 });
  const results = {};

  try {
    console.log('[Phase 0] Booting headless Chrome with WebGL...');
    await harness.launch('http://localhost:3000/');
    await sleep(2000);

    // ─────────────────────────────────────────────────────────
    // TEST 1: BOOT TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 1/13] Running BOOT TEST...');
    const title = await harness.evaluate('document.title');
    const hasCanvas = await harness.evaluate('!!document.getElementById("game-canvas")');
    const isThreeLoaded = await harness.evaluate('typeof THREE !== "undefined"');
    const bootErrors = [...harness.errors];

    const bootPass = title.includes('Gauntlet') && hasCanvas && isThreeLoaded && bootErrors.length === 0;
    results['BOOT_TEST'] = { pass: bootPass, details: { title, hasCanvas, isThreeLoaded, errors: bootErrors } };
    console.log(`  -> Result: ${bootPass ? 'PASS ✓' : 'FAIL ✗'}`);
    if (!bootPass) console.error('  Boot details:', results['BOOT_TEST']);

    // Capture 01_start
    await harness.captureScreenshot('screenshots/01_start.png');

    // Start Game as Warrior
    console.log('  Selecting Warrior and launching game...');
    await harness.evaluate(`
      const card = document.querySelector('.char-card[data-char="warrior"]');
      if (card) card.click();
      document.getElementById('btn-new-game').click();
    `);
    await sleep(1500);

    // ─────────────────────────────────────────────────────────
    // TEST 2: MOVEMENT TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 2/13] Running MOVEMENT TEST...');
    const posStart = await harness.evaluate(`({ x: window.GAME.player.camera.position.x, z: window.GAME.player.camera.position.z })`);
    // Simulate moving forward for 500ms
    await harness.evaluate(`
      window.GAME.player.input._keys.add('KeyW');
    `);
    await sleep(500);
    await harness.evaluate(`
      window.GAME.player.input._keys.delete('KeyW');
    `);
    const posMoved = await harness.evaluate(`({ x: window.GAME.player.camera.position.x, z: window.GAME.player.camera.position.z })`);
    const distMoved = Math.hypot(posMoved.x - posStart.x, posMoved.z - posStart.z);
    const movePass = distMoved > 0.5;
    results['MOVEMENT_TEST'] = { pass: movePass, details: { posStart, posMoved, distMoved } };
    console.log(`  -> Result: ${movePass ? 'PASS ✓' : 'FAIL ✗'} (Distance moved: ${distMoved.toFixed(2)}m)`);

    // Capture 02_first_hall
    await harness.evaluate('window.GAME.setPosition(0, 1.7, 10)');
    await sleep(300);
    await harness.captureScreenshot('screenshots/02_first_hall.png');

    // ─────────────────────────────────────────────────────────
    // TEST 3: COLLISION TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 3/13] Running COLLISION TEST (Anti-Penetration)...');
    // Position player near left wall (X: -4.0, Z: 10, wall boundary is at X: -4.65)
    await harness.evaluate('window.GAME.setPosition(-4.0, 1.7, 10)');
    const wallCount = await harness.evaluate('window.GAME.player.walls.length');
    // Attempt to walk left into wall for 600ms
    await harness.evaluate(`
      window.GAME.player.input._keys.add('KeyA');
    `);
    await sleep(600);
    await harness.evaluate(`
      window.GAME.player.input._keys.delete('KeyA');
    `);
    const posAfterWall = await harness.evaluate('window.GAME.player.camera.position.x');
    // Wall center is -6, w=2, minX=-7, maxX=-5. Player radius is 0.35. Position cannot penetrate past -4.65
    const collisionPass = wallCount > 20 && posAfterWall >= -4.75;
    results['COLLISION_TEST'] = { pass: collisionPass, details: { wallCount, posAfterWall } };
    console.log(`  -> Result: ${collisionPass ? 'PASS ✓' : 'FAIL ✗'} (Final X: ${posAfterWall.toFixed(2)}, walls: ${wallCount})`);

    // Capture 03_first_enemy
    await harness.evaluate('window.GAME.setPosition(0, 1.7, 20)');
    await sleep(400);
    await harness.captureScreenshot('screenshots/03_first_enemy.png');

    // ─────────────────────────────────────────────────────────
    // TEST 5: COMBAT TEST (Hit Detection & Damage)
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 5/13] Running COMBAT TEST (Melee Hit Detection)...');
    // Position directly in front of first alive Orc Grunt wherever AI moved it
    await harness.evaluate(`
      const targetEnemy = window.GAME.enemies.getAll()[0];
      const ePos = targetEnemy.mesh.position;
      window.GAME.setPosition(ePos.x, 1.7, ePos.z - 1.5);
      window.GAME.lookAt(ePos.x, ePos.z);
    `);
    await sleep(300);
    const enemyHpBefore = await harness.evaluate('window.GAME.enemies.getAll()[0].health');
    // Trigger attack
    await harness.evaluate('window.GAME.triggerAttack()');
    await sleep(450); // allow active strike window
    const enemyHpAfter = await harness.evaluate('window.GAME.enemies.getAll()[0].health');
    const combatPass = enemyHpAfter < enemyHpBefore;
    results['COMBAT_TEST'] = { pass: combatPass, details: { enemyHpBefore, enemyHpAfter } };
    console.log(`  -> Result: ${combatPass ? 'PASS ✓' : 'FAIL ✗'} (Enemy HP: ${enemyHpBefore} -> ${enemyHpAfter})`);

    // Capture 04_combat
    await harness.captureScreenshot('screenshots/04_combat.png');

    // ─────────────────────────────────────────────────────────
    // TEST 6: DAMAGE TEST (Player Damage & Vignette)
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 6/13] Running DAMAGE TEST...');
    const playerHpBefore = await harness.evaluate('window.GAME.player.health');
    await harness.evaluate('window.GAME.triggerDamage(25)');
    const playerHpAfter = await harness.evaluate('window.GAME.player.health');
    const dmgPass = playerHpAfter === playerHpBefore - 25;
    results['DAMAGE_TEST'] = { pass: dmgPass, details: { playerHpBefore, playerHpAfter } };
    console.log(`  -> Result: ${dmgPass ? 'PASS ✓' : 'FAIL ✗'} (Player HP: ${playerHpBefore} -> ${playerHpAfter})`);

    // ─────────────────────────────────────────────────────────
    // TEST 7: DODGE TEST (Iframes & Stamina)
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 7/13] Running DODGE TEST...');
    const stamBefore = await harness.evaluate('window.GAME.player.stamina');
    await harness.evaluate('window.GAME.triggerDodge()');
    await sleep(80);
    const isDodging = await harness.evaluate('window.GAME.player.isDodging');
    const iframes = await harness.evaluate('window.GAME.player._iframes');
    const stamAfter = await harness.evaluate('window.GAME.player.stamina');
    const dodgePass = isDodging && iframes > 0.1 && stamAfter < stamBefore;
    results['DODGE_TEST'] = { pass: dodgePass, details: { isDodging, iframes, stamBefore, stamAfter } };
    console.log(`  -> Result: ${dodgePass ? 'PASS ✓' : 'FAIL ✗'} (isDodging: ${isDodging}, iframes: ${iframes?.toFixed(2)}s, Stamina: ${stamBefore} -> ${stamAfter})`);

    // ─────────────────────────────────────────────────────────
    // TEST 9: CHECKPOINT & SHRINE TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 9/13] Running CHECKPOINT TEST...');
    // Teleport to Shrine of Ash (X: -16, Z: 87)
    await harness.evaluate(`
      window.GAME.setPosition(-16, 1.7, 87);
      window.GAME.triggerInteract();
    `);
    await sleep(400);
    const isCheckpointActive = await harness.evaluate('window.GAME.map.isCheckpointActive');
    const playerHpFull = await harness.evaluate('window.GAME.player.health === window.GAME.player.maxHealth');
    const checkpointPass = isCheckpointActive && playerHpFull;
    results['RESPAWN_TEST'] = { pass: checkpointPass, details: { isCheckpointActive, playerHpFull } };
    console.log(`  -> Result: ${checkpointPass ? 'PASS ✓' : 'FAIL ✗'}`);

    // Capture 05_checkpoint
    await harness.captureScreenshot('screenshots/05_checkpoint.png');

    // ─────────────────────────────────────────────────────────
    // TEST 4: DOOR & SHORTCUT TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 4/13] Running SHORTCUT & LEVER TEST...');
    const gateBefore = await harness.evaluate('window.GAME.map.isShortcutUnlocked');
    // Position at Ramparts shortcut lever (X: 2.8, Z: 73)
    await harness.evaluate(`
      window.GAME.setPosition(2.8, 1.7, 73);
      window.GAME.triggerInteract();
    `);
    await sleep(400);
    const gateAfter = await harness.evaluate('window.GAME.map.isShortcutUnlocked');
    const doorPass = (!gateBefore) && gateAfter;
    results['DOOR_TEST'] = { pass: doorPass, details: { gateBefore, gateAfter } };
    console.log(`  -> Result: ${doorPass ? 'PASS ✓' : 'FAIL ✗'} (Shortcut Unlocked: ${gateAfter})`);

    // Capture 06_shortcut
    await harness.evaluate('window.GAME.setPosition(0, 1.7, 66); window.GAME.lookAt(0, 72);');
    await sleep(400);
    await harness.captureScreenshot('screenshots/06_shortcut.png');

    // ─────────────────────────────────────────────────────────
    // TEST 10: AI & TELEGRAPH TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 10/13] Running AI & TELEGRAPH TEST...');
    // Stone Golem Elite at (5, 0, 106)
    await harness.evaluate(`
      window.GAME.setPosition(5, 1.7, 103);
      window.GAME.lookAt(5, 106);
    `);
    await sleep(600);
    const golemState = await harness.evaluate(`
      (() => {
        const golem = window.GAME.enemies.getAll().find(e => e.enemyType === 'golem');
        return golem ? { state: golem.state, hp: golem.health, hasTelegraph: golem.telegraphTime > 0 } : null;
      })()
    `);
    const aiPass = golemState && (golemState.state === 'chase' || golemState.state === 'windup' || golemState.state === 'idle') && golemState.hasTelegraph;
    results['AI_TEST'] = { pass: !!aiPass, details: golemState };
    console.log(`  -> Result: ${aiPass ? 'PASS ✓' : 'FAIL ✗'} (Golem State: ${golemState?.state})`);

    // Capture 07_elite
    await harness.captureScreenshot('screenshots/07_elite.png');

    // ─────────────────────────────────────────────────────────
    // TEST 11: BOSS ARENA TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 11/13] Running BOSS ARENA TEST...');
    // Enter Boss Arena at (5, 1.7, 162)
    await harness.evaluate(`
      window.GAME.setPosition(5, 1.7, 162);
      window.GAME.lookAt(5, 185);
    `);
    await sleep(600);
    const bossTriggered = await harness.evaluate('window.GAME.STATE.bossTriggered');
    const bossBarVisible = await harness.evaluate('!document.getElementById("boss-bar").classList.contains("hidden")');
    const fogWallExists = await harness.evaluate('!!window.GAME.map.bossFogWall');
    const bossPass = bossTriggered && bossBarVisible && fogWallExists;
    results['BOSS_TEST'] = { pass: bossPass, details: { bossTriggered, bossBarVisible, fogWallExists } };
    console.log(`  -> Result: ${bossPass ? 'PASS ✓' : 'FAIL ✗'} (Triggered: ${bossTriggered}, Fog Wall: ${fogWallExists})`);

    // Capture 08_boss_intro
    await harness.captureScreenshot('screenshots/08_boss_intro.png');

    // Approach boss for combat
    await harness.evaluate(`
      window.GAME.setPosition(5, 1.7, 180);
      window.GAME.lookAt(5, 185);
    `);
    await sleep(500);
    // Capture 09_boss_combat
    await harness.captureScreenshot('screenshots/09_boss_combat.png');

    // ─────────────────────────────────────────────────────────
    // TEST 12: WIN TEST (Boss Defeat & Victory)
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 12/13] Running WIN TEST...');
    // Slay Death Knight
    await harness.evaluate(`
      const boss = window.GAME.enemies.boss;
      if (boss) boss.takeDamage(1000);
    `);
    await sleep(2600);
    const victoryVisible = await harness.evaluate('!document.getElementById("victory-screen").classList.contains("hidden")');
    const phaseVictory = await harness.evaluate('window.GAME.STATE.phase === "victory"');
    const winPass = victoryVisible && phaseVictory;
    results['WIN_TEST'] = { pass: winPass, details: { victoryVisible, phaseVictory } };
    console.log(`  -> Result: ${winPass ? 'PASS ✓' : 'FAIL ✗'}`);

    // Capture 10_victory
    await harness.captureScreenshot('screenshots/10_victory.png');

    // ─────────────────────────────────────────────────────────
    // TEST 8: DEATH TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 8/13] Running DEATH TEST...');
    // Click play again
    await harness.evaluate('document.getElementById("btn-play-again").click()');
    await sleep(1000);
    // Inflict lethal damage
    await harness.evaluate('window.GAME.player.takeDamage(9999)');
    await sleep(1500);
    const gameOverVisible = await harness.evaluate('!document.getElementById("game-over").classList.contains("hidden")');
    const deathPass = gameOverVisible;
    results['DEATH_TEST'] = { pass: deathPass, details: { gameOverVisible } };
    console.log(`  -> Result: ${deathPass ? 'PASS ✓' : 'FAIL ✗'}`);

    // ─────────────────────────────────────────────────────────
    // TEST 13: RESTART TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 13/13] Running RESTART TEST...');
    await harness.evaluate('document.getElementById("btn-retry").click()');
    await sleep(1000);
    const retryPhase = await harness.evaluate('window.GAME.STATE.phase');
    const retryHp = await harness.evaluate('window.GAME.player.health');
    const restartPass = retryPhase === 'playing' && retryHp > 0;
    results['RESTART_TEST'] = { pass: restartPass, details: { retryPhase, retryHp } };
    console.log(`  -> Result: ${restartPass ? 'PASS ✓' : 'FAIL ✗'} (Phase: ${retryPhase}, HP: ${retryHp})`);

    // ─────────────────────────────────────────────────────────
    // PERFORMANCE TELEMETRY BENCHMARK (120 frames)
    // ─────────────────────────────────────────────────────────
    console.log('\n[BENCHMARK] Collecting 120-frame telemetry benchmark...');
    const perfData = await harness.evaluate(`
      new Promise((resolve) => {
        const frameTimes = [];
        let count = 0;
        let last = performance.now();
        function loop(now) {
          const dt = now - last;
          last = now;
          if (count > 0) frameTimes.push(dt);
          count++;
          if (count < 120) {
            requestAnimationFrame(loop);
          } else {
            frameTimes.sort((a, b) => a - b);
            const mean = frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length;
            const p50 = frameTimes[Math.floor(frameTimes.length * 0.5)];
            const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)];
            const p99 = frameTimes[Math.floor(frameTimes.length * 0.99)];
            resolve({
              mean_fps: Math.round(1000 / mean),
              mean_ms: mean,
              p50_ms: p50,
              p95_ms: p95,
              p99_ms: p99,
              over_20ms: frameTimes.filter(t => t > 20).length,
              over_33ms: frameTimes.filter(t => t > 33).length
            });
          }
        }
        requestAnimationFrame(loop);
      })
    `);

    console.log('  -> Performance Results:', perfData);

    // Save metrics
    const metricsPayload = {
      timestamp: new Date().toISOString(),
      iteration: 1,
      milestone: 19,
      mean_fps: perfData.mean_fps,
      mean_frametime_ms: Number(perfData.mean_ms.toFixed(2)),
      p50_frametime_ms: Number(perfData.p50_ms.toFixed(2)),
      p95_frametime_ms: Number(perfData.p95_ms.toFixed(2)),
      p99_frametime_ms: Number(perfData.p99_ms.toFixed(2)),
      frames_over_20ms: perfData.over_20ms,
      frames_over_33ms: perfData.over_33ms,
      test_results: results,
      total_passed: Object.values(results).filter(r => r.pass).length,
      total_tests: Object.keys(results).length,
    };
    writeFileSync('metrics/latest.json', JSON.stringify(metricsPayload, null, 2));

    let history = [];
    if (existsSync('metrics/history.json')) {
      try { history = JSON.parse(readFileSync('metrics/history.json', 'utf8')); } catch (_) {}
    }
    history.push(metricsPayload);
    writeFileSync('metrics/history.json', JSON.stringify(history, null, 2));

    console.log('\n========================================================');
    console.log(`GAUNTLET TEST RESULTS: ${metricsPayload.total_passed}/${metricsPayload.total_tests} TESTS PASSED`);
    console.log('========================================================\n');

  } catch (err) {
    console.error('Fatal error during test suite execution:', err);
  } finally {
    await harness.close();
  }
}

run();
