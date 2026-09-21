/**
 * PartyManager.js
 * The 4-Hero Mercenary Company (2 Male, 2 Female)
 * All 4 active members fight together in tactical battles
 */

import { Element } from './ElementalSystem.js';

export const HERO_ROLES = {
  WARRIOR: {
    id: 'warrior',
    name: 'Sir Roland',
    className: 'Warrior',
    gender: 'male',
    icon: '🛡️',
    spritePath: 'assets/sprites/warrior.png',
    element: Element.EARTH,
    baseStats: { hp: 160, mp: 30, str: 18, dex: 10, vit: 16, arc: 6, spd: 11 },
    skills: [
      { id: 'cleave', name: 'Iron Cleave', mp: 0, target: 'single', element: Element.PHYSICAL, power: 1.2, desc: 'Heavy two-handed sword swing.' },
      { id: 'shield_bash', name: 'Earth Stun', mp: 8, target: 'single', element: Element.EARTH, power: 1.0, stunChance: 0.5, desc: 'Crushing shield strike with chance to stun.' },
      { id: 'taunt', name: 'War Cry', mp: 10, target: 'self', element: Element.PHYSICAL, power: 0, buff: 'taunt', desc: 'Draw enemy aggression and raise Defense by 30% for 2 turns.' }
    ]
  },
  VALKYRIE: {
    id: 'valkyrie',
    name: 'Lady Brynhild',
    className: 'Valkyrie',
    gender: 'female',
    icon: '⚡',
    spritePath: 'assets/sprites/valkyrie.png',
    element: Element.THUNDER,
    baseStats: { hp: 130, mp: 60, str: 14, dex: 13, vit: 13, arc: 12, spd: 13 },
    skills: [
      { id: 'spear_thrust', name: 'Thunder Lance', mp: 6, target: 'single', element: Element.THUNDER, power: 1.35, desc: 'Piercing divine spear enveloped in lightning.' },
      { id: 'holy_smite', name: 'Holy Smite', mp: 14, target: 'single', element: Element.HOLY, power: 1.7, bonusUndead: 2.0, desc: 'Devastating holy beam, deals double damage to Undead.' },
      { id: 'aegis', name: 'Aegis Ward', mp: 18, target: 'all_allies', element: Element.HOLY, power: 0, buff: 'def_up', desc: 'Divine shield blessing that reduces all incoming party damage by 25%.' }
    ]
  },
  ELF: {
    id: 'elf',
    name: 'Lyra Swiftwind',
    className: 'Elf Ranger',
    gender: 'female',
    icon: '🏹',
    spritePath: 'assets/sprites/elf.png',
    element: Element.WIND,
    baseStats: { hp: 105, mp: 75, str: 12, dex: 18, vit: 9, arc: 14, spd: 16 },
    skills: [
      { id: 'gale_arrow', name: 'Gale Shot', mp: 0, target: 'single', element: Element.WIND, power: 1.15, critBonus: 0.25, desc: 'High-speed wind arrow with elevated critical strike chance.' },
      { id: 'arrow_barrage', name: 'Triple Volley', mp: 12, target: 'all_enemies', element: Element.PHYSICAL, power: 0.85, desc: 'Rains arrows down on all enemy units.' },
      { id: 'natures_mend', name: 'Nature\'s Mend', mp: 15, target: 'single_ally', element: Element.WIND, power: 1.5, isHeal: true, desc: 'Restores generous HP to an injured companion.' }
    ]
  },
  WIZARD: {
    id: 'wizard',
    name: 'Master Aldous',
    className: 'Wizard',
    gender: 'male',
    icon: '🔮',
    spritePath: 'assets/sprites/wizard.png',
    element: Element.FIRE,
    baseStats: { hp: 90, mp: 120, str: 8, dex: 11, vit: 8, arc: 20, spd: 12 },
    skills: [
      { id: 'fireball', name: 'Inferno Burst', mp: 16, target: 'all_enemies', element: Element.FIRE, power: 1.4, desc: 'Explosive blast of fire that scorches the entire enemy line.' },
      { id: 'frost_lance', name: 'Glacial Spike', mp: 12, target: 'single', element: Element.ICE, power: 1.6, freezeChance: 0.35, desc: 'Puncturing ice shard with high freeze probability.' },
      { id: 'arcane_surge', name: 'Mana Flow', mp: 0, target: 'self', element: Element.SHADOW, power: 0, restoreMp: 25, desc: 'Channel raw ley lines to replenish 25 MP.' }
    ]
  }
};

export class PartyMember {
  constructor(def) {
    this.id         = def.id;
    this.name       = def.name;
    this.className  = def.className;
    this.gender     = def.gender;
    this.icon       = def.icon;
    this.spritePath = def.spritePath;
    this.element    = def.element;
    this.skills     = def.skills;

    this.level      = 1;
    this.stats      = { ...def.baseStats };
    this.maxHp      = this.stats.hp;
    this.hp         = this.maxHp;
    this.maxMp      = this.stats.mp;
    this.mp         = this.maxMp;

    this.isGuarding = false;
    this.isSuperguarding = false;
    this.buffs      = {};
  }

  heal(amt) {
    this.hp = Math.min(this.maxHp, this.hp + amt);
  }

  consumeMp(amt) {
    if (this.mp < amt) return false;
    this.mp -= amt;
    return true;
  }

  gainStatsOnLevelUp() {
    this.level += 1;
    this.stats.hp  += 12 + Math.floor(this.stats.vit * 0.4);
    this.stats.mp  += 8 + Math.floor(this.stats.arc * 0.3);
    this.stats.str += 2;
    this.stats.dex += 2;
    this.stats.vit += 2;
    this.stats.arc += 2;
    this.maxHp = this.stats.hp;
    this.maxMp = this.stats.mp;
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }
}

export class PartyManager {
  constructor() {
    this.members = [
      new PartyMember(HERO_ROLES.WARRIOR),
      new PartyMember(HERO_ROLES.VALKYRIE),
      new PartyMember(HERO_ROLES.ELF),
      new PartyMember(HERO_ROLES.WIZARD),
    ];
    this.xp    = 0;
    this.level = 1;
    this.gold  = 150;
    this.flasks = 3;
    this.maxFlasks = 3;
  }

  isPartyWiped() {
    return this.members.every(m => m.hp <= 0);
  }

  restAtShrine() {
    this.members.forEach(m => {
      m.hp = m.maxHp;
      m.mp = m.maxMp;
      m.buffs = {};
    });
    this.flasks = this.maxFlasks;
  }

  addXp(amount) {
    this.xp += amount;
    const req = this.level * 180;
    let leveledUp = false;
    while (this.xp >= req) {
      this.xp -= req;
      this.level += 1;
      this.members.forEach(m => m.gainStatsOnLevelUp());
      leveledUp = true;
    }
    return leveledUp;
  }

  getAliveMembers() {
    return this.members.filter(m => m.hp > 0);
  }
}
