import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../src/engine.js';
import { WEAPON_IDS } from '../src/weapons.js';

function equipped(id = 'rifle') {
  const game = new Arena(() => .5);
  game.reset();
  game.spawnTimer = 100;
  game.selectWeapon(id);
  for (let i = 0; i < 3; i++) game.step(.05);
  game.events = [];
  return game;
}
function target(x, y = 0, overrides = {}) {
  return { x, y, hp: 9, maxHp: 9, radius: 10, speed: 0, type: 'crawler', points: 100, color: '#f27899', phase: 0, hit: 0, ...overrides };
}
function fireOnce(game) { game.step(.005, { fire: true, aimX: 1000, aimY: 0 }); }

test('holding fire gives the automatic weapon a faster cadence than rifle and shotgun', () => {
  const shots = {};
  for (const id of WEAPON_IDS) {
    const game = equipped(id);
    for (let i = 0; i < 300; i++) game.step(.005, { fire: true, aimX: 1000, aimY: 0 });
    shots[id] = game.events.filter(e => e.type === 'shot').length;
  }
  assert.ok(shots.smg > shots.rifle * 1.8);
  assert.ok(shots.rifle > shots.shotgun * 2);
});

test('one shotgun blast hits targets across a cone', () => {
  const game = equipped('shotgun');
  game.enemies.push(target(180), target(Math.cos(.32) * 180, Math.sin(.32) * 180), target(Math.cos(-.32) * 180, Math.sin(-.32) * 180));
  fireOnce(game);
  assert.equal(game.bullets.length, 7);
  assert.ok(game.bullets.some(b => b.vy > 0) && game.bullets.some(b => b.vy < 0));
  for (let i = 0; i < 10; i++) game.step(.05);
  assert.equal(game.kills, 3);
  assert.equal(game.score, 300);
});

test('shotgun pellets expire before a distant target that a rifle can hit', () => {
  for (const id of ['shotgun', 'rifle']) {
    const game = equipped(id);
    game.enemies.push(target(450));
    fireOnce(game);
    for (let i = 0; i < 20; i++) game.step(.05);
    assert.equal(game.kills, id === 'rifle' ? 1 : 0);
    if (id === 'shotgun') assert.equal(game.bullets.length, 0);
  }
});

test('a close shotgun blast awards a kill once even when several pellets overlap the target', () => {
  const game = equipped('shotgun');
  game.enemies.push(target(60, 0, { radius: 19 }));
  fireOnce(game);
  for (let i = 0; i < 10; i++) game.step(.05);
  assert.equal(game.kills, 1);
  assert.equal(game.waveKills, 1);
  assert.equal(game.score, 100);
  assert.equal(game.events.filter(e => e.type === 'kill').length, 1);
});

test('switching preserves an existing shot and cannot bypass its recovery', () => {
  const game = equipped('shotgun');
  fireOnce(game);
  const pellet = game.bullets[0];
  assert.equal(pellet.damage, 9);
  assert.equal(game.muzzleTime > 0, true);
  game.selectWeapon('rifle');
  assert.equal(game.muzzleTime, 0);
  assert.equal(game.shotTimer, .65);
  for (let i = 0; i < 20; i++) {
    game.selectWeapon(i % 2 ? 'rifle' : 'smg');
    game.step(.01, { fire: true, aimX: 1000, aimY: 0 });
  }
  assert.equal(game.events.filter(e => e.type === 'shot').length, 1);
  assert.equal(pellet.damage, 9);
  assert.equal(pellet.weaponId, 'shotgun');
  assert.equal(pellet.color, '#e6f5a1');
});

test('items follow weapon changes, respect rank limits and reset on a new run', () => {
  const game = equipped();
  game.state = 'shop'; game.money = 10000;
  assert.equal(game.buyItem('core'), true); assert.equal(game.buyItem('trigger'), true);
  game.nextWave();
  const expectedDamage = { rifle: 32.5, smg: 14.3, shotgun: 11.7 };
  for (const id of WEAPON_IDS) {
    game.selectWeapon(id);
    assert.ok(Math.abs(game.damage - expectedDamage[id]) < .00001);
    assert.ok(Math.abs(game.fireInterval - game.weapon.interval * .88) < .00001);
  }
  game.state = 'shop';
  assert.equal(game.buyItem('trigger'), true); assert.equal(game.buyItem('trigger'), true);
  assert.equal(game.buyItem('trigger'), false);
  game.nextWave();
  for (const id of WEAPON_IDS) {
    game.selectWeapon(id);
    assert.ok(game.fireInterval >= game.weapon.minInterval);
    assert.ok(Math.abs(game.fireInterval - game.weapon.interval * .88 ** 3) < .00001);
  }
  game.reset();
  assert.equal(game.weaponId, 'rifle'); assert.equal(game.damage, 25);
  assert.equal(game.fireInterval, .17); assert.equal(game.inventory.core, 0);
  assert.equal(game.inventory.trigger, 0); assert.equal(game.money, 0);
});

test('selection rejects invalid IDs and is unavailable outside active combat', () => {
  const game = equipped();
  for (const state of ['ready', 'paused', 'shop', 'gameover']) {
    game.state = state;
    assert.equal(game.selectWeapon('shotgun'), false);
    assert.equal(game.weaponId, 'rifle');
  }
  game.state = 'playing';
  for (const id of ['missing', '__proto__', 'constructor']) assert.equal(game.selectWeapon(id), false);
  assert.equal(game.selectWeapon('smg'), true);
  const timer = game.shotTimer;
  assert.equal(game.selectWeapon('smg'), false);
  assert.equal(game.shotTimer, timer);
});

test('a pellet can hit in its final partial frame without exceeding its lifetime range', () => {
  for (const [x, expectedKills] of [[340, 1], [370, 0]]) {
    const game = equipped('shotgun');
    game.enemies.push(target(x, 0, { radius: 1 }));
    fireOnce(game);
    for (let i = 0; i < 9; i++) game.step(.05);
    assert.equal(game.kills, expectedKills);
    assert.equal(game.bullets.length, 0);
  }
});
