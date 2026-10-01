'use strict';
/* RightWay — game.js. Требует i18n.js (const translations = {...}) */

// ───────── Утилиты ─────────
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const Store = {
  get(k, d) { try { return localStorage.getItem('rightway:' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('rightway:' + k, v); } catch { /* приватный режим */ } },
};
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const canvas = $('gameCanvas'), ctx = canvas.getContext('2d'), ui = $('ui-overlay');
const touchLayer = $('touch-controls'), joyZone = $('joystick-zone'), joyKnob = $('joystick-knob');
const btnAct = $('btn-touch-action'), btnPhone = $('btn-touch-phone');
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ───────── Звук ─────────
const AudioFX = {
  c: null,
  init() {
    try {
      if (!this.c) this.c = new (window.AudioContext || window.webkitAudioContext)();
      if (this.c.state === 'suspended') this.c.resume().catch(() => {});
    } catch { /* звук не критичен */ }
  },
  beep(f = 440, d = 0.08, type = 'sine') {
    if (!this.c) return;
    try {
      const o = this.c.createOscillator(), g = this.c.createGain(), n = this.c.currentTime;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.1, n); g.gain.exponentialRampToValueAtTime(0.001, n + d);
      o.connect(g); g.connect(this.c.destination); o.start(); o.stop(n + d);
    } catch { /* ignore */ }
  },
  chime() { this.beep(523, 0.1); setTimeout(() => this.beep(659, 0.15), 80); setTimeout(() => this.beep(784, 0.25), 160); },
  ring() { this.beep(880, 0.1, 'square'); setTimeout(() => this.beep(880, 0.1, 'square'), 120); },
  error() { this.beep(180, 0.2, 'sawtooth'); },
};

// ───────── Конфиг ─────────
const D = {
  MAP_W: 2000, MAP_H: 1000, PW: 48, PH: 48, SPEED: 270, // px/сек
  school: { x: 200, y: 0, w: 400, h: 200 }, house: { x: 800, y: 0, w: 200, h: 200 }, police: { x: 250, y: 400, w: 300, h: 250 },
  schoolDoor: { x: 400, y: 150 }, houseDoor: { x: 900, y: 150 }, policeDoor: { x: 400, y: 500 },
  schoolExit: { x: 600, y: 550 }, policeExit: { x: 400, y: 550 },
  stairsUp: { x: 1250, y: 300 }, stairsDown: { x: 300, y: 300 },
};
const BUILDINGS = [{ x: 200, y: 100, w: 400, h: 100 }, { x: 800, y: 100, w: 200, h: 100 }, { x: 270, y: 480, w: 260, h: 70 }];
const ROOMS = { school: { x: 200, y: 100, w: 1200, h: 500 }, police: { x: 200, y: 100, w: 400, h: 500 } };

// Тексты, которых нет в i18n.js (раньше были зашиты в код на русском)
const EXTRA = {
  ru: { trust: 'Доверие', clues: 'УЛИКИ:', noClues: 'Нет найденных улик', cont: '[E] / нажмите для продолжения', sleepSub: 'Новый день — новые дела!',
    intro: 'Школьный детектив Республики Казахстан', winSub: 'Теперь вы отлично знаете законы Республики Казахстан!', up: 'Вверх', down: 'Вниз',
    maps: { street: 'Улица', school: 'Школа', police: 'Полиция' }, policeTitle: 'ПОЛИЦЕЙСКИЙ УЧАСТОК', school: 'ГИМНАЗИЯ №83', home: 'ДОМ', pol: 'ПОЛИЦИЯ', detective: 'Детектив',
    ht_idle: 'Завуч по ВР: Ищите улики и опрашивайте учеников!', ct_idle: 'Кл. Руководитель: Мой класс самый дисциплинированный.', insp_idle: 'Инспектор: Порядок на территории школы под контролем.',
    crash: 'Что-то пошло не так. Перезагрузите игру.', reload: 'Перезагрузить', noI18n: 'Не найден файл i18n.js' },
  kk: { trust: 'Сенім', clues: 'ДӘЛЕЛДЕР:', noClues: 'Дәлел табылған жоқ', cont: '[E] / жалғастыру үшін басыңыз', sleepSub: 'Жаңа күн — жаңа істер!',
    intro: 'Қазақстан Республикасының мектеп детективі', winSub: 'Енді сіз Қазақстан Республикасының заңдарын жақсы білесіз!', up: 'Жоғары', down: 'Төмен',
    maps: { street: 'Көше', school: 'Мектеп', police: 'Полиция' }, policeTitle: 'ПОЛИЦИЯ БӨЛІМШЕСІ', school: '№83 ГИМНАЗИЯ', home: 'ҮЙ', pol: 'ПОЛИЦИЯ', detective: 'Детектив',
    ht_idle: 'ТІЖ орынбасары: Дәлел іздеп, оқушылардан жауап алыңыз!', ct_idle: 'Сынып жетекшісі: Менің сыныбым ең тәртіпті.', insp_idle: 'Инспектор: Мектеп аумағында тәртіп бақылауда.',
    crash: 'Бірдеңе дұрыс болмады. Ойынды қайта жүктеңіз.', reload: 'Қайта жүктеу', noI18n: 'i18n.js файлы табылмады' },
};

// ───────── Состояние ─────────
const newRun = () => ({
  score: 0, trust: 50, tries: 3, caseIdx: 0, step: 0, casesToday: 0, needSleep: false,
  ringing: false, ringT: 0, phoneLines: [], inventory: [], items: [], npcs: [], quest: '',
  map: 'street', player: { x: 400, y: 260 }, cutscenePlayed: false,
});
const savedLang = Store.get('lang', 'ru');
const state = {
  screen: 'intro', timer: 0, settingsOrigin: 'main_menu',
  lang: typeof translations !== 'undefined' && translations[savedLang] ? savedLang : 'ru',
  name: Store.get('name', '').slice(0, 20),
  dlg: { active: false, lines: [], line: 0, chars: 0, choice: null, onEnd: null },
  keys: {}, touchVec: { x: 0, y: 0 },
  ...newRun(),
};
const view = { w: 0, h: 0 };

const L = () => ({ ...translations[state.lang], ...EXTRA[state.lang] });
const currentCase = () => translations[state.lang].cases[state.caseIdx] || null;
const floorOf = (m) => (m.startsWith('school') ? parseInt(m.slice(6), 10) : 0);

// ───────── NPC ─────────
function getNPCs() {
  const t = L(), c = currentCase(), escort = state.step === 3;
  const ht = { x: 600, y: 450 };
  const list = [
    { id: 'ht', name: t.npc_ht, x: ht.x, y: ht.y, map: 'school1', color: '#ef4444' },
    { id: 'ct', name: t.npc_ct, x: escort ? ht.x + 100 : 200, y: escort ? ht.y : 200, map: 'school1', color: '#a855f7' },
    { id: 'insp', name: t.npc_insp, x: escort ? ht.x - 100 : 500, y: escort ? ht.y : 400, map: escort ? 'school1' : 'police', color: '#1e3a8a' },
    { id: 'pol', name: t.npc_pol, x: 400, y: 200, map: 'police', color: '#3b82f6' },
    { id: 'guard', name: t.npc_guard, x: 800, y: 500, map: 'school1', color: '#64748b' },
  ];
  if (c) list.push({ id: 'susp', name: c.suspect, x: escort ? ht.x : 800, y: escort ? ht.y + 80 : 300, map: escort ? 'school1' : 'school' + c.floor, color: '#06b6d4' });
  return list;
}

// ───────── Диалоги ─────────
function startDialogue(lines, opts = {}) {
  Object.assign(state.dlg, { active: true, lines, line: 0, chars: 0, choice: opts.choice || null, onEnd: opts.onEnd || null });
}
const quizVisible = () => { const d = state.dlg; return d.active && d.choice && d.line === d.lines.length - 1; };
function advanceDialogue() {
  const d = state.dlg;
  if (!d.active) return;
  const full = d.lines[d.line] || '';
  if (d.chars < full.length) { d.chars = full.length; return; }
  if (quizVisible()) return; // ждём выбор ответа
  d.line++; d.chars = 0;
  if (d.line >= d.lines.length) {
    d.active = false;
    const cb = d.onEnd; d.onEnd = null;
    if (cb) cb();
  }
}

// ───────── Игровая логика ─────────
function makeQuiz(c) {
  const ch = c.choice;
  const items = shuffle(ch.opt.map((opt, i) => ({ opt, info: ch.info[i], ok: i === ch.cor })));
  return { q: ch.q, opt: items.map((i) => i.opt), info: items.map((i) => i.info), cor: items.findIndex((i) => i.ok), win: ch.win, fail: ch.fail };
}

function answerQuiz(i) {
  const q = state.dlg.choice;
  if (!q || !quizVisible() || !(i in q.opt)) return;
  if (i === q.cor) {
    state.trust = Math.min(100, state.trust + 15); state.score += 25; state.step = 3;
    AudioFX.chime();
    startDialogue(q.win);
  } else {
    state.trust = Math.max(0, state.trust - 5); state.tries--;
    AudioFX.error();
    startDialogue([...q.fail, q.info[i]], { onEnd: () => { if (state.tries <= 0) state.screen = 'game_over'; } });
  }
}

function answerPhone() {
  if (!state.ringing || state.dlg.active) return;
  state.ringing = false; state.step = 1;
  AudioFX.chime();
  startDialogue(state.phoneLines);
}

function finishCase() {
  state.step = 0; state.caseIdx++; state.casesToday++; state.inventory = [];
}

function teleport(map, x, y) { state.map = map; state.player.x = x; state.player.y = y; }

function enterSchool() {
  const t = L();
  teleport('school1', 600, 500);
  if (!state.cutscenePlayed) {
    state.cutscenePlayed = true;
    startDialogue(t.cut_intro.map((l) => l.replace('{name}', state.name)));
  }
}

function goHome() {
  const t = L();
  if (state.needSleep) { state.screen = 'sleeping'; state.timer = 0; state.needSleep = false; state.casesToday = 0; }
  else startDialogue([t.cut_sleep[0].replace('{name}', state.name)]);
}

function pickup(item) {
  const t = L();
  state.inventory.push(t['item_' + item.id] || item.id);
  state.step = 2;
  AudioFX.chime();
}

function talkTo(n) {
  const t = L(), c = currentCase();
  switch (n.id) {
    case 'susp':
      if (state.step === 1) startDialogue([t.pickup_early]);
      else if (state.step === 2) startDialogue(c.dial, { choice: makeQuiz(c) });
      else startDialogue([`${n.name}: ${t.d_busy}`]);
      break;
    case 'ht': startDialogue(state.step === 3 && c ? c.ht : [t.ht_idle], state.step === 3 ? { onEnd: finishCase } : {}); break;
    case 'ct': startDialogue([t.ct_idle]); break;
    case 'insp': startDialogue([t.insp_idle]); break;
    case 'pol': startDialogue(t.pol_idle); break;
    case 'guard': startDialogue(t.guard_idle); break;
    default: startDialogue([`${n.name}: ${t.d_busy}`]);
  }
}

// Все интерактивные точки — в одном месте: и для подсказок, и для кнопки действия
function getInteractions() {
  const t = L(), m = state.map, fl = floorOf(m), out = [];
  const add = (map, x, y, r, hint, run) => { if (map === m) out.push({ x, y, r, hint, run }); };
  add('street', D.schoolDoor.x, D.schoolDoor.y, 120, t.hint_school, enterSchool);
  add('street', D.houseDoor.x, D.houseDoor.y, 120, state.needSleep ? t.hint_sleep : t.hint_sleep_early, goHome);
  add('street', D.policeDoor.x, D.policeDoor.y, 120, t.hint_police, () => teleport('police', 400, 500));
  add('school1', D.schoolExit.x, D.schoolExit.y, 100, t.hint_exit, () => teleport('street', D.schoolDoor.x - 24, 250));
  add('police', D.policeExit.x, D.policeExit.y, 100, t.hint_exit, () => teleport('street', D.policeDoor.x - 24, D.policeDoor.y + 120));
  if (fl && fl < 3) add(m, D.stairsUp.x + 30, D.stairsUp.y + 30, 100, t.hint_up, () => teleport('school' + (fl + 1), D.stairsDown.x + 60, D.stairsDown.y));
  if (fl > 1) add(m, D.stairsDown.x + 30, D.stairsDown.y + 30, 100, t.hint_down, () => teleport('school' + (fl - 1), D.stairsUp.x - 60, D.stairsUp.y));
  state.items.forEach((it) => add(it.map, it.x + 20, it.y + 20, 80, t.hint_pickup, () => pickup(it)));
  state.npcs.forEach((n) => add(n.map, n.x + 24, n.y + 24, 100, '[E] ' + n.name, () => talkTo(n)));
  return out;
}

function nearestInteraction() {
  const px = state.player.x + D.PW / 2, py = state.player.y + D.PH / 2;
  let best = null, bd = Infinity;
  for (const a of getInteractions()) {
    const d = Math.hypot(px - a.x, py - a.y);
    if (d < a.r && d < bd) { best = a; bd = d; }
  }
  return best;
}

function interact() {
  if (state.screen !== 'playing' || state.dlg.active || state.ringing) return;
  const a = nearestInteraction();
  if (a) a.run();
}

function blocked(x, y) {
  const f = { x: x + 10, y: y + D.PH - 20, w: D.PW - 20, h: 20 };
  const hit = (r) => f.x < r.x + r.w && f.x + f.w > r.x && f.y < r.y + r.h && f.y + f.h > r.y;
  if (state.map === 'street') return f.x < 0 || f.y < 0 || f.x + f.w > D.MAP_W || f.y + f.h > D.MAP_H || BUILDINGS.some(hit);
  const r = ROOMS[state.map.startsWith('school') ? 'school' : state.map];
  return f.x < r.x || f.y < r.y || f.x + f.w > r.x + r.w || f.y + f.h > r.y + r.h;
}

function questText(t, c) {
  if (!c) return t.q_done;
  if (state.needSleep) return t.need_sleep_msg;
  const n = state.caseIdx + 1;
  switch (state.step) {
    case 0: return t.q_wait;
    case 1: return t.q_find.replace('{num}', n).replace('{floor}', c.floor);
    case 2: return t.q_ask.replace('{num}', n).replace('{name}', c.suspect);
    default: return t.q_escort.replace('{num}', n).replace('{name}', c.suspect);
  }
}

function update(dt) {
  const s = state;
  if (s.screen === 'intro') { s.timer += dt; if (s.timer > 2) s.screen = 'main_menu'; }
  if (s.screen === 'sleeping') {
    s.timer += dt;
    if (s.timer > 3) { s.screen = 'playing'; s.player.x = D.houseDoor.x - 24; s.player.y = D.houseDoor.y + 80; }
  }
  const show = isTouch && s.screen === 'playing';
  touchLayer.style.display = show ? 'flex' : 'none';
  btnPhone.style.display = show && s.ringing ? 'block' : 'none';
  if (s.screen !== 'playing') return;

  const t = L(), c = currentCase();
  if (!c) { s.screen = 'victory'; AudioFX.chime(); return; }

  s.npcs = getNPCs();
  s.items = s.step === 1 && !s.inventory.length ? [{ id: c.item, x: c.ix, y: c.iy, map: 'school' + c.floor }] : [];
  s.quest = questText(t, c);

  // Звонок
  if (!s.dlg.active) {
    if (s.casesToday >= 2 && s.step === 0) { s.needSleep = true; s.ringing = false; }
    else if (s.step === 0 && !s.needSleep) {
      if (!s.ringing) { s.ringing = true; s.phoneLines = c.call; s.ringT = 0; AudioFX.ring(); }
      else if ((s.ringT += dt) > 2.5) { s.ringT = 0; AudioFX.ring(); }
    }
  }

  // Печать текста диалога
  const d = s.dlg;
  if (d.active) d.chars = Math.min((d.lines[d.line] || '').length, d.chars + dt * 48);

  // Движение (раздельно по осям — скольжение вдоль стен)
  if (!d.active && !s.ringing) {
    const k = s.keys;
    let dx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    let dy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    if (s.touchVec.x || s.touchVec.y) { dx = s.touchVec.x; dy = s.touchVec.y; }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const nx = s.player.x + dx * D.SPEED * dt, ny = s.player.y + dy * D.SPEED * dt;
    if (!blocked(nx, s.player.y)) s.player.x = nx;
    if (!blocked(s.player.x, ny)) s.player.y = ny;
  }
}

// ───────── Отрисовка canvas ─────────
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = canvas.clientWidth; view.h = canvas.clientHeight;
  canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fillRR(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fill();
}

function drawCharacter(x, y, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 24, y + 44, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; fillRR(x + 8, y + 16, 32, 28, 8);
  ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(x + 24, y + 14, 12, 0, Math.PI * 2); ctx.fill();
  if (label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x + 24, y - 6); ctx.textAlign = 'start'; }
}

function drawMap(t, cx, cy) {
  const rect = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x - cx, y - cy, w, h); };
  const text = (c, f, s, x, y) => { ctx.fillStyle = c; ctx.font = f; ctx.fillText(s, x - cx, y - cy); };
  const m = state.map;
  if (m === 'street') {
    rect('#15803d', 0, 0, D.MAP_W, D.MAP_H);
    rect('#475569', 0, 200, D.MAP_W, 120); rect('#475569', 350, 200, 100, D.MAP_H - 200);
    ctx.strokeStyle = '#fef08a'; ctx.setLineDash([20, 15]); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-cx, 260 - cy); ctx.lineTo(D.MAP_W - cx, 260 - cy); ctx.stroke(); ctx.setLineDash([]);
    const b = 'bold 16px Inter, sans-serif';
    rect('#334155', D.school.x, D.school.y, D.school.w, D.school.h); text('#f59e0b', b, t.school, D.school.x + 110, 80);
    rect('#78350f', D.schoolDoor.x - 25, D.schoolDoor.y, 50, 50);
    rect('#1e293b', D.house.x, D.house.y, D.house.w, D.house.h); text('#38bdf8', b, t.home, D.house.x + 80, 80);
    rect('#78350f', D.houseDoor.x - 20, D.houseDoor.y, 40, 50);
    rect('#1e3a8a', D.police.x, D.police.y, D.police.w, D.police.h); text('#60a5fa', b, t.pol, D.police.x + 100, D.police.y + 80);
    rect('#1d4ed8', D.policeDoor.x - 20, D.policeDoor.y, 40, 50);
  } else if (m.startsWith('school')) {
    const fl = floorOf(m);
    rect('#854d0e', 200, 100, 1200, 500);
    ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 6; ctx.strokeRect(200 - cx, 100 - cy, 1200, 500);
    for (let i = 0; i < 4; i++) { rect('#f59e0b', 400 + i * 250, 100, 80, 40); text('#fff', '14px Inter, sans-serif', `${fl}0${i + 1}`, 428 + i * 250, 125); }
    text('#fff', 'bold 22px Inter, sans-serif', `${fl} ${t.floor}`, 230, 140);
    if (fl < 3) { rect('#3b82f6', D.stairsUp.x, D.stairsUp.y, 60, 60); text('#fff', '12px Inter, sans-serif', t.up, D.stairsUp.x + 8, D.stairsUp.y + 35); }
    if (fl > 1) { rect('#ef4444', D.stairsDown.x, D.stairsDown.y, 60, 60); text('#fff', '12px Inter, sans-serif', t.down, D.stairsDown.x + 8, D.stairsDown.y + 35); }
    if (fl === 1) { rect('#78350f', D.schoolExit.x - 25, D.schoolExit.y, 50, 30); }
  } else if (m === 'police') {
    rect('#334155', 200, 100, 400, 500);
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 6; ctx.strokeRect(200 - cx, 100 - cy, 400, 500);
    text('#fff', 'bold 20px Inter, sans-serif', t.policeTitle, 230, 140);
    rect('#1d4ed8', D.policeExit.x - 20, D.policeExit.y, 40, 30);
  }
}

function drawCanvas() {
  ctx.clearRect(0, 0, view.w, view.h);
  if (state.screen !== 'playing') return;
  const t = L(), p = state.player;
  const cx = p.x - view.w / 2 + D.PW / 2, cy = p.y - view.h / 2 + D.PH / 2;
  drawMap(t, cx, cy);
  for (const it of state.items) {
    if (it.map !== state.map) continue;
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(it.x + 20 - cx, it.y + 20 - cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.font = '16px Inter, sans-serif'; ctx.fillText('🔍', it.x + 11 - cx, it.y + 26 - cy);
  }
  for (const n of state.npcs) if (n.map === state.map) drawCharacter(n.x - cx, n.y - cy, n.color, n.name);
  drawCharacter(p.x - cx, p.y - cy, '#3b82f6', state.name);
  if (!state.dlg.active && !state.ringing) {
    const a = nearestInteraction();
    if (a) { ctx.fillStyle = '#fef08a'; ctx.font = 'bold 14px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(a.hint, p.x + 24 - cx, p.y - 30 - cy); ctx.textAlign = 'start'; }
  }
}

// ───────── UI (HTML) ─────────
const card = 'bg-slate-800/90 backdrop-blur border border-slate-700 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 w-80 max-w-full text-center';
const btn = (action, label, cls = 'bg-blue-600 hover:bg-blue-500 text-white', arg = '') =>
  `<button data-action="${action}" data-arg="${arg}" class="w-full py-3 ${cls} font-bold rounded-xl transition shadow">${label}</button>`;
const GREY = 'bg-slate-700 hover:bg-slate-600 text-slate-300', GREEN = 'bg-emerald-600 hover:bg-emerald-500 text-white';

function hudHtml(t) {
  const d = state.dlg;
  const phone = state.ringing
    ? `<div data-action="answer" class="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600/90 border-2 border-blue-400 text-white px-6 py-3 rounded-2xl shadow-xl ring-alert cursor-pointer font-bold text-sm">${t.phone_ringing}</div>` : '';
  let dialog = '';
  if (d.active) {
    const opts = quizVisible()
      ? `<div class="mt-3 flex flex-col gap-2">${d.choice.opt.map((o, i) => `<button data-action="quiz" data-arg="${i}" class="w-full text-left px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-yellow-300 text-xs md:text-sm">${i + 1}. ${o}</button>`).join('')}</div>` : '';
    dialog = `<div data-action="advance" class="absolute bottom-4 left-4 right-4 md:left-12 md:right-12 bg-slate-900/95 border-2 border-blue-500 p-4 rounded-2xl shadow-2xl max-h-[70%] overflow-y-auto">
      <p id="dlg-text" class="text-white font-medium text-sm md:text-base leading-relaxed"></p>${opts}
      <div class="mt-2 text-xs text-slate-400">${t.cont}</div></div>`;
  }
  const clues = state.inventory.length ? `<ul class="list-disc list-inside text-slate-300">${state.inventory.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : `<span class="text-slate-500">${t.noClues}</span>`;
  const mapName = state.map.startsWith('school') ? `${t.maps.school} · ${floorOf(state.map)} ${t.floor}` : t.maps[state.map];
  return `${phone}
    <div class="absolute top-4 left-4 bg-slate-900/80 border border-slate-700 p-3 rounded-xl text-xs md:text-sm flex flex-col gap-1 pointer-events-none">
      <div class="text-white font-bold">🔍 ${esc(state.name || t.detective)}</div>
      <div class="text-emerald-400 font-semibold">${t.score_text} ${state.score}</div>
      <div class="text-rose-400 font-semibold">${t.lives_text} ${'❤️'.repeat(Math.max(0, state.tries))}</div>
      <div class="text-sky-400">${mapName}</div></div>
    <div class="absolute top-4 right-4 bg-slate-900/80 border border-slate-700 p-3 rounded-xl text-xs flex flex-col gap-2 w-56 md:w-64 pointer-events-none">
      <div><span class="text-amber-400 font-bold block mb-1">${t.cur_quest}</span><span class="text-slate-200 leading-tight block">${state.quest}</span></div>
      <div><div class="flex justify-between text-slate-300 mb-1"><span>${t.trust}</span><span>${state.trust}%</span></div>
        <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden"><div class="h-full bg-emerald-500" style="width:${state.trust}%"></div></div></div></div>
    <div class="absolute bottom-24 right-4 bg-slate-900/80 border border-slate-700 p-3 rounded-xl text-xs w-48 hidden md:block pointer-events-none"><span class="text-cyan-400 font-bold block mb-1">${t.clues}</span>${clues}</div>
    ${dialog}`;
}

const VIEWS = {
  intro: (t) => `<div class="text-center"><h1 class="text-5xl md:text-6xl font-extrabold text-blue-400 mb-4">RightWay</h1><p class="text-slate-400 text-lg">${t.intro}</p></div>`,
  main_menu: (t) => `<div class="${card}"><h1 class="text-3xl font-extrabold text-blue-400 mb-2">RightWay</h1>${btn('start', t.start)}${btn('settings', t.settings, GREEN)}</div>`,
  select_mode: (t) => `<div class="${card}"><h2 class="text-xl font-bold mb-2">${t.select_mode}</h2>${btn('solo', t.solo)}${btn('back_menu', t.back, GREY)}</div>`,
  settings: (t) => `<div class="${card}"><h2 class="text-xl font-bold mb-2">${t.settings_title}</h2>${btn('lang', t.lang)}${btn('back_settings', t.back, GREY)}</div>`,
  registration: (t) => `<div class="${card} text-left"><h2 class="text-2xl font-bold text-blue-400 text-center">${t.reg_title}</h2>
    <p class="text-sm text-slate-400">${t.city}</p><p class="text-sm text-slate-400">${t.school}</p>
    <label class="w-full text-xs text-slate-300 font-semibold">${t.enter_name}
      <input id="input-name" maxlength="20" value="${esc(state.name)}" class="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"></label>
    ${btn('to_game', t.to_game, GREEN)}</div>`,
  pause_menu: (t) => `<div class="${card}"><h2 class="text-xl font-bold mb-2">${t.pause_title}</h2>${btn('resume', t.resume)}${btn('settings_pause', t.settings, GREEN)}${btn('to_menu', t.to_menu, GREY)}</div>`,
  sleeping: (t) => `<div class="text-center animate-pulse"><h2 class="text-4xl font-bold text-blue-300 mb-2">Zzz...</h2><p class="text-slate-400">${t.sleepSub}</p></div>`,
  game_over: (t) => `<div class="${card} border-red-500/50"><h1 class="text-2xl font-extrabold text-red-500">${t.game_over}</h1><p class="text-slate-300 text-sm">${t.game_over_sub}</p>${btn('restart', t.start, 'bg-red-600 hover:bg-red-500 text-white')}</div>`,
  victory: (t) => `<div class="${card} w-96 border-emerald-500/50"><h1 class="text-2xl font-extrabold text-emerald-400">${t.victory}</h1><p class="text-slate-300 text-sm">${t.winSub}</p>
    <p class="text-amber-400 font-bold text-lg">${t.score_text} ${state.score}</p>${btn('restart', t.start, GREEN)}</div>`,
  playing: hudHtml,
};

let lastKey = '';
function renderUI() {
  const t = L(), d = state.dlg;
  // Перестраиваем DOM только при изменении состояния — иначе слетают фокус input и клики по кнопкам
  const key = [state.screen, state.lang, d.active, d.line, quizVisible(), state.ringing, state.score, state.tries, state.trust, state.map, state.quest, state.inventory.length].join('|');
  if (key !== lastKey) {
    lastKey = key;
    ui.innerHTML = (VIEWS[state.screen] || (() => ''))(t);
    ui.style.pointerEvents = 'auto';
  }
  const el = $('dlg-text');
  if (el && d.active) el.textContent = (d.lines[d.line] || '').slice(0, Math.floor(d.chars));
}

// ───────── Действия UI ─────────
function resetRun() { Object.assign(state, newRun()); state.dlg.active = false; }
const ACTIONS = {
  start: () => (state.screen = 'select_mode'),
  solo: () => (state.screen = 'registration'),
  back_menu: () => (state.screen = 'main_menu'),
  settings: () => { state.settingsOrigin = 'main_menu'; state.screen = 'settings'; },
  settings_pause: () => { state.settingsOrigin = 'pause_menu'; state.screen = 'settings'; },
  back_settings: () => (state.screen = state.settingsOrigin),
  lang: () => {
    state.lang = state.lang === 'ru' ? 'kk' : 'ru';
    Store.set('lang', state.lang);
    document.documentElement.lang = state.lang;
    state.dlg.active = false; state.ringing = false; // старые строки диалога остались бы на прежнем языке
  },
  to_game: () => {
    const name = state.name.trim();
    if (!name) return;
    state.name = name; Store.set('name', name);
    resetRun(); state.screen = 'playing';
  },
  resume: () => (state.screen = 'playing'),
  to_menu: () => { resetRun(); state.screen = 'main_menu'; },
  restart: () => { resetRun(); state.screen = 'playing'; },
  advance: () => advanceDialogue(),
  quiz: (arg) => answerQuiz(Number(arg)),
  answer: () => answerPhone(),
};

ui.addEventListener('click', (e) => {
  AudioFX.init();
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.stopPropagation();
  const fn = ACTIONS[el.dataset.action];
  if (fn) fn(el.dataset.arg);
});
ui.addEventListener('input', (e) => { if (e.target.id === 'input-name') state.name = e.target.value.slice(0, 20); });

function togglePause() {
  if (state.screen === 'playing') state.screen = 'pause_menu';
  else if (state.screen === 'pause_menu') state.screen = 'playing';
}

// ───────── Ввод ─────────
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Enter') ACTIONS.to_game(); return; }
  AudioFX.init();
  state.keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'Escape') { togglePause(); return; }
  if (state.screen !== 'playing') return;
  if (state.dlg.active) {
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') advanceDialogue();
    else if (/^Digit[1-9]$/.test(e.code)) answerQuiz(Number(e.code.slice(5)) - 1);
    return;
  }
  if (e.code === 'KeyT') answerPhone();
  else if (e.code === 'KeyE') interact();
});
window.addEventListener('keyup', (e) => { state.keys[e.code] = false; });
window.addEventListener('blur', () => { state.keys = {}; });

// Джойстик на pointer events (корректно работает с мультитачем)
let joyId = null, joyC = null;
function moveJoy(e) {
  const max = 45, dx = e.clientX - joyC.x, dy = e.clientY - joyC.y;
  const dist = Math.min(Math.hypot(dx, dy), max), a = Math.atan2(dy, dx);
  const kx = Math.cos(a) * dist, ky = Math.sin(a) * dist;
  joyKnob.style.transform = `translate(${kx}px, ${ky}px)`;
  state.touchVec = dist / max < 0.15 ? { x: 0, y: 0 } : { x: kx / max, y: ky / max };
}
function resetJoy() { joyId = null; joyKnob.style.transform = ''; state.touchVec = { x: 0, y: 0 }; }
joyZone.addEventListener('pointerdown', (e) => {
  e.preventDefault(); AudioFX.init();
  joyId = e.pointerId; joyZone.setPointerCapture(e.pointerId);
  const r = joyZone.getBoundingClientRect(); joyC = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  moveJoy(e);
});
joyZone.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveJoy(e); });
['pointerup', 'pointercancel'].forEach((n) => joyZone.addEventListener(n, (e) => { if (e.pointerId === joyId) resetJoy(); }));
btnAct.addEventListener('pointerdown', (e) => { e.preventDefault(); AudioFX.init(); state.dlg.active ? advanceDialogue() : interact(); });
btnPhone.addEventListener('pointerdown', (e) => { e.preventDefault(); AudioFX.init(); answerPhone(); });

// ───────── Запуск и обработка ошибок ─────────
let crashed = false;
function fatal(err) {
  console.error(err);
  if (crashed) return;
  crashed = true;
  const t = (typeof EXTRA !== 'undefined' && EXTRA[state.lang]) || EXTRA.ru;
  ui.innerHTML = `<div class="${card}"><p class="text-slate-200">${t.crash}</p>${btn('reload', t.reload)}</div>`;
  ACTIONS.reload = () => location.reload();
}
window.addEventListener('error', (e) => fatal(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => fatal(e.reason));

let last = performance.now();
function frame(now) {
  if (crashed) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { update(dt); drawCanvas(); renderUI(); } catch (err) { fatal(err); return; }
  requestAnimationFrame(frame);
}

if (typeof translations === 'undefined') {
  fatal(new Error(EXTRA.ru.noI18n));
} else {
  document.documentElement.lang = state.lang;
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
}
