import { WIDTH, spawnPosition } from './world.js';
import { WEAPONS, WEAPON_IDS } from './weapons.js';
import { createEnemy, enemyTypeFor, ENEMIES, ENEMY_IDS } from './enemies.js';
export { WIDTH, HEIGHT } from './world.js';
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segmentDistance = (point, x, y, endX, endY) => {
  const dx = endX - x, dy = endY - y, lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? clamp(((point.x - x) * dx + (point.y - y) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(point.x - x - t * dx, point.y - y - t * dy);
};
export class Arena {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
    this.state = 'ready';
  }
  reset() {
    this.player = { x: 0, y: 0, radius: 17, hp: 100, maxHp: 100, angle: 0, invulnerable: 0, dashCooldown: 0, dashTime: 0, dashX: 1, dashY: 0, slowed: false };
    this.enemies = [];
    this.bullets = [];
    this.hostileBullets = [];
    this.zones = [];
    this.particles = [];
    this.events = [];
    this.wave = 1;
    this.score = 0;
    this.kills = 0;
    this.time = 0;
    this.weaponId = 'rifle';
    this.powerLevel = 0;
    this.speedLevel = 0;
    this.shotTimer = 0;
    this.muzzleTime = 0;
    this.spawnTimer = .7;
    this.spawned = 0;
    this.waveKills = 0;
    this.target = 8;
    this.stats = {
      shots: 0, projectiles: 0, hits: 0, damageDealt: 0, damageTaken: 0, healing: 0, dashes: 0,
      upgrades: { power: 0, speed: 0, health: 0 }, lastHit: null,
      killsByType: Object.fromEntries(ENEMY_IDS.map(id => [id, 0])),
      weapons: Object.fromEntries(WEAPON_IDS.map(id => [id, { shots: 0, projectiles: 0, hits: 0, damage: 0, kills: 0 }]))
    };
    this.state = 'playing';
  }
  getRunReport() {
    const accuracy = stats => stats.projectiles ? stats.hits / stats.projectiles * 100 : 0;
    // Return independent data so a report remains intact after the next reset.
    return {
      score: this.score, wave: this.wave, completedWaves: this.wave - 1, time: this.time, kills: this.kills,
      maxHp: this.player.maxHp, shots: this.stats.shots, projectiles: this.stats.projectiles,
      hits: this.stats.hits, accuracy: accuracy(this.stats), damageDealt: this.stats.damageDealt,
      damageTaken: this.stats.damageTaken, healing: this.stats.healing, dashes: this.stats.dashes,
      upgrades: { ...this.stats.upgrades }, killsByType: { ...this.stats.killsByType },
      deathCause: this.player.hp <= 0 && this.stats.lastHit ? { ...this.stats.lastHit } : null,
      weapons: Object.fromEntries(WEAPON_IDS.map(id => [id, { ...this.stats.weapons[id], accuracy: accuracy(this.stats.weapons[id]) }]))
    };
  }
  get weapon() { return WEAPONS[this.weaponId]; }
  get damage() { return this.weapon.damage * (1 + this.powerLevel * .4); }
  get fireInterval() { return Math.max(this.weapon.minInterval, this.weapon.interval * .82 ** this.speedLevel); }
  selectWeapon(id) {
    if (this.state !== 'playing' || !Object.hasOwn(WEAPONS, id) || id === this.weaponId) return false;
    this.weaponId = id;
    // Switching preserves recovery from the last shot; it cannot bypass fire rate.
    this.shotTimer = Math.max(this.shotTimer, .12);
    this.muzzleTime = 0;
    this.events.push({ type: 'equip', weaponId: id });
    return true;
  }
  upgrade(type) {
    if (this.state !== 'upgrade' || !['power', 'speed', 'health'].includes(type)) return;
    if (type === 'power') this.powerLevel++;
    if (type === 'speed') this.speedLevel++;
    if (type === 'health') this.player.maxHp += 20;
    this.stats.upgrades[type]++;
    const beforeHp = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
    this.stats.healing += this.player.hp - beforeHp;
    this.wave++;
    this.target = 8 + (this.wave - 1) * 4;
    this.waveKills = 0;
    this.spawned = 0;
    this.spawnTimer = 1;
    this.bullets = [];
    this.hostileBullets = [];
    this.zones = [];
    this.state = 'playing';
    this.events.push({ type: 'wave' });
  }
  burst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const speed = 40 + this.random() * 170;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + this.random() * .3, maxLife: .65, color, size: 2 + this.random() * 3 });
    }
  }
  spawnEnemy() {
    const { x, y } = spawnPosition(this.player, this.random);
    const type = enemyTypeFor(this.wave, this.random());
    const enemy = createEnemy(type, this.wave, x, y, this.random() * Math.PI * 2);
    this.enemies.push(enemy);
    this.burst(x, y, enemy.color, 9);
    this.spawned++;
  }
  hurtPlayer(damage, source = null) {
    const p = this.player;
    if (p.invulnerable > 0 || p.hp <= 0) return false;
    const lostHp = Math.min(p.hp, damage);
    p.hp -= lostHp;
    this.stats.damageTaken += lostHp;
    this.stats.lastHit = source ? { ...source } : null;
    p.invulnerable = .8;
    this.burst(p.x, p.y, '#ff6788', 18);
    this.events.push({ type: 'hurt' });
    return true;
  }
  stepEnemy(enemy, dt) {
    const p = this.player;
    if (enemy.hp <= 0) return;
    // Relocation cancels a prepared attack; its old aim belongs to another sector.
    if (distance(p, enemy) > WIDTH * 2) {
      Object.assign(enemy, spawnPosition(p, this.random));
      enemy.attack = null; enemy.cooldown = 1;
      this.burst(enemy.x, enemy.y, enemy.color, 9);
    }
    const dx = p.x - enemy.x, dy = p.y - enemy.y, d = Math.hypot(dx, dy) || 1;
    const prevX = enemy.x, prevY = enemy.y;
    const ability = ENEMIES[enemy.type]?.ability;
    let charging = false;
    enemy.hit = Math.max(0, enemy.hit - dt);
    enemy.cooldown = Math.max(0, (enemy.cooldown ?? 1) - dt);
    if (enemy.attack) {
      const attack = enemy.attack;
      if (attack.stage === 'active') {
        const travel = Math.min(dt, attack.remaining);
        enemy.x += attack.dx * ability.speed * travel;
        enemy.y += attack.dy * ability.speed * travel;
        charging = true;
      }
      attack.remaining -= dt;
      if (attack.remaining <= 0) {
        if (attack.stage === 'windup') {
          if (enemy.type === 'hexer') {
            this.hostileBullets.push({ x: enemy.x + attack.dx * 28, y: enemy.y + attack.dy * 28,
              vx: attack.dx * ability.speed, vy: attack.dy * ability.speed,
              radius: ability.radius, life: ability.life, damage: ability.damage, color: enemy.color, enemyType: enemy.type });
            enemy.attack = null;
          } else if (enemy.type === 'shaman') {
            this.zones.push({ x: attack.targetX, y: attack.targetY, radius: ability.radius,
              warning: ability.warning, life: ability.duration, damage: ability.damage, slow: ability.slow, color: enemy.color, enemyType: enemy.type });
            enemy.attack = null;
          } else {
            attack.stage = 'active'; attack.remaining = ability.duration;
          }
          enemy.cooldown = ability.cooldown;
          this.events.push({ type: 'enemy-attack', enemyType: enemy.type });
        } else if (attack.stage === 'active') {
          attack.stage = 'recovery'; attack.remaining = ability.recovery;
        } else enemy.attack = null;
      }
    } else {
      // Casters hold a firing distance; close-range enemies keep chasing.
      const caster = enemy.type === 'hexer' || enemy.type === 'shaman';
      const direction = caster ? (d > 350 ? 1 : d < 220 ? -1 : 0) : 1;
      enemy.x += dx / d * enemy.speed * direction * dt;
      enemy.y += dy / d * enemy.speed * direction * dt;
      if (ability && enemy.cooldown === 0 && d <= ability.range && (enemy.type !== 'charger' || d >= 90)) {
        enemy.attack = { stage: 'windup', remaining: ability.windup, total: ability.windup,
          dx: dx / d, dy: dy / d, targetX: p.x, targetY: p.y };
      }
    }
    const touching = charging ? segmentDistance(p, prevX, prevY, enemy.x, enemy.y) < p.radius + enemy.radius : distance(p, enemy) < p.radius + enemy.radius;
    if (touching && this.hurtPlayer(charging ? ability.damage : enemy.type === 'tank' ? 22 : 12, { enemyType: enemy.type, attack: charging ? 'rush' : 'contact' }) && !charging) {
      enemy.x -= dx / d * 32; enemy.y -= dy / d * 32;
    }
  }
  step(dt, input = {}) {
    if (this.state !== 'playing') return;
    dt = clamp(dt, 0, .05);
    this.time += dt;
    const p = this.player;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    for (const zone of this.zones) {
      const warningTime = Math.min(dt, zone.warning);
      zone.warning = Math.max(0, zone.warning - dt);
      zone.life -= dt - warningTime;
    }
    this.zones = this.zones.filter(zone => zone.life > 0 && distance(p, zone) <= WIDTH * 2);
    let movementScale = 1;
    for (const zone of this.zones) {
      if (zone.warning === 0 && distance(p, zone) < p.radius + zone.radius) movementScale = Math.min(movementScale, zone.slow);
    }
    p.slowed = movementScale < 1;
    let mx = input.moveX || 0, my = input.moveY || 0;
    const length = Math.hypot(mx, my);
    if (length > 1) { mx /= length; my /= length; }
    if (Number.isFinite(input.aimX) && Number.isFinite(input.aimY)) p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (input.dash && p.dashCooldown === 0) {
      this.stats.dashes++;
      p.dashCooldown = 2.8;
      p.dashTime = .18;
      p.invulnerable = Math.max(p.invulnerable, .3);
      p.dashX = length > 0 ? mx / Math.hypot(mx, my) : Math.cos(p.angle);
      p.dashY = length > 0 ? my / Math.hypot(mx, my) : Math.sin(p.angle);
      this.events.push({ type: 'dash' });
    }
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.dashX * 850 * dt;
      p.y += p.dashY * 850 * dt;
      this.burst(p.x, p.y, '#a1f5ca', 2);
    } else {
      const speed = 250 * movementScale;
      p.x += mx * speed * dt; p.y += my * speed * dt;
    }
    this.shotTimer = Math.max(0, this.shotTimer - dt);
    this.muzzleTime = Math.max(0, this.muzzleTime - dt);
    if (input.fire && this.shotTimer === 0) {
      const weapon = this.weapon;
      this.stats.shots++; this.stats.projectiles += weapon.pellets;
      this.stats.weapons[weapon.id].shots++;
      this.stats.weapons[weapon.id].projectiles += weapon.pellets;
      for (let i = 0; i < weapon.pellets; i++) {
        const offset = weapon.pellets > 1 ? (i / (weapon.pellets - 1) - .5) * weapon.spread : weapon.spread ? (this.random() - .5) * weapon.spread : 0;
        const angle = p.angle + offset, dx = Math.cos(angle), dy = Math.sin(angle);
        this.bullets.push({ x: p.x + dx * 25, y: p.y + dy * 25, vx: dx * weapon.speed, vy: dy * weapon.speed, life: weapon.life, damage: this.damage, radius: weapon.radius, color: weapon.color, weaponId: weapon.id });
      }
      this.shotTimer = this.fireInterval;
      this.muzzleTime = .06;
      this.events.push({ type: 'shot', weaponId: weapon.id });
    }
    this.spawnTimer -= dt;
    if (this.spawned < this.target && this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = Math.max(.25, .95 - this.wave * .055);
    }
    for (const enemy of this.enemies) this.stepEnemy(enemy, dt);
    for (const bullet of this.bullets) {
      const travelTime = Math.min(dt, bullet.life);
      const prevX = bullet.x, prevY = bullet.y;
      bullet.x += bullet.vx * travelTime;
      bullet.y += bullet.vy * travelTime;
      bullet.life -= dt;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        // Segment collision prevents fast bullets passing through small enemies.
        const hitDistance = segmentDistance(enemy, prevX, prevY, bullet.x, bullet.y);
        if (hitDistance < enemy.radius + bullet.radius) {
          const dealt = Math.min(enemy.hp, bullet.damage);
          this.stats.hits++; this.stats.damageDealt += dealt;
          const weaponStats = this.stats.weapons[bullet.weaponId];
          if (weaponStats) { weaponStats.hits++; weaponStats.damage += dealt; }
          enemy.hp -= bullet.damage;
          enemy.hit = .1;
          bullet.life = 0;
          this.burst(bullet.x, bullet.y, enemy.color, 5);
          if (enemy.hp <= 0) {
            this.kills++;
            this.stats.killsByType[enemy.type]++;
            if (weaponStats) weaponStats.kills++;
            this.waveKills++;
            this.score += enemy.points;
            this.burst(enemy.x, enemy.y, enemy.color, 16);
            this.events.push({ type: 'kill' });
          }
          break;
        }
      }
    }
    this.enemies = this.enemies.filter(e => e.hp > 0);
    this.bullets = this.bullets.filter(b => b.life > 0);
    for (const bullet of this.hostileBullets) {
      const travelTime = Math.min(dt, bullet.life), prevX = bullet.x, prevY = bullet.y;
      bullet.x += bullet.vx * travelTime; bullet.y += bullet.vy * travelTime;
      bullet.life -= dt;
      if (segmentDistance(p, prevX, prevY, bullet.x, bullet.y) < p.radius + bullet.radius) {
        this.hurtPlayer(bullet.damage, { enemyType: bullet.enemyType || 'hexer', attack: 'bolt' }); bullet.life = 0;
      }
    }
    this.hostileBullets = this.hostileBullets.filter(b => b.life > 0 && distance(p, b) <= WIDTH * 2);
    for (const zone of this.zones) {
      if (zone.warning === 0 && distance(p, zone) < p.radius + zone.radius) this.hurtPlayer(zone.damage, { enemyType: zone.enemyType || 'shaman', attack: 'curse' });
    }
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
      particle.vx *= .97;
      particle.vy *= .97;
    }
    this.particles = this.particles.filter(particle => particle.life > 0).slice(-450);
    if (p.hp <= 0) { this.state = 'gameover'; this.events.push({ type: 'gameover' }); }
    else if (this.waveKills >= this.target && this.enemies.length === 0) {
      this.state = 'upgrade';
      this.hostileBullets = []; this.zones = []; p.slowed = false;
      this.score += this.wave * 500;
      this.events.push({ type: 'upgrade' });
    }
  }
}
