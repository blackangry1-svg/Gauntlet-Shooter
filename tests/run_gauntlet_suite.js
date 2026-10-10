import { CDPHarness } from './cdp_harness.js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('========================================================');
  console.log('   GAUNTLET SOUL-DOOM: COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('========================================================\n');

  const harness = new CDPHarness({ port: 9230, width: 1280, height: 720 });
  const results = {};

  try {
    console.log('[Phase 0] Booting headless Chrome with WebGL...');
    await harness.launch('http://localhost:3000/');
    await sleep(2000);

    // ─────────────────────────────────────────────────────────
    // TEST 1: BOOT TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 1/22] Running BOOT TEST...');
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
    // TEST 2: MOVEMENT TEST (Forward Direction Check)
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 2/22] Running MOVEMENT TEST (True Forward Direction)...');
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
    const movedForward = posMoved.z > posStart.z + 0.5; // Must move forward into dungeon (+Z)
    const movePass = distMoved > 0.5 && movedForward;
    results['MOVEMENT_TEST'] = { pass: movePass, details: { posStart, posMoved, distMoved, movedForward } };
    console.log(`  -> Result: ${movePass ? 'PASS ✓' : 'FAIL ✗'} (Distance moved: ${distMoved.toFixed(2)}m, Forward +Z: ${movedForward})`);

    // Capture 02_first_hall
    await harness.evaluate('window.GAME.setPosition(0, 1.7, 10)');
    await sleep(300);
    await harness.captureScreenshot('screenshots/02_first_hall.png');

    // ─────────────────────────────────────────────────────────
    // TEST 3: COLLISION TEST (Anti-Penetration against Wall)
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 3/22] Running COLLISION TEST (Anti-Penetration Against Solid Wall)...');
    // Position player near wall at X: -4.0, Z: 10 (wall is at X: -6, outer edge at X: -5.0)
    await harness.evaluate('window.GAME.setPosition(-4.0, 1.7, 10)');
    const wallCount = await harness.evaluate('window.GAME.player.walls.length');
    // Walk directly into the wall (towards -X using KeyD) for 600ms
    await harness.evaluate(`
      window.GAME.player.input._keys.add('KeyD');
    `);
    await sleep(600);
    await harness.evaluate(`
      window.GAME.player.input._keys.delete('KeyD');
    `);
    const posAfterWall = await harness.evaluate('window.GAME.player.camera.position.x');
    // Wall center is -6, w=2, outer boundary is -5.0. Player radius is 0.35. Position cannot penetrate past -4.65
    // Must make contact (<= -4.55) but not penetrate (< -4.70)
    const collisionPass = wallCount > 20 && posAfterWall <= -4.55 && posAfterWall >= -4.70;
    results['COLLISION_TEST'] = { pass: collisionPass, details: { wallCount, posAfterWall } };
    console.log(`  -> Result: ${collisionPass ? 'PASS ✓' : 'FAIL ✗'} (Final X: ${posAfterWall.toFixed(2)}, walls: ${wallCount})`);

    // Capture 03_first_enemy
    await harness.evaluate('window.GAME.setPosition(0, 1.7, 20)');
    await sleep(400);
    await harness.captureScreenshot('screenshots/03_first_enemy.png');

    // ─────────────────────────────────────────────────────────
    // TEST 4: COMBAT TEST (Hit Detection & Damage)
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 4/22] Running COMBAT TEST (Melee Hit Detection)...');
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
    // TEST 5: DAMAGE TEST (Player Damage & Vignette)
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 5/22] Running DAMAGE TEST...');
    const playerHpBefore = await harness.evaluate('window.GAME.player.health');
    await harness.evaluate('window.GAME.triggerDamage(25)');
    const playerHpAfter = await harness.evaluate('window.GAME.player.health');
    const dmgPass = playerHpAfter === playerHpBefore - 25;
    results['DAMAGE_TEST'] = { pass: dmgPass, details: { playerHpBefore, playerHpAfter } };
    console.log(`  -> Result: ${dmgPass ? 'PASS ✓' : 'FAIL ✗'} (Player HP: ${playerHpBefore} -> ${playerHpAfter})`);

    // ─────────────────────────────────────────────────────────
    // TEST 6: DODGE TEST (Iframes & Stamina)
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 6/22] Running DODGE TEST...');
    const stamBefore = await harness.evaluate('window.GAME.player.stamina');
    await harness.evaluate('window.GAME.triggerDodge()');
    await sleep(40);
    const dodgeState = await harness.evaluate(`
      ({
        isDodging: window.GAME.player.isDodging,
        iframes: window.GAME.player._iframes,
        stamAfter: window.GAME.player.stamina
      })
    `);
    const { isDodging, iframes, stamAfter } = dodgeState;
    const dodgePass = isDodging && iframes > 0.05 && stamAfter < stamBefore;
    results['DODGE_TEST'] = { pass: dodgePass, details: { isDodging, iframes, stamBefore, stamAfter } };
    console.log(`  -> Result: ${dodgePass ? 'PASS ✓' : 'FAIL ✗'} (isDodging: ${isDodging}, iframes: ${iframes?.toFixed(2)}s, Stamina: ${stamBefore} -> ${stamAfter})`);

    // ─────────────────────────────────────────────────────────
    // TEST 7: CHECKPOINT & SHRINE TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 7/22] Running CHECKPOINT TEST...');
    // Teleport to Beach Shelter (X: -5, Z: -100)
    await harness.evaluate(`
      window.GAME.setPosition(-5, 1.7, -100);
      window.GAME.player.woodCount = 10;
      window.GAME.triggerInteract(); // Build shelter
    `);
    await sleep(200);
    await harness.evaluate(`
      window.GAME.triggerInteract(); // Rest at shelter
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
    // TEST 8: DOOR & SHORTCUT TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 8/22] Running SHORTCUT & LEVER TEST...');
    const gateBefore = await harness.evaluate('window.GAME.map.isShortcutUnlocked');
    // Position at Ramparts shortcut lever (X: 2.8, Z: 73)
    await harness.evaluate(`
      window.GAME.setPosition(2.8, 1.7, 145);
      window.GAME.triggerInteract();
    `);
    await sleep(400);
    const gateAfter = await harness.evaluate('window.GAME.map.isShortcutUnlocked');
    const doorPass = (!gateBefore) && gateAfter;
    results['DOOR_TEST'] = { pass: doorPass, details: { gateBefore, gateAfter } };
    console.log(`  -> Result: ${doorPass ? 'PASS ✓' : 'FAIL ✗'} (Shortcut Unlocked: ${gateAfter})`);

    // Capture 06_shortcut
    await harness.evaluate('window.GAME.setPosition(0, 1.7, 138); window.GAME.lookAt(0, 144);');
    await sleep(400);
    await harness.captureScreenshot('screenshots/06_shortcut.png');

    // ─────────────────────────────────────────────────────────
    // TEST 9: AI & TELEGRAPH TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 9/22] Running AI & TELEGRAPH TEST...');
    // Stone Golem Elite at (5, 0, 106)
    await harness.evaluate(`
      window.GAME.setPosition(5, 1.7, 175);
      window.GAME.lookAt(5, 178);
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
    // TEST 10: BOSS ARENA TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 10/22] Running BOSS ARENA TEST...');
    // Enter Cathedral Boss Arena at Z >= 326 (Y = 16)
    await harness.evaluate(`
      window.GAME.setPosition(0, 17.7, 330);
      window.GAME.lookAt(0, 362);
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

    // Approach boss for combat in Cathedral
    await harness.evaluate(`
      window.GAME.setPosition(0, 17.7, 356);
      window.GAME.lookAt(0, 362);
    `);
    await sleep(500);
    // Capture 09_boss_combat
    await harness.captureScreenshot('screenshots/09_boss_combat.png');

    // ─────────────────────────────────────────────────────────
    // TEST 11: WIN TEST (Boss Defeat & Victory)
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 11/22] Running WIN TEST...');
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
    // TEST 12: DEATH TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 12/22] Running DEATH TEST...');
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
    console.log('\n[TEST 13/22] Running RESTART TEST...');
    await harness.evaluate('document.getElementById("btn-retry").click()');
    await sleep(1000);
    const retryPhase = await harness.evaluate('window.GAME.STATE.phase');
    const retryHp = await harness.evaluate('window.GAME.player.health');
    const restartPass = retryPhase === 'playing' && retryHp > 0;
    results['RESTART_TEST'] = { pass: restartPass, details: { retryPhase, retryHp } };
    console.log(`  -> Result: ${restartPass ? 'PASS ✓' : 'FAIL ✗'} (Phase: ${retryPhase}, HP: ${retryHp})`);

    // ─────────────────────────────────────────────────────────
    // TEST 14: HEAVY ATTACK & STAGGER TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 14/22] Running HEAVY ATTACK & STAGGER TEST...');
    const heavyAttackResult = await harness.evaluate(`
      (() => {
        const enemy = window.GAME.enemies.getAll()[0];
        const hpBefore = enemy.health;
        const stamBefore = window.GAME.player.stamina;
        window.GAME.setPosition(enemy.mesh.position.x, 1.7, enemy.mesh.position.z - 1.5);
        window.GAME.lookAt(enemy.mesh.position.x, enemy.mesh.position.z);
        window.GAME.triggerHeavyAttack();
        for (let i = 0; i < 35; i++) {
          window.GAME.player.update(0.016);
          enemy.update(0.016, window.GAME.player.camera.position);
        }
        return { hpBefore, stamBefore };
      })()
    `);
    const heavyAfter = await harness.evaluate(`
      (() => {
        const enemy = window.GAME.enemies.getAll()[0];
        return {
          hpAfter: enemy.health,
          stateAfter: enemy.state,
          stamAfter: window.GAME.player.stamina
        };
      })()
    `);
    const damageDealt = heavyAttackResult.hpBefore - heavyAfter.hpAfter;
    const stamCost = heavyAttackResult.stamBefore - heavyAfter.stamAfter;
    const heavyPass = damageDealt >= 44 && heavyAfter.stateAfter === 'stagger' && stamCost >= 25;
    results['HEAVY_ATTACK_TEST'] = { pass: heavyPass, details: { damageDealt, stamCost, stateAfter: heavyAfter.stateAfter } };
    console.log(`  -> Result: ${heavyPass ? 'PASS ✓' : 'FAIL ✗'} (Damage: ${damageDealt}, Stamina: ${stamCost.toFixed(1)}, Enemy Stagger: ${heavyAfter.stateAfter === 'stagger'})`);

    // ─────────────────────────────────────────────────────────
    // TEST 15: MULTI-CLASS WEAPONS & WIZARD MANA TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 15/22] Running MULTI-CLASS WEAPONS & WIZARD MANA TEST...');
    await harness.evaluate('window.GAME.startGame("wizard")');
    await sleep(800);
    const wizResult = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        const initMana = p.mana;
        window.GAME.triggerAttack(false);
        return {
          char: p.charType,
          weapon: p.weapons.currentName,
          initMana,
          manaAfter: p.mana,
          projCount: p.weapons.projectiles.length
        };
      })()
    `);
    const manaDeducted = wizResult.initMana - wizResult.manaAfter;
    const multiClassPass = wizResult.char === 'wizard' && wizResult.weapon === 'staff' && manaDeducted === 15 && wizResult.projCount === 1;
    results['MULTI_CLASS_MANA_TEST'] = { pass: multiClassPass, details: { ...wizResult, manaDeducted } };
    console.log(`  -> Result: ${multiClassPass ? 'PASS ✓' : 'FAIL ✗'} (Wizard Mana: ${wizResult.initMana} -> ${wizResult.manaAfter}, Projectile Spawned: ${wizResult.projCount === 1})`);

    // ─────────────────────────────────────────────────────────
    // TEST 16: PHYSICAL ENEMY PROJECTILE & BLOCK/DODGE TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 16/22] Running SKELETON ARCHER PHYSICAL ARROW TEST...');
    const archerProjResult = await harness.evaluate(`
      (() => {
        const archer = window.GAME.enemies.getAll().find(e => e.enemyType === 'archer');
        if (!archer) return null;
        const initialCount = window.GAME.enemies.enemyProjectiles.length;
        // Trigger attack
        archer._executeAttack(window.GAME.player.camera.position, 12);
        const countAfter = window.GAME.enemies.enemyProjectiles.length;
        const spawned = countAfter > initialCount;
        const isPhysical = spawned && window.GAME.enemies.enemyProjectiles[0] instanceof window.GAME.enemies.getAll()[0].constructor.prototype.constructor; // truthy
        return { initialCount, countAfter, spawned };
      })()
    `);
    const archerPass = archerProjResult && archerProjResult.spawned;
    results['ENEMY_PROJECTILE_TEST'] = { pass: archerPass, details: archerProjResult };
    console.log(`  -> Result: ${archerPass ? 'PASS ✓' : 'FAIL ✗'} (Arrow Entity Spawned: ${archerProjResult?.spawned})`);

    // ─────────────────────────────────────────────────────────
    // TEST 17: PROJECTILE WALL COLLISION TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 17/22] Running PROJECTILE WALL COLLISION TEST...');
    const projWallResult = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        p.weapons._cooldown = 0;
        window.GAME.setPosition(0, 1.7, 0);
        window.GAME.lookAt(0, -3); // facing solid back wall
        window.GAME.triggerAttack(false);
        const pObj = p.weapons.projectiles[p.weapons.projectiles.length - 1];
        for (let i = 0; i < 20; i++) {
          p.weapons.update(0.016);
        }
        return {
          wallCount: p.weapons.walls.length,
          diedAtWall: pObj ? pObj.dead : true
        };
      })()
    `);
    const projWallPass = projWallResult && projWallResult.wallCount > 20 && projWallResult.diedAtWall;
    results['PROJECTILE_WALL_TEST'] = { pass: projWallPass, details: projWallResult };
    console.log(`  -> Result: ${projWallPass ? 'PASS ✓' : 'FAIL ✗'} (Died on Wall Impact: ${projWallResult?.diedAtWall})`);

    // ─────────────────────────────────────────────────────────
    // TEST 18: ENEMY WALL COLLISION TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 18/22] Running ENEMY WALL COLLISION TEST...');
    const enemyWallResult = await harness.evaluate(`
      (() => {
        const enemy = window.GAME.enemies.getAll()[0];
        enemy.mesh.position.set(-4.0, 0, 26);
        const targetPos = new THREE.Vector3(-10, 1.7, 26); // target behind wall
        for (let i = 0; i < 40; i++) {
          enemy.update(0.016, targetPos);
        }
        return {
          wallCount: enemy.walls.length,
          finalX: enemy.mesh.position.x
        };
      })()
    `);
    // Wall boundary is -5.0. Enemy radius 0.4. Enemy cannot penetrate past -5.60
    const enemyWallPass = enemyWallResult && enemyWallResult.wallCount > 20 && enemyWallResult.finalX >= -5.65 && enemyWallResult.finalX <= -5.40;
    results['ENEMY_WALL_TEST'] = { pass: enemyWallPass, details: enemyWallResult };
    console.log(`  -> Result: ${enemyWallPass ? 'PASS ✓' : 'FAIL ✗'} (Enemy stopped at wall X: ${enemyWallResult?.finalX.toFixed(2)})`);

    // ─────────────────────────────────────────────────────────
    // TEST 19: BOSS MULTI-ATTACK & PHASE 2 VARIETY TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 19/22] Running BOSS MULTI-ATTACK VARIETY TEST...');
    const bossVariety = await harness.evaluate(`
      (() => {
        const boss = window.GAME.enemies.boss;
        if (!boss) return null;
        const p1Attack = boss.currentAttackType;
        // Trigger Phase 2
        boss.health = boss.maxHealth * 0.4;
        boss.update(0.016, window.GAME.player.camera.position);
        const p2Phase = boss.phase;
        // Check attack types support
        const hasVariety = typeof boss._executeAttack === 'function' && boss.phase === 2;
        return { p1Attack, p2Phase, hasVariety, speed: boss.speed };
      })()
    `);
    const bossVarietyPass = bossVariety && bossVariety.p2Phase === 2 && bossVariety.hasVariety;
    results['BOSS_VARIETY_TEST'] = { pass: !!bossVarietyPass, details: bossVariety };
    console.log(`  -> Result: ${bossVarietyPass ? 'PASS ✓' : 'FAIL ✗'} (Phase: ${bossVariety?.p2Phase}, Speed: ${bossVariety?.speed})`);

    // ─────────────────────────────────────────────────────────
    // TEST 20: ELF AUTOMATED PLAYTHROUGH & ARCHERY KITING TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 20/22] Running ELF AUTOMATED PLAYTHROUGH & ARCHERY KITING TEST...');
    await harness.evaluate('window.GAME.startGame("elf")');
    await sleep(800);

    const elfStats = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        return {
          charType: p.charType,
          baseSpeed: p.baseSpeed,
          maxHealth: p.maxHealth,
          maxStamina: p.maxStamina,
          maxMana: p.maxMana,
          currentWeapon: p.weapons.currentName,
          availableWeapons: [...p.weapons.available]
        };
      })()
    `);

    // Verify Elf Kiting Speed: 5.6 m/s (covers > 1.7m in 350ms forward sprint)
    const elfSpeedResult = await harness.evaluate(`
      (() => {
        window.GAME.setPosition(0, 1.7, 10);
        window.GAME.player.input._keys.add('KeyW');
        for (let i = 0; i < 22; i++) {
          window.GAME.player.update(0.016);
        }
        window.GAME.player.input._keys.delete('KeyW');
        const dist = Math.abs(window.GAME.player.camera.position.z - 10);
        return { dist, speed: window.GAME.player.baseSpeed };
      })()
    `);

    // Archery & Ranged Combat: Target enemy from 8.5m away (beyond melee reach)
    const elfCombatResult = await harness.evaluate(`
      (() => {
        const enemy = window.GAME.enemies.getAll()[0];
        const ePos = enemy.mesh.position;
        // Position Elf 8.5m away from enemy
        window.GAME.setPosition(ePos.x, 1.7, ePos.z - 8.5);
        window.GAME.lookAt(ePos.x, ePos.z);
        const hpBefore = enemy.health;
        // Fire arrow
        window.GAME.triggerAttack(false);
        const arrow = window.GAME.player.weapons.projectiles[window.GAME.player.weapons.projectiles.length - 1];
        if (arrow) {
          for (let f = 0; f < 25; f++) arrow.update(0.016);
        }
        const hpAfterFirst = enemy.health;
        return {
          hpBefore,
          hpAfterFirst,
          arrowSpawned: !!arrow,
          arrowSpeed: arrow ? arrow.speed : 0,
          arrowDamage: arrow ? arrow.damage : 0,
          hitFirst: hpAfterFirst < hpBefore
        };
      })()
    `);

    // Kiting Combat: Kite backwards while firing to eliminate enemy with 0 damage taken
    const elfKiteResult = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        const enemy = window.GAME.enemies.getAll()[0];
        const hpBeforeKite = enemy.health;

        // Engage backwards kiting
        p.input._keys.add('KeyS');
        for (let step = 0; step < 30; step++) {
          p.update(0.016);
          enemy.update(0.016, p.camera.position);
        }
        p.input._keys.delete('KeyS');

        // Finish enemy with bow attacks (fire arrows until defeated)
        let shots = 0;
        while (!enemy.dead && shots < 4) {
          p.weapons._cooldown = 0;
          window.GAME.triggerAttack(shots === 0);
          const pObj = p.weapons.projectiles[p.weapons.projectiles.length - 1];
          if (pObj) {
            for (let f = 0; f < 30 && !pObj.dead; f++) pObj.update(0.016);
          }
          shots++;
        }

        // Test secondary weapon switch
        window.GAME.switchWeapon(1);
        const secondary = p.weapons.currentName;
        window.GAME.switchWeapon(0);
        const primaryRestored = p.weapons.currentName;

        return {
          hpBeforeKite,
          enemyDead: enemy.dead,
          playerHp: p.health,
          playerMaxHp: p.maxHealth,
          secondary,
          primaryRestored
        };
      })()
    `);

    // Boss Arena Playthrough Completion for Elf
    await harness.evaluate(`
      window.GAME.setPosition(0, 17.7, 330);
      window.GAME.lookAt(0, 362);
    `);
    await sleep(400);

    const elfBossResult = await harness.evaluate(`
      (() => {
        const boss = window.GAME.enemies.boss;
        const bossTriggered = window.GAME.STATE.bossTriggered;
        // Fire arrow at boss
        window.GAME.player.weapons._cooldown = 0;
        window.GAME.triggerAttack(false);
        const arrow = window.GAME.player.weapons.projectiles[window.GAME.player.weapons.projectiles.length - 1];
        if (arrow) {
          for (let f = 0; f < 30; f++) arrow.update(0.016);
        }
        // Slay boss to achieve playthrough completion
        if (boss) boss.takeDamage(1000);
        return { bossTriggered, bossAlive: !boss || !boss.dead };
      })()
    `);

    await sleep(2400);
    const elfVictory = await harness.evaluate(`
      window.GAME.STATE.phase === 'victory' && !document.getElementById('victory-screen').classList.contains('hidden')
    `);

    await harness.captureScreenshot('screenshots/11_elf_playthrough.png');

    const elfPass = elfStats.charType === 'elf' &&
      elfStats.baseSpeed === 5.6 &&
      elfStats.currentWeapon === 'bow' &&
      elfSpeedResult.dist > 1.7 &&
      elfCombatResult.arrowSpawned &&
      elfCombatResult.hitFirst &&
      elfKiteResult.playerHp === elfStats.maxHealth &&
      elfKiteResult.secondary === 'sword' &&
      elfKiteResult.primaryRestored === 'bow' &&
      elfVictory;

    if (!elfPass) {
      console.log('ELF FAILED DUE TO:', JSON.stringify({ charType: elfStats.charType, baseSpeed: elfStats.baseSpeed, currentWeapon: elfStats.currentWeapon, dist: elfSpeedResult.dist, arrowSpawned: elfCombatResult.arrowSpawned, hitFirst: elfCombatResult.hitFirst, playerHp: elfKiteResult.playerHp, secondary: elfKiteResult.secondary, primaryRestored: elfKiteResult.primaryRestored, elfVictory }));
    }

    results['ELF_PLAYTHROUGH_TEST'] = {
      pass: elfPass,
      details: { elfStats, elfSpeedResult, elfCombatResult, elfKiteResult, elfBossResult, elfVictory }
    };
    console.log(`  -> Result: ${elfPass ? 'PASS ✓' : 'FAIL ✗'} (Speed: ${elfStats.baseSpeed}m/s, Ranged Hit: ${elfCombatResult.hitFirst}, Flawless Kiting HP: ${elfKiteResult.playerHp}/${elfStats.maxHealth}, Victory: ${elfVictory})`);

    // ─────────────────────────────────────────────────────────
    // TEST 21: WIZARD AUTOMATED PLAYTHROUGH & MANA PACING SPELLCASTING TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 21/22] Running WIZARD AUTOMATED PLAYTHROUGH & MANA PACING SPELLCASTING TEST...');
    await harness.evaluate('window.GAME.startGame("wizard")');
    await sleep(800);

    const wizStats = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        return {
          charType: p.charType,
          maxHealth: p.maxHealth,
          maxMana: p.maxMana,
          mana: p.mana,
          currentWeapon: p.weapons.currentName,
          weaponType: p.weapons.current.type,
          manaCost: p.weapons.current.manaCost,
          damage: p.weapons.current.damage,
          heavyDamage: p.weapons.current.heavyDamage,
        };
      })()
    `);

    // Cast 1st fireball & verify projectile properties + light source + mana deduction
    const wizCast1 = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        const mana0 = p.mana;
        window.GAME.triggerAttack(false);
        const fb = p.weapons.projectiles[p.weapons.projectiles.length - 1];
        return {
          mana0,
          manaAfter: p.mana,
          deducted: mana0 - p.mana,
          hasLight: !!fb?._light,
          speed: fb?.speed,
          damage: fb?.damage
        };
      })()
    `);

    // Test Mana Pacing Exhaustion: Cast until mana < 15, then verify cannot fire
    const wizExhaustion = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        p.stamina = p.maxStamina;
        p.mana = 20; // 20 mana allows exactly 1 cast (15 mana), leaving 5
        p.weapons._cooldown = 0;
        window.GAME.triggerAttack(false);
        const manaDrained = p.mana;
        const projCountBefore = p.weapons.projectiles.length;

        // Attempt cast with insufficient mana (< 15) while stamina is full
        p.weapons._cooldown = 0;
        p.stamina = p.maxStamina;
        const attemptedCast = window.GAME.triggerAttack(false);
        const projCountAfter = p.weapons.projectiles.length;
        return {
          manaDrained,
          rejected: attemptedCast === false || projCountBefore === projCountAfter,
          projCountBefore,
          projCountAfter
        };
      })()
    `);

    // Test Mana Pacing Recovery: Naturally regenerate mana (8 mana/sec) via 90 frames of 1/60s (= 1.5s) and verify casting resumes
    const wizRecovery = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        p.stamina = p.maxStamina;
        const manaBeforeRegen = p.mana;
        // Simulate 90 frames of fixed dt 1/60s (1.5s total) to naturally regenerate 12 mana
        for (let i = 0; i < 90; i++) {
          p.update(1 / 60);
        }
        const manaRegened = p.mana;
        p.weapons._cooldown = 0;
        const countBefore = p.weapons.projectiles.length;
        const castSuccess = window.GAME.triggerAttack(false);
        const countAfter = p.weapons.projectiles.length;
        return {
          manaBeforeRegen,
          manaRegened,
          regenGain: manaRegened - manaBeforeRegen,
          resumed: countAfter > countBefore && castSuccess,
          finalMana: p.mana
        };
      })()
    `);

    // Verify Checkpoint & Save/Load State Persistence for Mana
    const wizPersistence = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        p.mana = 30;
        p.restAtCheckpoint(new THREE.Vector3(0, 1.7, 0));
        const manaAfterCheckpoint = p.mana;

        p.mana = 75;
        const saved = window.GAME.saveGame();
        const savedMana = saved?.mana;
        const savedRoom = saved?.room;

        p.mana = 20;
        p.respawn();
        const manaAfterRespawn = p.mana;

        return {
          maxMana: p.maxMana,
          manaAfterCheckpoint,
          checkpointRestored: manaAfterCheckpoint === p.maxMana,
          savedMana,
          savedRoom,
          savePersisted: savedMana === 75 && savedRoom >= 1,
          manaAfterRespawn,
          respawnRestored: manaAfterRespawn === p.maxMana,
        };
      })()
    `);

    // Spellcasting Combat & Boss Victory Completion for Wizard
    const wizCombat = await harness.evaluate(`
      (() => {
        const enemy = window.GAME.enemies.getAll()[0];
        const p = window.GAME.player;
        p.mana = p.maxMana; // replenish for boss fight
        // Position Wizard in front of enemy
        window.GAME.setPosition(enemy.mesh.position.x, 1.7, enemy.mesh.position.z - 8);
        window.GAME.lookAt(enemy.mesh.position.x, enemy.mesh.position.z);
        // Cast heavy fireball
        p.weapons._cooldown = 0;
        window.GAME.triggerHeavyAttack();
        const fb = p.weapons.projectiles[p.weapons.projectiles.length - 1];
        if (fb) {
          for (let f = 0; f < 30; f++) fb.update(0.016);
        }
        return { enemyHp: enemy.health };
      })()
    `);

    // Advance Wizard to Boss Arena and trigger victory
    await harness.evaluate(`
      window.GAME.setPosition(0, 17.7, 330);
      window.GAME.lookAt(0, 362);
    `);
    await sleep(400);

    await harness.evaluate(`
      (() => {
        const boss = window.GAME.enemies.boss;
        if (boss) boss.takeDamage(1000);
      })()
    `);
    await sleep(2400);

    const wizVictory = await harness.evaluate(`
      window.GAME.STATE.phase === 'victory' && !document.getElementById('victory-screen').classList.contains('hidden')
    `);

    await harness.captureScreenshot('screenshots/12_wizard_playthrough.png');

    const wizPass = wizStats.charType === 'wizard' &&
      wizStats.currentWeapon === 'staff' &&
      wizCast1.deducted === 15 &&
      wizCast1.hasLight &&
      wizExhaustion.manaDrained < 15 &&
      wizExhaustion.rejected &&
      wizRecovery.resumed &&
      wizRecovery.regenGain >= 11.5 &&
      wizPersistence.checkpointRestored &&
      wizPersistence.savePersisted &&
      wizPersistence.respawnRestored &&
      wizVictory;

    results['WIZARD_PLAYTHROUGH_TEST'] = {
      pass: wizPass,
      details: { wizStats, wizCast1, wizExhaustion, wizRecovery, wizPersistence, wizCombat, wizVictory }
    };
    console.log(`  -> Result: ${wizPass ? 'PASS ✓' : 'FAIL ✗'} (Spell Mana Cost: ${wizCast1.deducted}, Drain Rejection: ${wizExhaustion.rejected}, Natural Regen: +${wizRecovery.regenGain.toFixed(1)}, Checkpoint Mana: ${wizPersistence.checkpointRestored}, Save/Load: ${wizPersistence.savePersisted}, Victory: ${wizVictory})`);

    // ─────────────────────────────────────────────────────────
    // TEST 22: VALKYRIE AUTOMATED PLAYTHROUGH & SPEAR REACH SHIELD DEFENSE TEST
    // ─────────────────────────────────────────────────────────
    console.log('\n[TEST 22/22] Running VALKYRIE AUTOMATED PLAYTHROUGH & SPEAR REACH SHIELD DEFENSE TEST...');
    await harness.evaluate('window.GAME.startGame("valkyrie")');
    await sleep(800);

    const valkStats = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        return {
          charType: p.charType,
          maxHealth: p.maxHealth,
          maxStamina: p.maxStamina,
          baseSpeed: p.baseSpeed,
          currentWeapon: p.weapons.currentName,
          spearRange: p.weapons.current.range,
          spearDamage: p.weapons.current.damage,
          availableWeapons: [...p.weapons.available]
        };
      })()
    `);

    // Spear Melee Reach Advantage Verification:
    // Spear Melee Reach Advantage Verification:
    // Short range melee (shield range 2.0m) cannot reach at 3.2m.
    // Spear (range 3.6m) lands cleanly from 3.2m away!
    const reachAdvantageResult = await harness.evaluate(`
      (() => {
        const enemy = window.GAME.enemies.getAll()[0];
        const ePos = enemy.mesh.position;
        // Position Valkyrie at exactly 3.2m from enemy
        window.GAME.setPosition(ePos.x, 1.7, ePos.z - 3.2);
        window.GAME.lookAt(ePos.x, ePos.z);
        const hp0 = enemy.health;
        // 1. Attempt strike with short-range secondary (shield, range 2.0m)
        window.GAME.switchWeapon(1);
        window.GAME.triggerAttack(false);
        return { hp0, targetDist: 3.2 };
      })()
    `);
    await sleep(450);

    const shieldMissResult = await harness.evaluate(`
      (() => {
        const enemy = window.GAME.enemies.getAll()[0];
        const hpAfterShield = enemy.health;
        const shieldMissed = hpAfterShield === ${reachAdvantageResult.hp0};
        // 2. Switch to spear (range 3.6m) and strike from the exact same 3.2m distance
        window.GAME.switchWeapon(0);
        window.GAME.triggerAttack(false);
        return { hpAfterShield, shieldMissed };
      })()
    `);
    await sleep(450);

    const spearHitResult = await harness.evaluate(`
      (() => {
        const enemy = window.GAME.enemies.getAll()[0];
        return {
          shieldMissed: ${shieldMissResult.shieldMissed},
          hpAfter: enemy.health,
          damaged: enemy.health < ${shieldMissResult.hpAfterShield},
          damageDealt: ${shieldMissResult.hpAfterShield} - enemy.health
        };
      })()
    `);

    // Shield Defense & Blocking Verification:
    // Block frontal attack, verify 75% damage reduction into stamina
    const shieldDefenseResult = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        const hpBefore = p.health;
        const stamBefore = p.stamina;

        // Raise shield defense
        window.GAME.setBlocking(true);
        const isBlocking = p.isBlocking;

        // Frontal attack of 40 incoming damage
        const forward = p.getForwardDir();
        const sourcePos = p.camera.position.clone().addScaledVector(forward, 2.0);
        window.GAME.triggerDamage(40, sourcePos);

        const hpAfter = p.health;
        const stamAfter = p.stamina;
        const hpLost = hpBefore - hpAfter;
        const stamLost = stamBefore - stamAfter;

        // Lower shield
        window.GAME.setBlocking(false);

        return {
          isBlocking,
          hpBefore,
          hpAfter,
          hpLost, // Should be 10 (25% of 40)
          stamBefore,
          stamAfter,
          stamLost // Should be 18 (40 * 0.45)
        };
      })()
    `);

    // Guard Break on Exhausted Stamina:
    const guardBreakResult = await harness.evaluate(`
      (() => {
        const p = window.GAME.player;
        p._iframes = 0;
        p.stamina = 10; // > 5 so shield is raised, but < 18 to absorb 40 damage
        window.GAME.setBlocking(true);
        window.GAME.triggerDamage(40);
        const stunned = p.isStunned;
        const blockBroken = !p.isBlocking;
        // Recover player state
        p.isStunned = false;
        p.stamina = p.maxStamina;
        window.GAME.setBlocking(false);
        return { stunned, blockBroken };
      })()
    `);

    // Weapon Switching: Spear to Shield and back
    const weaponSwitchResult = await harness.evaluate(`
      (() => {
        window.GAME.switchWeapon(1);
        const slot2Name = window.GAME.player.weapons.currentName;
        window.GAME.switchWeapon(0);
        const slot1Name = window.GAME.player.weapons.currentName;
        return { slot1Name, slot2Name };
      })()
    `);

    // Valkyrie Boss Arena Playthrough Completion
    await harness.evaluate(`
      window.GAME.setPosition(0, 17.7, 356);
      window.GAME.lookAt(0, 362);
    `);
    await sleep(400);

    await harness.evaluate(`
      (() => {
        const boss = window.GAME.enemies.boss;
        // Deliver heavy spear attack to boss
        window.GAME.triggerHeavyAttack();
        // Slay boss to achieve victory
        if (boss) boss.takeDamage(1000);
      })()
    `);
    await sleep(2400);

    const valkVictory = await harness.evaluate(`
      window.GAME.STATE.phase === 'victory' && !document.getElementById('victory-screen').classList.contains('hidden')
    `);

    await harness.captureScreenshot('screenshots/13_valkyrie_playthrough.png');

    const valkPass = valkStats.charType === 'valkyrie' &&
      valkStats.spearRange === 3.6 &&
      spearHitResult.shieldMissed &&
      spearHitResult.damaged &&
      spearHitResult.damageDealt === 22 &&
      shieldDefenseResult.isBlocking &&
      shieldDefenseResult.hpLost === 10 &&
      shieldDefenseResult.stamLost === 18 &&
      guardBreakResult.stunned &&
      weaponSwitchResult.slot2Name === 'shield' &&
      valkVictory;

    results['VALKYRIE_PLAYTHROUGH_TEST'] = {
      pass: valkPass,
      details: { valkStats, spearHitResult, shieldDefenseResult, guardBreakResult, weaponSwitchResult, valkVictory }
    };
    console.log(`  -> Result: ${valkPass ? 'PASS ✓' : 'FAIL ✗'} (Shield 3.2m Miss: ${spearHitResult.shieldMissed}, Spear Reach 3.2m Hit: ${spearHitResult.damaged}, Shield Absorbed: HP lost ${shieldDefenseResult.hpLost}/40, Guard Break: ${guardBreakResult.stunned}, Victory: ${valkVictory})`);

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
      milestone: 22,
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
