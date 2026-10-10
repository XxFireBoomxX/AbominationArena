export const WEAPONS = Object.freeze({
  rifle: Object.freeze({
    id: 'rifle', name: 'Пушка', key: '1', description: 'Точна стрелба · далечна дистанция',
    damage: 25, interval: .17, minInterval: .065, speed: 740, life: 1.7,
    pellets: 1, spread: 0, radius: 4, color: '#a1f5ca', barrel: 27,
    sound: Object.freeze({ frequency: 220, duration: .045, type: 'triangle', volume: .02 })
  }),
  smg: Object.freeze({
    id: 'smg', name: 'Автомат', key: '2', description: 'Бърза стрелба · средна дистанция',
    damage: 11, interval: .075, minInterval: .035, speed: 880, life: .8,
    pellets: 1, spread: .09, radius: 3, color: '#7bdce5', barrel: 21,
    sound: Object.freeze({ frequency: 350, duration: .035, type: 'square', volume: .012 })
  }),
  shotgun: Object.freeze({
    id: 'shotgun', name: 'Дробовик', key: '3', description: '7 сачми в конус · близка дистанция',
    damage: 9, interval: .65, minInterval: .25, speed: 760, life: .42,
    pellets: 7, spread: .64, radius: 3, color: '#e6f5a1', barrel: 32,
    sound: Object.freeze({ frequency: 95, duration: .16, type: 'sawtooth', volume: .045 })
  })
});
export const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));
