import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../src/engine.js';
import { ENEMIES, ENEMY_IDS, createEnemy, enemyTypeFor } from '../src/enemies.js';

function arena(type, x = 300, y = 0) {
  const game = new Arena(() => .5);
  game.reset(); game.spawnTimer = 100;
  if (type) {
    const enemy = createEnemy(type, ENEMIES[type].wave, x, y);
    enemy.cooldown = 0; game.enemies.push(enemy);
  }
  return game;
}
function advance(game, duration, input = {}) {
  for (let remaining = duration; remaining > 1e-8; remaining -= .01) game.step(Math.min(.01, remaining), input);
}
function zone(overrides = {}) {
  return { x: 0, y: 0, radius: 76, warning: 1.1, life: 2.4, damage: 10, slow: .65, color: ENEMIES.shaman.color, ...overrides };
}
function bolt(overrides = {}) {
  return { x: -100, y: 0, vx: 4000, vy: 0, life: 1, radius: 7, damage: 16, color: ENEMIES.hexer.color, ...overrides };
}

test('enemy pools introduce abilities only at their unlock waves and keep the original early mix', () => {
  assert.equal(enemyTypeFor(1, .01), 'crawler');
  assert.equal(enemyTypeFor(2, .54), 'runner');
  assert.equal(enemyTypeFor(2, .55), 'crawler');
  assert.equal(enemyTypeFor(3, .24), 'tank');
  assert.equal(enemyTypeFor(3, .54), 'runner');
  assert.equal(enemyTypeFor(3, .55), 'crawler');
  for (let wave = 1; wave <= 8; wave++) {
    const seen = new Set();
    for (let i = 0; i < 10000; i++) seen.add(enemyTypeFor(wave, i / 10000));
    assert.deepEqual([...seen].sort(), ENEMY_IDS.filter(id => ENEMIES[id].wave <= wave).sort());
  }
});

test('special enemies spawn with wave scaling and their own rewards', () => {
  for (const type of ['hexer', 'charger', 'shaman']) {
    const game = arena(); game.wave = 10;
    const stats = ENEMIES[type];
    const sample = Array.from({ length: 1000 }, (_, i) => i / 1000).find(roll => enemyTypeFor(10, roll) === type);
    const rolls = [.5, .5, sample, .5]; game.random = () => rolls.shift() ?? .5;
    game.spawnEnemy();
    const enemy = game.enemies[0];
    assert.equal(enemy.type, type); assert.equal(enemy.hp, stats.hp + 63);
    assert.equal(enemy.speed, stats.speed + 45); assert.equal(enemy.points, stats.points);
    assert.equal(game.spawned, 1);
  }
});

test('a mage locks its aim, warns before firing and respects attack recovery', () => {
  const game = arena('hexer');
  game.step(.01);
  const mage = game.enemies[0];
  assert.equal(mage.attack.stage, 'windup'); assert.equal(game.hostileBullets.length, 0);
  game.player.y = 120;
  advance(game, .6);
  assert.equal(game.hostileBullets.length, 0);
  advance(game, .11);
  assert.equal(game.hostileBullets.length, 1);
  assert.equal(game.hostileBullets[0].vy, 0, 'A dodge must not be tracked after aim locks');
  assert.equal(game.hostileBullets[0].vx, -280);
  advance(game, .8);
  assert.equal(game.events.filter(e => e.type === 'enemy-attack').length, 1);
  assert.equal(game.player.hp, 100);
});

test('casters approach from far away, hold distance and retreat when crowded', () => {
  for (const type of ['hexer', 'shaman']) {
    for (const [x, direction] of [[600, -1], [300, 0], [100, 1]]) {
      const game = arena(type, x); game.enemies[0].cooldown = 10;
      game.step(.05);
      assert.equal(Math.sign(game.enemies[0].x - x), direction);
    }
  }
});

test('hostile bolts use swept collision, shared invulnerability and finite lifetime range', () => {
  const game = arena(); game.hostileBullets.push(bolt(), bolt());
  game.step(.05);
  assert.equal(game.player.hp, 84); assert.equal(game.hostileBullets.length, 0);
  assert.equal(game.events.filter(e => e.type === 'hurt').length, 1);
  const expired = arena(); expired.hostileBullets.push(bolt({ x: -50, vx: 1000, life: .01 }));
  expired.step(.05);
  assert.equal(expired.player.hp, 100); assert.equal(expired.hostileBullets.length, 0);
});

test('a shaman fixes the curse location at cast start and gives a harmless ground warning', () => {
  const game = arena('shaman'); game.step(.01);
  game.player.x = 100;
  advance(game, .46);
  assert.equal(game.zones.length, 1); assert.equal(game.zones[0].x, 0);
  assert.equal(game.zones[0].y, 0); assert.ok(game.zones[0].warning > 1);
  assert.equal(game.player.hp, 100);
});

test('curse zones warn, slow without stacking, deal periodic damage and expire', () => {
  const game = arena(); game.zones.push(zone(), zone());
  advance(game, 1);
  assert.equal(game.player.hp, 100); assert.equal(game.player.slowed, false);
  advance(game, .12);
  assert.equal(game.player.hp, 90); assert.equal(game.player.slowed, true);
  const before = game.player.x;
  game.step(.05, { moveX: 1 });
  assert.ok(Math.abs(game.player.x - before - 8.125) < 1e-8);
  advance(game, .9);
  assert.equal(game.player.hp, 80, 'Overlapping zones share the damage protection window');
  advance(game, 1.5);
  assert.equal(game.zones.length, 0); assert.equal(game.player.slowed, false);
});

test('moving outside a curse restores movement speed', () => {
  const game = arena(); game.zones.push(zone({ warning: 0 })); game.step(.01);
  assert.equal(game.player.slowed, true);
  game.player.x = 120;
  game.step(.05, { moveX: 1 });
  assert.equal(game.player.slowed, false); assert.equal(game.player.x, 132.5);
});

test('dash protects from magic and ignores ground slowing', () => {
  const game = arena(); game.zones.push(zone({ warning: 0 }));
  game.hostileBullets.push(bolt({ x: 0, vx: 850 }));
  game.step(.05, { moveX: 1, dash: true });
  assert.equal(game.player.x, 42.5); assert.equal(game.player.hp, 100);
  assert.equal(game.hostileBullets.length, 0);
});

test('a charger commits to a straight rush then rests, allowing a sideways dodge', () => {
  const game = arena('charger', 280);
  game.step(.01);
  const charger = game.enemies[0], start = charger.x;
  assert.equal(charger.attack.stage, 'windup');
  game.player.y = 120;
  advance(game, .7);
  assert.equal(charger.x, start);
  advance(game, .75);
  assert.equal(charger.y, 0); assert.equal(charger.attack.stage, 'recovery');
  assert.ok(charger.x < start - 300); assert.equal(game.player.hp, 100);
  const restingX = charger.x;
  advance(game, .5);
  assert.equal(charger.x, restingX);
});

test('a charger damages the player along its swept rush and can be dashed through', () => {
  for (const dash of [false, true]) {
    const game = arena('charger', 50), charger = game.enemies[0];
    charger.attack = { stage: 'active', remaining: .55, dx: -1, dy: 0 };
    game.step(.05, { dash, moveX: 1 });
    assert.equal(game.player.hp, dash ? 100 : 76);
  }
});

test('killing a caster during windup cancels its spell and awards its score once', () => {
  const game = arena('hexer', 65), mage = game.enemies[0];
  mage.hp = 25; mage.speed = 0;
  game.step(.05, { fire: true, aimX: 100, aimY: 0 });
  assert.equal(game.kills, 1); assert.equal(game.score, 200);
  advance(game, 1);
  assert.equal(game.hostileBullets.length, 0); assert.equal(game.kills, 1);
});

test('pausing freezes attack warnings, projectiles and curses; relocation cancels an old aim', () => {
  const game = arena('hexer'); game.step(.01);
  game.hostileBullets.push(bolt()); game.zones.push(zone()); game.state = 'paused';
  const snapshot = JSON.stringify([game.enemies, game.hostileBullets, game.zones]);
  game.step(.05);
  assert.equal(JSON.stringify([game.enemies, game.hostileBullets, game.zones]), snapshot);
  game.state = 'playing'; game.player.x = 10000; game.player.y = -10000;
  game.step(.01);
  assert.equal(game.enemies[0].attack, null);
  assert.equal(game.enemies[0].hp, ENEMIES.hexer.hp + 21);
  assert.equal(game.hostileBullets.length, 0); assert.equal(game.zones.length, 0);
});

test('wave completion clears deployed hazards; upgrade and restart reset spell state', () => {
  const game = arena('shaman', 65), shaman = game.enemies[0];
  shaman.hp = 25; shaman.speed = 0; shaman.cooldown = 10;
  game.waveRemaining = .05;
  game.zones.push(zone({ x: 200 })); game.hostileBullets.push(bolt({ y: 200 }));
  game.step(.05, { fire: true, aimX: 100, aimY: 0 });
  assert.equal(game.state, 'upgrade'); assert.equal(game.kills, 1);
  assert.equal(game.zones.length, 0); assert.equal(game.hostileBullets.length, 0);
  game.upgrade('health'); assert.equal(game.zones.length, 0);
  game.zones.push(zone()); game.hostileBullets.push(bolt()); game.player.slowed = true;
  game.reset();
  assert.equal(game.zones.length, 0); assert.equal(game.hostileBullets.length, 0);
  assert.equal(game.player.slowed, false);
});
