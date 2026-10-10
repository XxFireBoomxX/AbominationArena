import { WIDTH, spawnPosition } from './world.js';
import { WEAPONS } from './weapons.js';
export { WIDTH, HEIGHT } from './world.js';
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export class Arena {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
    this.state = 'ready';
  }
  reset() {
    this.player = { x: 0, y: 0, radius: 17, hp: 100, maxHp: 100, angle: 0, invulnerable: 0, dashCooldown: 0, dashTime: 0, dashX: 1, dashY: 0 };
    this.enemies = [];
    this.bullets = [];
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
    this.state = 'playing';
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
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
    this.wave++;
    this.target = 8 + (this.wave - 1) * 4;
    this.waveKills = 0;
    this.spawned = 0;
    this.spawnTimer = 1;
    this.bullets = [];
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
    const roll = this.random();
    const type = this.wave >= 3 && roll < .25 ? 'tank' : this.wave >= 2 && roll < .55 ? 'runner' : 'crawler';
    const stats = { crawler: { hp: 45, speed: 80, radius: 19, color: '#f27899', points: 100 }, runner: { hp: 30, speed: 145, radius: 14, color: '#b294f9', points: 150 }, tank: { hp: 120, speed: 55, radius: 29, color: '#f1ba77', points: 250 } }[type];
    const hp = stats.hp + (this.wave - 1) * 7;
    this.enemies.push({ ...stats, hp, maxHp: hp, type, x, y, phase: this.random() * Math.PI * 2, hit: 0, speed: stats.speed + Math.min(80, (this.wave - 1) * 5) });
    this.burst(x, y, stats.color, 9);
    this.spawned++;
  }
  step(dt, input = {}) {
    if (this.state !== 'playing') return;
    dt = clamp(dt, 0, .05);
    this.time += dt;
    const p = this.player;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    let mx = input.moveX || 0, my = input.moveY || 0;
    const length = Math.hypot(mx, my);
    if (length > 1) { mx /= length; my /= length; }
    if (Number.isFinite(input.aimX) && Number.isFinite(input.aimY)) p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (input.dash && p.dashCooldown === 0) {
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
    } else { p.x += mx * 250 * dt; p.y += my * 250 * dt; }
    this.shotTimer = Math.max(0, this.shotTimer - dt);
    this.muzzleTime = Math.max(0, this.muzzleTime - dt);
    if (input.fire && this.shotTimer === 0) {
      const weapon = this.weapon;
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
    for (const enemy of this.enemies) {
      // Reuse distant pursuers, preserving their health and wave membership.
      // This keeps an unfinished wave reachable after a long journey.
      if (distance(p, enemy) > WIDTH * 2) {
        Object.assign(enemy, spawnPosition(p, this.random));
        this.burst(enemy.x, enemy.y, enemy.color, 9);
      }
      const dx = p.x - enemy.x, dy = p.y - enemy.y, d = Math.hypot(dx, dy) || 1;
      enemy.x += dx / d * enemy.speed * dt;
      enemy.y += dy / d * enemy.speed * dt;
      enemy.hit = Math.max(0, enemy.hit - dt);
      if (distance(p, enemy) < p.radius + enemy.radius && p.invulnerable === 0) {
        p.hp = Math.max(0, p.hp - (enemy.type === 'tank' ? 22 : 12));
        p.invulnerable = .8;
        this.burst(p.x, p.y, '#ff6788', 18);
        this.events.push({ type: 'hurt' });
        enemy.x -= dx / d * 32;
        enemy.y -= dy / d * 32;
      }
    }
    for (const bullet of this.bullets) {
      const travelTime = Math.min(dt, bullet.life);
      const prevX = bullet.x, prevY = bullet.y;
      bullet.x += bullet.vx * travelTime;
      bullet.y += bullet.vy * travelTime;
      bullet.life -= dt;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        // Segment collision prevents fast bullets passing through small enemies.
        const segX = bullet.x - prevX, segY = bullet.y - prevY;
        const denom = segX * segX + segY * segY;
        const t = denom ? clamp(((enemy.x - prevX) * segX + (enemy.y - prevY) * segY) / denom, 0, 1) : 0;
        const hitDistance = Math.hypot(enemy.x - (prevX + t * segX), enemy.y - (prevY + t * segY));
        if (hitDistance < enemy.radius + bullet.radius) {
          enemy.hp -= bullet.damage;
          enemy.hit = .1;
          bullet.life = 0;
          this.burst(bullet.x, bullet.y, enemy.color, 5);
          if (enemy.hp <= 0) {
            this.kills++;
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
      this.score += this.wave * 500;
      this.events.push({ type: 'upgrade' });
    }
  }
}
