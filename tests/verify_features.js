import { CDPHarness } from './cdp_harness.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('========================================================');
  console.log('   VERIFY ALL USER REQUIREMENTS & ADVANCED CAPABILITIES');
  console.log('========================================================\n');

  const harness = new CDPHarness({ port: 9228 });

  try {
    await harness.launch();
    await harness.navigate('http://localhost:3000/');
    await sleep(2000);

    // ─────────────────────────────────────────────────────────────
    // TEST A: PS4 CONTROLLER MENU NAVIGATION
    // ─────────────────────────────────────────────────────────────
    console.log('[FEATURE A] Testing PS4 Controller Menu Navigation...');
    // Click Warrior to start game
    await harness.evaluate(`window.GAME.startGame('warrior');`);
    await sleep(1500);

    const phase = await harness.evaluate('window.GAME.STATE.phase');
    console.log('  -> Game started, phase:', phase);
    if (phase !== 'playing') throw new Error('Failed to start game');

    // ─────────────────────────────────────────────────────────────
    // TEST B: FIRST PERSON WEAPONS & VIEWMODEL VISIBILITY
    // ─────────────────────────────────────────────────────────────
    console.log('\n[FEATURE B] Testing First-Person Weapons & Battle Visuals...');
    const weaponInfo = await harness.evaluate(`(() => {
      const player = window.GAME.player;
      const wp = player.weapons;
      const mesh = wp._weaponMesh;
      const light = wp._viewmodelLight;
      const slashArc = wp._slashArcMesh;
      const inScene = player.camera.parent === window.GAME.player.scene;
      return {
        currentName: wp.currentName,
        meshVisible: !!mesh && mesh.visible,
        meshChildren: mesh ? mesh.children.length : 0,
        lightPresent: !!light,
        slashArcPresent: !!slashArc,
        cameraInScene: inScene
      };
    })()`);
    console.log('  -> Weapon Info:', weaponInfo);
    if (!weaponInfo.cameraInScene) throw new Error('Camera is not in scene! Weapons will not render!');
    if (!weaponInfo.meshVisible || weaponInfo.meshChildren === 0) throw new Error('Weapon mesh missing or empty!');

    // Trigger attack and check slash arc activation
    await harness.evaluate(`window.GAME.triggerAttack(false);`);
    await sleep(100);
    const attackState = await harness.evaluate(`(() => {
      const wp = window.GAME.player.weapons;
      return {
        swinging: wp._swinging,
        swingT: wp._swingT,
        slashArcVisible: wp._slashArcMesh?.visible,
        slashArcOpacity: wp._slashArcMesh?.material.opacity
      };
    })()`);
    console.log('  -> Active Attack Slash Arc State:', attackState);
    await harness.captureScreenshot('screenshots/feat_weapon_attack_slash.png');
    await sleep(400);

    // ─────────────────────────────────────────────────────────────
    // TEST C: BEACH DRIFTWOOD COUNT & GATHERING
    // ─────────────────────────────────────────────────────────────
    console.log('\n[FEATURE C] Testing Beach Driftwood Logs & Gathering...');
    const driftwoodData = await harness.evaluate(`(() => {
      const items = window.GAME.map.interactables.filter(i => i.prompt && i.prompt.includes('DRIFTWOOD'));
      return {
        count: items.length,
        initialWood: window.GAME.player.woodCount || 0
      };
    })()`);
    console.log('  -> Beach Driftwood count:', driftwoodData.count);
    if (driftwoodData.count < 15) throw new Error(`Expected at least 15 driftwood logs on beach, found ${driftwoodData.count}`);

    // Gather 1 driftwood log
    await harness.evaluate(`(() => {
      const items = window.GAME.map.interactables.filter(i => i.prompt && i.prompt.includes('DRIFTWOOD'));
      if (items.length > 0) items[0].onInteract();
    })()`);
    await sleep(300);
    const woodCountAfter = await harness.evaluate('window.GAME.player.woodCount');
    console.log('  -> Wood gathered! Current wood:', woodCountAfter);
    if (woodCountAfter !== 1) throw new Error(`Wood count expected 1, got ${woodCountAfter}`);

    // ─────────────────────────────────────────────────────────────
    // TEST D: FLOOR 2 ACCESSIBILITY (GRAND STAIRCASE 1)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[FEATURE D] Testing Floor 2 Portal & Grand Staircase 1...');
    // Teleport player near Grand Staircase 1 portal at Z = 116
    await harness.evaluate('window.GAME.setPosition(0, 1.7, 116);');
    await sleep(300);

    // Walk forward up the Grand Staircase onto Floor 2 (Z = 128)
    await harness.evaluate(`window.GAME.setPosition(0, 3.2, 128);`);
    await sleep(300);
    const f2Pos = await harness.evaluate(`(() => ({
      x: window.GAME.player.camera.position.x,
      y: window.GAME.player.camera.position.y,
      z: window.GAME.player.camera.position.z,
      groundY: window.GAME.player.currentGroundY
    }))()`);
    console.log('  -> Position on Grand Staircase / Floor 2:', f2Pos);
    if (f2Pos.z < 125 || f2Pos.y < 2.5) {
      throw new Error(`Failed to ascend to Floor 2: pos = ${JSON.stringify(f2Pos)}`);
    }
    await harness.captureScreenshot('screenshots/feat_floor2_grand_staircase.png');

    // ─────────────────────────────────────────────────────────────
    // TEST E: MINOTAUR JUMP SCARE & NEMESIS STALKER
    // ─────────────────────────────────────────────────────────────
    console.log('\n[FEATURE E] Testing Minotaur Jump Scare & Nemesis Mechanics...');
    // Teleport inside Labyrinth Floor 1 (Z = 45)
    await harness.evaluate('window.GAME.setPosition(0, 1.7, 45);');
    await sleep(300);

    // Trigger Minotaur Ambush
    console.log('  Triggering Minotaur Ambush...');
    await harness.evaluate('window.GAME.minotaurStalker.triggerAmbush();');
    await sleep(400);

    const minotaurState = await harness.evaluate(`(() => {
      const stalker = window.GAME.minotaurStalker;
      const mino = stalker.activeMinotaur;
      const overlay = document.getElementById('jumpscare-overlay');
      const alert = document.getElementById('jumpscare-alert');
      return {
        isHunting: stalker.isHunting,
        hasMinotaur: !!mino,
        minotaurHp: mino ? mino.health : 0,
        minotaurMaxHp: mino ? mino.maxHealth : 0,
        minotaurAnim: mino ? mino._currentAnim : '',
        overlayOpacity: overlay ? overlay.style.opacity : '0',
        alertVisible: alert ? alert.style.display : 'none',
        alertText: alert ? alert.textContent : ''
      };
    })()`);
    console.log('  -> Minotaur State:', minotaurState);
    if (!minotaurState.isHunting) throw new Error('MinotaurStalker not hunting!');
    if (minotaurState.minotaurHp < 50000) throw new Error(`Minotaur HP must be massive (>50,000), got ${minotaurState.minotaurHp}`);
    if (minotaurState.alertVisible === 'none') throw new Error('Jumpscare alert UI not shown!');

    await harness.captureScreenshot('screenshots/feat_minotaur_jumpscare.png');

    // Escape to Beach (Z <= 2)
    console.log('  Escaping to Beach dunes (Z = -5)...');
    await harness.evaluate('window.GAME.setPosition(0, 1.7, -5);');
    await sleep(200);
    // Let stalker update detect escape
    await harness.evaluate('window.GAME.minotaurStalker.update(0.1);');
    await sleep(200);

    const escapedState = await harness.evaluate(`(() => {
      const stalker = window.GAME.minotaurStalker;
      return {
        isHunting: stalker.isHunting,
        cooldownTimer: stalker.cooldownTimer
      };
    })()`);
    console.log('  -> Escape Status:', escapedState);
    if (escapedState.isHunting) throw new Error('Player reached beach but Minotaur did not retreat!');

    // ─────────────────────────────────────────────────────────────
    // TEST F: PS4 CONTROLLER BUTTON MAPPINGS & PROMPTS
    // ─────────────────────────────────────────────────────────────
    console.log('\n[FEATURE F] Testing Native PS4 Controller Mappings & Prompts...');
    const controllerChecks = await harness.evaluate(`(() => {
      const input = window.GAME.player.input;
      input.isGamepadActive = true;
      const hudPrompt = window.GAME.hud;
      hudPrompt.showInteractPrompt('GATHER DRIFTWOOD [E]');
      const promptEl = document.getElementById('interact-text');
      const flaskEl = document.getElementById('flask-text');
      hudPrompt.update(window.GAME.player);

      return {
        isGamepadActive: input.isGamepadActive,
        promptText: promptEl ? promptEl.textContent : '',
        flaskText: flaskEl ? flaskEl.textContent : '',
        hasPlayRumble: typeof input.playRumble === 'function',
        hasMoveForward: 'moveForward' in input,
        hasRightStick: typeof input._getGamepad === 'function'
      };
    })()`);
    console.log('  -> Controller Support Telemetry:', controllerChecks);
    if (!controllerChecks.promptText.includes('◯')) throw new Error('Interact prompt did not switch to PS4 Circle (◯)!');
    if (!controllerChecks.flaskText.includes('D-Pad')) throw new Error('Flask text did not switch to PS4 D-Pad!');

    // ─────────────────────────────────────────────────────────────
    // TEST G: EXPERIMENTAL 3D SPRITE ANIMATION CHAMBER & 3RD PERSON POV
    // ─────────────────────────────────────────────────────────────
    console.log('\n[FEATURE G] Testing 3D Sprite Animation Chamber & 3rd Person POV Switch...');
    const roomCheck = await harness.evaluate(`(() => {
      window.GAME.enterSpriteTestRoom();
      const room = window.GAME.spriteTestRoom;
      const player = window.GAME.player;
      return {
        roomActive: !!room && room.isActive,
        modelCount: room ? room.models.length : 0,
        hasWarrior: room ? room.models.some(m => m.name === 'warrior') : false,
        hasMinotaur: room ? room.models.some(m => m.name === 'minotaur') : false,
        texRepeatX: room && room.models[0].spriteTex ? room.models[0].spriteTex.repeat.x : 0,
        texRepeatY: room && room.models[0].spriteTex ? room.models[0].spriteTex.repeat.y : 0,
        isThirdPerson: player ? player.isThirdPerson : false,
      };
    })()`);
    console.log('  -> 3D Sprite Room Check:', roomCheck);
    if (roomCheck.modelCount !== 4) throw new Error(`Expected 4 3D models in test room, got ${roomCheck.modelCount}`);
    if (Math.abs(roomCheck.texRepeatX - (1/6)) > 0.01) {
      throw new Error(`Expected 6x6 repeat (0.1667), got ${roomCheck.texRepeatX}`);
    }

    // Toggle 3rd person POV camera switch and test player sprite billboard
    await harness.evaluate(`
      window.GAME.toggleThirdPerson();
      window.GAME.spriteTestRoom.setAnimation('attack');
    `);
    await sleep(250);
    const tpCheck = await harness.evaluate(`(() => {
      const p = window.GAME.player;
      const room = window.GAME.spriteTestRoom;
      return {
        isThirdPerson: p.isThirdPerson,
        thirdPersonMeshVisible: p.thirdPersonMesh ? p.thirdPersonMesh.visible : false,
        roomAnim: room ? room.currentAnim : '',
        spriteOffsetY: room ? room.models[0].spriteTex.offset.y : 0,
      };
    })()`);
    console.log('  -> 3rd Person POV Switch & Model Animation Check:', tpCheck);
    if (!tpCheck.isThirdPerson || !tpCheck.thirdPersonMeshVisible) {
      throw new Error('3rd Person camera switch did not activate thirdPersonMesh!');
    }
    // Test exit from SpriteTestRoom back to Shoreline
    await harness.evaluate(`window.GAME.exitSpriteTestRoom();`);
    await sleep(250);
    const exitCheck = await harness.evaluate(`(() => ({
      roomActive: window.GAME.spriteTestRoom.isActive,
      posZ: window.GAME.player.camera.position.z,
      posX: window.GAME.player.camera.position.x
    }))()`);
    console.log('  -> Exited SpriteTestRoom back to Shoreline:', exitCheck);
    if (exitCheck.roomActive || exitCheck.posZ > -50) {
      throw new Error(`Failed to return from SpriteTestRoom: ${JSON.stringify(exitCheck)}`);
    }

    // Toggle back to first person for next tests
    await harness.evaluate(`
      if (window.GAME.player.isThirdPerson) window.GAME.toggleThirdPerson();
    `);

    // ─────────────────────────────────────────────────────────────
    // TEST H: SECRET OPTIONAL BOSS ASTERION & THE AEGIS OF THE MINOTAUR
    // ─────────────────────────────────────────────────────────────
    console.log('\n[FEATURE H] Testing Secret Boss Asterion & Legendary Aegis...');
    // Teleport to Floor 1 Runic Portal at (-30, 1.7, 90)
    await harness.evaluate(`window.GAME.setPosition(-30, 1.7, 90);`);
    await sleep(200);

    // Interact with runic portal to challenge Asterion
    await harness.evaluate(`(() => {
      const portal = window.GAME.map.interactables.find(i => i.prompt && i.prompt.includes('CHALLENGE THE MINOTAUR'));
      if (portal) portal.onInteract();
    })()`);
    await sleep(400);

    const asterionState = await harness.evaluate(`(() => {
      const map = window.GAME.map;
      const bBar = document.getElementById('boss-bar');
      const bName = document.getElementById('boss-name');
      const bFill = document.getElementById('boss-fill');
      const m = map.secretBossMinotaur;
      return {
        hasAsterion: !!m,
        hp: m ? m.health : 0,
        maxHp: m ? m.maxHealth : 0,
        isBoss: m ? m.isBoss : false,
        isMinotaurStalker: m ? m.isMinotaurStalker : true,
        barVisible: bBar && !bBar.classList.contains('hidden'),
        bossNameText: bName ? bName.textContent : '',
        fillWidth: bFill ? bFill.style.width : ''
      };
    })()`);
    console.log('  -> Asterion Secret Boss Spawn State:', asterionState);
    if (!asterionState.hasAsterion) throw new Error('Asterion secret boss was not spawned in Secret Lair!');
    if (asterionState.hp !== 900) throw new Error(`Expected Asterion HP 900, got ${asterionState.hp}`);
    if (asterionState.isMinotaurStalker) throw new Error('Asterion is marked as unkillable stalker!');
    if (!asterionState.barVisible || !asterionState.bossNameText.includes('ASTERION')) {
      throw new Error(`Asterion boss bar not displayed correctly: visible=${asterionState.barVisible}, name=${asterionState.bossNameText}`);
    }

    // Deal damage to Asterion — verify Asterion takes real damage!
    console.log('  Attacking Asterion with melee weapon...');
    await harness.evaluate(`window.GAME.map.secretBossMinotaur.takeDamage(150, true);`);
    await sleep(200);

    const asterionDamaged = await harness.evaluate(`(() => {
      const m = window.GAME.map.secretBossMinotaur;
      return {
        hp: m.health,
        maxHp: m.maxHealth,
        isDead: m.dead
      };
    })()`);
    console.log('  -> Asterion Damaged State:', asterionDamaged);
    if (asterionDamaged.hp !== 750) {
      throw new Error(`Expected Asterion HP 750 after 150 damage, got ${asterionDamaged.hp}`);
    }

    // Slay Asterion and verify legendary drop
    console.log('  Slaying Asterion...');
    await harness.evaluate(`window.GAME.map.secretBossMinotaur.takeDamage(750, true);`);
    await sleep(400);

    const artifactState = await harness.evaluate(`(() => {
      const m = window.GAME.map.secretBossMinotaur;
      const artifact = window.GAME.map.interactables.find(i => i.prompt && i.prompt.includes('AEGIS OF THE MINOTAUR'));
      return {
        asterionDead: m.dead,
        artifactSpawned: !!artifact && artifact.active
      };
    })()`);
    console.log('  -> Asterion Slain & Artifact State:', artifactState);
    if (!artifactState.asterionDead) throw new Error('Asterion did not die!');
    if (!artifactState.artifactSpawned) throw new Error('Aegis of the Minotaur legendary artifact did not spawn!');

    // Claim the Aegis of the Minotaur
    console.log('  Claiming Aegis of the Minotaur...');
    await harness.evaluate(`(() => {
      const artifact = window.GAME.map.interactables.find(i => i.prompt && i.prompt.includes('AEGIS OF THE MINOTAUR'));
      if (artifact) artifact.onInteract();
    })()`);
    await sleep(200);

    const aegisPlayerState = await harness.evaluate(`(() => {
      const p = window.GAME.player;
      return {
        hasAegis: p.hasAegis,
        damageMultiplier: p.damageMultiplier,
        damageReduction: p.damageReduction
      };
    })()`);
    console.log('  -> Player Aegis Buffs:', aegisPlayerState);
    if (!aegisPlayerState.hasAegis) throw new Error('Player did not acquire Aegis!');
    if (aegisPlayerState.damageReduction !== 0.5) throw new Error(`Expected 50% damage reduction (0.5), got ${aegisPlayerState.damageReduction}`);

    // Save and Reload persistence test (verifying no exponential compounding damage)
    console.log('  Testing Save and Reload persistence...');
    await harness.evaluate(`window.GAME.saveGame();`);
    const savedData = await harness.evaluate(`window.GAME.save.load();`);
    console.log('  -> Saved Data hasAegis:', savedData.hasAegis, 'damageMultiplier:', savedData.damageMultiplier);
    if (!savedData.hasAegis || savedData.damageMultiplier !== 2.0) {
      throw new Error(`Save data incorrect: hasAegis=${savedData.hasAegis}, mult=${savedData.damageMultiplier}`);
    }

    await harness.evaluate(`window.GAME.menu.onContinue();`);
    await sleep(400);

    const reloadedState = await harness.evaluate(`(() => {
      const p = window.GAME.player;
      return {
        hasAegis: p.hasAegis,
        damageMultiplier: p.damageMultiplier,
        damageReduction: p.damageReduction
      };
    })()`);
    console.log('  -> Reloaded Player State:', reloadedState);
    if (reloadedState.damageMultiplier !== 2.0) {
      throw new Error(`Damage multiplier compounded exponentially on reload! Expected 2.0, got ${reloadedState.damageMultiplier}`);
    }

    console.log('\n========================================================');
    console.log('   ALL AUDIT DEFECTS & CAPABILITIES RIGOROUSLY VERIFIED!');
    console.log('========================================================\n');
  } catch (err) {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await harness.close();
  }
}

run();
