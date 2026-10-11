// One catalog shared by combat, the shop, inventory and reports.
// Effects are cumulative within a run; recipes activate once, at any rank.
export const ITEMS = Object.freeze({
  core: { name: 'Плазмено ядро', icon: '⌁', price: 70, maxRank: 3, description: '+20% базови щети за всички оръжия на ранг.' },
  trigger: { name: 'Ускорител', icon: '»', price: 80, maxRank: 3, description: '12% по-кратък интервал между изстрелите на ранг.' },
  plating: { name: 'Наноброня', icon: '⬡', price: 85, maxRank: 3, description: '+25 максимален живот и лечение 25 при покупка. −8% входящи щети на ранг.' },
  boots: { name: 'Импулсни ботуши', icon: '↯', price: 75, maxRank: 3, description: '+8% движение и 10% по-кратко възстановяване на скока на ранг.' },
  lens: { name: 'Критична леща', icon: '◇', price: 100, maxRank: 3, description: '+10% шанс за критичен снаряд на ранг. Критичният удар нанася ×1,75 щети.' },
  siphon: { name: 'Кръвен сифон', icon: '✚', price: 90, maxRank: 3, description: 'Всяко убийство възстановява 1 живот на ранг.' },
  magnet: { name: 'Магнитен модул', icon: '◎', price: 70, maxRank: 3, description: '+70 обхват на привличане и +10% стойност на събрани монети на ранг.' },
  piercer: { name: 'Пробивен патрон', icon: '↠', price: 110, maxRank: 3, description: 'Снарядите пробиват още 1 цел на ранг. След всяка цел запазват 80% от щетите.' }
});
export const ITEM_IDS = Object.freeze(Object.keys(ITEMS));
export const SYNERGIES = Object.freeze({
  overdrive: { name: 'Претоварване', items: ['core', 'trigger'], description: 'Още +10% базови щети за всички оръжия.' },
  livingArmor: { name: 'Жива броня', items: ['plating', 'siphon'], description: 'Още +2 живот при всяко убийство.' },
  precision: { name: 'Прецизен пробив', items: ['lens', 'piercer'], description: 'Пробиването запазва 100% от щетите след всяка цел.' },
  scavenger: { name: 'Ловец на ресурси', items: ['boots', 'magnet'], description: 'Събрана монета дава +20% движение за 2 секунди. Подновява времето, без натрупване.' }
});
export const SYNERGY_IDS = Object.freeze(Object.keys(SYNERGIES));
export const COIN_VALUES = Object.freeze({ crawler: 14, runner: 18, tank: 28, hexer: 24, charger: 26, shaman: 30 });
export const SURVIVAL_COINS = 40;
export const COIN_LIFETIME = 20;
export const MEDKIT_PRICE = 40;
export const MEDKIT_HEALING = 40;

export function itemPrice(id, rank) {
  return Object.hasOwn(ITEMS, id) ? Math.ceil(ITEMS[id].price * (1 + rank * .65) / 5) * 5 : Infinity;
}
export function activeSynergies(inventory) {
  return SYNERGY_IDS.filter(id => SYNERGIES[id].items.every(item => inventory[item] > 0));
}
