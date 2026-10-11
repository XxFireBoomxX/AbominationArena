import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../src/engine.js';
import { createEnemy, ENEMY_IDS } from '../src/enemies.js';

function arena() {
  const game = new Arena(() => .5);
  game.reset(); game.spawnTimer = 100;
  return game;
}
function enemy(type = 'crawler', overrides = {}) {
  return { ...createEnemy(type, 6, 65, 0), speed: 0, cooldown: 100, ...overrides };
}
function bolt(overrides = {}) {
  return { x: -40, y: 0, vx: 1000, vy: 0, life: 1, radius: 7, damage: 16, enemyType: 'hexer', ...overrides };
}

test('shots count only actual firing, while accuracy is safe for a run without shots', () => {
  const game = arena();
  assert.equal(game.getRunReport().accuracy, 0);
  game.step(.05, { fire: true, aimX: 100, aimY: 0 });
  game.step(.05, { fire: true, aimX: 100, aimY: 0 });
  const report = game.getRunReport();
  assert.equal(report.shots, 1); assert.equal(report.projectiles, 1);
  assert.equal(report.hits, 0); assert.equal(report.accuracy, 0);
  assert.equal(report.weapons.rifle.shots, 1); assert.equal(report.weapons.smg.accuracy, 0);
});

test('shotgun accuracy counts pellets, caps overkill damage and awards one kill', () => {
  const game = arena(); game.selectWeapon('shotgun'); game.shotTimer = 0;
  game.enemies.push(enemy('tank', { hp: 10, maxHp: 10, radius: 50, x: 80 }));
  game.step(.05, { fire: true, aimX: 100, aimY: 0 });
  const report = game.getRunReport();
  assert.equal(report.shots, 1); assert.equal(report.projectiles, 7);
  assert.equal(report.hits, 2); assert.equal(report.accuracy, 2 / 7 * 100);
  assert.equal(report.damageDealt, 10); assert.equal(report.kills, 1);
  assert.equal(report.killsByType.tank, 1);
  assert.equal(report.weapons.shotgun.damage, 10); assert.equal(report.weapons.shotgun.kills, 1);
  assert.equal(report.weapons.shotgun.accuracy, report.accuracy);
});

test('a bullet keeps attribution to its firing weapon after switching', () => {
  const game = arena();
  game.enemies.push(enemy('hexer', { x: 220, hp: 25 }));
  game.step(.05, { fire: true, aimX: 300, aimY: 0 });
  assert.equal(game.kills, 0);
  game.selectWeapon('smg');
  for (let i = 0; i < 6; i++) game.step(.05);
  const report = game.getRunReport();
  assert.equal(report.weapons.rifle.hits, 1); assert.equal(report.weapons.rifle.kills, 1);
  assert.equal(report.weapons.rifle.damage, 25); assert.equal(report.killsByType.hexer, 1);
  assert.equal(report.weapons.smg.damage, 0); assert.equal(report.weapons.smg.kills, 0);
});

test('kills are tracked individually for all six enemy types', () => {
  const game = arena();
  for (const type of ENEMY_IDS) {
    game.enemies.push(enemy(type, { hp: 1 })); game.shotTimer = 0;
    game.step(.05, { fire: true, aimX: 100, aimY: 0 });
  }
  const report = game.getRunReport();
  assert.equal(report.kills, 6); assert.equal(report.hits, 6);
  assert.equal(report.damageDealt, 6); assert.equal(report.accuracy, 100);
  assert.equal(report.weapons.rifle.kills, 6);
  for (const type of ENEMY_IDS) assert.equal(report.killsByType[type], 1);
});

test('all lethal attack kinds record their cause and only the remaining player health', () => {
  for (const attack of ['contact', 'rush', 'bolt', 'curse']) {
    const game = arena(); game.player.hp = 5;
    const enemyType = { contact: 'tank', rush: 'charger', bolt: 'hexer', curse: 'shaman' }[attack];
    if (attack === 'contact') game.enemies.push(enemy(enemyType, { x: 0 }));
    if (attack === 'rush') game.enemies.push(enemy(enemyType, { x: 30, attack: { stage: 'active', remaining: .55, dx: -1, dy: 0 } }));
    if (attack === 'bolt') game.hostileBullets.push(bolt());
    if (attack === 'curse') game.zones.push({ x: 0, y: 0, radius: 76, warning: 0, life: 2.4, damage: 10, slow: .65, enemyType });
    game.step(.05);
    assert.equal(game.state, 'gameover'); assert.equal(game.player.hp, 0);
    const report = game.getRunReport();
    assert.equal(report.damageTaken, 5);
    assert.deepEqual(report.deathCause, { enemyType, attack });
  }
});

test('blocked hits do not count damage or overwrite a previous cause; dash counts once per activation', () => {
  const game = arena();
  game.enemies.push(enemy('crawler', { x: 0 })); game.step(.01);
  assert.equal(game.stats.damageTaken, 12);
  game.hostileBullets.push(bolt()); game.step(.05);
  assert.equal(game.stats.damageTaken, 12);
  assert.deepEqual(game.stats.lastHit, { enemyType: 'crawler', attack: 'contact' });
  game.step(.05, { dash: true, moveX: 1 });
  game.step(.05, { dash: true, moveX: 1 });
  assert.equal(game.getRunReport().dashes, 1);
  const dodging = arena(); dodging.hostileBullets.push(bolt({ x: 0, vx: 850 }));
  dodging.step(.05, { dash: true, moveX: 1 });
  assert.equal(dodging.getRunReport().damageTaken, 0); assert.equal(dodging.stats.lastHit, null);
});

test('upgrades preserve combat totals, count valid selections and record actual healing', () => {
  const game = arena(); game.player.hp = 90;
  game.enemies.push(enemy('crawler', { hp: 25 }));
  game.step(.05, { fire: true, aimX: 100, aimY: 0 });
  game.waveRemaining = .01; game.step(.01); game.upgrade('invalid');
  assert.equal(game.state, 'upgrade');
  game.upgrade('health');
  assert.equal(game.player.hp, 120); assert.equal(game.stats.healing, 30);
  game.waveRemaining = .01; game.step(.01); game.upgrade('power');
  assert.equal(game.stats.healing, 30);
  game.player.hp = 108; game.waveRemaining = .01; game.step(.01); game.upgrade('speed');
  const report = game.getRunReport();
  assert.equal(report.healing, 42); assert.equal(report.maxHp, 120);
  assert.equal(report.wave, 4); assert.equal(report.completedWaves, 3);
  assert.deepEqual(report.upgrades, { power: 1, speed: 1, health: 1 });
  assert.equal(report.shots, 1); assert.equal(report.kills, 1); assert.equal(report.damageDealt, 25);
});

test('death freezes the report; restart clears all totals without mutating an earlier snapshot', () => {
  const game = arena();
  game.step(.05, { fire: true, aimX: 100, aimY: 0 });
  const pausedTime = game.time; game.state = 'paused';
  game.step(.05, { fire: true, dash: true });
  assert.equal(game.time, pausedTime); assert.equal(game.stats.shots, 1);
  game.state = 'playing'; game.player.hp = 1;
  game.enemies.push(enemy('runner', { x: 0 })); game.step(.01);
  const report = game.getRunReport(), snapshot = structuredClone(report);
  game.step(.05, { fire: true, dash: true, moveX: 1 });
  assert.deepEqual(game.getRunReport(), snapshot);
  assert.equal(report.completedWaves, 0);
  game.reset();
  const next = game.getRunReport();
  for (const key of ['score', 'kills', 'time', 'shots', 'projectiles', 'hits', 'damageDealt', 'damageTaken', 'healing', 'dashes']) assert.equal(next[key], 0);
  assert.equal(next.deathCause, null); assert.equal(next.wave, 1);
  for (const type of ENEMY_IDS) assert.equal(next.killsByType[type], 0);
  assert.deepEqual(report, snapshot);
  report.weapons.rifle.shots = 100; report.killsByType.runner = 100;
  report.upgrades.power = 100; report.deathCause.attack = 'curse';
  assert.equal(game.stats.weapons.rifle.shots, 0); assert.equal(game.stats.killsByType.runner, 0);
  assert.equal(game.stats.upgrades.power, 0);
});
