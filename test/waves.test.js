import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, WAVE_DURATION, MAX_ACTIVE_ENEMIES } from '../src/engine.js';
import { createEnemy } from '../src/enemies.js';

function arena() {
  const game = new Arena(() => .5);
  game.reset(); game.spawnTimer = 100;
  return game;
}
function stepSeconds(game, seconds, input = {}) {
  for (let remaining = seconds; remaining > 1e-8; remaining -= .05) game.step(Math.min(.05, remaining), input);
}

test('a wave lasts the full minute even with no enemies or kills', () => {
  const game = arena();
  stepSeconds(game, 59.95);
  assert.equal(game.state, 'playing'); assert.ok(game.waveRemaining > 0);
  assert.equal(game.score, 0); assert.equal(game.completedWaves, 0);
  game.step(.05);
  assert.equal(game.state, 'shop'); assert.equal(game.waveRemaining, 0);
  assert.equal(game.time, WAVE_DURATION); assert.equal(game.kills, 0);
  assert.equal(game.score, 500); assert.equal(game.completedWaves, 1);
  game.step(5); assert.equal(game.score, 500); assert.equal(game.time, WAVE_DURATION);
});

test('killing the last opponent early does not finish the wave or stop new spawning', () => {
  const game = arena();
  game.enemies.push({ ...createEnemy('crawler', 1, 65, 0), hp: 25, speed: 0 });
  game.step(.05, { fire: true, aimX: 100, aimY: 0 });
  assert.equal(game.kills, 1); assert.equal(game.state, 'playing');
  assert.equal(game.enemies.length, 0); assert.equal(game.score, 100);
  game.spawned = 20; game.spawnTimer = 0;
  game.step(.01);
  assert.equal(game.spawned, 21); assert.equal(game.enemies.length, 1);
  assert.equal(game.state, 'playing');
});

test('expiry clears live opponents and all attacks without granting their kills or damage', () => {
  const game = arena(); game.waveRemaining = .02;
  game.enemies.push({ ...createEnemy('shaman', 6, 300, 200), cooldown: 10 });
  game.bullets.push({ x: 500, y: 500, vx: 740, vy: 0, life: 1, damage: 25, radius: 4, weaponId: 'rifle' });
  game.hostileBullets.push({ x: 500, y: 500, vx: 280, vy: 0, life: 1, damage: 16, radius: 7 });
  game.zones.push({ x: 500, y: 500, warning: 0, life: 2.4, radius: 76, damage: 10, slow: .65 });
  game.step(.05, { moveX: 1 });
  assert.equal(game.player.x, 5, 'Only the remaining 0.02 seconds may move the player');
  assert.equal(game.state, 'shop'); assert.equal(game.score, 500);
  assert.equal(game.player.hp, 100); assert.equal(game.kills, 0);
  assert.equal(game.stats.damageDealt, 0); assert.equal(game.stats.damageTaken, 0);
  for (const key of ['enemies', 'bullets', 'hostileBullets', 'zones']) assert.equal(game[key].length, 0);
  game.nextWave();
  assert.equal(game.wave, 2); assert.equal(game.waveRemaining, WAVE_DURATION);
  assert.equal(game.waveKills, 0); assert.equal(game.spawned, 0);
  game.spawnTimer = 100;
  stepSeconds(game, WAVE_DURATION);
  assert.equal(game.state, 'shop'); assert.equal(game.completedWaves, 2);
  assert.equal(game.time, 120); assert.equal(game.score, 1500);
});

test('pause, shop and game over freeze the minute and accumulated combat time', () => {
  const game = arena(); game.step(.25);
  assert.equal(game.waveRemaining, 59.75);
  for (const state of ['paused', 'shop', 'gameover']) {
    game.state = state; const snapshot = game.getRunReport();
    game.step(30, { fire: true, dash: true, moveX: 1 });
    assert.deepEqual(game.getRunReport(), snapshot);
  }
  game.state = 'playing'; game.step(.25);
  assert.equal(game.waveRemaining, 59.5); assert.equal(game.time, .5);
});

test('slow frames count actual active seconds without allowing unbounded combat movement', () => {
  const game = arena(); game.step(1, { moveX: 1 });
  assert.equal(game.time, 1); assert.equal(game.waveRemaining, 59);
  assert.equal(game.player.x, 12.5);
  game.step(120);
  assert.equal(game.state, 'shop'); assert.equal(game.time, 60);
  assert.equal(game.waveRemaining, 0);
});

test('death in the final combat tick takes priority over clearing a wave', () => {
  const game = arena(); game.waveRemaining = .01; game.player.hp = 1;
  game.enemies.push(createEnemy('crawler', 1, 0, 0));
  game.step(.05);
  assert.equal(game.state, 'gameover'); assert.equal(game.waveRemaining, 0);
  assert.equal(game.completedWaves, 0); assert.equal(game.score, 0);
  assert.equal(game.getRunReport().completedWaves, 0);
  assert.deepEqual(game.getRunReport().deathCause, { enemyType: 'crawler', attack: 'contact' });
});

test('continuous spawning respects the active cap and resumes when a slot opens', () => {
  const game = arena(); game.wave = 20;
  game.enemies = Array.from({ length: MAX_ACTIVE_ENEMIES }, (_, i) => ({ ...createEnemy('tank', 20, 300 + i, 0), speed: 0 }));
  game.spawnTimer = 0; game.step(.05);
  assert.equal(game.enemies.length, MAX_ACTIVE_ENEMIES); assert.equal(game.spawned, 0);
  game.enemies.pop(); game.step(.05);
  assert.equal(game.enemies.length, MAX_ACTIVE_ENEMIES); assert.equal(game.spawned, 1);
});

test('restart resets the wave timer, completed waves and report progress', () => {
  const game = arena(); game.step(60); game.nextWave(); game.step(15);
  assert.equal(game.getRunReport().completedWaves, 1);
  assert.equal(game.getRunReport().waveRemaining, 45);
  game.reset(); const report = game.getRunReport();
  assert.equal(game.wave, 1); assert.equal(report.completedWaves, 0);
  assert.equal(report.waveRemaining, 60); assert.equal(report.waveDuration, 60);
  assert.equal(report.time, 0); assert.equal(report.kills, 0);
});
