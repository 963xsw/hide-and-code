'use strict';
/* ===== 客戶端：存檔、狀態、房間／連線、事件處理、玩家物理、互動 ===== */
const $ = id => document.getElementById(id);
const IS_TOUCH = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
const URLQ = new URLSearchParams(location.search);
const NET_MODE = URLQ.get('bc') ? 'bc' : 'peer';

const AVATARS = [
  { id: 'a0', emoji: '🙂', name: '路人', price: 0, color: [0.55, 0.62, 0.75] },
  { id: 'a1', emoji: '😎', name: '酷哥', price: 30, color: [0.25, 0.25, 0.3] },
  { id: 'a2', emoji: '🦊', name: '狐狸', price: 50, color: [0.9, 0.5, 0.2] },
  { id: 'a3', emoji: '🐱', name: '貓咪', price: 50, color: [0.75, 0.7, 0.62] },
  { id: 'a4', emoji: '🐼', name: '熊貓', price: 80, color: [0.9, 0.9, 0.9] },
  { id: 'a5', emoji: '🤖', name: '機器人', price: 100, color: [0.45, 0.7, 0.85] },
  { id: 'a6', emoji: '👻', name: '幽靈', price: 120, color: [0.85, 0.88, 1.0] },
  { id: 'a7', emoji: '🧙', name: '法師', price: 150, color: [0.5, 0.3, 0.75] },
  { id: 'a8', emoji: '🐸', name: '奶蛙', price: 200, color: [0.35, 0.75, 0.3] },
  { id: 'a9', emoji: '🐲', name: '小龍', price: 300, color: [0.85, 0.25, 0.3] },
];
const TITLES = [
  { id: 'rookie', name: '初出茅廬', desc: '完成第一場遊戲' },
  { id: 'winner', name: '首位通關', desc: '在一場遊戲中率先完成配對' },
  { id: 'frog', name: '奶蛙獵人', desc: '找到隱藏的奶蛙通關' },
  { id: 'untouched', name: '毫髮無傷', desc: '沒有失去任何生命就通關' },
  { id: 'speed', name: '疾風', desc: '5 分鐘內通關' },
  { id: 'locksmith', name: '開鎖專家', desc: '單場成功解鎖 3 個以上的鎖' },
  { id: 'ghost', name: '幽靈常客', desc: '一場遊戲中三條命用完' },
  { id: 'hider', name: '躲貓貓大師', desc: '累計躲藏 10 次' },
];
const QUALITY = { low: { s: 0.6, d: 42 }, mid: { s: 0.8, d: 56 }, high: { s: 1.0, d: 72 } };

const Store = {
  key: 'hide-and-code-v1', d: null,
  load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(this.key)); } catch (e) { /* ignore */ }
    const def = { name: '玩家' + (100 + Math.floor(Math.random() * 900)), vol: 70, q: IS_TOUCH ? 'low' : 'mid', sens: 12, coins: 0, owned: ['a0'], av: 'a0', titles: [], title: '', best: {}, hides: 0, wins: 0, map: 0 };
    this.d = Object.assign(def, saved || {});
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch (e) { /* ignore */ } },
};
Store.load();

const G = {
  mode: 'menu', isHost: false, solo: false, myId: null, hostNet: null, clientNet: null, sim: null,
  roster: new Map(), connPid: new Map(), pidConn: new Map(), nextPid: 1,
  room: { code: '', map: 0, players: [] },
  mapIdx: 0, bundle: null, chunks: null, chunksIdx: -1, miniImg: null,
  me: null, others: new Map(), mon: { x: 0, y: 0, z: 0, yaw: 0, tx: 0, ty: 0, tz: 0, tyaw: 0, st: 0, target: '' },
  codes: [], locks: [], peds: [], frog: { spot: 0, found: false }, notes: {},
  tm: ROUND_TIME, countdown: 0, simDelay: 0, menuOpen: false, keypad: null, chatOpen: false,
  sendT: 0, snapT: 0, inter: null, flash: true, locked: false, cine: null, ended: false, alertT: 0,
  eyeY: 1.55, bob: 0, stepD: 0, wasGround: true, lastHP: 3, portalCd: 0, results: null, roundStats: { hides: 0 }, hbOn: false,
};

/* ---------- 小工具 ---------- */
function toast(txt, ms = 3200) {
  const box = $('toasts'); if (!box) return;
  const d = document.createElement('div'); d.textContent = txt; box.appendChild(d);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, ms);
}
function chatLine(name, s, sys) {
  const d = document.createElement('div');
  if (sys) { d.textContent = s; d.style.color = '#9fd0ff'; }
  else { const b = document.createElement('b'); b.textContent = name + '：'; d.appendChild(b); d.appendChild(document.createTextNode(s)); }
  const box = $('chat'); box.appendChild(d);
  while (box.children.length > 6) box.removeChild(box.firstChild);
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 1000); }, 9000);
  const lc = $('l-chat');
  if (lc) { const e = document.createElement('div'); e.textContent = sys ? s : name + '：' + s; lc.appendChild(e); lc.scrollTop = lc.scrollHeight; }
}
function fmtTime(sec) { sec = Math.max(0, sec); const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
const avOf = id => AVATARS.find(a => a.id === id) || AVATARS[0];
const titleOf = id => (TITLES.find(t => t.id === id) || {}).name || '';
function selfInfo() { return { name: Store.d.name, av: Store.d.av, title: Store.d.title }; }

/* ---------- 房主：收發 ---------- */
function hostSend(to, msg) {
  if (to === 'all') { if (G.hostNet) G.hostNet.broadcast(msg); clientHandle(msg); }
  else if (to === G.myId) clientHandle(msg);
  else { const cid = G.pidConn.get(to); if (cid && G.hostNet) G.hostNet.send(cid, msg); }
}
function sendHost(msg) {
  if (G.isHost) {
    if (G.sim) G.sim.handle(G.myId, msg);
    else if (msg.t === 'chat') hostSend('all', { t: 'chat', n: Store.d.name, s: String(msg.s).slice(0, 60) });
  } else if (G.clientNet) G.clientNet.send(msg);
}
function broadcastRoom() {
  const players = [...G.roster.values()];
  hostSend('all', { t: 'room', code: G.room.code, map: G.room.map, players, solo: G.solo });
}

function resetNetwork() {
  if (G.hostNet) { try { G.hostNet.close(); } catch (e) { /* ignore */ } }
  if (G.clientNet) { try { G.clientNet.close(); } catch (e) { /* ignore */ } }
  G.hostNet = null; G.clientNet = null; G.sim = null; G.isHost = false; G.solo = false; G.myId = null;
  G.roster = new Map(); G.connPid = new Map(); G.pidConn = new Map(); G.nextPid = 1;
  G.ended = false; G.cine = null;
}

function createRoom(solo) {
  resetNetwork();
  G.isHost = true; G.solo = !!solo; G.myId = 'h';
  G.room = { code: solo ? 'SOLO' : '', map: Store.d.map, players: [] };
  G.roster.set('h', Object.assign({ id: 'h' }, selfInfo()));
  if (solo) { broadcastRoom(); hostStartGame(); return; }
  const tryOpen = (n) => {
    const code = genRoomCode();
    G.room.code = code;
    G.hostNet = new HostNet(NET_MODE);
    G.hostNet.open(code, {
      onReady: () => { broadcastRoom(); showScreen('s-lobby'); G.mode = 'lobby'; refreshLobby(); },
      onError: e => {
        if (e && e.type === 'taken' && n < 5) { try { G.hostNet.close(); } catch (x) { /* ignore */ } tryOpen(n + 1); return; }
        resetNetwork(); setLoading(false); showScreen('s-menu'); $('m-err').textContent = '無法建立房間：' + ((e && (e.type || e.message)) || '連線服務失敗') + '。請檢查網路後重試。';
      },
      onJoin: () => { /* 等待 hello */ },
      onData: (cid, msg) => hostOnData(cid, msg),
      onLeave: cid => hostOnLeave(cid),
    });
  };
  setLoading('建立房間中…'); tryOpen(0);
  setTimeout(() => { if (G.mode !== 'lobby' && G.isHost && !G.solo && !G.sim) { setLoading(false); } }, 15000);
  const iv = setInterval(() => { if (G.mode === 'lobby') { setLoading(false); clearInterval(iv); } }, 200);
}

function hostOnData(cid, msg) {
  if (msg.t === 'hello') {
    if (G.connPid.has(cid)) return;
    if (G.sim && G.sim.status === 'playing') { G.hostNet.send(cid, { t: 'deny', r: '遊戲進行中，請等下一局' }); setTimeout(() => G.hostNet.kick(cid), 300); return; }
    if (G.roster.size >= 4) { G.hostNet.send(cid, { t: 'deny', r: '房間已滿（最多 4 人）' }); setTimeout(() => G.hostNet.kick(cid), 300); return; }
    const pid = 'p' + (G.nextPid++);
    G.connPid.set(cid, pid); G.pidConn.set(pid, cid);
    G.roster.set(pid, { id: pid, name: String(msg.name || '玩家').slice(0, 10), av: avOf(msg.av).id, title: msg.title || '' });
    G.hostNet.send(cid, { t: 'welcome', id: pid });
    broadcastRoom();
    hostSend('all', { t: 'chat', sys: 1, s: `${G.roster.get(pid).name} 加入了房間` });
    return;
  }
  const pid = G.connPid.get(cid); if (!pid) return;
  if (G.sim) G.sim.handle(pid, msg);
  else if (msg.t === 'chat') hostSend('all', { t: 'chat', n: G.roster.get(pid).name, s: String(msg.s).slice(0, 60) });
}
function hostOnLeave(cid) {
  const pid = G.connPid.get(cid); if (!pid) return;
  G.connPid.delete(cid); G.pidConn.delete(pid);
  const r = G.roster.get(pid); G.roster.delete(pid);
  if (G.sim) G.sim.removePlayer(pid);
  broadcastRoom();
  hostSend('all', { t: 'chat', sys: 1, s: `${r ? r.name : '玩家'} 離開了房間` });
}

function joinRoom(code) {
  resetNetwork();
  code = normalizeCode(code);
  if (code.length !== 5) { $('j-err').textContent = '請輸入 5 碼房間代碼'; return; }
  $('j-err').textContent = '';
  setLoading('連線到房間 ' + code + '…');
  G.clientNet = new ClientNet(NET_MODE);
  G.clientNet.connect(code, {
    onOpen: () => { G.clientNet.send(Object.assign({ t: 'hello' }, selfInfo())); },
    onData: msg => clientHandle(msg),
    onClose: () => { if (G.mode !== 'menu') { toast('與房主的連線已中斷'); goMenu(); $('m-err').textContent = '房主已離開或連線中斷。'; } },
    onError: e => {
      setLoading(false); resetNetwork();
      const t = e && e.type;
      $('j-err').textContent = t === 'peer-unavailable' ? '找不到這個房間，請確認代碼是否正確。' : t === 'timeout' ? '連線逾時（可能是網路環境限制點對點連線）。' : '連線失敗：' + (t || (e && e.message) || '未知錯誤');
      showScreen('s-join');
    },
  });
}

function hostStartGame() {
  setLoading('產生地圖與導航網格…');
  setTimeout(() => {
    try {
      const seed = (Math.random() * 4294967296) >>> 0;
      const roster = [...G.roster.values()].map(r => ({ id: r.id, name: r.name, av: r.av }));
      G.ended = false;
      G.sim = new Sim(G.room.map, seed, roster, hostSend);
      G.simDelay = 4.2;
      const spawn = {}; G.sim.players.forEach(p => { spawn[p.id] = [p.x, p.y, p.z, p.yaw]; });
      hostSend('all', { t: 'start', map: G.room.map, spawn, delay: 4, roster });
      hostSend('all', G.sim.worldMsg());
    } catch (e) {
      console.error(e); setLoading(false); toast('開始遊戲失敗：' + e.message);
    }
  }, 40);
}
function hostBackToLobby() {
  if (!G.isHost) return;
  G.sim = null;
  if (G.solo) { hostStartGame(); return; }
  hostSend('all', { t: 'lobby' });
  broadcastRoom();
}

/* ---------- 地圖載入 ---------- */
function loadMap(idx) {
  G.mapIdx = idx;
  G.bundle = getBundle(idx, false);
  if (G.chunksIdx !== idx) {
    if (G.chunks) R.freeStatic(G.chunks);
    G.chunks = R.buildStatic(G.bundle.b);
    G.chunksIdx = idx;
    buildMinimap(G.bundle.b);
  }
  Object.assign(R.theme, G.bundle.b.theme);
}
function buildMinimap(b) {
  const bd = b.bounds, S = 2;
  const w = Math.ceil((bd.x1 - bd.x0) * S), h = Math.ceil((bd.z1 - bd.z0) * S);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#10141a'; x.fillRect(0, 0, w, h);
  const bx = b.boxes.filter(o => o.solid && o.y1 > 0.6).sort((p, q) => p.y1 - q.y1);
  for (const o of bx) {
    const v = Math.floor(70 + Math.min(o.y1, 14) / 14 * 150);
    x.fillStyle = `rgb(${v},${v},${Math.min(255, v + 12)})`;
    x.fillRect((o.x0 - bd.x0) * S, (o.z0 - bd.z0) * S, Math.max(1, (o.x1 - o.x0) * S), Math.max(1, (o.z1 - o.z0) * S));
  }
  G.miniImg = c;
}

/* ---------- 事件處理（房主與客戶端共用） ---------- */
function clientHandle(m) {
  switch (m.t) {
    case 'welcome': G.myId = m.id; break;
    case 'deny': setLoading(false); resetNetwork(); $('j-err').textContent = m.r; showScreen('s-join'); break;
    case 'room':
      G.room = { code: m.code, map: m.map, players: m.players, solo: m.solo };
      if (!G.isHost && G.mode !== 'play' && G.mode !== 'result') { if (G.mode !== 'lobby') { G.mode = 'lobby'; setLoading(false); showScreen('s-lobby'); } }
      refreshLobby();
      break;
    case 'lobby': G.mode = 'lobby'; G.ended = false; leaveGameView(); showScreen('s-lobby'); refreshLobby(); break;
    case 'start': beginRound(m); break;
    case 'world': applyWorld(m); break;
    case 's': applySnapshot(m); break;
    case 'note': G.notes[m.c] = m.v; Sfx.pickup(); toast(`取得${COLORS[m.c].name}色密碼：${m.v}`); refreshTasks(); if (G.keypad) refreshKeypadNotes(); break;
    case 'unlocked':
      if (G.locks[m.c]) { G.locks[m.c].open = true; G.locks[m.c].by = m.by; }
      if (m.by === G.myId) { G.me.items.push(m.c); Sfx.unlock(); toast(`你解開了${COLORS[m.c].name}色鎖，取得物品！去找${COLORS[m.c].name}色放置點`); closeKeypad(); G.roundStats.unlocks = (G.roundStats.unlocks || 0) + 1; }
      else { Sfx.unlock(); toast(`${m.name} 解開了${COLORS[m.c].name}色鎖`); }
      refreshTasks(); break;
    case 'wrong': Sfx.wrong(); if (G.keypad) { const d = $('kp-disp'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); G.keypad.val = ''; setTimeout(updateKeypad, 420); } G.flashRed = 0.6; toast('密碼錯誤！聲音可能吸引了怪物…'); break;
    case 'lockmsg': toast(m.s); break;
    case 'placed': Sfx.place(); break;
    case 'alert': Sfx.alert(); G.alertT = 1.5; break;
    case 'caught': onCaught(m); break;
    case 'reset': {
      applyWorld(m.world);
      m.colors.forEach(c => { delete G.notes[c]; const i = G.me.items.indexOf(c); if (i >= 0) G.me.items.splice(i, 1); });
      toast(`${m.name} 被抓住了：${m.colors.map(c => COLORS[c].name).join('、')}色鎖重新上鎖，密碼已重新藏到別處！`);
      refreshTasks(); break;
    }
    case 'resp':
      if (m.id === G.myId) respawnMe(m);
      break;
    case 'hideok': {
      const h = G.bundle.b.spots.hide[m.i];
      G.me.hidden = true; G.me.hideIdx = m.i; G.me.x = h.x; G.me.y = h.y; G.me.z = h.z; G.me.vx = G.me.vz = 0; G.me.vy = 0;
      G.roundStats.hides = (G.roundStats.hides || 0) + 1; Sfx.hide(); toast('你躲起來了。按 E 離開'); break;
    }
    case 'unhideok': G.me.hidden = false; G.me.hideIdx = -1; G.me.x = m.x; G.me.y = m.y; G.me.z = m.z; Sfx.hide(); break;
    case 'chat': chatLine(m.n, m.s, !!m.sys); if (!m.sys) Sfx.chat(); break;
    case 'left': G.others.delete(m.id); break;
    case 'end': onEnd(m); break;
  }
}

function applyWorld(m) {
  G.codes = m.codes.map(spot => ({ spot }));
  G.codeVals = m.vals || []; G.codeViews = m.views || [];
  G.locks = m.locks.map(l => ({ spot: l.spot, open: l.open, by: l.by }));
  G.peds = m.peds.map(spot => ({ spot }));
  G.frog = { spot: m.frog, found: !!m.frogFound };
  refreshTasks();
}

function newMe(x, y, z, yaw) {
  return { x, y, z, vx: 0, vz: 0, vy: 0, onGround: true, yaw, pitch: 0, crouch: false, run: false, moving: false, hidden: false, hideIdx: -1, st: 'alive', lives: 3, items: [], deadT: 0, prot: 3 };
}
function beginRound(m) {
  loadMap(m.map);
  G.mode = 'play'; G.ended = false; G.cine = null; G.notes = {}; G.roundStats = { hides: 0, unlocks: 0 };
  const sp = m.spawn[G.myId] || [0, 0, 0, 0];
  G.me = newMe(sp[0], sp[1], sp[2], sp[3]);
  G.eyeY = 1.55;
  G.others = new Map();
  for (const r of m.roster) if (r.id !== G.myId) G.others.set(r.id, { id: r.id, name: r.name, av: r.av, x: 0, y: -50, z: 0, yaw: 0, pitch: 0, tx: 0, ty: -50, tz: 0, tyaw: 0, tpitch: 0, flags: 0, st: 0, lives: 3, init: false });
  G.countdown = m.delay; G.tm = ROUND_TIME; G.menuOpen = false; G.keypad = null; G.inter = null;
  setLoading(false); showScreen(null);
  $('result').classList.add('hidden'); $('death').classList.add('hidden'); $('keypad').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden'); if (IS_TOUCH) $('touch').classList.remove('hidden');
  $('roomtag').textContent = G.room.solo ? '單人練習' : '房間 ' + G.room.code;
  $('ghostbar').classList.add('hidden');
  Sfx.init(); Sfx.ambient(MAP_DEFS[m.map].id);
  setTimeout(() => $('keyhint').classList.add('hidden'), 25000);
  $('keyhint').classList.toggle('hidden', IS_TOUCH);
  refreshTasks(); updateHearts();
  toast(`地圖：${MAP_DEFS[m.map].name}　準備！`, 3500);
}
function leaveGameView() {
  G.mode = G.mode === 'play' ? 'lobby' : G.mode;
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('result').classList.add('hidden'); $('death').classList.add('hidden');
  $('keypad').classList.add('hidden'); $('pause').classList.add('hidden');
  G.keypad = null; G.menuOpen = false; Sfx.stopAmbient();
  if (document.pointerLockElement) document.exitPointerLock();
}

function applySnapshot(m) {
  G.tm = m.tm;
  const mo = G.mon; mo.tx = m.m[0]; mo.ty = m.m[1]; mo.tz = m.m[2]; mo.tyaw = m.m[3]; mo.st = m.m[4]; mo.target = m.m[5];
  if (!mo.init) { mo.x = mo.tx; mo.y = mo.ty; mo.z = mo.tz; mo.yaw = mo.tyaw; mo.init = true; }
  for (const e of m.pl) {
    if (e[0] === G.myId) { G.me.lives = e[7]; continue; }
    const o = G.others.get(e[0]); if (!o) continue;
    o.tx = e[1]; o.ty = e[2]; o.tz = e[3]; o.tyaw = e[4]; o.tpitch = e[5]; o.flags = e[6]; o.lives = e[7]; o.st = e[8];
    if (!o.init) { o.x = o.tx; o.y = o.ty; o.z = o.tz; o.yaw = o.tyaw; o.init = true; }
  }
}

/* ---------- 死亡 / 重生 / 結束 ---------- */
function onCaught(m) {
  if (m.id !== G.myId) { toast(`${m.name} 被怪物抓住了${m.ghost ? '，淘汰成為幽靈' : ''}`); return; }
  const me = G.me;
  me.st = m.ghost ? 'dead' : 'dead'; me.lives = m.lives; me.deadT = 5; me.hidden = false; me.hideIdx = -1; me.items = [];
  me.ghostPending = !!m.ghost;
  closeKeypad(); G.flashRed = 1; Sfx.caught(); updateHearts();
  const mo = G.mon; me.deathYaw = Math.atan2(-(mo.x - me.x), -(mo.z - me.z));
  $('death').classList.remove('hidden');
  $('d-title').textContent = m.ghost ? '你的生命用完了…' : '你被抓住了！';
  $('d-sub').textContent = m.ghost ? '你將成為幽靈，可以自由觀察其他玩家（他們看不到你）' : `剩餘 ${m.lives} 條命，即將在隨機位置重生`;
  refreshTasks();
}
function respawnMe(m) {
  const me = G.me;
  me.st = 'alive'; me.x = m.x; me.y = m.y; me.z = m.z; me.yaw = m.yaw; me.pitch = 0; me.vx = me.vz = me.vy = 0; me.prot = 4; me.deadT = 0; me.crouch = false;
  G.eyeY = 1.55; $('death').classList.add('hidden'); toast('已在隨機位置重生（短暫無敵）');
}
function becomeGhost() {
  const me = G.me; me.st = 'ghost'; me.ghostPending = false; me.vy = 0; me.spec = null;
  $('death').classList.add('hidden'); $('ghostbar').classList.remove('hidden'); updateGhostBar();
  toast('你成為了幽靈：WASD 飛行，點擊／Q 切換觀察對象');
}
function updateGhostBar() {
  const me = G.me; let t = '👻 自由觀察中（點擊／Q 切換玩家）';
  if (me.spec) { const o = G.others.get(me.spec); t = '👻 觀察：' + (o ? o.name : '') + '（點擊／Q 切換）'; }
  $('ghostbar').textContent = t;
}
function cycleSpectate() {
  const me = G.me; if (me.st !== 'ghost') return;
  const ids = [...G.others.values()].filter(o => o.st === 0).map(o => o.id);
  const order = [null, ...ids];
  const i = order.indexOf(me.spec);
  me.spec = order[(i + 1) % order.length];
  updateGhostBar();
}
function onEnd(m) {
  if (G.ended) return;
  G.ended = true; G.results = m;
  const me = G.me; if (!me) return;
  closeKeypad(); $('death').classList.add('hidden');
  // 通關者的通關畫面：鏡頭繞著獲勝者旋轉
  let wx = me.x, wy = me.y, wz = me.z;
  if (m.winner && m.winner !== G.myId) { const o = G.others.get(m.winner); if (o) { wx = o.x; wy = o.y; wz = o.z; } }
  G.cine = { x: wx, y: wy, z: wz, t: 0, winner: m.winner };
  const won = m.winner === G.myId;
  if (m.winner) { if (won) Sfx.win(); else Sfx.lose(); } else Sfx.lose();
  const wn = m.winner ? (m.winner === G.myId ? Store.d.name : (G.others.get(m.winner) || {}).name) : '';
  const banner = m.winner ? (m.reason === 'frog' ? `🐸 ${wn} 找到了奶蛙！` : `🎉 ${wn} 完成了物品配對！`) : (m.reason === 'timeout' ? '⏰ 時間到，沒有人完成' : '💀 全員淘汰');
  toast(banner, 4200);
  // 獎勵與稱號
  const mine = m.rank.find(r => r.id === G.myId) || { unlocks: 0, lives: 0, hides: 0 };
  let coins = 10 + mine.unlocks * 5 + Math.min(20, Math.floor(m.elapsed / 60) * 2) + (mine.lives > 0 ? 5 : 0) + (won ? 40 : 0);
  if (G.room.solo) coins = Math.floor(coins * 0.6);
  const d = Store.d, gained = [];
  const give = id => { if (!d.titles.includes(id)) { d.titles.push(id); gained.push(titleOf(id)); } };
  give('rookie');
  if (won) { give('winner'); d.wins++; if (m.reason === 'frog') give('frog'); if (mine.lives === 3) give('untouched'); if (m.elapsed < 300) give('speed'); const k = MAP_DEFS[m.map].id; if (!d.best[k] || m.elapsed < d.best[k]) d.best[k] = m.elapsed; }
  if (mine.unlocks >= 3) give('locksmith');
  if (mine.lives <= 0) give('ghost');
  d.hides += (G.roundStats.hides || 0); if (d.hides >= 10) give('hider');
  d.coins += coins; Store.save();
  G.rewardTxt = `🪙 +${coins} 金幣` + (gained.length ? `　🏅 新稱號：${gained.join('、')}` : '');
  setTimeout(() => { if (G.mode === 'play') showResult(); }, 4200);
}

/* ---------- 玩家物理 ---------- */
const K = {};
const T = { jx: 0, jy: 0, crouch: false, run: false, jump: false };
function canMove() { return G.mode === 'play' && !G.menuOpen && !G.keypad && !G.chatOpen && G.countdown <= 0 && !G.ended; }

function updateMe(dt) {
  const me = G.me, W = G.bundle.world;
  if (!me) return;
  if (me.prot > 0) me.prot -= dt;
  if (me.st === 'dead') {
    me.deadT -= dt;
    if (me.ghostPending && me.deadT < 2.5) becomeGhost();
    return;
  }
  const can = canMove();
  if (me.st === 'ghost') {
    let fx = 0, fz = 0, fy = 0;
    if (can) {
      if (K.KeyW || K.ArrowUp) fz += 1; if (K.KeyS || K.ArrowDown) fz -= 1; if (K.KeyD || K.ArrowRight) fx += 1; if (K.KeyA || K.ArrowLeft) fx -= 1;
      fx += T.jx; fz += T.jy; if (K.Space || T.jump) fy += 1; if (K.ControlLeft || K.KeyC || T.crouch) fy -= 1;
    }
    const f = fwdVec(me.yaw, me.pitch), sp = (K.ShiftLeft ? 14 : 8);
    me.x += (f[0] * fz + Math.cos(me.yaw) * fx) * sp * dt; me.z += (f[2] * fz - Math.sin(me.yaw) * fx) * sp * dt; me.y += (f[1] * fz + fy) * sp * dt;
    const bd = W.bounds; me.x = clamp(me.x, bd.x0 + 1, bd.x1 - 1); me.z = clamp(me.z, bd.z0 + 1, bd.z1 - 1); me.y = clamp(me.y, 0.3, 30);
    return;
  }
  if (me.hidden) { me.vx = me.vz = 0; me.moving = false; me.run = false; return; }
  let fx = 0, fz = 0;
  if (can) {
    if (K.KeyW || K.ArrowUp) fz += 1; if (K.KeyS || K.ArrowDown) fz -= 1; if (K.KeyD || K.ArrowRight) fx += 1; if (K.KeyA || K.ArrowLeft) fx -= 1;
    fx += T.jx; fz += T.jy;
  }
  const len = Math.hypot(fx, fz); if (len > 1) { fx /= len; fz /= len; }
  const wantCrouch = can && (K.ControlLeft || K.ControlRight || K.KeyC || T.crouch);
  if (wantCrouch) me.crouch = true;
  else if (me.crouch && !W.anyBox(me.x - PR, me.y + 1.1, me.z - PR, me.x + PR, me.y + 1.7, me.z + PR)) me.crouch = false;
  const run = can && (K.ShiftLeft || K.ShiftRight || T.run) && !me.crouch && len > 0.1;
  const speed = me.crouch ? SPEED.crouch : run ? SPEED.run : SPEED.walk;
  const dx = -Math.sin(me.yaw) * fz + Math.cos(me.yaw) * fx, dz = -Math.cos(me.yaw) * fz - Math.sin(me.yaw) * fx;
  const acc = me.onGround ? 14 : 3.5;
  me.vx += (dx * speed - me.vx) * Math.min(1, acc * dt); me.vz += (dz * speed - me.vz) * Math.min(1, acc * dt);
  const h = me.crouch ? 1.1 : 1.7;
  if (can && (K.Space || T.jump) && me.onGround && !me.crouch) { me.vy = 5.3; me.onGround = false; T.jump = false; }
  W.hMove(me, h, 0, me.vx * dt); W.hMove(me, h, 1, me.vz * dt);
  const wasG = me.onGround, vyBefore = me.vy;
  W.vMove(me, h, dt);
  W.clampBounds(me);
  if (!wasG && me.onGround && vyBefore < -3) { Sfx.land(); if (G.isHost && G.sim) G.sim.noise(me.x, me.y, me.z, 8, false); }
  const sp = Math.hypot(me.vx, me.vz);
  me.moving = sp > 0.6; me.run = run && me.moving;
  if (me.onGround && me.moving) {
    G.stepD += sp * dt; G.bob += sp * dt * 2.2;
    const stride = me.run ? 2.3 : 1.7;
    if (G.stepD > stride && !me.crouch) { G.stepD = 0; Sfx.step(me.run); }
  }
  // 傳送門
  G.portalCd -= dt;
  if (G.portalCd <= 0) {
    for (const p of G.bundle.b.portals) {
      for (const [a, b2] of [[p.a, p.b], [p.b, p.a]]) {
        if (G.portalCd <= 0 && Math.hypot(me.x - a[0], me.z - a[2]) < 1.0 && Math.abs(me.y - a[1]) < 1.5) {
          me.x = b2[0]; me.y = b2[1]; me.z = b2[2] + 1.4; me.vx = me.vz = 0; G.portalCd = 2.5; G.flashWhite = 1; Sfx.portal();
          toast('🌀 傳送！');
        }
      }
    }
  }
}
function netSendMe(dt) {
  const me = G.me; if (!me || G.mode !== 'play') return;
  G.sendT -= dt; if (G.sendT > 0) return;
  G.sendT = 0.05;
  if (me.st === 'dead' || me.st === 'ghost') return;
  const f = (me.crouch ? F_CROUCH : 0) | (me.hidden ? F_HIDDEN : 0) | (me.run ? F_RUN : 0) | (me.moving ? F_MOVE : 0) | (me.onGround ? F_GROUND : 0);
  sendHost({ t: 'p', x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(2), pitch: +me.pitch.toFixed(2), f });
}

/* ---------- 互動 ---------- */
function eyePos() {
  const me = G.me;
  return { x: me.x, y: me.y + G.eyeY, z: me.z };
}
function computeInteract() {
  const me = G.me, b = G.bundle.b, W = G.bundle.world;
  G.inter = null;
  if (!me || me.st !== 'alive' || G.mode !== 'play') return;
  if (me.hidden) { G.inter = { type: 'unhide', txt: '離開藏匿處' }; return; }
  const e = eyePos(), f = fwdVec(me.yaw, me.pitch);
  const range = IS_TOUCH ? 3.6 : 3.0;
  let best = null, bs = 1e9;
  const test = (type, idx, x, y, z, r, txt, tol) => {
    const dx = x - e.x, dy = y - e.y, dz = z - e.z;
    const t = dx * f[0] + dy * f[1] + dz * f[2];
    if (t < 0.15 || t > range) return;
    const px = e.x + f[0] * t - x, py = e.y + f[1] * t - y, pz = e.z + f[2] * t - z;
    const perp = Math.hypot(px, py, pz);
    const rr = r * (IS_TOUCH ? 1.4 : 1);
    if (perp > rr) return;
    const d = Math.hypot(dx, dy, dz);
    if (W.ray(e.x, e.y, e.z, dx / d, dy / d, dz / d, d) < d - (tol || 0.45)) return;
    const score = perp / rr + t * 0.05;
    if (score < bs) { bs = score; best = { type, idx, txt }; }
  };
  G.codes.forEach((c, i) => { const v = G.codeViews[i]; if (v) test('code', i, v.px, v.y, v.pz, 0.5, `記下${COLORS[i].name}色密碼`); });
  G.locks.forEach((l, i) => { const s = b.spots.lock[l.spot]; test('lock', i, s.x, s.y + 0.5, s.z, 0.65, l.open ? `${COLORS[i].name}色鎖（已被開啟）` : `輸入${COLORS[i].name}色密碼鎖`); });
  G.peds.forEach((p, i) => { const s = b.spots.ped[p.spot]; test('ped', i, s.x, s.y + 0.8, s.z, 0.75, me.items.includes(i) ? `放置${COLORS[i].name}色物品` : `${COLORS[i].name}色放置點（需要${COLORS[i].name}色物品）`); });
  if (!G.frog.found) { const s = b.spots.frog[G.frog.spot]; test('frog', 0, s.x, s.y + 0.06, s.z, 0.4, '🐸 抓住奶蛙！'); }
  b.spots.hide.forEach((h, i) => { const dx = h.x - e.x, dz = h.z - e.z; if (dx * dx + dz * dz < 20) test('hide', i, h.x, h.y + (h.kind === 'wardrobe' || h.kind === 'tank' ? 1.0 : 0.6), h.z, h.kind === 'bush' ? 1.0 : 0.95, '躲藏', 1.2); });
  G.inter = best;
}
function doInteract() {
  const it = G.inter, me = G.me;
  if (!it || !me || me.st !== 'alive') return;
  switch (it.type) {
    case 'code': sendHost({ t: 'insp', c: it.idx }); break;
    case 'lock': if (G.locks[it.idx].open) toast('這個鎖已經被開啟了'); else openKeypad(it.idx); break;
    case 'ped': if (me.items.includes(it.idx)) sendHost({ t: 'place', c: it.idx }); else toast(`需要先取得${COLORS[it.idx].name}色物品`); break;
    case 'frog': sendHost({ t: 'frog' }); break;
    case 'hide': sendHost({ t: 'hide', i: it.idx }); break;
    case 'unhide': sendHost({ t: 'unhide' }); break;
  }
}
/* 密碼鎖面板 */
function openKeypad(c) {
  if (G.keypad) return;
  G.keypad = { c, val: '' };
  if (document.pointerLockElement) document.exitPointerLock();
  const col = COLORS[c];
  $('kp-head').style.background = col.hex; $('kp-title').textContent = `${col.name}色密碼鎖`;
  $('keypad').classList.remove('hidden'); updateKeypad(); refreshKeypadNotes();
}
function closeKeypad() { G.keypad = null; $('keypad').classList.add('hidden'); }
function updateKeypad() { if (!G.keypad) return; const v = G.keypad.val; $('kp-disp').textContent = (v + '----').slice(0, 4).split('').join(' ').replace(/-/g, '–'); $('kp-disp').classList.remove('shake'); }
function refreshKeypadNotes() {
  const k = Object.keys(G.notes);
  $('kp-notes').textContent = k.length ? '已找到的密碼：' + k.map(c => `${COLORS[c].name} ${G.notes[c]}`).join('　') : '尚未找到任何密碼條';
}
function keypadPress(d) {
  if (!G.keypad) return;
  const k = G.keypad;
  if (d === 'del') k.val = k.val.slice(0, -1);
  else if (d === 'ok') { if (k.val.length === 4) { sendHost({ t: 'unlock', c: k.c, code: k.val }); } else toast('請輸入 4 位數字'); return; }
  else if (k.val.length < 4) { k.val += d; Sfx.click(); }
  updateKeypad();
}
