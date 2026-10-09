import { Arena, WIDTH, HEIGHT } from './engine.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const game = new Arena();
const keys = new Set();
const pointer = { x: WIDTH * .7, y: HEIGHT * .5, down: false };
const touch = { x: 0, y: 0, active: false, enabled: matchMedia('(pointer:coarse)').matches };
let dash = false, lastTime = 0, previousState = '', toastTimer, audio, sound = false;
let best = 0;
try { best = Number(localStorage.getItem('abomination-record')) || 0; } catch { /* Storage may be unavailable in private mode. */ }
const padded = n => String(n).padStart(6, '0');
const timeLabel = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
$('record').textContent = padded(best);

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
  toast('ВЪЛНА 01');
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
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && event.target.tagName !== 'BUTTON') event.preventDefault();
  if (['p', 'escape'].includes(key) && !event.repeat) pause();
  if (key === ' ' && !event.repeat && event.target.tagName !== 'BUTTON') dash = true;
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
  if (game.state === 'playing') canvas.focus({ preventScroll: true });
  if (game.state === 'ready') {
    content.innerHTML = '<div class="overlay-badge">SURVIVAL PROTOCOL / 01</div><h2>ABOMINATION<br><span>ARENA</span></h2><p>Влез в арената. Надживей чудовищата.<br>Стани по-силен с всяка премината вълна.</p><button class="primary-button" id="start">ВЛЕЗ В АРЕНАТА <span>↗</span></button><div class="overlay-note">' + (touch.enabled ? 'ПЛЪЗНИ ЗА ДВИЖЕНИЕ · АВТОМАТИЧНА СТРЕЛБА' : 'WASD ЗА ДВИЖЕНИЕ · ЗАДРЪЖ ЛЯВ БУТОН ЗА СТРЕЛБА') + '</div>';
    $('start').addEventListener('click', start);
  } else if (game.state === 'paused') {
    content.innerHTML = '<div class="overlay-badge">ПРОТОКОЛЪТ Е ЗАДЪРЖАН</div><h2>Поеми <span>въздух.</span></h2><p>Арената ще те изчака.</p><button class="primary-button" id="resume">ПРОДЪЛЖИ <span>→</span></button>';
    $('resume').addEventListener('click', pause);
  } else if (game.state === 'upgrade') {
    content.innerHTML = '<div class="overlay-badge">ВЪЛНА ' + game.wave + ' / ПРЕМИНАТА</div><h2>Адаптирай се. <span>Оцелей.</span></h2><p>Избери подобрение. Всеки избор възстановява 35 живот.</p><div class="upgrade-options"><button class="upgrade" data-upgrade="power"><strong>⌁</strong>Повече сила<small>+10 щети<br>за всеки изстрел</small></button><button class="upgrade" data-upgrade="speed"><strong>»</strong>Бърза стрелба<small>18% по-кратко време<br>между изстрелите</small></button><button class="upgrade" data-upgrade="health"><strong>✚</strong>По-здрава броня<small>+20 максимален<br>живот</small></button></div>';
    content.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => { game.upgrade(button.dataset.upgrade); clearInput(); syncOverlay(); toast('ВЪЛНА ' + String(game.wave).padStart(2, '0')); }));
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
  $('footer-status').textContent = game.state === 'playing' ? 'Дръж чудовищата на разстояние' : game.state === 'gameover' ? 'Връзката е прекъсната' : 'Системата е готова';
}

function circle(x, y, r, fill, stroke) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function drawBackground(t) {
  ctx.fillStyle = '#101b22'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const light = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, WIDTH * .65);
  light.addColorStop(0, '#1c343230'); light.addColorStop(1, '#020a1170');
  ctx.fillStyle = light; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.lineWidth = 1; ctx.strokeStyle = '#8cc3b308';
  ctx.beginPath();
  for (let x = 0; x <= WIDTH; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); }
  for (let y = 0; y <= HEIGHT; y += 40) { ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); }
  ctx.stroke();
  ctx.strokeStyle = '#6ab39d14'; ctx.lineWidth = 2;
  circle(WIDTH / 2, HEIGHT / 2, 158, null, '#6ab39d12');
  circle(WIDTH / 2, HEIGHT / 2, 190, null, '#6ab39d08');
  ctx.setLineDash([6, 16]); circle(WIDTH / 2, HEIGHT / 2, 210, null, '#6ab39d15'); ctx.setLineDash([]);
  ctx.strokeStyle = '#55826f45'; ctx.lineWidth = 2; ctx.strokeRect(20, 20, WIDTH - 40, HEIGHT - 40);
  const corners = [[20, 20, 1, 1], [WIDTH - 20, 20, -1, 1], [20, HEIGHT - 20, 1, -1], [WIDTH - 20, HEIGHT - 20, -1, -1]];
  ctx.strokeStyle = '#a1f5ca66'; ctx.lineWidth = 3;
  for (const [x, y, dx, dy] of corners) { ctx.beginPath(); ctx.moveTo(x + dx * 50, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * 50); ctx.stroke(); }
  ctx.fillStyle = '#aacabd18'; ctx.font = '10px monospace';
  ctx.fillText('CONTAINMENT ZONE / 07', 44, HEIGHT - 39);
  ctx.textAlign = 'right'; ctx.fillText('NO EXTRACTION AVAILABLE', WIDTH - 44, HEIGHT - 39); ctx.textAlign = 'left';
  // Decorative floor vents and quiet ambient motes.
  for (const [x, y] of [[100, 100], [WIDTH - 145, 100], [100, HEIGHT - 140], [WIDTH - 145, HEIGHT - 140]]) {
    ctx.fillStyle = '#0b141b'; ctx.fillRect(x, y, 45, 40); ctx.strokeStyle = '#2d4149'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + 8, y + 7 + i * 6); ctx.lineTo(x + 37, y + 7 + i * 6); ctx.stroke(); }
  }
  for (let i = 0; i < 18; i++) circle((i * 173 + 97) % WIDTH, (i * 91 + t * (3 + i % 4)) % HEIGHT, 1.2, '#a1f5ca22');
}
function drawEnemy(e, t) {
  ctx.save(); ctx.translate(e.x, e.y);
  const angle = Math.atan2(game.player.y - e.y, game.player.x - e.x);
  const r = e.radius, wobble = Math.sin(t * 8 + e.phase) * 1.5;
  circle(0, 5, r * 1.1, '#03091266');
  ctx.rotate(angle);
  ctx.shadowColor = e.color; ctx.shadowBlur = e.hit > 0 ? 25 : 8;
  ctx.fillStyle = e.hit > 0 ? '#fff' : e.color;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, radius = r + (i % 2 === 0 ? 4 : -1) + wobble;
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  circle(-2, 0, r * .75, e.type === 'tank' ? '#7d4e39' : e.type === 'runner' ? '#51437e' : '#793950');
  ctx.fillStyle = '#19222b'; ctx.beginPath(); ctx.moveTo(5, -r * .8); ctx.lineTo(18, -r * 1.1); ctx.lineTo(11, -5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, r * .8); ctx.lineTo(18, r * 1.1); ctx.lineTo(11, 5); ctx.fill();
  circle(7, -5, 3, '#fff7d4'); circle(7, 5, 3, '#fff7d4');
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
  if (p.invulnerable > 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = .55;
  ctx.rotate(p.angle);
  ctx.shadowColor = '#a1f5ca'; ctx.shadowBlur = 16;
  circle(0, 0, 18, '#243b36', '#a1f5ca'); ctx.shadowBlur = 0;
  ctx.fillStyle = '#527869'; ctx.fillRect(-13, -18, 13, 6); ctx.fillRect(-13, 12, 13, 6);
  circle(-2, 0, 13, '#7fb79c');
  ctx.fillStyle = '#142a2b'; ctx.fillRect(0, -9, 9, 18);
  ctx.fillStyle = '#c6ffe0'; ctx.fillRect(3, -7, 4, 14);
  ctx.fillStyle = '#111e27'; ctx.fillRect(7, 7, 25, 9);
  ctx.fillStyle = '#a1f5ca'; ctx.fillRect(28, 7, 5, 9);
  ctx.restore();
  if (game.shotTimer > game.fireInterval - .05 && game.state === 'playing') {
    circle(p.x + Math.cos(p.angle) * 33, p.y + Math.sin(p.angle) * 33, 7, '#eaffbf88');
  }
}
function render(t) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground(t);
  if (game.state === 'ready') {
    for (let i = 0; i < 6; i++) drawEnemy({ x: [180, 1050, 1100, 230, 900, 370][i], y: [170, 140, 500, 570, 600, 90][i], radius: 20, color: '#f27899', type: 'crawler', phase: i, hp: 45, maxHp: 45 }, t);
  }
  for (const bullet of game.bullets) {
    ctx.strokeStyle = '#a1f5ca70'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bullet.x - bullet.vx * .018, bullet.y - bullet.vy * .018); ctx.lineTo(bullet.x, bullet.y); ctx.stroke();
    circle(bullet.x, bullet.y, 3, '#e0ffd0');
  }
  for (const enemy of game.enemies) drawEnemy(enemy, t);
  drawPlayer(t);
  for (const particle of game.particles) {
    ctx.globalAlpha = Math.min(1, particle.life / particle.maxLife);
    circle(particle.x, particle.y, particle.size, particle.color);
  }
  ctx.globalAlpha = 1;
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
function frame(timestamp) {
  const dt = Math.min(.05, lastTime ? (timestamp - lastTime) / 1000 : 0);
  lastTime = timestamp;
  let aimX = pointer.x, aimY = pointer.y;
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
    if (event.type === 'shot') tone(220, .045, 'triangle', .02);
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
