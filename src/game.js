import { Arena, WIDTH, HEIGHT } from './engine.js';
import { cameraFor, screenToWorld, inView, visibleSectors, SECTOR_SIZE } from './world.js';
import { WEAPONS, WEAPON_IDS } from './weapons.js';
import { ENEMIES, ENEMY_IDS } from './enemies.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const game = new Arena();
const keys = new Set();
const pointer = { x: WIDTH * .7, y: HEIGHT * .5, down: false };
const touch = { x: 0, y: 0, active: false, enabled: matchMedia('(pointer:coarse)').matches };
let dash = false, lastTime = 0, previousState = '', toastTimer, audio, sound = false;
let weaponHUDKey = '';
let best = 0;
try { best = Number(localStorage.getItem('abomination-record')) || 0; } catch { /* Storage may be unavailable in private mode. */ }
const padded = n => String(n).padStart(6, '0');
const timeLabel = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
$('record').textContent = padded(best);
for (const id of ENEMY_IDS) {
  const enemy = ENEMIES[id], entry = document.createElement('article');
  entry.className = 'enemy-entry'; entry.style.setProperty('--enemy-color', enemy.color);
  entry.innerHTML = `<span class="enemy-symbol" aria-hidden="true">${{ crawler: '✦', runner: '»', tank: '⬡', hexer: '◇', charger: '↠', shaman: '◎' }[id]}</span><div><strong>${enemy.name}<small>ВЪЛНА ${enemy.wave}+</small></strong><p>${enemy.description}</p></div>`;
  $('bestiary').append(entry);
}
function waveToast() {
  const newcomer = ENEMY_IDS.find(id => ENEMIES[id].wave === game.wave);
  toast('ВЪЛНА ' + String(game.wave).padStart(2, '0') + (game.wave > 1 && newcomer ? ' · ' + ENEMIES[newcomer].name.toUpperCase() : ''));
}

const weaponShapes = {
  rifle: 'M3 8h9l3-3h10v3h12M12 8v6h6l3-6M26 5v6M3 8v5h6',
  smg: 'M5 8h9l3-3h11v4h7M14 8v7h6V8M6 8v5h5M25 5v6',
  shotgun: 'M2 12l9-5h14v3H12l-4 6H3zM25 7h13M25 10h13'
};
for (const id of WEAPON_IDS) {
  const weapon = WEAPONS[id], button = document.createElement('button');
  button.type = 'button'; button.className = 'weapon-button'; button.dataset.weapon = id;
  button.style.setProperty('--weapon-color', weapon.color);
  button.setAttribute('aria-label', `${weapon.name}, клавиш ${weapon.key}. ${weapon.description}`);
  button.innerHTML = `<kbd>${weapon.key}</kbd><svg viewBox="0 0 40 20" aria-hidden="true"><path d="${weaponShapes[id]}"/></svg><span>${weapon.name}</span>`;
  // Multi-touch browsers may suppress click while another finger holds the joystick.
  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') { event.preventDefault(); equipWeapon(id); }
  });
  button.addEventListener('click', () => equipWeapon(id));
  $('weapons').append(button);
}
function equipWeapon(id) {
  if (game.selectWeapon(id)) {
    canvas.focus({ preventScroll: true });
    updateWeaponHUD();
  }
}
function updateWeaponHUD() {
  const key = `${game.weaponId}:${game.state}:${game.powerLevel}:${game.speedLevel}`;
  if (key === weaponHUDKey) return;
  weaponHUDKey = key;
  document.querySelectorAll('[data-weapon]').forEach(button => {
    const selected = button.dataset.weapon === game.weaponId;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = game.state !== 'playing';
  });
  const damage = Number(game.damage.toFixed(1));
  $('weapon-description').textContent = game.weapon.description;
  $('weapon-stats').textContent = `${game.weapon.pellets > 1 ? game.weapon.pellets + ' × ' : ''}${damage} щети · ${(1 / game.fireInterval).toFixed(1)} / сек`;
}

function tone(frequency, duration, type = 'sine', volume = .035) {
  if (!sound || !audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * .45), audio.currentTime + duration);
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
  oscillator.connect(gain); gain.connect(audio.destination);
  oscillator.start(); oscillator.stop(audio.currentTime + duration);
}
$('sound').addEventListener('click', () => {
  if (!audio) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio = new Audio();
  }
  audio.resume().catch(() => {});
  sound = !sound;
  $('sound-label').textContent = sound ? 'ON' : 'OFF';
  $('sound').setAttribute('aria-label', sound ? 'Изключи звука' : 'Включи звука');
  $('sound').setAttribute('aria-pressed', String(sound));
  tone(600, .1);
});

function toast(text) {
  clearTimeout(toastTimer);
  $('wave-toast').textContent = text;
  $('wave-toast').classList.add('show');
  toastTimer = setTimeout(() => $('wave-toast').classList.remove('show'), 1900);
}
function clearInput() { keys.clear(); pointer.down = false; touch.x = 0; touch.y = 0; touch.active = false; dash = false; $('joystick').firstElementChild.style.transform = ''; }
function start() {
  clearInput();
  game.reset();
  previousState = '';
  syncOverlay();
  waveToast();
}
function pause() {
  if (!['playing', 'paused'].includes(game.state)) return;
  game.state = game.state === 'playing' ? 'paused' : 'playing';
  clearInput();
  syncOverlay();
}
$('pause').addEventListener('click', pause);
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  const nativeControl = event.target.closest('button, summary, a');
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && !nativeControl) event.preventDefault();
  if (['p', 'escape'].includes(key) && !event.repeat) pause();
  if (['1', '2', '3'].includes(key) && !event.repeat) equipWeapon(WEAPON_IDS[Number(key) - 1]);
  if (key === ' ' && !event.repeat && !nativeControl) dash = true;
  keys.add(key);
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { if (game.state === 'playing') pause(); clearInput(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing') pause(); });
function point(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) / rect.width * WIDTH;
  pointer.y = (event.clientY - rect.top) / rect.height * HEIGHT;
}
canvas.addEventListener('pointermove', point);
canvas.addEventListener('pointerdown', event => { point(event); if (event.button !== 0) return; pointer.down = true; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointerup', () => { pointer.down = false; });
canvas.addEventListener('pointercancel', () => { pointer.down = false; });
canvas.addEventListener('contextmenu', event => event.preventDefault());
let joystickPointer = null;
function moveJoystick(event) {
  if (joystickPointer !== event.pointerId) return;
  const rect = $('joystick').getBoundingClientRect();
  const dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
  const length = Math.hypot(dx, dy), scale = Math.min(1, 32 / Math.max(1, length));
  touch.x = dx * scale / 32; touch.y = dy * scale / 32;
  $('joystick').firstElementChild.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
}
$('joystick').addEventListener('pointerdown', event => {
  if (game.state !== 'playing') return;
  joystickPointer = event.pointerId; touch.active = true; touch.enabled = true;
  $('joystick').setPointerCapture(event.pointerId); moveJoystick(event);
});
$('joystick').addEventListener('pointermove', moveJoystick);
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) $('joystick').addEventListener(eventName, () => { joystickPointer = null; touch.active = false; touch.x = 0; touch.y = 0; $('joystick').firstElementChild.style.transform = ''; });
$('touch-dash').addEventListener('pointerdown', event => { event.preventDefault(); dash = true; });

function syncOverlay() {
  if (previousState === game.state) return;
  previousState = game.state;
  const overlay = $('overlay'), content = $('overlay-content');
  overlay.classList.toggle('hidden', game.state === 'playing');
  $('pause').disabled = !['playing', 'paused'].includes(game.state);
  $('pause').innerHTML = game.state === 'paused' ? '▷ <span>Продължи</span>' : 'Ⅱ <span>Пауза</span>';
  $('status').textContent = { ready: 'В ГОТОВНОСТ', playing: 'БИТКАТА Е В ХОД', paused: 'ПАУЗА', upgrade: 'ВЪЛНАТА Е ПРЕМИНАТА', gameover: 'СИГНАЛЪТ Е ЗАГУБЕН' }[game.state];
  updateWeaponHUD();
  if (game.state === 'playing') canvas.focus({ preventScroll: true });
  if (game.state === 'ready') {
    content.innerHTML = '<div class="overlay-badge">SURVIVAL PROTOCOL / 01</div><h2>ABOMINATION<br><span>ARENA</span></h2><p>Влез в арената. Надживей чудовищата.<br>Стани по-силен с всяка премината вълна.</p><button class="primary-button" id="start">ВЛЕЗ В АРЕНАТА <span>↗</span></button><div class="overlay-note">' + (touch.enabled ? 'ПЛЪЗНИ ЗА ДВИЖЕНИЕ · АВТОМАТИЧНА СТРЕЛБА' : 'WASD ЗА ДВИЖЕНИЕ · ЗАДРЪЖ ЛЯВ БУТОН ЗА СТРЕЛБА') + '</div>';
    $('start').addEventListener('click', start);
  } else if (game.state === 'paused') {
    content.innerHTML = '<div class="overlay-badge">ПРОТОКОЛЪТ Е ЗАДЪРЖАН</div><h2>Поеми <span>въздух.</span></h2><p>Арената ще те изчака.</p><button class="primary-button" id="resume">ПРОДЪЛЖИ <span>→</span></button>';
    $('resume').addEventListener('click', pause);
  } else if (game.state === 'upgrade') {
    content.innerHTML = '<div class="overlay-badge">ВЪЛНА ' + game.wave + ' / ПРЕМИНАТА</div><h2>Адаптирай се. <span>Оцелей.</span></h2><p>Избери подобрение. Всеки избор възстановява 35 живот.</p><div class="upgrade-options"><button class="upgrade" data-upgrade="power"><strong>⌁</strong>Повече сила<small>+40% от базовите щети<br>за всички оръжия</small></button><button class="upgrade" data-upgrade="speed"><strong>»</strong>Бърза стрелба<small>18% по-кратко време<br>между изстрелите</small></button><button class="upgrade" data-upgrade="health"><strong>✚</strong>По-здрава броня<small>+20 максимален<br>живот</small></button></div>';
    content.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => { game.upgrade(button.dataset.upgrade); clearInput(); syncOverlay(); waveToast(); }));
  } else if (game.state === 'gameover') {
    const newRecord = game.score > best;
    if (newRecord) {
      best = game.score;
      try { localStorage.setItem('abomination-record', String(best)); } catch { /* The current session still retains the record. */ }
      $('record').textContent = padded(best);
    }
    content.innerHTML = '<div class="overlay-badge">' + (newRecord ? 'НОВ ЛИЧЕН РЕКОРД' : 'ПРОТОКОЛЪТ ПРИКЛЮЧИ') + '</div><h2>До следващия <span>път.</span></h2><p>' + game.score.toLocaleString('bg-BG') + ' точки · ' + game.kills + ' победени · ' + timeLabel(game.time) + '<br>Достигна вълна ' + game.wave + '.</p><button class="primary-button" id="restart">ОПИТАЙ ОТНОВО <span>↻</span></button>';
    $('restart').addEventListener('click', start);
  }
  if (game.state !== 'playing') content.querySelector('button')?.focus({ preventScroll: true });
}

function updateHUD() {
  updateWeaponHUD();
  const p = game.player;
  $('wave').textContent = String(game.wave).padStart(2, '0');
  $('threat').textContent = game.wave < 3 ? 'НИСЪК' : game.wave < 6 ? 'ВИСОК' : 'КРИТИЧЕН';
  $('wave-progress').style.width = `${game.waveKills / game.target * 100}%`;
  $('wave-detail').textContent = `${game.waveKills} / ${game.target} победени чудовища`;
  $('health-number').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('health').style.width = `${p.hp / p.maxHp * 100}%`;
  $('health').style.background = p.hp < 30 ? '#ff6788' : '#a1f5ca';
  $('dash-status').textContent = p.dashCooldown > 0 ? p.dashCooldown.toFixed(1) + ' СЕК' : 'ГОТОВ';
  $('score').textContent = padded(game.score);
  $('kills').textContent = game.kills;
  $('time').textContent = timeLabel(game.time);
  $('footer-status').textContent = game.state === 'playing' ? `X ${Math.round(p.x)} · Y ${Math.round(p.y)}` : game.state === 'gameover' ? 'Връзката е прекъсната' : 'Системата е готова';
  $('sector').textContent = `SECTOR ${Math.floor(p.x / SECTOR_SIZE)} : ${Math.floor(p.y / SECTOR_SIZE)}`;
}

function circle(x, y, r, fill, stroke) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function drawBackground(t, camera) {
  ctx.fillStyle = '#101b22'; ctx.fillRect(camera.x, camera.y, WIDTH, HEIGHT);
  const light = ctx.createRadialGradient(game.player.x, game.player.y, 0, game.player.x, game.player.y, WIDTH * .65);
  light.addColorStop(0, '#1c343230'); light.addColorStop(1, '#020a1170');
  ctx.fillStyle = light; ctx.fillRect(camera.x, camera.y, WIDTH, HEIGHT);
  ctx.lineWidth = 1; ctx.strokeStyle = '#8cc3b308';
  ctx.beginPath();
  for (let x = Math.floor(camera.x / 40) * 40; x <= camera.x + WIDTH; x += 40) { ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + HEIGHT); }
  for (let y = Math.floor(camera.y / 40) * 40; y <= camera.y + HEIGHT; y += 40) { ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + WIDTH, y); }
  ctx.stroke();
  for (const sector of visibleSectors(camera)) {
    const { x, y, variant, ventX, ventY, column, row } = sector;
    ctx.strokeStyle = '#55826f25'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 16, y + 16, SECTOR_SIZE - 32, SECTOR_SIZE - 32);
    ctx.strokeStyle = '#a1f5ca35'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 65, y + 16); ctx.lineTo(x + 16, y + 16); ctx.lineTo(x + 16, y + 65); ctx.stroke();
    if (variant === 0) {
      circle(x + 320, y + 320, 130, null, '#6ab39d18');
      ctx.setLineDash([6, 16]); circle(x + 320, y + 320, 158, null, '#6ab39d12'); ctx.setLineDash([]);
    } else if (variant === 1) {
      ctx.strokeStyle = '#6ab39d12'; ctx.strokeRect(x + 245, y + 245, 150, 150);
      ctx.beginPath(); ctx.moveTo(x + 245, y + 245); ctx.lineTo(x + 395, y + 395); ctx.moveTo(x + 395, y + 245); ctx.lineTo(x + 245, y + 395); ctx.stroke();
    } else {
      ctx.strokeStyle = '#6ab39d12'; ctx.beginPath();
      for (let i = 0; i < 6; i++) { ctx.moveTo(x + 260, y + 260 + i * 24); ctx.lineTo(x + 380, y + 260 + i * 24); }
      ctx.stroke();
    }
    ctx.fillStyle = '#aacabd25'; ctx.font = '10px monospace';
    ctx.fillText(`SECTOR ${column} : ${row} / CONTAINMENT ZONE`, x + 35, y + SECTOR_SIZE - 35);
    const vx = x + ventX, vy = y + ventY;
    ctx.fillStyle = '#0b141b'; ctx.fillRect(vx, vy, 45, 40); ctx.strokeStyle = '#2d4149'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(vx + 8, vy + 7 + i * 6); ctx.lineTo(vx + 37, vy + 7 + i * 6); ctx.stroke(); }
    const moteY = y + ((t * 8 + 170 + variant * 71) % SECTOR_SIZE);
    circle(x + 160 + variant * 100, moteY, 1.2, '#a1f5ca22');
  }
}
function drawEnemy(e, t) {
  ctx.save(); ctx.translate(e.x, e.y);
  const angle = e.attack && e.attack.stage !== 'recovery' ? Math.atan2(e.attack.dy, e.attack.dx) : Math.atan2(game.player.y - e.y, game.player.x - e.x);
  const r = e.radius, wobble = Math.sin(t * 8 + e.phase) * 1.5;
  circle(0, 5, r * 1.1, '#03091266');
  ctx.rotate(angle);
  ctx.shadowColor = e.color; ctx.shadowBlur = e.hit > 0 ? 25 : 8;
  ctx.fillStyle = e.hit > 0 ? '#fff' : e.color;
  ctx.beginPath();
  const vertices = e.type === 'hexer' ? 8 : e.type === 'shaman' ? 16 : e.type === 'charger' ? 6 : 12;
  for (let i = 0; i < vertices; i++) {
    const a = i / vertices * Math.PI * 2, radius = r + (i % 2 === 0 ? (e.type === 'hexer' ? 10 : 4) : -1) + wobble;
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  circle(-2, 0, r * .75, { tank: '#7d4e39', runner: '#51437e', hexer: '#244d65', charger: '#70392b', shaman: '#5b6331' }[e.type] || '#793950');
  ctx.fillStyle = '#19222b'; ctx.beginPath(); ctx.moveTo(5, -r * .8); ctx.lineTo(18, -r * 1.1); ctx.lineTo(11, -5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, r * .8); ctx.lineTo(18, r * 1.1); ctx.lineTo(11, 5); ctx.fill();
  circle(7, -5, 3, '#fff7d4'); circle(7, 5, 3, '#fff7d4');
  if (e.type === 'hexer') {
    circle(-7, 0, 4, '#e3fcff', e.color);
    ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -r - 5); ctx.lineTo(-8, r + 5); ctx.stroke();
    circle(-8, -r - 5, 4, e.color);
  } else if (e.type === 'charger') {
    ctx.fillStyle = '#fff1d4';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(8, side * 13); ctx.lineTo(r + 15, side * 17); ctx.lineTo(16, side * 5); ctx.fill(); }
  } else if (e.type === 'shaman') {
    ctx.lineWidth = 2; circle(0, 0, r + 8, null, e.color);
    ctx.strokeStyle = '#f4ffc0'; ctx.strokeRect(-8, -6, 10, 12);
  }
  if (e.attack?.stage === 'windup') {
    const progress = 1 - e.attack.remaining / e.attack.total;
    ctx.strokeStyle = '#fff1d4'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r + 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
  }
  ctx.restore();
  if (e.hp < e.maxHp) {
    ctx.fillStyle = '#071019'; ctx.fillRect(e.x - r, e.y - r - 12, r * 2, 3);
    ctx.fillStyle = e.color; ctx.fillRect(e.x - r, e.y - r - 12, r * 2 * e.hp / e.maxHp, 3);
  }
}
function drawPlayer(t) {
  const p = game.player;
  ctx.save(); ctx.translate(p.x, p.y);
  circle(0, 8, 22, '#03091280');
  if (p.invulnerable > 0) circle(0, 0, 26, '#a1f5ca12', '#a1f5ca80');
  if (p.slowed) { ctx.setLineDash([4, 5]); circle(0, 0, 31, null, ENEMIES.shaman.color); ctx.setLineDash([]); }
  if (p.invulnerable > 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = .55;
  ctx.rotate(p.angle);
  ctx.shadowColor = '#a1f5ca'; ctx.shadowBlur = 16;
  circle(0, 0, 18, '#243b36', '#a1f5ca'); ctx.shadowBlur = 0;
  ctx.fillStyle = '#527869'; ctx.fillRect(-13, -18, 13, 6); ctx.fillRect(-13, 12, 13, 6);
  circle(-2, 0, 13, '#7fb79c');
  ctx.fillStyle = '#142a2b'; ctx.fillRect(0, -9, 9, 18);
  ctx.fillStyle = '#c6ffe0'; ctx.fillRect(3, -7, 4, 14);
  const weapon = game.weapon;
  ctx.fillStyle = '#111e27'; ctx.fillRect(7, -5, weapon.barrel, weapon.id === 'smg' ? 12 : 10);
  ctx.fillStyle = weapon.color; ctx.fillRect(weapon.barrel + 3, -5, 4, 10);
  if (weapon.id === 'shotgun') {
    ctx.strokeStyle = '#63836e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(weapon.barrel + 3, 0); ctx.stroke();
    ctx.fillStyle = '#73875a'; ctx.fillRect(17, -6, 9, 12);
  } else if (weapon.id === 'smg') {
    ctx.fillStyle = '#456970'; ctx.fillRect(12, 7, 8, 8);
  }
  ctx.restore();
  if (game.muzzleTime > 0 && game.state === 'playing') {
    const muzzle = weapon.barrel + 7;
    circle(p.x + Math.cos(p.angle) * muzzle, p.y + Math.sin(p.angle) * muzzle, weapon.pellets > 1 ? 11 : 6, weapon.color + '88');
  }
}
function drawZone(zone, t) {
  const warning = zone.warning > 0;
  ctx.save(); ctx.translate(zone.x, zone.y); ctx.lineWidth = 2;
  circle(0, 0, zone.radius, zone.color + (warning ? '10' : '26'), zone.color);
  if (warning) {
    ctx.setLineDash([8, 7]); circle(0, 0, zone.radius + 5, null, zone.color); ctx.setLineDash([]);
    const progress = 1 - zone.warning / ENEMIES.shaman.ability.warning;
    circle(0, 0, zone.radius * Math.max(.05, progress), null, zone.color + '80');
  } else {
    circle(0, 0, zone.radius * (.8 + Math.sin(t * 5) * .04), null, zone.color + '70');
    ctx.strokeStyle = zone.color + '70';
    for (let i = -2; i <= 2; i++) { const y = i * 22, span = Math.sqrt(zone.radius ** 2 - y ** 2); ctx.beginPath(); ctx.moveTo(-span, y); ctx.lineTo(span, y); ctx.stroke(); }
  }
  ctx.fillStyle = zone.color; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center'; ctx.fillText(warning ? '!' : '×', 0, 6);
  ctx.restore();
}
function drawAttackWarnings(camera, t) {
  for (const zone of game.zones) if (inView(zone, camera, zone.radius + 10)) drawZone(zone, t);
  for (const e of game.enemies) {
    const attack = e.attack;
    if (!attack || attack.stage !== 'windup') continue;
    if (e.type === 'shaman') {
      drawZone({ x: attack.targetX, y: attack.targetY, radius: e.ability.radius, warning: e.ability.warning, color: e.color }, t);
      continue;
    }
    const reach = e.type === 'charger' ? e.ability.speed * e.ability.duration : e.ability.range;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(attack.dy, attack.dx));
    if (e.type === 'charger') {
      ctx.fillStyle = e.color + '16'; ctx.fillRect(0, -e.radius, reach, e.radius * 2);
      ctx.strokeStyle = e.color + '90'; ctx.lineWidth = 1; ctx.setLineDash([8, 6]); ctx.strokeRect(0, -e.radius, reach, e.radius * 2);
    }
    ctx.strokeStyle = e.color + 'b0'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(e.radius + 15, 0); ctx.lineTo(reach, 0); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(reach - 12, -7); ctx.lineTo(reach, 0); ctx.lineTo(reach - 12, 7); ctx.stroke(); ctx.restore();
  }
}
function render(t) {
  const camera = cameraFor(game.player);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save(); ctx.translate(-camera.x, -camera.y);
  drawBackground(t, camera);
  drawAttackWarnings(camera, t);
  if (game.state === 'ready') {
    for (let i = 0; i < 6; i++) drawEnemy({ x: [180, 1050, 1100, 230, 900, 370][i] + camera.x, y: [170, 140, 500, 570, 600, 90][i] + camera.y, radius: 20, color: '#f27899', type: 'crawler', phase: i, hp: 45, maxHp: 45 }, t);
  }
  for (const bullet of game.bullets) {
    if (!inView(bullet, camera, 30)) continue;
    ctx.strokeStyle = bullet.color + '70'; ctx.lineWidth = bullet.radius;
    ctx.beginPath(); ctx.moveTo(bullet.x - bullet.vx * .018, bullet.y - bullet.vy * .018); ctx.lineTo(bullet.x, bullet.y); ctx.stroke();
    circle(bullet.x, bullet.y, bullet.radius * .75, bullet.color);
  }
  for (const bullet of game.hostileBullets) {
    if (!inView(bullet, camera, 40)) continue;
    ctx.strokeStyle = bullet.color + '90'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bullet.x - bullet.vx * .07, bullet.y - bullet.vy * .07); ctx.lineTo(bullet.x, bullet.y); ctx.stroke();
    ctx.save(); ctx.translate(bullet.x, bullet.y); ctx.rotate(t * 5); ctx.fillStyle = bullet.color;
    ctx.beginPath(); ctx.moveTo(0, -bullet.radius - 3); ctx.lineTo(bullet.radius + 3, 0); ctx.lineTo(0, bullet.radius + 3); ctx.lineTo(-bullet.radius - 3, 0); ctx.closePath(); ctx.fill();
    circle(0, 0, 3, '#e5fbff'); ctx.restore();
  }
  for (const enemy of game.enemies) if (inView(enemy, camera, 70)) drawEnemy(enemy, t);
  drawPlayer(t);
  for (const particle of game.particles) {
    if (!inView(particle, camera, 10)) continue;
    ctx.globalAlpha = Math.min(1, particle.life / particle.maxLife);
    circle(particle.x, particle.y, particle.size, particle.color);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (game.state === 'playing') drawEnemyIndicators(camera);
  if (!touch.enabled && game.state === 'playing') {
    ctx.strokeStyle = '#a1f5ca88'; ctx.lineWidth = 1;
    circle(pointer.x, pointer.y, 9, null, '#a1f5ca88');
    ctx.beginPath(); ctx.moveTo(pointer.x - 14, pointer.y); ctx.lineTo(pointer.x - 5, pointer.y); ctx.moveTo(pointer.x + 5, pointer.y); ctx.lineTo(pointer.x + 14, pointer.y); ctx.moveTo(pointer.x, pointer.y - 14); ctx.lineTo(pointer.x, pointer.y - 5); ctx.moveTo(pointer.x, pointer.y + 5); ctx.lineTo(pointer.x, pointer.y + 14); ctx.stroke();
  }
  if (game.player.hp < 35 && game.state === 'playing') {
    const danger = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 250, WIDTH / 2, HEIGHT / 2, WIDTH * .6);
    danger.addColorStop(0, '#ff365800'); danger.addColorStop(1, '#ff365840'); ctx.fillStyle = danger; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  canvas.style.cursor = game.state === 'playing' ? 'none' : 'default';
}
function drawEnemyIndicators(camera) {
  for (const enemy of game.enemies) {
    if (inView(enemy, camera, 30)) continue;
    const dx = enemy.x - game.player.x, dy = enemy.y - game.player.y;
    const scale = Math.min((WIDTH / 2 - 27) / Math.max(1, Math.abs(dx)), (HEIGHT / 2 - 27) / Math.max(1, Math.abs(dy)));
    ctx.save(); ctx.translate(WIDTH / 2 + dx * scale, HEIGHT / 2 + dy * scale); ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = enemy.color; ctx.globalAlpha = .75;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function frame(timestamp) {
  const dt = Math.min(.05, lastTime ? (timestamp - lastTime) / 1000 : 0);
  lastTime = timestamp;
  const aim = screenToWorld(pointer, cameraFor(game.player));
  let aimX = aim.x, aimY = aim.y;
  if (touch.enabled && game.enemies.length) {
    const nearest = game.enemies.reduce((best, e) => Math.hypot(e.x - game.player.x, e.y - game.player.y) < Math.hypot(best.x - game.player.x, best.y - game.player.y) ? e : best);
    aimX = nearest.x; aimY = nearest.y;
  }
  game.step(dt, {
    moveX: touch.x || Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')),
    moveY: touch.y || Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')),
    aimX, aimY, fire: touch.enabled ? game.enemies.length > 0 : pointer.down, dash
  });
  dash = false;
  for (const event of game.events.splice(0)) {
    if (event.type === 'shot') {
      const s = WEAPONS[event.weaponId].sound;
      tone(s.frequency, s.duration, s.type, s.volume);
    }
    if (event.type === 'equip') tone(550, .06, 'sine', .02);
    if (event.type === 'enemy-attack') tone(event.enemyType === 'hexer' ? 620 : event.enemyType === 'shaman' ? 260 : 110, .16, 'triangle', .022);
    if (event.type === 'kill') tone(90, .09, 'sawtooth', .018);
    if (event.type === 'hurt') tone(80, .2, 'sawtooth', .045);
    if (event.type === 'dash') tone(450, .15, 'sine', .025);
    if (event.type === 'upgrade') tone(850, .3);
    if (event.type === 'gameover') tone(160, .6, 'triangle', .07);
  }
  syncOverlay(); updateHUD(); render(timestamp / 1000);
  requestAnimationFrame(frame);
}
syncOverlay();
requestAnimationFrame(frame);
