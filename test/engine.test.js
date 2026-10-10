import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, WIDTH, HEIGHT } from '../src/engine.js';
import { cameraFor, inView, screenToWorld } from '../src/world.js';

function arena() {
  const game = new Arena(() => .5);
  game.reset();
  game.spawnTimer = 100;
  return game;
}
function enemy(overrides = {}) {
  return { x: 65, y: 0, hp: 25, maxHp: 25, radius: 14, speed: 0, type: 'crawler', points: 100, color: '#f27899', hit: 0, ...overrides };
}

test('diagonal movement has the same speed as straight movement', () => {
  const straight = arena(), diagonal = arena();
  straight.step(.05, { moveX: 1 });
  diagonal.step(.05, { moveX: 1, moveY: 1 });
  assert.ok(Math.abs(Math.hypot(diagonal.player.x, diagonal.player.y) - straight.player.x) < .0001);
});

test('a shot crosses an enemy, kills it and awards score once', () => {
  const game = arena();
  game.enemies.push(enemy());
  game.step(.05, { fire: true, aimX: WIDTH, aimY: 0 });
  assert.equal(game.kills, 1);
  assert.equal(game.score, 100);
  assert.equal(game.enemies.length, 0);
  game.step(.05);
  assert.equal(game.kills, 1);
});

test('contact damage has an invulnerability period; dash prevents damage and has a cooldown', () => {
  const game = arena();
  game.enemies.push(enemy({ x: game.player.x, y: game.player.y }));
  game.step(.01);
  assert.equal(game.player.hp, 88);
  game.step(.01);
  assert.equal(game.player.hp, 88);
  const dodging = arena();
  dodging.enemies.push(enemy({ x: dodging.player.x, y: dodging.player.y }));
  dodging.step(.01, { dash: true, moveX: 1 });
  assert.equal(dodging.player.hp, 100);
  assert.ok(dodging.player.dashCooldown > 2);
  const remaining = dodging.player.dashCooldown;
  dodging.step(.01, { dash: true });
  assert.ok(dodging.player.dashCooldown < remaining);
});

test('completing a wave opens upgrades, then advances difficulty and restores health', () => {
  const game = arena();
  game.waveKills = game.target - 1;
  game.spawned = game.target;
  game.player.hp = 50;
  game.enemies.push(enemy());
  game.step(.05, { fire: true, aimX: WIDTH, aimY: 0 });
  assert.equal(game.state, 'upgrade');
  assert.equal(game.score, 600);
  const before = game.time;
  game.step(.05, { moveX: 1 });
  assert.equal(game.time, before);
  game.upgrade('power');
  assert.equal(game.state, 'playing');
  assert.equal(game.wave, 2);
  assert.equal(game.damage, 35);
  assert.equal(game.player.hp, 85);
  assert.equal(game.target, 12);
  assert.equal(game.spawned, 0);
});

test('zero health ends the game, freezes simulation, and restart resets progress', () => {
  const game = arena();
  game.player.hp = 1;
  game.enemies.push(enemy({ x: game.player.x, y: game.player.y }));
  game.step(.01);
  assert.equal(game.state, 'gameover');
  assert.equal(game.player.hp, 0);
  const before = game.time;
  game.step(.05, { fire: true, moveX: 1 });
  assert.equal(game.time, before);
  game.reset();
  assert.equal(game.state, 'playing');
  assert.equal(game.player.hp, 100);
  assert.equal(game.wave, 1);
  assert.equal(game.enemies.length, 0);
});

test('paused games do not move, spawn enemies or accumulate time', () => {
  const game = arena();
  game.state = 'paused';
  game.step(.05, { moveX: 1, fire: true, dash: true });
  assert.equal(game.time, 0);
  assert.equal(game.player.x, 0);
  assert.equal(game.bullets.length, 0);
  assert.equal(game.enemies.length, 0);
});

test('movement and dash cross former boundaries in every direction', () => {
  for (const [moveX, moveY] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const game = arena();
    game.player.x = moveX * WIDTH;
    game.player.y = moveY * HEIGHT;
    const before = { ...game.player };
    game.step(.05, { moveX, moveY });
    assert.equal(game.player.x, before.x + moveX * 12.5);
    assert.equal(game.player.y, before.y + moveY * 12.5);
    game.step(.05, { moveX, moveY, dash: true });
    assert.equal(game.player.x, before.x + moveX * 55);
    assert.equal(game.player.y, before.y + moveY * 55);
  }
});

test('shots collide and persist beyond former bounds, including negative world coordinates', () => {
  for (const origin of [50000, -50000]) {
    const game = arena();
    game.player.x = origin;
    game.player.y = origin;
    game.enemies.push(enemy({ x: origin + 65, y: origin }));
    game.step(.05, { fire: true, aimX: origin + 100, aimY: origin });
    assert.equal(game.kills, 1);
    game.shotTimer = 0;
    game.step(.05, { fire: true, aimX: origin + 100, aimY: origin });
    assert.equal(game.bullets.length, 1);
    for (let i = 0; i < 40; i++) game.step(.05);
    assert.equal(game.bullets.length, 0);
  }
});

test('enemies spawn outside the current view at distant positive and negative positions', () => {
  const game = arena();
  game.player.x = -12000;
  game.player.y = 18000;
  game.spawnEnemy();
  assert.equal(game.spawned, 1);
  assert.equal(inView(game.enemies[0], cameraFor(game.player), 30), false);
  assert.ok(Math.hypot(game.enemies[0].x - game.player.x, game.enemies[0].y - game.player.y) < WIDTH);
});

test('far pursuers are repositioned without losing health or changing wave progress', () => {
  const game = arena();
  game.player.x = -9000;
  game.player.y = -7000;
  game.enemies.push(enemy({ x: 20000, y: 20000, hp: 10 }));
  game.spawned = game.target;
  game.waveKills = game.target - 1;
  game.step(.01);
  assert.equal(game.enemies[0].hp, 10);
  assert.equal(game.spawned, game.target);
  assert.equal(game.waveKills, game.target - 1);
  assert.equal(game.score, 0);
  assert.equal(game.state, 'playing');
  assert.ok(Math.hypot(game.enemies[0].x - game.player.x, game.enemies[0].y - game.player.y) < WIDTH);
  // The last enemy remains killable, so travelling cannot strand the wave.
  game.enemies[0].x = game.player.x + 65;
  game.enemies[0].y = game.player.y;
  game.step(.05, { fire: true, aimX: game.player.x + 100, aimY: game.player.y });
  assert.equal(game.state, 'upgrade');
});

test('screen targeting keeps the same direction as the camera follows the player', () => {
  for (const position of [0, 25000, -25000]) {
    const game = arena();
    game.player.x = position;
    game.player.y = position;
    const aim = screenToWorld({ x: WIDTH / 2 + 100, y: HEIGHT / 2 - 100 }, cameraFor(game.player));
    game.step(.01, { fire: true, aimX: aim.x, aimY: aim.y });
    assert.ok(Math.abs(game.player.angle + Math.PI / 4) < .00001);
    assert.ok(game.bullets[0].vx > 0 && game.bullets[0].vy < 0);
  }
});
