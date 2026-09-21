/**
 * ElementalSystem.js
 * Elemental affinity matrix and damage multiplier calculator
 * Elements: PHYSICAL, FIRE, ICE, THUNDER, EARTH, WIND, HOLY, SHADOW
 */

export const Element = {
  PHYSICAL: 'physical',
  FIRE:     'fire',
  ICE:      'ice',
  THUNDER:  'thunder',
  EARTH:    'earth',
  WIND:     'wind',
  HOLY:     'holy',
  SHADOW:   'shadow',
};

export const ElementColors = {
  [Element.PHYSICAL]: '#c0c0c0',
  [Element.FIRE]:     '#ff4411',
  [Element.ICE]:      '#33bbff',
  [Element.THUNDER]:  '#ffdd22',
  [Element.EARTH]:    '#a87232',
  [Element.WIND]:     '#44dd88',
  [Element.HOLY]:     '#fff088',
  [Element.SHADOW]:   '#aa33ff',
};

export const ElementIcons = {
  [Element.PHYSICAL]: '⚔️',
  [Element.FIRE]:     '🔥',
  [Element.ICE]:      '❄️',
  [Element.THUNDER]:  '⚡',
  [Element.EARTH]:    '🪨',
  [Element.WIND]:     '🌪️',
  [Element.HOLY]:     '✨',
  [Element.SHADOW]:   '🌑',
};

// Target weaknesses: defenderWeaknesses[defenderElement] = [elements that deal 1.75x bonus damage]
const WEAKNESS_MAP = {
  [Element.PHYSICAL]: [],
  [Element.FIRE]:     [Element.ICE, Element.EARTH],
  [Element.ICE]:      [Element.FIRE, Element.PHYSICAL],
  [Element.THUNDER]:  [Element.EARTH],
  [Element.EARTH]:    [Element.WIND, Element.ICE],
  [Element.WIND]:     [Element.FIRE, Element.THUNDER],
  [Element.HOLY]:     [Element.SHADOW],
  [Element.SHADOW]:   [Element.HOLY],
};

// Target resistances: defenderResists[defenderElement] = [elements that deal 0.5x reduced damage]
const RESIST_MAP = {
  [Element.PHYSICAL]: [],
  [Element.FIRE]:     [Element.FIRE, Element.WIND],
  [Element.ICE]:      [Element.ICE, Element.THUNDER],
  [Element.THUNDER]:  [Element.THUNDER, Element.WIND],
  [Element.EARTH]:    [Element.EARTH, Element.FIRE, Element.THUNDER],
  [Element.WIND]:     [Element.WIND, Element.EARTH],
  [Element.HOLY]:     [Element.HOLY],
  [Element.SHADOW]:   [Element.SHADOW, Element.PHYSICAL],
};

export class ElementalSystem {
  /**
   * Calculate effective multiplier for an attack element against a target's element(s)
   * @param {string} attackElement
   * @param {string|string[]} targetElements
   * @returns {{ multiplier: number, affinity: 'weakness'|'resist'|'immune'|'neutral' }}
   */
  static evaluate(attackElement, targetElements) {
    if (!attackElement || attackElement === Element.PHYSICAL) {
      return { multiplier: 1.0, affinity: 'neutral' };
    }

    const targets = Array.isArray(targetElements) ? targetElements : [targetElements];
    let isWeakness = false;
    let isResist = false;

    for (const targetEl of targets) {
      const weaknesses = WEAKNESS_MAP[targetEl] || [];
      const resists    = RESIST_MAP[targetEl] || [];

      if (weaknesses.includes(attackElement)) isWeakness = true;
      if (resists.includes(attackElement))    isResist = true;
    }

    if (isWeakness && !isResist) {
      return { multiplier: 1.75, affinity: 'weakness' };
    }
    if (isResist && !isWeakness) {
      return { multiplier: 0.5, affinity: 'resist' };
    }
    return { multiplier: 1.0, affinity: 'neutral' };
  }
}
