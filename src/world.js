// These are viewport dimensions, not world boundaries.
export const WIDTH = 1280;
export const HEIGHT = 720;
export const SECTOR_SIZE = 640;
export const SPAWN_MARGIN = 80;

export function cameraFor(player) {
  return { x: player.x - WIDTH / 2, y: player.y - HEIGHT / 2 };
}

export function screenToWorld(point, camera) {
  return { x: point.x + camera.x, y: point.y + camera.y };
}

export function inView(point, camera, margin = 0) {
  return point.x >= camera.x - margin && point.x <= camera.x + WIDTH + margin
    && point.y >= camera.y - margin && point.y <= camera.y + HEIGHT + margin;
}

export function spawnPosition(player, random = Math.random) {
  const camera = cameraFor(player);
  const side = Math.floor(random() * 4);
  if (side < 2) return {
    x: camera.x + (side === 0 ? -SPAWN_MARGIN : WIDTH + SPAWN_MARGIN),
    y: camera.y + random() * HEIGHT
  };
  return {
    x: camera.x + random() * WIDTH,
    y: camera.y + (side === 2 ? -SPAWN_MARGIN : HEIGHT + SPAWN_MARGIN)
  };
}

// Sector appearance depends only on coordinates, never the combat RNG.
export function sectorAt(column, row) {
  const hash = (Math.imul(column, 73856093) ^ Math.imul(row, 19349663) ^ 83492791) >>> 0;
  return {
    column, row, x: column * SECTOR_SIZE, y: row * SECTOR_SIZE,
    variant: hash % 3,
    ventX: 72 + hash % 180,
    ventY: 72 + (hash >>> 8) % 180
  };
}

export function* visibleSectors(camera) {
  const left = Math.floor(camera.x / SECTOR_SIZE);
  const top = Math.floor(camera.y / SECTOR_SIZE);
  const right = Math.floor((camera.x + WIDTH) / SECTOR_SIZE);
  const bottom = Math.floor((camera.y + HEIGHT) / SECTOR_SIZE);
  for (let row = top; row <= bottom; row++) {
    for (let column = left; column <= right; column++) yield sectorAt(column, row);
  }
}
