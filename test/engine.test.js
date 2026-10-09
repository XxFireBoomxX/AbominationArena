import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, WIDTH, HEIGHT } from '../src/engine.js';

function arena() {
  const game = new Arena(() => .5);
  game.reset();
  game.spawnTimer = 100;
  return game;
}
function enemy(overrides = {}) {
  return { x: WIDTH / 2 + 65, y: HEIGHT / 2, hp: 25, maxHp: 25, radius: 14, speed: 0, type: 'crawler', points: 100, color: '#f27899', hit: 0, ...overrides };
}

test('diagonal movement has the same speed as straight movement and stays inside the arena', () => {
  const straight = arena(), diagonal = arena();
  straight.step(.05, { moveX: 1 });
  diagonal.step(.05, { moveX: 1, moveY: 1 });
  assert.ok(Math.abs(Math.hypot(diagonal.player.x - WIDTH / 2, diagonal.player.y - HEIGHT / 2) - (straight.player.x - WIDTH / 2)) < .0001);
  straight.player.x = WIDTH - 31;
  straight.step(.05, { moveX: 1 });
  assert.equal(straight.player.x, WIDTH - 30);
});

test('a shot crosses an enemy, kills it and awards score once', () => {
  const game = arena();
  game.enemies.push(enemy());
  game.step(.05, { fire: true, aimX: WIDTH, aimY: HEIGHT / 2 });
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
  game.step(.05, { fire: true, aimX: WIDTH, aimY: HEIGHT / 2 });
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
  assert.equal(game.player.x, WIDTH / 2);
  assert.equal(game.bullets.length, 0);
  assert.equal(game.enemies.length, 0);
});
