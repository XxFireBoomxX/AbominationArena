import test from 'node:test';
import assert from 'node:assert/strict';
import { WIDTH, HEIGHT, SPAWN_MARGIN, SECTOR_SIZE, cameraFor, screenToWorld, spawnPosition, sectorAt, visibleSectors, inView } from '../src/world.js';

test('the player projects to the center and screen-to-world conversion follows travel', () => {
  for (const player of [{ x: 0, y: 0 }, { x: -100000, y: 90000 }]) {
    const camera = cameraFor(player);
    assert.equal(player.x - camera.x, WIDTH / 2);
    assert.equal(player.y - camera.y, HEIGHT / 2);
    assert.deepEqual(screenToWorld({ x: WIDTH / 2, y: HEIGHT / 2 }, camera), player);
  }
});

test('all four spawn edges stay beyond the camera with a safe margin', () => {
  const player = { x: -5000, y: 7500 }, camera = cameraFor(player);
  for (let side = 0; side < 4; side++) {
    const values = [(side + .5) / 4, .5];
    const position = spawnPosition(player, () => values.shift());
    assert.equal(inView(position, camera, SPAWN_MARGIN - 1), false);
    assert.equal(inView(position, camera, SPAWN_MARGIN), true);
  }
});

test('only a bounded number of sectors is generated, even after long journeys', () => {
  for (const player of [{ x: 0, y: 0 }, { x: 10000000, y: -10000000 }, { x: -.1, y: -.1 }]) {
    const camera = cameraFor(player), sectors = [...visibleSectors(camera)];
    assert.ok(sectors.length >= 6 && sectors.length <= 9);
    for (const point of [{ x: camera.x, y: camera.y }, { x: camera.x + WIDTH - 1, y: camera.y + HEIGHT - 1 }]) {
      assert.ok(sectors.some(s => point.x >= s.x && point.x < s.x + SECTOR_SIZE && point.y >= s.y && point.y < s.y + SECTOR_SIZE));
    }
  }
});

test('negative sectors use floor coordinates and revisiting restores identical decoration', () => {
  const sectors = [...visibleSectors({ x: -1, y: -1 })];
  assert.ok(sectors.some(s => s.column === -1 && s.row === -1));
  const before = sectorAt(-2, 3);
  [...visibleSectors({ x: 20000, y: -20000 })];
  assert.deepEqual(sectorAt(-2, 3), before);
  assert.ok(new Set([...visibleSectors({ x: -640, y: -640 })].map(s => s.variant)).size > 1);
});
