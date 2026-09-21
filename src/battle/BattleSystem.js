/**
 * BattleSystem.js
 * Turn-Based Tactical Orchestrator with Paper Mario Action Commands
 * 4-Hero Active Squad vs Enemy Horde
 */

import { ElementalSystem, ElementColors } from './ElementalSystem.js';

export class BattleSystem {
  constructor(partyManager, arena, ui, audio, camera = null) {
    this.partyManager = partyManager;
    this.arena        = arena;
    this.ui           = ui;
    this.audio        = audio;
    this.camera       = camera;

    this.enemySquad   = [];
    this.targetIndex  = 0;
    this.turnQueue    = [];
    this.currentTurn  = 0;
    this.inBattle     = false;
    this.onBattleEnd  = null;

    // Action Command timing state
    this._actionCommandActive = false;
    this._actionCommandHit    = false;
    this._superguardHit       = false;

    this._bindInput();
    this.ui.onSelectTarget = (idx) => {
      this.targetIndex = idx;
      this.ui.updateEnemyHUD(this.enemySquad, this.targetIndex);
    };
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      if (!this.inBattle) return;
      if (e.code === 'Space') {
        if (this._actionCommandActive) {
          this._actionCommandHit = true;
          this.ui.hideTimingPrompt();
        }
      }
    });
  }

  startBattle(enemySquad, isFirstStrike = false, isAmbush = false, onComplete = null) {
    this.inBattle    = true;
    this.enemySquad  = enemySquad;
    this.targetIndex = 0;
    this.onBattleEnd = onComplete;

    const isBoss = enemySquad.some(e => e.isBoss);

    this.audio.playBattleTransition(isBoss);
    this.ui.playTransition(isBoss, () => {
      this.arena.setupBattle(this.partyManager.members, this.enemySquad, this.camera);
      this.ui.show();
      this.ui.updatePartyHUD(this.partyManager.members);
      this.ui.updateEnemyHUD(this.enemySquad, this.targetIndex);

      if (isFirstStrike) {
        this.ui.spawnFloatText('⚔️ FIRST STRIKE!', '#44ff88');
        this.audio.playSFX('swordHit');
        // Deal opening bonus damage to vanguard
        if (this.enemySquad[0]) {
          this.enemySquad[0].hp -= 22;
          this.arena.playEnemyHitFlash(0);
          this.ui.updateEnemyHUD(this.enemySquad, this.targetIndex);
        }
      } else if (isAmbush) {
        this.ui.spawnFloatText('⚠️ AMBUSHED!', '#ff4444');
        this.audio.playSFX('telegraphWarn');
      }

      this._buildTurnQueue(isAmbush);
      this._nextTurn();
    });
  }

  _buildTurnQueue(isAmbush = false) {
    // Collect all living combatants sorted by speed
    const list = [];
    if (!isAmbush) {
      this.partyManager.getAliveMembers().forEach(m => list.push({ type: 'hero', entity: m, speed: m.stats.dex }));
      this.enemySquad.filter(e => e.hp > 0).forEach(e => list.push({ type: 'enemy', entity: e, speed: e.speed || 10 }));
    } else {
      // Ambush: Enemies act first
      this.enemySquad.filter(e => e.hp > 0).forEach(e => list.push({ type: 'enemy', entity: e, speed: (e.speed || 10) + 100 }));
      this.partyManager.getAliveMembers().forEach(m => list.push({ type: 'hero', entity: m, speed: m.stats.dex }));
    }

    list.sort((a, b) => b.speed - a.speed);
    this.turnQueue = list;
    this.currentTurn = 0;
  }

  _nextTurn() {
    // Check battle conclusion
    const enemiesAlive = this.enemySquad.some(e => e.hp > 0);
    if (!enemiesAlive) {
      this._onVictory();
      return;
    }
    if (this.partyManager.isPartyWiped()) {
      this._onDefeat();
      return;
    }

    if (this.currentTurn >= this.turnQueue.length) {
      this._buildTurnQueue();
    }

    const current = this.turnQueue[this.currentTurn++];
    if (!current || current.entity.hp <= 0) {
      this._nextTurn();
      return;
    }

    if (current.type === 'hero') {
      const heroIndex = this.partyManager.members.indexOf(current.entity);
      this.ui.updatePartyHUD(this.partyManager.members, heroIndex);
      this._promptHeroTurn(current.entity, heroIndex);
    } else {
      this._executeEnemyTurn(current.entity);
    }
  }

  _promptHeroTurn(hero, heroIndex) {
    this.ui.showCommandMenu(hero, (action, skill = null) => {
      this.ui.hideCommandMenu();

      if (action === 'flee') {
        this.ui.spawnFloatText('RETREATING...', '#ffaa33');
        setTimeout(() => this._endBattle(false), 800);
        return;
      }

      if (action === 'guard') {
        hero.isGuarding = true;
        this.ui.spawnFloatText('🛡️ GUARD STANCE', '#33aaff');
        this.audio.playSFX('block');
        setTimeout(() => this._nextTurn(), 600);
        return;
      }

      if (action === 'item') {
        if (this.partyManager.flasks > 0) {
          this.partyManager.flasks--;
          hero.heal(45);
          this.audio.playSFX('pickup');
          this.ui.spawnFloatText('+45 HP (FLASK)', '#44ff66');
          this.ui.updatePartyHUD(this.partyManager.members);
        } else {
          this.ui.spawnFloatText('NO FLASKS LEFT!', '#ff4444');
        }
        setTimeout(() => this._nextTurn(), 700);
        return;
      }

      // Attack or Skill Execution with Action Command
      this._executeHeroAction(hero, heroIndex, skill);
    });
  }

  _executeHeroAction(hero, heroIndex, skill) {
    const element = skill ? skill.element : hero.element;

    if (skill && skill.mp > 0) {
      hero.consumeMp(skill.mp);
      this.ui.updatePartyHUD(this.partyManager.members);
    }

    // Handle Ally Heal Skill (Elf: Nature Grace)
    if (skill && skill.target === 'ally') {
      const livingAllies = this.partyManager.members.filter(m => m.hp > 0);
      livingAllies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
      const healTarget = livingAllies[0] || hero;
      const healAmount = Math.round(hero.stats.arc * 1.6 + skill.power * 20);
      healTarget.heal(healAmount);
      this.audio.playSFX('pickup');
      this.ui.spawnFloatText(`💚 ${healTarget.name} +${healAmount} HP`, '#44ff66');
      this.ui.updatePartyHUD(this.partyManager.members);
      setTimeout(() => this._nextTurn(), 700);
      return;
    }

    // Handle AoE Skill (Wizard: Blizzard Gale)
    if (skill && skill.target === 'all') {
      // Start Action Command window (Timed Hit)
      this._actionCommandActive = false;
      this._actionCommandHit    = false;

      setTimeout(() => {
        this._actionCommandActive = true;
        this.ui.showTimingPrompt('STRIKE');
        setTimeout(() => {
          this._actionCommandActive = false;
          this.ui.hideTimingPrompt();
        }, 240);
      }, 180);

      this.arena.playHeroAttackAnimation(heroIndex, null, () => {
        let isCrit = this._actionCommandHit;
        this.audio.playSFX('heavySwing');
        this.enemySquad.forEach((t, tIdx) => {
          if (t.hp <= 0) return;
          const evalRes = ElementalSystem.evaluate(element, t.element);
          let baseDmg = Math.round(hero.stats.arc * 1.3 + skill.power * 14);
          let finalDmg = Math.round(baseDmg * evalRes.multiplier * (isCrit ? 1.4 : 1.0));
          t.hp = Math.max(0, t.hp - finalDmg);
          this.arena.playEnemyHitFlash(tIdx, ElementColors[element]);
        });
        this.ui.spawnFloatText(isCrit ? '💥 BLIZZARD CRIT!' : '❄️ BLIZZARD GALE!', '#66ccff');
        this.ui.updateEnemyHUD(this.enemySquad, this.targetIndex);
      }, () => {
        setTimeout(() => this._nextTurn(), 400);
      });
      return;
    }

    // Single Target Attack / Skill
    let target = this.enemySquad[this.targetIndex];
    if (!target || target.hp <= 0) {
      this.targetIndex = this.enemySquad.findIndex(e => e.hp > 0);
      target = this.enemySquad[this.targetIndex];
    }
    if (!target) { this._nextTurn(); return; }

    const targetMesh = this.arena.enemyMeshes[this.targetIndex]?.mesh;

    // Start Action Command window (Timed Hit)
    this._actionCommandActive = false;
    this._actionCommandHit    = false;

    setTimeout(() => {
      this._actionCommandActive = true;
      this.ui.showTimingPrompt('STRIKE');
      setTimeout(() => {
        this._actionCommandActive = false;
        this.ui.hideTimingPrompt();
      }, 240);
    }, 180);

    this.arena.playHeroAttackAnimation(heroIndex, targetMesh, () => {
      // Impact evaluation
      const evalRes = ElementalSystem.evaluate(element, target.element);
      let isCrit = this._actionCommandHit;

      let baseDmg = Math.round((hero.stats.str * 1.3 + (skill ? skill.power * 15 : 10)));
      if (skill && skill.element !== 'physical') {
        baseDmg = Math.round((hero.stats.arc * 1.4 + skill.power * 16));
      }

      let finalDmg = Math.round(baseDmg * evalRes.multiplier * (isCrit ? 1.5 : 1.0));

      target.hp = Math.max(0, target.hp - finalDmg);
      this.arena.playEnemyHitFlash(this.targetIndex, ElementColors[element]);

      if (isCrit) {
        this.audio.playSFX('heavySwing');
        this.ui.spawnFloatText(`💥 CRITICAL! -${finalDmg}`, '#ffff33');
      } else {
        this.audio.playSFX('swordHit');
        this.ui.spawnFloatText(`-${finalDmg}`, '#ffffff');
      }

      if (evalRes.affinity === 'weakness') {
        setTimeout(() => this.ui.spawnFloatText('✨ WEAKNESS! 1.75x', '#ff8833'), 250);
      } else if (evalRes.affinity === 'resist') {
        setTimeout(() => this.ui.spawnFloatText('🛡️ RESISTED! 0.5x', '#88aaff'), 250);
      }

      this.ui.updateEnemyHUD(this.enemySquad, this.targetIndex);
    }, () => {
      setTimeout(() => this._nextTurn(), 400);
    });
  }

  _executeEnemyTurn(enemy) {
    const livingHeroes = this.partyManager.getAliveMembers();
    if (livingHeroes.length === 0) { this._onDefeat(); return; }

    const targetHero = livingHeroes[Math.floor(Math.random() * livingHeroes.length)];
    const targetIdx = this.partyManager.members.indexOf(targetHero);

    this.ui.spawnFloatText(`⚠️ ${enemy.name} ATTACKS!`, '#ff4444');
    this.audio.playSFX('telegraphWarn');

    // Superguard / Active Guard Window
    this._actionCommandActive = false;
    this._actionCommandHit    = false;

    setTimeout(() => {
      this._actionCommandActive = true;
      this.ui.showTimingPrompt('GUARD');
      setTimeout(() => {
        this._actionCommandActive = false;
        this.ui.hideTimingPrompt();
      }, 260);
    }, 280);

    setTimeout(() => {
      const incomingDmg = enemy.damage || 18;
      let finalDmg = incomingDmg;

      if (this._actionCommandHit) {
        // Successful Active Guard (65% damage reduction)
        finalDmg = Math.round(incomingDmg * 0.35);
        this.audio.playSFX('block');
        this.ui.spawnFloatText(`🛡️ GUARD! -${finalDmg}`, '#33aaff');
      } else {
        this.audio.playSFX('playerHurt');
        this.ui.spawnFloatText(`💥 -${finalDmg}`, '#ff3333');
      }

      targetHero.hp = Math.max(0, targetHero.hp - finalDmg);
      this.ui.updatePartyHUD(this.partyManager.members);

      setTimeout(() => this._nextTurn(), 600);
    }, 560);
  }

  _onVictory() {
    this.audio.playSFX('roomClear');
    const totalXp = this.enemySquad.reduce((sum, e) => sum + (e.xp || 60), 0);
    const totalGold = this.enemySquad.reduce((sum, e) => sum + (e.gold || 40), 0);

    this.partyManager.gold += totalGold;
    const leveledUp = this.partyManager.addXp(totalXp);

    this.ui.spawnFloatText(`🏆 VICTORY! +${totalXp} XP, +${totalGold}G`, '#ffea00');
    if (leveledUp) {
      setTimeout(() => this.ui.spawnFloatText('🌟 PARTY LEVEL UP!', '#00ffff'), 500);
    }

    setTimeout(() => this._endBattle(true), 1800);
  }

  _onDefeat() {
    this.ui.spawnFloatText('💀 DEFEATED...', '#ff2222');
    this.audio.playSFX('playerDeath');
    setTimeout(() => this._endBattle(false, true), 1600);
  }

  _endBattle(isVictory, isWiped = false) {
    this.inBattle = false;
    this.arena.hide();
    this.ui.hide();
    if (this.onBattleEnd) {
      this.onBattleEnd(isVictory, isWiped);
    }
  }
}

