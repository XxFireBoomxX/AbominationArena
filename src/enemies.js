// Shared combat and presentation definitions. Ability strength stays fixed;
// later waves scale health, movement speed and the number of opponents.
export const ENEMIES = Object.freeze({
  crawler: { name: 'Преследвач', wave: 1, weight: 45, hp: 45, speed: 80, radius: 19, color: '#f27899', points: 100, description: 'Приближава и атакува при контакт.' },
  runner: { name: 'Бегач', wave: 2, weight: 30, hp: 30, speed: 145, radius: 14, color: '#b294f9', points: 150, description: 'Бърз и крехък. Пази дистанция.' },
  tank: { name: 'Тежък', wave: 3, weight: 25, hp: 120, speed: 55, radius: 29, color: '#f1ba77', points: 250, description: 'Много живот и силен удар при контакт.' },
  hexer: { name: 'Маг', wave: 4, weight: 18, hp: 55, speed: 75, radius: 20, color: '#71d8f2', points: 200, description: 'Зарежда магически снаряд. Отмести се от линията.', ability: { windup: .7, cooldown: 2.4, range: 560, damage: 16, speed: 280, life: 2.4, radius: 7 } },
  charger: { name: 'Таран', wave: 5, weight: 18, hp: 90, speed: 85, radius: 23, color: '#ff9569', points: 225, description: 'Засилва се по права линия. Избягвай встрани.', ability: { windup: .85, cooldown: 3.2, range: 500, damage: 24, speed: 560, duration: .55, recovery: 1.1 } },
  shaman: { name: 'Шаман', wave: 6, weight: 16, hp: 85, speed: 60, radius: 24, color: '#d5e879', points: 275, description: 'Прокълната зона забавя и наранява. Излез от кръга.', ability: { windup: .45, cooldown: 4.6, range: 540, damage: 10, radius: 76, warning: 1.1, duration: 2.4, slow: .65 } }
});
export const ENEMY_IDS = Object.freeze(Object.keys(ENEMIES));

export function enemyTypeFor(wave, roll) {
  if (wave === 1) return 'crawler';
  if (wave === 2) return roll < .55 ? 'runner' : 'crawler';
  const pool = ['tank', 'runner', 'crawler', 'hexer', 'charger', 'shaman'].filter(id => wave >= ENEMIES[id].wave);
  let remaining = roll * pool.reduce((sum, id) => sum + ENEMIES[id].weight, 0);
  for (const id of pool) {
    remaining -= ENEMIES[id].weight;
    if (remaining < 0) return id;
  }
  return pool.at(-1);
}

export function createEnemy(type, wave, x, y, phase = 0) {
  const stats = ENEMIES[type], hp = stats.hp + (wave - 1) * 7;
  return { ...stats, type, x, y, phase, hp, maxHp: hp, hit: 0,
    speed: stats.speed + Math.min(80, (wave - 1) * 5), attack: null, cooldown: 1 };
}
