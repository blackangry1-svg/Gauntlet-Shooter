/**
 * BattleUI.js
 * Thematic Medieval / LotR Battle Interface
 * Command Menu, 4-Hero Status Bar, Action Command Timing Reticle & Float Text
 */

import { ElementColors, ElementIcons } from './ElementalSystem.js';

export class BattleUI {
  constructor() {
    this._container = null;
    this._timingReticle = null;
    this._buildDOM();
  }

  _buildDOM() {
    let el = document.getElementById('battle-ui-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'battle-ui-container';
      el.className = 'hidden';
      el.innerHTML = `
        <div id="battle-transition-overlay"></div>
        <div id="battle-header">
          <div id="battle-title">ENCOUNTER ENGAGED</div>
          <div id="battle-sub">Defeat the horde to ascend the tower</div>
        </div>

        <!-- Enemy Squad Indicators -->
        <div id="battle-enemy-hud"></div>

        <!-- Action Command Timing Prompts (Paper Mario style) -->
        <div id="battle-action-prompt" class="hidden">
          <div class="prompt-ring"></div>
          <div class="prompt-text">PRESS [SPACE]!</div>
        </div>

        <!-- Float Text Container -->
        <div id="battle-float-texts"></div>

        <!-- 4-Hero Party Status Bar (Bottom) -->
        <div id="battle-party-hud"></div>

        <!-- Command Menu (Left Popout) -->
        <div id="battle-command-menu" class="hidden">
          <div class="command-header">COMMAND</div>
          <button class="battle-btn" data-action="attack">⚔️ ATTACK</button>
          <button class="battle-btn" data-action="skills">✨ SKILLS</button>
          <button class="battle-btn" data-action="item">🧪 FLASK [Q]</button>
          <button class="battle-btn" data-action="guard">🛡️ GUARD</button>
          <button class="battle-btn" data-action="flee">🏃 RETREAT</button>
        </div>

        <!-- Skill Submenu -->
        <div id="battle-skill-menu" class="hidden">
          <div class="skill-header">SELECT SKILL</div>
          <div id="battle-skill-list"></div>
          <button class="battle-btn-back">⬅ BACK</button>
        </div>
      `;
      document.body.appendChild(el);
    }
    this._container = el;
    this._timingReticle = document.getElementById('battle-action-prompt');
  }

  show() {
    this._container.classList.remove('hidden');
    const overworldHud = document.getElementById('hud');
    if (overworldHud) overworldHud.classList.add('hidden');
    const ctp = document.getElementById('click-to-play');
    if (ctp) ctp.classList.add('hidden');
  }

  hide() {
    this._container.classList.add('hidden');
    this.hideCommandMenu();
    this.hideTimingPrompt();
    const overworldHud = document.getElementById('hud');
    if (overworldHud) overworldHud.classList.remove('hidden');
  }

  playTransition(isBoss = false, onComplete = null) {
    const overlay = document.getElementById('battle-transition-overlay');
    if (!overlay) { if (onComplete) onComplete(); return; }

    overlay.className = isBoss ? 'boss-shatter' : 'funky-swirl';
    setTimeout(() => {
      if (onComplete) onComplete();
      setTimeout(() => {
        overlay.className = '';
      }, 400);
    }, 900);
  }

  updatePartyHUD(partyMembers, activeHeroIndex = -1) {
    const hud = document.getElementById('battle-party-hud');
    if (!hud) return;
    hud.innerHTML = '';

    partyMembers.forEach((hero, i) => {
      const card = document.createElement('div');
      card.className = `hero-card ${i === activeHeroIndex ? 'active-turn' : ''} ${hero.hp <= 0 ? 'fallen' : ''}`;
      const hpPct = Math.max(0, Math.min(100, Math.round((hero.hp / hero.maxHp) * 100)));
      const mpPct = Math.max(0, Math.min(100, Math.round((hero.mp / hero.maxMp) * 100)));
      const elColor = ElementColors[hero.element] || '#fff';
      const elIcon = ElementIcons[hero.element] || '⚔️';

      card.innerHTML = `
        <div class="hero-header">
          <span class="hero-icon">${hero.icon}</span>
          <span class="hero-name">${hero.name}</span>
          <span class="hero-el" style="color:${elColor}">${elIcon}</span>
        </div>
        <div class="hero-bars">
          <div class="bar-row">
            <span class="bar-lbl">HP</span>
            <div class="bar-bg"><div class="bar-fill hp" style="width:${hpPct}%"></div></div>
            <span class="bar-val">${hero.hp}/${hero.maxHp}</span>
          </div>
          <div class="bar-row">
            <span class="bar-lbl">MP</span>
            <div class="bar-bg"><div class="bar-fill mp" style="width:${mpPct}%"></div></div>
            <span class="bar-val">${hero.mp}/${hero.maxMp}</span>
          </div>
        </div>
      `;
      hud.appendChild(card);
    });
  }

  updateEnemyHUD(enemySquad, targetedIndex = 0) {
    const hud = document.getElementById('battle-enemy-hud');
    if (!hud) return;
    hud.innerHTML = '';

    enemySquad.forEach((enemy, i) => {
      if (enemy.hp <= 0) return;
      const card = document.createElement('div');
      card.className = `enemy-card ${i === targetedIndex ? 'targeted' : ''}`;
      const hpPct = Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)));
      const elColor = ElementColors[enemy.element] || '#fff';
      const elIcon = ElementIcons[enemy.element] || '💀';

      card.innerHTML = `
        <div class="enemy-info">
          <span class="enemy-el" style="color:${elColor}">${elIcon}</span>
          <span class="enemy-name">${enemy.name}</span>
        </div>
        <div class="bar-bg enemy-bar"><div class="bar-fill hp" style="width:${hpPct}%"></div></div>
      `;
      card.addEventListener('click', () => {
        if (this.onSelectTarget) this.onSelectTarget(i);
      });
      hud.appendChild(card);
    });
  }

  showCommandMenu(hero, onCommand) {
    const menu = document.getElementById('battle-command-menu');
    const skillMenu = document.getElementById('battle-skill-menu');
    if (!menu) return;
    skillMenu.classList.add('hidden');
    menu.classList.remove('hidden');

    menu.querySelectorAll('.battle-btn').forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        if (action === 'skills') {
          this._showSkillList(hero, onCommand);
        } else {
          onCommand(action);
        }
      };
    });
  }

  _showSkillList(hero, onCommand) {
    const menu = document.getElementById('battle-command-menu');
    const skillMenu = document.getElementById('battle-skill-menu');
    const list = document.getElementById('battle-skill-list');
    menu.classList.add('hidden');
    skillMenu.classList.remove('hidden');
    list.innerHTML = '';

    hero.skills.forEach(skill => {
      const btn = document.createElement('button');
      btn.className = 'battle-btn skill-btn';
      const elIcon = ElementIcons[skill.element] || '✨';
      const canAfford = hero.mp >= skill.mp;
      btn.disabled = !canAfford;
      btn.innerHTML = `
        <div class="skill-name">${elIcon} ${skill.name}</div>
        <div class="skill-cost">${skill.mp > 0 ? skill.mp + ' MP' : 'FREE'}</div>
      `;
      btn.onclick = () => {
        skillMenu.classList.add('hidden');
        onCommand('skill', skill);
      };
      list.appendChild(btn);
    });

    skillMenu.querySelector('.battle-btn-back').onclick = () => {
      skillMenu.classList.add('hidden');
      menu.classList.remove('hidden');
    };
  }

  hideCommandMenu() {
    const menu = document.getElementById('battle-command-menu');
    const skillMenu = document.getElementById('battle-skill-menu');
    if (menu) menu.classList.add('hidden');
    if (skillMenu) skillMenu.classList.add('hidden');
  }

  showTimingPrompt(type = 'STRIKE') {
    if (!this._timingReticle) return;
    const txt = this._timingReticle.querySelector('.prompt-text');
    if (txt) txt.textContent = type === 'GUARD' ? 'TAP [SPACE] TO GUARD!' : 'TAP [SPACE] AT IMPACT!';
    this._timingReticle.className = `active ${type.toLowerCase()}`;
    this._timingReticle.classList.remove('hidden');
  }

  hideTimingPrompt() {
    if (!this._timingReticle) return;
    this._timingReticle.classList.add('hidden');
  }

  spawnFloatText(text, color = '#ffdd44', x = window.innerWidth / 2, y = window.innerHeight / 2) {
    const container = document.getElementById('battle-float-texts');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'battle-float-text';
    el.textContent = text;
    el.style.color = color;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
}
