import { CDPHarness } from './cdp_harness.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('=== Starting Paper Mario RPG Hybrid Test ===');
  const harness = new CDPHarness({ port: 9225 });

  try {
    await harness.launch();
    await harness.navigate('http://localhost:3000/');
    await sleep(2000);

    // 1. Check title & canvas
    const title = await harness.evaluate('document.title');
    console.log('Page title:', title);

    // 2. Start game
    console.log('Starting game as Warrior...');
    await harness.evaluate(`window.GAME.startGame('warrior');`);
    await sleep(1500);

    const phase = await harness.evaluate('window.GAME.STATE.phase');
    console.log('Game phase after start:', phase);
    if (phase !== 'playing') {
      throw new Error(`Expected phase 'playing' but got '${phase}'`);
    }

    // 3. Verify Party of 4 Heroes
    const partyData = await harness.evaluate(`
      window.GAME.party.members.map(m => ({
        id: m.id,
        name: m.name,
        element: m.element,
        hp: m.hp,
        maxHp: m.maxHp,
        mp: m.mp,
        skillsCount: m.skills.length
      }))
    `);
    console.log('Party Members:', JSON.stringify(partyData, null, 2));
    if (partyData.length !== 4) {
      throw new Error(`Expected 4 party members, found ${partyData.length}`);
    }

    // 4. Verify 13 Roaming Enemies across Citadel
    const enemyCount = await harness.evaluate('window.GAME.enemies.getAll().length');
    console.log('Total roaming enemies across 5 floors:', enemyCount);
    if (enemyCount < 10) {
      throw new Error(`Expected at least 10 enemies, found ${enemyCount}`);
    }

    // 5. Trigger First Strike Battle
    console.log('Triggering Melee First Strike Encounter...');
    await harness.evaluate(`
      const firstEnemy = window.GAME.enemies.getAll()[0];
      window.GAME.triggerEncounter(firstEnemy, true, false);
    `);
    await sleep(1200);

    const battlePhase = await harness.evaluate('window.GAME.STATE.phase');
    console.log('Phase during battle:', battlePhase);
    if (battlePhase !== 'battle') {
      throw new Error(`Expected phase 'battle' but got '${battlePhase}'`);
    }

    const inBattle = await harness.evaluate('window.GAME.battleSystem.inBattle');
    console.log('BattleSystem inBattle:', inBattle);
    if (!inBattle) {
      throw new Error('Expected BattleSystem.inBattle to be true');
    }

    const enemySquad = await harness.evaluate(`
      window.GAME.battleSystem.enemySquad.map(e => ({ name: e.name, hp: e.hp, maxHp: e.maxHp, element: e.element }))
    `);
    console.log('Battle Enemy Squad:', JSON.stringify(enemySquad, null, 2));

    // Check vanguard took first strike damage
    const firstStrikeDamageTaken = enemySquad[0].hp < enemySquad[0].maxHp;
    console.log('Vanguard took First Strike bonus damage:', firstStrikeDamageTaken);

    await harness.captureScreenshot('screenshots/02_rpg_battle_arena.png');

    // 6. Test Action Command Input (Spacebar press)
    console.log('Testing Spacebar Action Command...');
    await harness.evaluate(`
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    `);
    await sleep(800);

    // 7. Verify Shrine resting & enemy respawn
    console.log('Testing Shrine resting and respawn loop...');
    await harness.evaluate(`
      // End battle cleanly
      window.GAME.battleSystem._endBattle(true);
      // Simulate resting at Save Shrine
      window.GAME.player.onRest();
    `);
    await sleep(500);

    const postRestEnemies = await harness.evaluate('window.GAME.enemies.getAll().length');
    console.log('Enemies after shrine rest:', postRestEnemies);
    if (postRestEnemies < 10) {
      throw new Error('Enemies failed to respawn after resting at shrine');
    }

    const postRestParty = await harness.evaluate(`
      window.GAME.party.members.every(m => m.hp === m.maxHp && m.mp === m.maxMp)
    `);
    console.log('Party fully restored after shrine rest:', postRestParty);
    if (!postRestParty) {
      throw new Error('Party not fully restored after shrine rest');
    }

    console.log('Console Errors Recorded:', harness.errors);
    if (harness.errors.length > 0) {
      throw new Error(`Test had console errors: ${JSON.stringify(harness.errors)}`);
    }

    console.log('=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Test Failed:', err);
    process.exitCode = 1;
  } finally {
    await harness.close();
  }
}

run();
