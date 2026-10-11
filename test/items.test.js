import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../src/engine.js';
import { createEnemy, ENEMY_IDS } from '../src/enemies.js';
import { WEAPON_IDS } from '../src/weapons.js';
import { ITEMS, ITEM_IDS, SYNERGIES, COIN_VALUES, COIN_LIFETIME, MEDKIT_PRICE, itemPrice, SURVIVAL_COINS } from '../src/items.js';

function arena(random = () => .5) {
  const game = new Arena(random); game.reset(); game.spawnTimer = 100;
  return game;
}
function shop(game, ids, money = 10000) {
  game.state = 'shop'; game.money = money;
  for (const id of ids) assert.equal(game.buyItem(id), true);
  game.nextWave(); game.spawnTimer = 100;
}
function target(x = 65, hp = 25, type = 'crawler') {
  return { ...createEnemy(type, 1, x, 0), hp, maxHp: hp, speed: 0, cooldown: 100, radius: 8 };
}
function shoot(game) { game.shotTimer = 0; game.step(.05, { fire: true, aimX: game.player.x + 1000, aimY: game.player.y }); }

test('all enemy kills drop their own coin value; kills alone do not fill the wallet', () => {
  const game = arena();
  for (const type of ENEMY_IDS) {
    game.enemies.push(target(90, 1, type)); shoot(game); game.step(.05);
    assert.equal(game.money, 0);
    assert.equal(game.coins.at(-1).value, COIN_VALUES[type]);
  }
  assert.equal(game.coins.length, 6); assert.equal(game.kills, 6);
  game.player.x = 90; game.step(.01);
  assert.equal(game.coins.length, 0);
  assert.equal(game.money, Object.values(COIN_VALUES).reduce((a, b) => a + b, 0));
  assert.equal(game.getRunReport().coinsCollected, game.money);
  const money = game.money; game.step(.05); assert.equal(game.money, money);
});

test('coins attract only within range, work far from the origin and expire in active time', () => {
  const game = arena(); game.player.x = -50000; game.player.y = 90000;
  game.coins.push({ x: -49940, y: 90000, value: 14, life: COIN_LIFETIME }, { x: -49800, y: 90000, value: 18, life: COIN_LIFETIME });
  game.step(.05); assert.equal(game.coins[0].x, -49961); assert.equal(game.coins[1].x, -49800);
  game.state = 'paused'; const snapshot = structuredClone(game.coins); game.step(10);
  assert.deepEqual(game.coins, snapshot);
  game.state = 'playing'; game.step(.05); assert.equal(game.money, 14);
  game.step(20); assert.equal(game.coins.length, 0); assert.equal(game.money, 14);
});

test('expiry pays survival once, discards uncollected coins and freezes shopping time', () => {
  const game = arena(); game.player.hp = 10;
  game.coins.push({ x: 500, y: 0, value: 100, life: 20 });
  game.waveRemaining = .01; game.step(.01);
  assert.equal(game.state, 'shop'); assert.equal(game.money, SURVIVAL_COINS);
  assert.equal(game.coins.length, 0); assert.equal(game.player.hp, 10);
  const snapshot = game.getRunReport(); game.step(500, { fire: true, moveX: 1 });
  assert.deepEqual(game.getRunReport(), snapshot);
  assert.equal(game.buyItem('medkit'), true); assert.equal(game.player.hp, 50);
  assert.equal(game.money, SURVIVAL_COINS - MEDKIT_PRICE);
  game.nextWave(); assert.equal(game.waveRemaining, 60);
});

test('purchases reject closed shop, invalid IDs, insufficient funds and excessive ranks atomically', () => {
  const game = arena(); game.money = 10000;
  for (const state of ['ready', 'playing', 'paused', 'gameover']) {
    game.state = state; const before = game.getRunReport();
    assert.equal(game.buyItem('core'), false); assert.equal(game.buyItem('medkit'), false);
    assert.equal(game.nextWave(), false); assert.deepEqual(game.getRunReport(), before);
  }
  game.state = 'shop';
  for (const id of ['missing', '__proto__', 'constructor', 'toString']) assert.equal(game.buyItem(id), false);
  game.money = 69; const before = game.getRunReport();
  assert.equal(game.buyItem('core'), false); assert.deepEqual(game.getRunReport(), before);
  game.money = 10000;
  for (const id of ITEM_IDS) {
    for (let rank = 0; rank < ITEMS[id].maxRank; rank++) {
      const price = itemPrice(id, rank), money = game.money;
      assert.equal(game.purchaseStatus(id).price, price);
      assert.equal(game.buyItem(id), true); assert.equal(game.money, money - price);
    }
    const before = game.getRunReport(); assert.equal(game.buyItem(id), false);
    assert.deepEqual(game.getRunReport(), before);
  }
});

test('the wallet conserves earnings, allows multiple purchases and saves money across waves', () => {
  const game = arena();
  game.coins.push({ x: 0, y: 0, value: 400, life: 20 }); game.step(.01);
  game.waveRemaining = .01; game.step(.01);
  assert.equal(game.buyItem('core'), true); assert.equal(game.buyItem('core'), true);
  assert.equal(game.buyItem('trigger'), true); assert.equal(game.state, 'shop');
  assert.equal(game.inventory.core, 2); assert.equal(game.inventory.trigger, 1);
  assert.deepEqual(game.synergies, ['overdrive']);
  const report = game.getRunReport(); assert.equal(report.money, report.moneyEarned - report.moneySpent);
  assert.equal(report.moneySpent, 70 + 120 + 80); assert.equal(report.money, 170);
  assert.equal(game.nextWave(), true); assert.equal(game.nextWave(), false);
  assert.equal(game.money, 170); assert.equal(game.inventory.core, 2);
  assert.equal(game.wave, 2); assert.equal(game.player.hp, 100);
  assert.equal(game.events.filter(e => e.type === 'synergy').length, 1);
});

test('medkits heal only actual lost health, cost on each use and reject full health', () => {
  const game = arena(); game.state = 'shop'; game.money = 200;
  assert.equal(game.buyItem('medkit'), false); assert.equal(game.money, 200);
  game.player.hp = 25;
  assert.equal(game.buyItem('medkit'), true); assert.equal(game.player.hp, 65);
  assert.equal(game.buyItem('medkit'), true); assert.equal(game.player.hp, 100);
  assert.equal(game.buyItem('medkit'), false);
  assert.equal(game.stats.healing, 75); assert.equal(game.stats.medkits, 2);
  assert.equal(game.stats.moneySpent, 80); assert.equal(game.money, 120);
});

test('plating raises max health, heals its increase and reduces contact and magic damage', () => {
  const game = arena(); game.player.hp = 90; shop(game, ['plating', 'plating']);
  assert.equal(game.player.maxHp, 150); assert.equal(game.player.hp, 140); assert.equal(game.stats.healing, 50);
  for (const attack of ['contact', 'rush', 'bolt', 'curse']) {
    game.player.invulnerable = 0; const before = game.player.hp;
    assert.equal(game.hurtPlayer(20, { enemyType: 'hexer', attack }), true);
    assert.ok(Math.abs(before - game.player.hp - 16.8) < 1e-8);
  }
  assert.ok(Math.abs(game.stats.damageTaken - 67.2) < 1e-8);
  const damage = game.stats.damageTaken; game.hurtPlayer(100); assert.equal(game.stats.damageTaken, damage);
});

test('living armor heals once per kill, caps at max health and cannot revive a lethal hit', () => {
  const game = arena(); shop(game, ['plating', 'siphon']); game.player.hp = 120;
  game.enemies.push(target()); shoot(game);
  assert.equal(game.player.hp, 123);
  game.enemies.push(target()); shoot(game); assert.equal(game.player.hp, 125);
  assert.equal(game.stats.healing, 30);
  const money = game.money;
  game.player.hp = 1; game.player.invulnerable = 0;
  game.enemies.push(target(0, 100), target(60, 1)); shoot(game);
  assert.equal(game.state, 'gameover'); assert.equal(game.player.hp, 0);
  assert.equal(game.kills, 3); assert.equal(game.stats.healing, 30);
  assert.equal(game.money, money); assert.equal(game.completedWaves, 0);
});

test('boots change ordinary movement and dash recovery while preserving diagonal normalization', () => {
  const game = arena(); shop(game, ['boots', 'boots']);
  game.step(.05, { moveX: 1, moveY: 1 });
  assert.ok(Math.abs(Math.hypot(game.player.x, game.player.y) - 14.5) < 1e-8);
  const before = game.player.x; game.step(.05, { dash: true, moveX: 1 });
  assert.equal(game.player.x - before, 42.5);
  assert.ok(Math.abs(game.player.dashCooldown - 2.8 * .9 ** 2) < 1e-8);
});

test('magnet awards rounded bonus and scavenger haste renews without multiplying its strength', () => {
  const game = arena(); shop(game, ['magnet', 'boots']);
  assert.equal(game.pickupRadius, 135);
  game.coins.push({ x: 0, y: 0, value: 14, life: 20 }); game.step(.01);
  assert.equal(game.stats.coinsCollected, 15); assert.equal(game.hasteTime, 2);
  game.step(.05, { moveX: 1 }); assert.ok(Math.abs(game.player.x - 16.2) < 1e-8);
  game.coins.push({ x: game.player.x, y: 0, value: 18, life: 20 }); game.step(.5);
  assert.equal(game.hasteTime, 2); assert.ok(Math.abs(game.moveSpeed - 324) < 1e-8);
  game.step(2); assert.equal(game.hasteTime, 0); assert.equal(game.moveSpeed, 270);
  game.waveRemaining = .01; game.step(.01); assert.equal(game.hasteTime, 0);
});

test('critical projectiles use rank chance, retain weapon attribution and work with all weapons', () => {
  for (const id of WEAPON_IDS) {
    const game = arena(() => 0); shop(game, ['lens']); game.selectWeapon(id); shoot(game);
    assert.equal(game.bullets.length, game.weapon.pellets);
    for (const bullet of game.bullets) { assert.equal(bullet.critical, true); assert.equal(bullet.damage, game.weapon.damage * 1.75); }
    const bullet = game.bullets[0]; game.selectWeapon(id === 'rifle' ? 'smg' : 'rifle');
    assert.equal(bullet.weaponId, id); assert.equal(bullet.critical, true);
  }
  const normal = arena(() => .1); shop(normal, ['lens']); shoot(normal);
  assert.equal(normal.bullets[0].critical, false);
  const ranked = arena(() => .29); shop(ranked, ['lens', 'lens', 'lens']); shoot(ranked);
  assert.equal(ranked.bullets[0].critical, true);
});

test('piercing hits in travel order with diminishing damage and accuracy never exceeds 100%', () => {
  const game = arena(); shop(game, ['piercer', 'piercer']);
  const near = target(43, 100), far = target(58, 100);
  game.enemies.push(far, near); shoot(game);
  assert.equal(near.hp, 75); assert.equal(far.hp, 80);
  game.step(.001); assert.equal(near.hp, 75); assert.equal(far.hp, 80);
  const report = game.getRunReport();
  assert.equal(report.hits, 2); assert.equal(report.hitProjectiles, 1);
  assert.equal(report.accuracy, 100); assert.equal(report.weapons.rifle.accuracy, 100);
  assert.equal(report.damageDealt, 45); assert.equal(game.bullets[0].damage, 16);
});

test('piercing consumes its limited extra targets across frames and counts each kill once', () => {
  const game = arena(); shop(game, ['piercer']);
  game.enemies.push(target(65, 1), target(100, 1), target(150, 1)); shoot(game);
  assert.equal(game.kills, 1); assert.equal(game.bullets.length, 1);
  game.selectWeapon('smg'); game.step(.05);
  assert.equal(game.kills, 2); assert.equal(game.bullets.length, 0);
  assert.equal(game.enemies.length, 1); assert.equal(game.coins.length + game.stats.coinsCollected / 14, 2);
  assert.equal(game.stats.weapons.rifle.kills, 2); assert.equal(game.stats.weapons.smg.kills, 0);
});

test('contact order uses the first body intersection even when a larger target has a farther center', () => {
  for (const piercing of [false, true]) {
    const game = arena(); if (piercing) shop(game, ['piercer']);
    const small = { ...target(50, 100), radius: 2 }, large = { ...target(70, 100), radius: 30 };
    game.enemies.push(small, large); shoot(game);
    assert.equal(large.hp, 75); assert.equal(small.hp, piercing ? 80 : 100);
  }
});

test('precision retains all damage and critical hits do not inflate projectile accuracy', () => {
  const game = arena(() => 0); shop(game, ['piercer', 'lens']);
  const a = target(43, 100), b = target(58, 100); game.enemies.push(a, b); shoot(game);
  assert.equal(a.hp, 56.25); assert.equal(b.hp, 56.25);
  assert.equal(game.stats.criticalHits, 2); assert.equal(game.stats.hits, 2);
  assert.equal(game.getRunReport().accuracy, 100);
});

test('recipes unlock in either purchase order and additional ranks do not unlock them again', () => {
  for (const [id, recipe] of Object.entries(SYNERGIES)) {
    for (const ingredients of [recipe.items, [...recipe.items].reverse()]) {
      const game = arena(); game.state = 'shop'; game.money = 10000;
      assert.equal(game.buyItem(ingredients[0]), true); assert.deepEqual(game.synergies, []);
      assert.equal(game.buyItem(ingredients[1]), true); assert.deepEqual(game.synergies, [id]);
      for (const ingredient of ingredients) assert.equal(game.buyItem(ingredient), true);
      assert.deepEqual(game.synergies, [id]);
      assert.equal(game.events.filter(e => e.type === 'synergy').length, 1);
    }
  }
});

test('death at expiry grants no survival coins and death freezes all economy counters', () => {
  const game = arena(); game.player.hp = 1; game.waveRemaining = .01;
  game.coins.push({ x: 0, y: 0, value: 100, life: 20 }); game.enemies.push(target(0, 100));
  game.step(.01); assert.equal(game.state, 'gameover'); assert.equal(game.money, 0);
  assert.equal(game.stats.survivalCoins, 0); assert.equal(game.stats.coinsCollected, 0);
  const snapshot = game.getRunReport(); game.step(60, { fire: true, moveX: 1 });
  assert.deepEqual(game.getRunReport(), snapshot); assert.equal(game.buyItem('plating'), false);
});

test('restart resets economy, ranks, combinations and pickups without mutating reports', () => {
  const game = arena(); shop(game, ITEM_IDS); game.coins.push({ x: 0, y: 0, value: 20, life: 20 }); game.step(.01);
  const report = game.getRunReport(), snapshot = structuredClone(report);
  game.reset(); assert.deepEqual(report, snapshot);
  assert.equal(game.money, 0); assert.equal(game.coins.length, 0); assert.equal(game.hasteTime, 0);
  assert.deepEqual(game.synergies, []); assert.equal(game.player.maxHp, 100);
  for (const id of ITEM_IDS) assert.equal(game.inventory[id], 0);
  for (const key of ['money', 'coinsCollected', 'survivalCoins', 'moneyEarned', 'moneySpent', 'medkits', 'hitProjectiles', 'criticalHits']) assert.equal(game.getRunReport()[key], 0);
  report.inventory.core = 99; report.synergies.push('missing');
  assert.equal(game.inventory.core, 0); assert.deepEqual(game.synergies, []);
});
