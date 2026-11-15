'use strict';
/* ===== 渲染、HUD、輸入、選單、主迴圈 ===== */
let R = null, MODELS = null;
function initRenderer() {
  try {
    R = new Renderer($('gl'));
    MODELS = buildModels(R);
    const q = QUALITY[Store.d.q] || QUALITY.mid;
    R.setScale(q.s); R.drawDist = q.d; R.detail = Store.d.q === 'low' ? 0 : 1;
    return true;
  } catch (e) {
    console.error(e);
    $('m-err').textContent = '無法啟動 3D 畫面：' + e.message + '。請改用最新版 Chrome／Safari／Edge，並開啟硬體加速。';
    return false;
  }
}

/* ---------- 畫面切換 ---------- */
const SCREENS = ['s-menu', 's-join', 's-lobby', 's-maps', 's-shop', 's-titles', 's-settings'];
function showScreen(id) { SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id)); }
function setLoading(t) { const e = $('loading'); if (!t) { e.classList.add('hidden'); return; } $('ld-txt').textContent = t; e.classList.remove('hidden'); }
function goMenu() {
  resetNetwork(); leaveGameView(); G.mode = 'menu'; G.me = null; G.cine = null; setLoading(false);
  showScreen('s-menu'); refreshMenu();
}
function refreshMenu() {
  const d = Store.d;
  $('m-coins').textContent = d.coins; $('m-name').textContent = avOf(d.av).emoji + ' ' + d.name;
  $('m-title').textContent = titleOf(d.title) || '無稱號'; $('m-title').style.display = '';
  $('m-map').textContent = MAP_DEFS[d.map].name;
  $('m-err').textContent = $('m-err').textContent || '';
}

/* ---------- 大廳 ---------- */
function refreshLobby() {
  if (G.mode !== 'lobby') return;
  $('l-code').textContent = G.room.code || '-----';
  const box = $('l-players'); box.innerHTML = '';
  G.room.players.forEach(p => {
    const d = document.createElement('div'); d.className = 'pl';
    d.innerHTML = `<span class="em">${avOf(p.av).emoji}</span><span style="flex:1"></span>`;
    const nm = d.children[1]; nm.textContent = p.name + (p.id === G.myId ? '（你）' : '');
    if (p.title) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = titleOf(p.title); nm.appendChild(t); }
    if (p.id === 'h') { const t = document.createElement('span'); t.className = 'tag'; t.textContent = '房主'; nm.appendChild(t); }
    box.appendChild(d);
  });
  const mp = $('l-map'); mp.innerHTML = '';
  MAP_DEFS.forEach((m, i) => {
    const b = document.createElement('button'); b.textContent = `${m.icon} ${m.name}`;
    if (i === G.room.map) b.classList.add('pri');
    b.disabled = !G.isHost; b.onclick = () => { G.room.map = i; Store.d.map = i; Store.save(); broadcastRoom(); };
    mp.appendChild(b);
  });
  $('l-start').classList.toggle('hidden', !G.isHost);
  $('l-hint').textContent = G.isHost ? `把代碼 ${G.room.code} 分享給朋友（最多 4 人）。所有人到齊後按「開始遊戲」。` : '等待房主開始遊戲…';
}

/* ---------- 選地圖 / 商店 / 稱號 ---------- */
function renderMaps() {
  const box = $('mp-list'); box.innerHTML = '';
  MAP_DEFS.forEach((m, i) => {
    const b = document.createElement('button'); b.className = 'mapcard' + (i === Store.d.map ? ' sel' : '');
    const best = Store.d.best[m.id];
    b.innerHTML = `<span class="em">${m.icon}</span><span><b>${m.name}</b><br><small style="color:var(--dim)">${m.sub}・以${m.axis}為主軸${best ? '・最佳 ' + fmtTime(best) : ''}</small></span>`;
    b.onclick = () => { Store.d.map = i; Store.save(); renderMaps(); refreshMenu(); };
    box.appendChild(b);
  });
}
function renderShop() {
  const d = Store.d; $('sh-coins').textContent = d.coins; $('sh-err').textContent = '';
  const box = $('sh-list'); box.innerHTML = '';
  AVATARS.forEach(a => {
    const owned = d.owned.includes(a.id), sel = d.av === a.id;
    const e = document.createElement('div'); e.className = 'item' + (sel ? ' sel' : '');
    e.innerHTML = `<div class="em">${a.emoji}</div><div class="nm">${a.name}</div>`;
    const btn = document.createElement('button'); btn.style.padding = '5px 10px'; btn.style.fontSize = '13px';
    btn.textContent = sel ? '使用中' : owned ? '使用' : `🪙 ${a.price}`;
    btn.disabled = sel;
    btn.onclick = () => {
      if (owned) { d.av = a.id; }
      else if (d.coins >= a.price) { d.coins -= a.price; d.owned.push(a.id); d.av = a.id; Sfx.pickup(); }
      else { $('sh-err').textContent = '金幣不足，去玩一場賺金幣吧！'; return; }
      Store.save(); renderShop(); refreshMenu();
    };
    e.appendChild(btn); box.appendChild(e);
  });
}
function renderTitles() {
  const d = Store.d, box = $('tt-list'); box.innerHTML = '';
  const none = document.createElement('div'); none.className = 'pl'; none.innerHTML = '<span style="flex:1">不佩戴稱號</span>';
  const nb = document.createElement('button'); nb.textContent = d.title ? '佩戴' : '使用中'; nb.disabled = !d.title; nb.onclick = () => { d.title = ''; Store.save(); renderTitles(); refreshMenu(); };
  none.appendChild(nb); box.appendChild(none);
  TITLES.forEach(t => {
    const has = d.titles.includes(t.id);
    const e = document.createElement('div'); e.className = 'pl'; e.style.opacity = has ? 1 : 0.55;
    e.innerHTML = `<span class="em">${has ? '🏅' : '🔒'}</span><span style="flex:1"><b>${t.name}</b><br><small style="color:var(--dim)">${t.desc}</small></span>`;
    const b = document.createElement('button'); b.textContent = d.title === t.id ? '使用中' : '佩戴'; b.disabled = !has || d.title === t.id;
    b.onclick = () => { d.title = t.id; Store.save(); renderTitles(); refreshMenu(); };
    e.appendChild(b); box.appendChild(e);
  });
}

/* ---------- 暫停 ---------- */
function openPause() {
  if (G.mode !== 'play' || G.menuOpen || G.ended) return;
  G.menuOpen = true; $('pause').classList.remove('hidden');
  $('p-restart').disabled = !G.isHost; $('p-restart').textContent = G.isHost ? '重新開始（重新隨機配置）' : '重新開始（僅房主）';
  if (document.pointerLockElement) document.exitPointerLock();
}
function closePause() { G.menuOpen = false; $('pause').classList.add('hidden'); $('s-settings').classList.add('hidden'); }

/* ---------- 結算 ---------- */
function showResult() {
  const m = G.results; if (!m) return;
  G.mode = 'result';
  if (document.pointerLockElement) document.exitPointerLock();
  const won = m.winner === G.myId;
  const wn = m.winner ? (m.winner === G.myId ? '你' : ((G.others.get(m.winner) || {}).name || '玩家')) : '';
  $('r-title').textContent = m.winner ? (won ? '🎉 通關成功！' : `🏁 ${wn} 通關了`) : (m.reason === 'timeout' ? '⏰ 時間到' : '💀 全員淘汰');
  $('r-sub').textContent = m.winner ? `${m.reason === 'frog' ? '找到了隱藏的奶蛙' : '完成物品放置與匹配'}・通關時間 ${m.elapsed.toFixed(1)} 秒（${fmtTime(m.elapsed)}）` : '這一局沒有人完成配對';
  const t = $('r-tab');
  t.innerHTML = '<tr><th>名次</th><th>玩家</th><th>解鎖</th><th>剩餘命</th><th>躲藏</th></tr>';
  m.rank.forEach((r, i) => {
    const tr = document.createElement('tr');
    const nm = r.id === G.myId ? Store.d.name : ((G.others.get(r.id) || {}).name || r.name);
    tr.innerHTML = `<td>${r.id === m.winner ? '🏆' : i + 1}</td><td></td><td>${r.unlocks}</td><td>${r.lives}</td><td>${r.hides}</td>`;
    tr.children[1].textContent = nm + (r.id === G.myId ? '（你）' : '');
    t.appendChild(tr);
  });
  $('r-reward').textContent = G.rewardTxt || '';
  $('r-lobby').textContent = G.room.solo ? '再玩一次' : (G.isHost ? '回到大廳（再來一局）' : '等待房主…');
  $('r-lobby').disabled = !G.isHost;
  $('result').classList.remove('hidden');
}

/* ---------- HUD ---------- */
function updateHearts() {
  const me = G.me; const n = me ? Math.max(0, me.lives) : 3;
  $('hud-lives').textContent = '❤️'.repeat(n) + '🖤'.repeat(3 - n);
}
let lastTaskKey = '';
function refreshTasks() {
  const me = G.me, box = $('hud-tasks'); if (!box || !G.locks.length) return;
  let html = '';
  COLORS.forEach((c, i) => {
    const l = G.locks[i]; if (!l) return;
    const holding = me && me.items.includes(i);
    const st = holding ? '🎒 持有，找放置點' : l.open ? '🔓 已被解鎖' : '🔒 未解鎖';
    const note = G.notes[i] ? `<span class="note">${G.notes[i]}</span>` : '';
    html += `<div class="tk"><span class="sw" style="background:${c.hex}"></span>${c.name}色 <small>${st}</small>${note}</div>`;
  });
  box.innerHTML = html;
  const it = $('itemtag'); it.textContent = me && me.items.length ? '持有物品：' + me.items.map(i => COLORS[i].name + '色').join('、') : '';
}
function drawMinimap() {
  const cv = $('mm'); if (!cv || $('hud-mini').classList.contains('min')) return;
  const me = G.me, b = G.bundle && G.bundle.b; if (!me || !b || !G.miniImg) return;
  const x = cv.getContext('2d'), w = cv.width, h = cv.height, S = 3.0, bd = b.bounds;
  x.save(); x.clearRect(0, 0, w, h);
  x.beginPath(); x.arc(w / 2, h / 2, w / 2, 0, TAU); x.clip();
  x.fillStyle = '#05070a'; x.fillRect(0, 0, w, h);
  x.translate(w / 2, h / 2); x.rotate(me.yaw); x.scale(S / 2, S / 2);
  x.translate(-(me.x - bd.x0) * 2, -(me.z - bd.z0) * 2);
  x.globalAlpha = 0.9; x.drawImage(G.miniImg, 0, 0); x.globalAlpha = 1;
  const dot = (px, pz, col, r) => { x.fillStyle = col; x.beginPath(); x.arc((px - bd.x0) * 2, (pz - bd.z0) * 2, r, 0, TAU); x.fill(); };
  G.others.forEach(o => { if (o.st === 0 && o.init && !(o.flags & F_HIDDEN)) dot(o.x, o.z, '#46c37b', 5); });
  if (G.lurePing) { const lp = G.lurePing, ph = (performance.now() % 900) / 900; x.strokeStyle = `rgba(255,170,40,${(1 - ph).toFixed(2)})`; x.lineWidth = 3; x.beginPath(); x.arc((lp.x - bd.x0) * 2, (lp.z - bd.z0) * 2, 6 + ph * 22, 0, TAU); x.stroke(); dot(lp.x, lp.z, '#ffaa28', 5); }
  const mo = G.mon; if (mo.init) { dot(mo.x, mo.z, '#ff3b3b', 8); x.strokeStyle = 'rgba(255,60,60,.5)'; x.lineWidth = 2; x.beginPath(); x.arc((mo.x - bd.x0) * 2, (mo.z - bd.z0) * 2, 14 + (performance.now() % 1000) / 1000 * 10, 0, TAU); x.stroke(); }
  x.restore();
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(w / 2, h / 2 - 11); x.lineTo(w / 2 + 7, h / 2 + 8); x.lineTo(w / 2 - 7, h / 2 + 8); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 3; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 2, 0, TAU); x.stroke();
}
const tagEls = new Map();
function updateTags() {
  const me = G.me; if (!me) return;
  const seen = new Set();
  if (me.st === 'alive' || me.st === 'ghost') {
    const W = G.bundle.world, e = camPos;
    G.others.forEach(o => {
      if (o.st !== 0 || !o.init || (o.flags & F_HIDDEN)) return;
      const dx = o.x - e.x, dy = o.y + 2.0 - e.y, dz = o.z - e.z, d = Math.hypot(dx, dy, dz);
      if (d > 28) return;
      // 投影
      const vp = R.vp, X = o.x, Y = o.y + 2.0, Z = o.z;
      const cx = vp[0] * X + vp[4] * Y + vp[8] * Z + vp[12], cy = vp[1] * X + vp[5] * Y + vp[9] * Z + vp[13], cw = vp[3] * X + vp[7] * Y + vp[11] * Z + vp[15];
      if (cw <= 0.1) return;
      if (o._losT === undefined || performance.now() - o._losT > 250) { o._losT = performance.now(); o._los = W.los(e.x, e.y, e.z, o.x, o.y + 1.6, o.z); }
      if (!o._los) return;
      let el = tagEls.get(o.id);
      if (!el) { el = document.createElement('div'); el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);font-size:13px;text-shadow:0 1px 3px #000;background:rgba(0,0,0,.45);padding:1px 8px;border-radius:8px;white-space:nowrap'; $('hud').appendChild(el); tagEls.set(o.id, el); el.textContent = avOf(o.av).emoji + ' ' + o.name; }
      el.style.display = ''; el.style.left = ((cx / cw * 0.5 + 0.5) * innerWidth) + 'px'; el.style.top = ((-cy / cw * 0.5 + 0.5) * innerHeight) + 'px';
      seen.add(o.id);
    });
  }
  tagEls.forEach((el, id) => { if (!seen.has(id)) el.style.display = 'none'; });
}

let camPos = { x: 0, y: 0, z: 0 };
const codeMeshes = new Map();
function renderFrame(dt) {
  if (!R) return;
  const me = G.me;
  if (!G.bundle || !me || (G.mode !== 'play' && G.mode !== 'result')) { R.begin({ x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0, fov: 70 }, false); return; }
  const b = G.bundle.b;
  let cam;
  if (G.cine) {
    const c = G.cine; c.t += 0; const a = c.t * 0.5;
    cam = { x: c.x + Math.sin(a) * 4.5, y: c.y + 2.6, z: c.z + Math.cos(a) * 4.5, yaw: a, pitch: -0.35, fov: 70 };
  } else if (me.st === 'ghost') {
    let o = me.spec ? G.others.get(me.spec) : null;
    if (o && o.st === 0 && o.init) cam = { x: o.x, y: o.y + 1.55, z: o.z, yaw: o.yaw, pitch: o.pitch, fov: 75 };
    else { me.spec = null; cam = { x: me.x, y: me.y, z: me.z, yaw: me.yaw, pitch: me.pitch, fov: 75 }; }
  } else if (me.st === 'dead') {
    const k = Math.min(1, (5 - me.deadT) * 3);
    const yaw = me.yaw + angDiff(me.yaw, me.deathYaw || me.yaw) * k;
    cam = { x: me.x, y: me.y + G.eyeY * (1 - k) + 0.35 * k, z: me.z, yaw, pitch: me.pitch * (1 - k) + 0.5 * k, fov: 75 };
  } else if (me.hidden) {
    cam = { x: me.x, y: me.y + 1.25, z: me.z, yaw: me.yaw, pitch: me.pitch, fov: 75 };
  } else {
    const bobY = me.moving && me.onGround ? Math.sin(G.bob) * 0.035 : 0;
    cam = { x: me.x, y: me.y + G.eyeY + bobY, z: me.z, yaw: me.yaw, pitch: me.pitch, fov: 75 + (me.run ? 4 : 0) };
  }
  camPos = cam;
  R.drawDist = (QUALITY[Store.d.q] || QUALITY.mid).d;
  R.gray = me.st === 'ghost' && !G.cine ? 0.65 : 0;
  R.begin(cam, G.flash && !(me.hidden));
  R.drawStatic(G.chunks);
  const t = performance.now() / 1000;
  // 密碼告示牌（微亮的四位數字，顏色對應鎖）
  G.codes.forEach((c, i) => {
    const v = G.codeViews[i], val = G.codeVals[i]; if (!v || !val) return;
    let mesh = codeMeshes.get(val);
    if (!mesh) { mesh = buildCodeMesh(R, val); codeMeshes.set(val, mesh); if (codeMeshes.size > 24) { const k = codeMeshes.keys().next().value; R.freeMesh(codeMeshes.get(k)); codeMeshes.delete(k); } }
    const pulse = 0.05 * Math.sin(t * 2 + i * 1.7);
    R.drawDyn(mesh, v.px, v.y, v.pz, v.yaw, 1, 1, 1, { tint: COLORS[i].rgb, emit: pulse, maxDist: 18 });
    if (v.y - v.fy < 1.05) {
      R.drawDyn(MODELS.codePost, v.px, v.y - 0.13, v.pz, v.yaw, 1, Math.max(0.05, v.y - 0.13 - v.fy), 1, { maxDist: 18 });
      R.drawDyn(MODELS.codeFoot, v.px, v.fy, v.pz, v.yaw, 1, 1, 1, { maxDist: 18 });
    }
  });
  // 鎖
  G.locks.forEach((l, i) => {
    const s = b.spots.lock[l.spot];
    if (l.open) R.drawDyn(MODELS.lockOpen, s.x, s.y, s.z, s.yaw, 1, 1, 1);
    else { R.drawDyn(MODELS.lockBody, s.x, s.y, s.z, s.yaw, 1, 1, 1); R.drawDyn(MODELS.lockBand, s.x, s.y, s.z, s.yaw, 1, 1, 1, { tint: COLORS[i].rgb }); }
  });
  // 放置點
  G.peds.forEach((p, i) => {
    const s = b.spots.ped[p.spot];
    R.drawDyn(MODELS.pedBody, s.x, s.y, s.z, 0, 1, 1, 1);
    R.drawDyn(MODELS.pedTop, s.x, s.y, s.z, 0, 1, 1, 1, { tint: COLORS[i].rgb, emit: 0.2 * Math.sin(t * 3 + i) });
    if (me.items.includes(i)) R.drawDyn(MODELS.gem, s.x, s.y + 1.35 + Math.sin(t * 2) * 0.08, s.z, t * 1.5, 1, 1, 1, { tint: COLORS[i].rgb });
  });
  if (!G.frog.found) { const s = b.spots.frog[G.frog.spot]; R.drawDyn(MODELS.frog, s.x, s.y, s.z, (s.x * 3.3 + s.z) % TAU, 1, 1, 1); }
  // 傳送門
  b.portals.forEach((p, k) => {
    [[p.a, [0.3, 0.9, 1.0]], [p.b, [0.75, 0.4, 1.0]]].forEach(([q, col]) => {
      R.drawDyn(MODELS.portalFrame, q[0], q[1], q[2], 0, 1, 1, 1);
      R.drawDyn(MODELS.portalFrame, q[0], q[1], q[2], Math.PI / 2, 1, 1, 1);
      const pulse = 0.5 + 0.4 * Math.sin(t * 3 + k);
      R.drawDyn(MODELS.portalDisc, q[0], q[1], q[2], t, 1, 1, 1, { tint: col, emit: pulse, alpha: 0.75 });
      R.drawDyn(MODELS.portalDisc, q[0], q[1], q[2], t + Math.PI / 2, 1, 1, 1, { tint: col, emit: pulse, alpha: 0.75 });
    });
  });
  // 怪物
  drawMonster(t);
  // 其他玩家
  G.others.forEach(o => {
    if (o.st !== 0 || !o.init || (o.flags & F_HIDDEN)) return;
    const av = avOf(o.av), cr = (o.flags & F_CROUCH) ? 0.68 : 1;
    R.drawDyn(MODELS.pBody, o.x, o.y, o.z, o.yaw, 1, cr, 1, { tint: av.color });
    R.drawDyn(MODELS.pHead, o.x, o.y, o.z, o.yaw, 1, cr, 1);
    R.drawDyn(MODELS.pLegs, o.x, o.y, o.z, o.yaw, 1, cr, 1);
  });
  updateTags();
}

/* 怪物：原本的瘦長黑影造型，但體型放大（加寬加粗，高度控制在不穿天花板內） */
const MON_SCALE = [1.75, 1.12, 1.75];
function drawMonster(t) {
  const mo = G.mon, M = MODELS; if (!mo.init) return;
  if (!R.visible(mo.x, mo.y + 1.4, mo.z, 4.0)) return;
  const chase = mo.st === 2, bob = Math.sin((mo.phase || 0) * 2) * 0.04;
  R.drawDyn(M.blob, mo.x, mo.y + 0.02, mo.z, mo.yaw, 1.5, 1, 1.5, { alpha: 0.5 });
  R.drawDyn(M.monster, mo.x, mo.y + bob, mo.z, mo.yaw, MON_SCALE[0], MON_SCALE[1], MON_SCALE[2], { emit: chase ? 0.25 : 0 });
}

function hudFrame(dt) {
  const me = G.me; if (G.mode !== 'play' || !me) return;
  // 計時／倒數
  const tm = $('hud-time');
  tm.textContent = G.countdown > 0 ? '準備 ' + Math.ceil(G.countdown) : fmtTime(G.tm);
  tm.classList.toggle('low', G.tm < 60 && G.countdown <= 0);
  // 提示
  const pr = $('prompt');
  let txt = '';
  if (G.countdown > 0) txt = `<b>${Math.ceil(G.countdown)}</b> 開始後找到密碼、避開怪物！`;
  else if (me.st === 'alive' && G.inter) txt = `<b>${IS_TOUCH ? '互動' : 'E'}</b>${G.inter.txt}`;
  else if (!IS_TOUCH && !G.locked && !G.menuOpen && !G.keypad && !G.chatOpen && me.st !== 'dead' && !G.ended) txt = '點擊畫面以鎖定滑鼠並開始控制';
  pr.classList.toggle('hidden', !txt); if (txt) pr.innerHTML = txt;
  // 怪物警示（邊緣泛紅＋心跳）
  const mo = G.mon; let inten = 0;
  if (mo.init && me.st === 'alive') {
    const d = Math.hypot(mo.x - me.x, mo.z - me.z) + Math.abs(mo.y - me.y) * 1.5;
    if (mo.st === 2 && mo.target === G.myId) inten = 1; else if (d < 16) inten = (1 - d / 16) * 0.7;
  }
  if (G.alertT > 0) { G.alertT -= dt; inten = Math.max(inten, 0.8); }
  inten = inten * (me.hidden ? 0.6 : 1);
  $('vig').style.boxShadow = `inset 0 0 ${120 + inten * 80}px ${30 + inten * 60}px rgba(229,72,77,${(inten * 0.85).toFixed(2)})`;
  if (inten > 0.12 && !me.hidden) Sfx.heartbeat(inten);
  // 閃光
  const f = $('flashov');
  if (G.flashRed > 0) { f.style.background = '#c00'; f.style.opacity = G.flashRed * 0.5; G.flashRed -= dt * 1.5; }
  else if (G.flashWhite > 0) { f.style.background = '#fff'; f.style.opacity = G.flashWhite * 0.8; G.flashWhite -= dt * 2.5; }
  else f.style.opacity = 0;
  $('hidemask').classList.toggle('hidden', !me.hidden);
  $('death').querySelector('#d-sub').textContent = me.st === 'dead' && !me.ghostPending ? `剩餘 ${me.lives} 條命，${Math.max(0, Math.ceil(me.deadT))} 秒後在隨機位置重生` : $('d-sub').textContent;
  if (G.hbT === undefined) G.hbT = 0; G.hbT -= dt; if (G.hbT <= 0) { G.hbT = 0.1; drawMinimap(); }
  updateHearts();
}

/* ---------- 輸入 ---------- */
function setupInput() {
  const cv = $('gl');
  const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ControlLeft', 'ShiftLeft', 'Tab'];
  window.addEventListener('keydown', e => {
    if (G.chatOpen) return; // 聊天輸入框自行處理 Enter / Esc
    const tgt = e.target;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT')) {
      if (G.keypad === null || tgt.id === 'chatin') return;
    }
    if (G.keypad) {
      if (e.key >= '0' && e.key <= '9') keypadPress(e.key);
      else if (e.code === 'Backspace') keypadPress('del');
      else if (e.code === 'Enter') keypadPress('ok');
      else if (e.code === 'Escape' || e.code === 'KeyE') closeKeypad();
      e.preventDefault(); return;
    }
    if (G.mode === 'play' && gameKeys.includes(e.code)) e.preventDefault();
    K[e.code] = true;
    if (G.mode !== 'play') return;
    if (e.code === 'Escape') { if (G.menuOpen) { closePause(); lockPointer(); } else openPause(); e.preventDefault(); return; }
    if (G.menuOpen || G.ended) return;
    if (e.code === 'KeyE') doInteract();
    else if (e.code === 'KeyF') { G.flash = !G.flash; Sfx.click(); }
    else if (e.code === 'KeyM') $('hud-mini').classList.toggle('min');
    else if (e.code === 'KeyQ') cycleSpectate();
    else if (e.code === 'Enter' || e.code === 'KeyT') { openChat(); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { K[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in K) K[k] = false; });
  cv.addEventListener('mousedown', () => {
    if (G.mode !== 'play' || G.menuOpen || G.keypad) return;
    if (!document.pointerLockElement) lockPointer();
    else if (G.me && G.me.st === 'ghost') cycleSpectate();
  });
  document.addEventListener('pointerlockchange', () => {
    const was = G.locked; G.locked = document.pointerLockElement === cv;
    if (was && !G.locked && G.mode === 'play' && !G.keypad && !G.chatOpen && !G.ended) openPause();
  });
  document.addEventListener('mousemove', e => {
    if (G.mode !== 'play' || !G.me || G.menuOpen || G.keypad || G.chatOpen || G.ended) return;
    if (document.pointerLockElement !== cv && !(e.buttons & 1)) return;
    if (Math.abs(e.movementX) > 220 || Math.abs(e.movementY) > 220) return; // 忽略鎖定滑鼠瞬間的假位移
    const k = Store.d.sens * 0.00018;
    G.me.yaw -= e.movementX * k; G.me.pitch = clamp(G.me.pitch - e.movementY * k, -1.45, 1.45);
  });
  /* 觸控 */
  const joy = $('joy'), knob = joy.querySelector('i'), look = $('lookpad');
  let jid = null, jc = null, lid = null, lx = 0, ly = 0;
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; e.preventDefault(); joyMove(e); });
  const joyMove = e => { if (e.pointerId !== jid) return; let dx = (e.clientX - jc.x) / jc.r, dy = (e.clientY - jc.y) / jc.r; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } T.jx = dx; T.jy = -dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; };
  joy.addEventListener('pointermove', joyMove);
  const joyEnd = e => { if (e.pointerId !== jid) return; jid = null; T.jx = T.jy = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
  look.addEventListener('pointerdown', e => { lid = e.pointerId; look.setPointerCapture(lid); lx = e.clientX; ly = e.clientY; e.preventDefault(); });
  look.addEventListener('pointermove', e => {
    if (e.pointerId !== lid || !G.me || G.menuOpen || G.keypad || G.chatOpen) return;
    const k = Store.d.sens * 0.00032;
    G.me.yaw -= (e.clientX - lx) * k; G.me.pitch = clamp(G.me.pitch - (e.clientY - ly) * k, -1.45, 1.45); lx = e.clientX; ly = e.clientY;
  });
  const lookEnd = e => { if (e.pointerId === lid) lid = null; };
  look.addEventListener('pointerup', lookEnd); look.addEventListener('pointercancel', lookEnd);
  const tap = (id, fn) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); fn(b); }); };
  tap('tb-act', () => { if (G.me && G.me.st === 'ghost') cycleSpectate(); else doInteract(); });
  tap('tb-jump', () => { T.jump = true; setTimeout(() => { T.jump = false; }, 150); });
  tap('tb-crouch', b => { T.crouch = !T.crouch; b.classList.toggle('on', T.crouch); });
  tap('tb-run', b => { T.run = !T.run; b.classList.toggle('on', T.run); });
  tap('tb-menu', () => openPause());
  tap('tb-chat', () => openChat());
  tap('tb-flash', () => { G.flash = !G.flash; });
}
function lockPointer() { if (IS_TOUCH || !G.me) return; try { const p = $('gl').requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
function openChat() { if (G.mode !== 'play') return; G.chatOpen = true; $('chatbox').classList.remove('hidden'); $('chatin').value = ''; if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => $('chatin').focus(), 20); }
function closeChat() { G.chatOpen = false; $('chatbox').classList.add('hidden'); $('chatin').blur(); }

/* ---------- 選單接線 ---------- */
function applySettings() {
  const d = Store.d;
  Sfx.setVolume(d.vol / 100);
  if (R) { const q = QUALITY[d.q] || QUALITY.mid; R.setScale(q.s); R.drawDist = q.d; R.detail = d.q === 'low' ? 0 : 1; }
}
function wireUI() {
  const on = (id, fn) => $(id).addEventListener('click', e => { Sfx.init(); Sfx.click(); fn(e); });
  on('b-start', () => { $('m-err').textContent = ''; createRoom(true); });
  on('b-create', () => { $('m-err').textContent = ''; createRoom(false); });
  on('b-join', () => { showScreen('s-join'); $('j-err').textContent = ''; $('j-code').focus(); });
  on('b-maps', () => { renderMaps(); showScreen('s-maps'); });
  on('b-shop', () => { renderShop(); showScreen('s-shop'); });
  on('b-titles', () => { renderTitles(); showScreen('s-titles'); });
  on('b-set', () => { openSettings(); });
  on('j-back', () => showScreen('s-menu'));
  on('j-go', () => joinRoom($('j-code').value));
  $('j-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom($('j-code').value); });
  on('mp-back', () => { refreshMenu(); showScreen('s-menu'); });
  on('sh-back', () => { refreshMenu(); showScreen('s-menu'); });
  on('tt-back', () => { refreshMenu(); showScreen('s-menu'); });
  on('st-back', () => { if (G.mode === 'play') $('s-settings').classList.add('hidden'); else { refreshMenu(); showScreen('s-menu'); } });
  on('l-leave', () => goMenu());
  on('l-start', () => { if (G.isHost) hostStartGame(); });
  on('l-copy', () => { copyText(G.room.code, '已複製房間代碼'); });
  on('l-share', () => { copyText(location.origin + location.pathname + '?room=' + G.room.code, '已複製邀請連結'); });
  const sendLobbyChat = () => { const v = $('l-chatin').value.trim(); if (v) { sendHost({ t: 'chat', s: v }); $('l-chatin').value = ''; } };
  on('l-send', sendLobbyChat);
  $('l-chatin').addEventListener('keydown', e => { if (e.key === 'Enter') sendLobbyChat(); });
  on('p-resume', () => { closePause(); lockPointer(); });
  on('p-set', () => openSettings());
  on('p-restart', () => { closePause(); hostBackToLobby(); });
  on('p-quit', () => { closePause(); goMenu(); });
  on('r-lobby', () => { if (G.isHost) hostBackToLobby(); });
  on('r-home', () => goMenu());
  on('kp-close', () => closeKeypad());
  on('kp-ok', () => keypadPress('ok'));
  const pad = $('kp-pad');
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].forEach(k => {
    const b = document.createElement('button'); b.textContent = k === 'del' ? '⌫' : k === 'ok' ? '✔' : k;
    b.addEventListener('click', () => keypadPress(k)); pad.appendChild(b);
  });
  on('mm-t', () => { const m = $('hud-mini'); m.classList.toggle('min'); $('mm-t').textContent = m.classList.contains('min') ? '小地圖 ▸' : '小地圖 ▾'; });
  // 設定
  const d = Store.d;
  $('st-name').value = d.name; $('st-vol').value = d.vol; $('st-q').value = d.q; $('st-sens').value = d.sens;
  const upd = () => { $('st-vol-v').textContent = d.vol + '%'; $('st-sens-v').textContent = d.sens; };
  upd();
  $('st-name').addEventListener('input', e => { d.name = e.target.value.slice(0, 10) || '玩家'; Store.save(); });
  $('st-vol').addEventListener('input', e => { d.vol = +e.target.value; upd(); applySettings(); Store.save(); });
  $('st-sens').addEventListener('input', e => { d.sens = +e.target.value; upd(); Store.save(); });
  $('st-q').addEventListener('change', e => { d.q = e.target.value; applySettings(); Store.save(); });
  $('chatin').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.code === 'Enter' || e.key === 'Enter') { const v = $('chatin').value.trim(); if (v) sendHost({ t: 'chat', s: v }); closeChat(); lockPointer(); e.preventDefault(); }
    else if (e.code === 'Escape') { closeChat(); lockPointer(); e.preventDefault(); }
  });
  const room = URLQ.get('room');
  if (room) { $('j-code').value = normalizeCode(room); showScreen('s-join'); }
}
function openSettings() { $('st-name').value = Store.d.name; $('s-settings').classList.remove('hidden'); if (G.mode !== 'play') showScreen('s-settings'); }
function copyText(s, msg) {
  const done = () => { const e = $('l-err'); e.style.color = 'var(--good)'; e.textContent = msg; setTimeout(() => { e.textContent = ''; e.style.color = ''; }, 1800); };
  try { navigator.clipboard.writeText(s).then(done, () => { prompt('請複製：', s); }); } catch (e) { prompt('請複製：', s); }
}

/* ---------- 主迴圈 ---------- */
let lastT = performance.now(), fpsAcc = 0, fpsN = 0, lowCount = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (dt <= 0) return;
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 2) {
    const fps = fpsN / fpsAcc; $('fps').textContent = Math.round(fps) + ' FPS' + (R ? `・${R.stats.chunks}區` : ''); fpsAcc = 0; fpsN = 0;
    if (G.mode === 'play' && fps < 26) { if (++lowCount >= 2 && Store.d.q !== 'low') { Store.d.q = Store.d.q === 'high' ? 'mid' : 'low'; $('st-q').value = Store.d.q; applySettings(); toast('偵測到畫面不順，已自動降低畫質'); lowCount = 0; } } else lowCount = 0;
  }
  if (G.mode === 'play' && G.me) {
    if (G.countdown > 0) { G.countdown -= dt; if (G.countdown <= 0) toast('開始！'); }
    if (G.isHost && G.sim) {
      if (G.simDelay > 0) G.simDelay -= dt;
      else if (G.sim.status === 'playing') {
        G.sim.tick(dt);
        G.snapT -= dt; if (G.snapT <= 0) { G.snapT = 1 / 12; hostSend('all', G.sim.snapshot()); }
      }
    }
    updateMe(dt); netSendMe(dt);
    const eyeT = G.me.crouch ? 1.0 : 1.55; G.eyeY += (eyeT - G.eyeY) * Math.min(1, 10 * dt);
    const k = Math.min(1, 14 * dt);
    G.others.forEach(o => { if (!o.init) return; o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k; o.yaw += angDiff(o.yaw, o.tyaw) * k; o.pitch += (o.tpitch - o.pitch) * k; });
    const mo = G.mon;
    if (mo.init) {
      const ox = mo.x, oz = mo.z;
      mo.x += (mo.tx - mo.x) * k; mo.y += (mo.ty - mo.y) * k; mo.z += (mo.tz - mo.z) * k; mo.yaw += angDiff(mo.yaw, mo.tyaw) * k;
      const moved = Math.hypot(mo.x - ox, mo.z - oz);
      const sp0 = Math.floor((mo.phase || 0) / Math.PI);
      mo.phase = (mo.phase || 0) + Math.min(moved, 1.0) * 2.0;
      const dM = G.me ? Math.hypot(mo.x - G.me.x, mo.z - G.me.z) : 99;
      if (Math.floor(mo.phase / Math.PI) !== sp0 && dM < 30) Sfx.stomp(clamp(1.1 - dM / 30, 0.1, 1) * (mo.st === 2 ? 1 : 0.7));
      if (mo.st !== mo.prevSt) { if (mo.st === 2 && dM < 45) Sfx.growl(clamp(1.1 - dM / 45, 0.2, 1)); mo.prevSt = mo.st; }
    }
    if (G.lurePing) { G.lurePing.t -= dt; if (G.lurePing.t <= 0) G.lurePing = null; }
    computeInteract();
    if (G.cine) G.cine.t += dt;
  } else if (G.mode === 'result' && G.cine) G.cine.t += dt;
  renderFrame(dt);
  hudFrame(dt);
}

/* ---------- 啟動 ---------- */
function boot() {
  wireUI(); setupInput(); refreshMenu();
  window.addEventListener('resize', () => { if (R) R.resize(); });
  if (!initRenderer()) { /* 仍顯示選單與錯誤訊息 */ }
  applySettings();
  window.__HC = { G, Store, Sim, getBundle, MAP_DEFS, K, T, COLORS };
  requestAnimationFrame(frame);
}
boot();
