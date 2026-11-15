'use strict';
/* ===== 房主端權威模擬：規則、怪物 AI、解鎖狀態（無 DOM，可在 Node 測試） ===== */
const COLORS = [
  { id: 0, name: '紅', hex: '#e5484d', rgb: [0.90, 0.28, 0.30] },
  { id: 1, name: '藍', hex: '#3e8bff', rgb: [0.24, 0.55, 1.0] },
  { id: 2, name: '綠', hex: '#3fb950', rgb: [0.25, 0.73, 0.31] },
  { id: 3, name: '黃', hex: '#f2c744', rgb: [0.95, 0.78, 0.27] },
];
const SPEED = { walk: 3.6, run: 6.0, crouch: 1.8 };
const MON = { patrol: 1.7, invest: 3.0, chase: 5.4, view: 20, fov: 0.42, seeNeeded: 2.0, giveUp: 4.0, catchR: 1.35, lureTime: 8.0, lureMax: 12.5 };
const ROUND_TIME = 1200;
const F_CROUCH = 1, F_HIDDEN = 2, F_RUN = 4, F_MOVE = 8, F_GROUND = 16;

const MAP_CACHE = {};
function getBundle(idx, needNav) {
  let c = MAP_CACHE[idx];
  if (!c) { const b = MAP_DEFS[idx].build(); c = MAP_CACHE[idx] = { idx, b, world: new World(b), nav: null }; }
  if (needNav && !c.nav) {
    c.nav = new Nav(c.world);
    const nav = c.nav, b = c.b;
    const ok = (p, h, v) => { const i = nav.nearest(p.x, p.y, p.z, 4); return i >= 0 && nav.inMain(i) && Math.hypot(nav.nx[i] - p.x, nav.nz[i] - p.z) <= h && Math.abs(nav.ny[i] - p.y) <= v; };
    c.valid = {};
    for (const k of ['code', 'lock', 'ped', 'frog']) c.valid[k] = b.spots[k].map((p, i) => i).filter(i => ok(b.spots[k][i], 1.8, 1.3));
    // 密碼告示牌：只保留「從可走到的位置確實看得到」的點，並算出朝向／高度
    c.codeView = [];
    const viewFor = sp => {
      let best = null, bs = 1e9;
      for (const r of [1.6, 2.1, 2.6, 3.1, 3.6, 4.2]) for (let a = 0; a < 16; a++) {
        const ang = a * Math.PI / 8, x = sp.x + Math.cos(ang) * r, z = sp.z + Math.sin(ang) * r;
        const i = nav.nearest(x, sp.y, z, 2);
        if (i < 0 || !nav.inMain(i) || Math.hypot(nav.nx[i] - x, nav.nz[i] - z) > 0.35) continue;
        const fy = nav.ny[i], rel = sp.y - fy;
        if (rel < -0.3 || rel > 2.6) continue;
        const dy = Math.min(Math.max(sp.y, fy + 0.5), fy + 1.9);
        const nx = nav.nx[i], nz = nav.nz[i], fx = nx - sp.x, fz = nz - sp.z, fl = Math.hypot(fx, fz);
        if (fl < 0.5) continue;
        const px = sp.x + fx / fl * 0.05, pz = sp.z + fz / fl * 0.05, sx = -fz / fl * 0.25, sz = fx / fl * 0.25, ey = fy + 1.55;
        if (!c.world.los(nx, ey, nz, px, dy, pz) || !c.world.los(nx, ey, nz, px + sx, dy, pz + sz) || !c.world.los(nx, ey, nz, px - sx, dy, pz - sz)) continue;
        const sc = Math.abs(r - 2.6) + Math.abs(dy - (fy + 1.2)) * 0.4;
        if (sc < bs) { bs = sc; best = { yaw: Math.round(Math.atan2(fx, fz) * 100) / 100, y: Math.round(dy * 100) / 100, fy: Math.round(fy * 100) / 100, px: Math.round(px * 100) / 100, pz: Math.round(pz * 100) / 100 }; }
      }
      return best;
    };
    b.spots.code.forEach((sp, i) => { c.codeView[i] = viewFor(sp); });
    c.valid.code = c.valid.code.filter(i => c.codeView[i]);
    c.valid.hide = b.spots.hide.map((p, i) => i).filter(i => ok({ x: b.spots.hide[i].ex, y: b.spots.hide[i].y, z: b.spots.hide[i].ez }, 0.9, 0.9));
    const arr = p => ({ x: p[0], y: p[1], z: p[2] });
    c.spawns = b.spots.spawn.filter(p => ok(arr(p), 1.0, 0.7));
    // 巡邏路線（固定）：最近鄰排序，並確認相鄰點可達
    let pts = b.spots.patrol.filter(p => ok(arr(p), 1.0, 0.7)).map(p => nav.nearest(p[0], p[1], p[2], 4));
    const route = [];
    if (pts.length) {
      let cur = pts.shift(); route.push(cur);
      while (pts.length) {
        let bi = 0, bd = 1e9;
        pts.forEach((n, i) => { const d = (nav.nx[n] - nav.nx[cur]) ** 2 + (nav.nz[n] - nav.nz[cur]) ** 2 + ((nav.ny[n] - nav.ny[cur]) * 3) ** 2; if (d < bd) { bd = d; bi = i; } });
        const nx = pts.splice(bi, 1)[0];
        if (nav.path(cur, nx, 40000)) { route.push(nx); cur = nx; }
      }
    }
    c.route = route;
  }
  return c;
}

class Sim {
  constructor(mapIdx, seed, roster, emit) {
    this.mapIdx = mapIdx;
    this.bundle = getBundle(mapIdx, true);
    this.b = this.bundle.b; this.world = this.bundle.world; this.nav = this.bundle.nav;
    this.def = MAP_DEFS[mapIdx];
    this.rng = mulberry32(seed >>> 0);
    this.emit = emit;
    this.time = ROUND_TIME; this.status = 'playing'; this.t = 0; this.startAt = 0;
    this.players = new Map();
    this.chatLog = [];
    this.layout();
    // 玩家出生
    const spawns = shuffle(this.rng, this.bundle.spawns);
    this.initMonster(spawns);
    roster.forEach((r, i) => {
      const sp = spawns[i % spawns.length];
      this.players.set(r.id, {
        id: r.id, name: r.name, av: r.av, x: sp[0], y: sp[1], z: sp[2], yaw: this.rng() * TAU, pitch: 0, flags: 0,
        lives: 3, st: 'alive', deadT: 0, items: [], unlocks: 0, hideIdx: -1, seen: 0, prot: 3, noiseT: 0, hides: 0, deaths: 0,
      });
    });
  }
  /* 隨機配置：密碼、鎖、放置點、奶蛙 */
  layout() {
    const v = this.bundle.valid, rng = this.rng, b = this.b;
    const pickSpaced = (kind, n, minD, avoid) => {
      const out = [];
      for (const i of shuffle(rng, v[kind])) {
        const p = b.spots[kind][i];
        if (out.some(j => Math.hypot(b.spots[kind][j].x - p.x, b.spots[kind][j].z - p.z) < minD)) continue;
        if (avoid && avoid.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 5)) continue;
        out.push(i); if (out.length >= n) break;
      }
      return out;
    };
    const locks = pickSpaced('lock', 4, 11);
    const peds = pickSpaced('ped', 4, 11, locks.map(i => b.spots.lock[i]));
    const codes = pickSpaced('code', 4, 7);
    this.locks = locks.map((spot, c) => ({ spot, open: false, by: null }));
    this.peds = peds.map(spot => ({ spot }));
    this.codes = codes.map(spot => ({ spot, value: this.newCode() }));
    this.frog = { spot: v.frog[Math.floor(rng() * v.frog.length)], found: false };
    this.hideTaken = {};
  }
  newCode() { return String(1000 + Math.floor(this.rng() * 9000)); }
  worldMsg() {
    return { t: 'world', map: this.mapIdx, codes: this.codes.map(c => c.spot), vals: this.codes.map(c => c.value), views: this.codes.map(c => this.bundle.codeView[c.spot]), locks: this.locks.map(l => ({ spot: l.spot, open: l.open, by: l.by })), peds: this.peds.map(p => p.spot), frog: this.frog.spot, frogFound: this.frog.found };
  }
  initMonster(spawns) {
    const nav = this.nav, route = this.bundle.route;
    let best = 0, bd = -1;
    route.forEach((n, i) => {
      const md = Math.min(...spawns.slice(0, 4).map(s => Math.hypot(nav.nx[n] - s[0], nav.nz[n] - s[2])));
      if (md > bd) { bd = md; best = i; }
    });
    const n = route[best];
    this.mon = { x: nav.nx[n], y: nav.ny[n], z: nav.nz[n], yaw: 0, st: 'patrol', wp: best, path: null, pi: 0, target: null, cool: 2, lost: 0, repath: 0, idle: 0, inv: null, node: n, stuck: 0 };
  }
  /* ---------- 訊息處理 ---------- */
  handle(pid, m) {
    const p = this.players.get(pid);
    if (!p || this.status !== 'playing') { if (m.t === 'chat' && p) this.chat(p, m.s); return; }
    switch (m.t) {
      case 'p':
        if (p.st === 'dead') break;
        p.x = m.x; p.y = m.y; p.z = m.z; p.yaw = m.yaw; p.pitch = m.pitch; p.flags = m.f | 0;
        break;
      case 'insp': {
        const c = this.codes[m.c]; if (!c || p.st !== 'alive') break;
        const s = this.b.spots.code[c.spot];
        if (Math.hypot(s.x - p.x, s.z - p.z) < 5 && Math.abs(s.y - p.y) < 4) this.emit(pid, { t: 'note', c: m.c, v: c.value });
        break;
      }
      case 'unlock': {
        const l = this.locks[m.c]; if (!l || p.st !== 'alive') break;
        const s = this.b.spots.lock[l.spot];
        if (Math.hypot(s.x - p.x, s.z - p.z) > 5 || Math.abs(s.y - p.y) > 4) break;
        if (l.open) { this.emit(pid, { t: 'lockmsg', c: m.c, s: '這個鎖已經被開啟了' }); break; }
        if (String(m.code) === this.codes[m.c].value) {
          l.open = true; l.by = pid; p.items.push(m.c); p.unlocks++;
          this.emit('all', { t: 'unlocked', c: m.c, by: pid, name: p.name });
        } else {
          this.emit(pid, { t: 'wrong', c: m.c });
          this.lure(s, m.c);
        }
        break;
      }
      case 'place': {
        const pd = this.peds[m.c]; if (!pd || p.st !== 'alive') break;
        const s = this.b.spots.ped[pd.spot];
        if (Math.hypot(s.x - p.x, s.z - p.z) > 4.5 || Math.abs(s.y - p.y) > 4) break;
        if (!p.items.includes(m.c)) { this.emit(pid, { t: 'lockmsg', c: m.c, s: '你還沒有這個顏色的物品' }); break; }
        this.emit('all', { t: 'placed', c: m.c, by: pid, name: p.name });
        this.end('place', pid);
        break;
      }
      case 'frog': {
        const s = this.b.spots.frog[this.frog.spot];
        if (!this.frog.found && p.st === 'alive' && Math.hypot(s.x - p.x, s.z - p.z) < 3.5 && Math.abs(s.y - p.y) < 3) { this.frog.found = true; this.end('frog', pid); }
        break;
      }
      case 'hide': {
        const h = this.b.spots.hide[m.i]; if (!h || p.st !== 'alive' || p.hideIdx >= 0) break;
        if (this.hideTaken[m.i]) { this.emit(pid, { t: 'lockmsg', s: '這裡已經有人躲了' }); break; }
        if (Math.hypot(h.x - p.x, h.z - p.z) > 3.5 || Math.abs(h.y - p.y) > 2.5) break;
        p.hideIdx = m.i; this.hideTaken[m.i] = pid; p.hides++;
        p.x = h.x; p.y = h.y; p.z = h.z; p.flags |= F_HIDDEN;
        const mon = this.mon;
        if (mon.st === 'chase' && mon.target === pid && Math.hypot(mon.x - p.x, mon.z - p.z) > MON.catchR + 0.4) this.monGiveUp();
        this.emit(pid, { t: 'hideok', i: m.i });
        break;
      }
      case 'unhide': {
        if (p.hideIdx >= 0) { const h = this.b.spots.hide[p.hideIdx]; delete this.hideTaken[p.hideIdx]; p.hideIdx = -1; p.flags &= ~F_HIDDEN;
          const n = this.nav.nearest(h.ex, h.y, h.ez, 4);
          const ok = n >= 0 && Math.hypot(this.nav.nx[n] - h.ex, this.nav.nz[n] - h.ez) < 1.5;
          const ox = ok ? this.nav.nx[n] : h.ex, oy = ok ? this.nav.ny[n] : h.y, oz = ok ? this.nav.nz[n] : h.ez;
          p.x = ox; p.z = oz; p.y = oy; this.emit(pid, { t: 'unhideok', x: ox, y: oy, z: oz }); }
        break;
      }
      case 'chat': this.chat(p, m.s); break;
    }
  }
  chat(p, s) { s = String(s || '').slice(0, 60); if (s) this.emit('all', { t: 'chat', n: p.name, s }); }
  /* ---------- 輸錯密碼：怪物一定會在約 10 秒內趕到那個鎖 ---------- */
  lure(s, color) {
    const m = this.mon, nav = this.nav;
    if (m.st === 'chase') return false;          // 已經在追人時，不會被引開（專心追眼前的人）
    const target = nav.nearest(s.x, s.y, s.z, 6);
    const a = nav.nearest(m.x, m.y, m.z, 4);
    if (target < 0 || a < 0) return false;
    let path = nav.path(a, target, 120000);
    if (!path) return false;
    const plen = pth => { let L = 0; for (let i = 1; i < pth.length; i++) L += Math.hypot(nav.nx[pth[i]] - nav.nx[pth[i - 1]], nav.ny[pth[i]] - nav.ny[pth[i - 1]], nav.nz[pth[i]] - nav.nz[pth[i - 1]]); return L; };
    let L = plen(path), speed = Math.max(MON.invest, L / MON.lureTime), tele = false; const L0 = L;
    if (speed > MON.lureMax) {
      // 太遠：若沒有任何玩家看得到／在附近，就把怪物往前「挪」到趕得上的位置（看不見才挪）
      const keep = MON.lureMax * MON.lureTime;
      let acc = 0, k = path.length - 1;
      while (k > 0 && acc < keep) { const n0 = path[k], n1 = path[k - 1]; acc += Math.hypot(nav.nx[n0] - nav.nx[n1], nav.ny[n0] - nav.ny[n1], nav.nz[n0] - nav.nz[n1]); k--; }
      const near = (x, y, z) => [...this.players.values()].some(p => p.st === 'alive' && (Math.hypot(p.x - x, p.y - y, p.z - z) < 6 || (Math.hypot(p.x - x, p.z - z) < 45 && this.world.los(p.x, p.y + 1.5, p.z, x, y + 1.6, z))));
      if (k > 0 && !near(m.x, m.y, m.z)) {
        // 從「剛好趕得上」的位置開始，往鎖的方向找第一個沒人看得到的落點
        while (k < path.length - 1 && near(nav.nx[path[k]], nav.ny[path[k]], nav.nz[path[k]])) k++;
      } else k = 0;
      if (k > 0 && !near(nav.nx[path[k]], nav.ny[path[k]], nav.nz[path[k]])) {
        m.x = nav.nx[path[k]]; m.y = nav.ny[path[k]]; m.z = nav.nz[path[k]]; m.node = path[k];
        path = path.slice(k); L = plen(path); speed = Math.max(MON.invest, L / MON.lureTime); tele = true;
      }
      speed = Math.min(speed, MON.lureMax);
    }
    m.st = 'investigate'; m.inv = { x: s.x, y: s.y, z: s.z }; m.path = path; m.pi = path.length > 1 ? 1 : 0;
    m.idle = 0; m.cool = 0; m.rushSpeed = speed; m.target = null; this.lastLure = { L0: Math.round(L0), L: Math.round(L), speed: Math.round(speed * 10) / 10, tele };
    this.emit('all', { t: 'lure', c: color, x: s.x, y: s.y, z: s.z, eta: Math.round(L / speed * 10) / 10 });
    return true;
  }
  /* ---------- 噪音 ---------- */
  noise(x, y, z, r, strong) {
    const m = this.mon;
    if (m.st === 'chase' || m.cool > 0) return;
    if (Math.hypot(m.x - x, m.z - z) > r || Math.abs(m.y - y) > 7) return;
    if (m.st === 'investigate' && !strong) return;
    m.st = 'investigate'; m.inv = { x, y, z }; m.path = null; m.idle = 0; m.rushSpeed = 0;
    const n = this.nav.nearest(x, y, z, 4);
    if (n >= 0) this.monPathTo(n); else m.st = 'patrol';
  }
  /* ---------- 怪物 ---------- */
  monPathTo(node) {
    const m = this.mon, nav = this.nav;
    const a = nav.nearest(m.x, m.y, m.z, 4);
    if (a < 0) { m.path = null; return false; }
    const p = nav.path(a, node);
    m.path = p; m.pi = 0;
    if (p && p.length > 1) m.pi = 1;
    return !!p;
  }
  monGiveUp() {
    const m = this.mon;
    m.st = 'patrol'; m.target = null; m.path = null; m.lost = 0; m.cool = 1.2; m.rushSpeed = 0;
    // 回到最近的巡邏點
    let bi = 0, bd = 1e9; const nav = this.nav;
    this.bundle.route.forEach((n, i) => { const d = (nav.nx[n] - m.x) ** 2 + (nav.nz[n] - m.z) ** 2 + ((nav.ny[n] - m.y) * 4) ** 2; if (d < bd) { bd = d; bi = i; } });
    m.wp = bi;
  }
  monMove(dt, speed) {
    const m = this.mon, nav = this.nav;
    if (!m.path || m.pi >= m.path.length) return true;
    let step = speed * dt;
    while (step > 0 && m.pi < m.path.length) {
      const n = m.path[m.pi];
      const dx = nav.nx[n] - m.x, dz = nav.nz[n] - m.z, d = Math.hypot(dx, dz);
      if (d <= step) { m.x = nav.nx[n]; m.z = nav.nz[n]; m.y += (nav.ny[n] - m.y) * Math.min(1, 12 * dt) + 0; m.node = n; step -= d; m.pi++; if (d > 0.01) m.yaw = Math.atan2(-dx, -dz); }
      else {
        m.x += dx / d * step; m.z += dz / d * step;
        m.y += (nav.ny[n] - m.y) * Math.min(1, 10 * dt);
        m.yaw = Math.atan2(-dx, -dz); step = 0;
      }
    }
    return m.pi >= m.path.length;
  }
  monSee(p) {
    const m = this.mon;
    if (p.st !== 'alive' || (p.flags & F_HIDDEN)) return false;
    const dx = p.x - m.x, dz = p.z - m.z, d = Math.hypot(dx, dz);
    const crouch = p.flags & F_CROUCH;
    if (d > MON.view * (crouch ? 0.6 : 1)) return false;
    if (Math.abs(p.y - m.y) > 4.5) return false;
    const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw);
    if ((dx * fx + dz * fz) / Math.max(d, 0.001) < MON.fov && d > 2.5) return false;
    return this.world.los(m.x, m.y + 1.9, m.z, p.x, p.y + (crouch ? 0.9 : 1.5), p.z);
  }
  tickMonster(dt) {
    const m = this.mon, nav = this.nav, route = this.bundle.route;
    if (m.cool > 0) m.cool -= dt;
    // 視線偵測
    let target = null, bd = 1e9;
    for (const p of this.players.values()) {
      const vis = this.monSee(p);
      if (vis) p.seen = Math.min(MON.seeNeeded + 0.5, p.seen + dt); else p.seen = Math.max(0, p.seen - dt * 0.7);
      if (vis) { const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < bd) { bd = d; target = p; } }
      // 跑步腳步聲
      if (p.st === 'alive' && (p.flags & F_RUN) && (p.flags & F_MOVE) && (p.flags & F_GROUND) && !(p.flags & F_HIDDEN)) {
        p.noiseT -= dt;
        if (p.noiseT <= 0) { p.noiseT = 1.0; this.noise(p.x, p.y, p.z, 9, false); }
      }
    }
    if (m.st !== 'chase' && m.cool <= 0) {
      for (const p of this.players.values()) {
        if (p.seen >= MON.seeNeeded && this.monSee(p) && p.prot <= 0) {
          m.st = 'chase'; m.target = p.id; m.lost = 0; m.repath = 0; m.path = null; m.rushSpeed = 0;
          this.emit(p.id, { t: 'alert' });
          break;
        }
      }
    }
    if (m.st === 'chase') {
      const tp = this.players.get(m.target);
      if (!tp || tp.st !== 'alive') { this.monGiveUp(); }
      else if (tp.flags & F_HIDDEN) { if (Math.hypot(tp.x - m.x, tp.z - m.z) > MON.catchR + 0.4) this.monGiveUp(); }
      else {
        const vis = this.monSee(tp) || Math.hypot(tp.x - m.x, tp.z - m.z) < 4;
        if (vis) m.lost = 0; else m.lost += dt;
        if (m.lost > MON.giveUp) this.monGiveUp();
        else {
          const d = Math.hypot(tp.x - m.x, tp.z - m.z);
          if (d < 2.4 && this.world.los(m.x, m.y + 1.0, m.z, tp.x, tp.y + 1.0, tp.z) && Math.abs(tp.y - m.y) < 1.0) {
            const dx = tp.x - m.x, dz = tp.z - m.z, s = Math.min(MON.chase * dt, d);
            m.x += dx / d * s; m.z += dz / d * s; m.yaw = Math.atan2(-dx, -dz); m.y += (tp.y - m.y) * Math.min(1, 10 * dt);
          } else {
            m.repath -= dt;
            if (m.repath <= 0 || !m.path) {
              m.repath = 0.45;
              const tn = nav.nearest(tp.x, tp.y, tp.z, 4);
              if (tn >= 0) this.monPathTo(tn);
            }
            this.monMove(dt, MON.chase);
          }
        }
      }
    } else if (m.st === 'investigate') {
      const done = this.monMove(dt, m.rushSpeed || MON.invest);
      if (done || !m.path) {
        m.idle += dt;
        if (m.idle > 2.2) this.monGiveUp();
      }
    } else { // patrol
      if (m.idle > 0) { m.idle -= dt; }
      else {
        if (!m.path || m.pi >= m.path.length) {
          m.wp = (m.wp + 1) % route.length;
          if (!this.monPathTo(route[m.wp])) { m.idle = 0.5; }
          else m.idle = 0.6;
        } else this.monMove(dt, MON.patrol);
      }
    }
    // 抓人
    for (const p of this.players.values()) {
      if (p.st !== 'alive' || (p.flags & F_HIDDEN) || p.prot > 0) continue;
      if (Math.hypot(p.x - m.x, p.z - m.z) < MON.catchR && p.y < m.y + 1.9 && p.y + 1.5 > m.y) this.caught(p);
    }
  }
  caught(p) {
    p.lives--; p.deaths++;
    p.st = p.lives > 0 ? 'dead' : 'ghost'; p.deadT = 5; p.flags = 0;
    if (p.hideIdx >= 0) { delete this.hideTaken[p.hideIdx]; p.hideIdx = -1; }
    this.emit('all', { t: 'caught', id: p.id, name: p.name, lives: p.lives, ghost: p.lives <= 0 });
    this.resetHoldings(p);
    const m = this.mon; m.st = 'patrol'; m.target = null; m.path = null; m.cool = 3; m.idle = 2.0;
    this.checkAllDead();
  }
  /* 死亡重置：物品歸還、鎖重新上鎖、密碼重新隨機生成到別處 */
  resetHoldings(p) {
    const colors = [];
    this.locks.forEach((l, c) => {
      if (l.open && l.by === p.id) {
        l.open = false; l.by = null; colors.push(c);
        const used = new Set(this.codes.map(x => x.spot));
        const pool = shuffle(this.rng, this.bundle.valid.code.filter(i => !used.has(i)));
        this.codes[c] = { spot: pool.length ? pool[0] : this.codes[c].spot, value: this.newCode() };
      }
    });
    p.items = [];
    if (colors.length) this.emit('all', { t: 'reset', colors, world: this.worldMsg(), name: p.name });
  }
  checkAllDead() {
    if (this.status !== 'playing') return;
    if ([...this.players.values()].every(p => p.st === 'ghost')) this.end('alldead', null);
  }
  removePlayer(pid) {
    const p = this.players.get(pid); if (!p) return;
    this.resetHoldings(p);
    if (p.hideIdx >= 0) delete this.hideTaken[p.hideIdx];
    this.players.delete(pid);
    this.emit('all', { t: 'left', id: pid, name: p.name });
    if (this.players.size === 0) this.status = 'ended'; else this.checkAllDead();
  }
  respawn(p) {
    const m = this.mon;
    const spawns = this.bundle.spawns.filter(s => Math.hypot(s[0] - m.x, s[2] - m.z) > 28);
    const pool = spawns.length ? spawns : this.bundle.spawns;
    const s = pool[Math.floor(this.rng() * pool.length)];
    p.st = 'alive'; p.x = s[0]; p.y = s[1]; p.z = s[2]; p.prot = 4; p.flags = 0;
    this.emit('all', { t: 'resp', id: p.id, x: s[0], y: s[1], z: s[2], yaw: this.rng() * TAU });
  }
  end(reason, winnerId) {
    if (this.status !== 'playing') return;
    this.status = 'ended';
    const rank = [...this.players.values()].map(p => ({ id: p.id, name: p.name, unlocks: p.unlocks, lives: p.lives, hides: p.hides, deaths: p.deaths }));
    rank.sort((a, b) => (b.id === winnerId) - (a.id === winnerId) || b.unlocks - a.unlocks || b.lives - a.lives);
    this.emit('all', { t: 'end', reason, winner: winnerId, elapsed: Math.round((ROUND_TIME - this.time) * 10) / 10, rank, map: this.mapIdx });
  }
  tick(dt) {
    if (this.status !== 'playing') return;
    this.t += dt;
    this.time -= dt;
    for (const p of this.players.values()) {
      if (p.prot > 0) p.prot -= dt;
      if (p.st === 'dead') { p.deadT -= dt; if (p.deadT <= 0) this.respawn(p); }
    }
    this.tickMonster(dt);
    if (this.time <= 0) this.end('timeout', null);
  }
  snapshot() {
    const m = this.mon;
    return {
      t: 's', tm: Math.max(0, Math.round(this.time * 10) / 10),
      m: [Math.round(m.x * 100) / 100, Math.round(m.y * 100) / 100, Math.round(m.z * 100) / 100, Math.round(m.yaw * 100) / 100, m.st === 'chase' ? 2 : m.st === 'investigate' ? 1 : 0, m.target || ''],
      pl: [...this.players.values()].map(p => [p.id, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100, Math.round(p.yaw * 100) / 100, Math.round(p.pitch * 100) / 100, p.flags, p.lives, p.st === 'alive' ? 0 : p.st === 'dead' ? 1 : 2, Math.round(p.deadT * 10) / 10]),
    };
  }
}
