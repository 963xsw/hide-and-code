'use strict';
/* ===== 地圖建構器、碰撞世界、射線、導航網格 ===== */

class Builder {
  constructor(seed, bounds) {
    this.rng = mulberry32(seed);
    this.boxes = [];
    this.pyrs = [];
    this.bounds = bounds || { x0: -60, z0: -60, x1: 60, z1: 60 };
    this.spots = { code: [], lock: [], ped: [], frog: [], hide: [], spawn: [], patrol: [] };
    this.portals = [];
    this.theme = {};
    this.jit = 0;         // 顏色微幅隨機（僅植物／石頭／家具使用）；結構類一律 0，避免共平面重疊時閃爍
  }
  box(x0, y0, z0, x1, y1, z1, col, solid = true, emit = 0) {
    const c = hexRgb(col);
    const j = this.jit > 0 ? 1 + (this.rng() - 0.5) * this.jit : 1;
    this.boxes.push({
      x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1),
      x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1),
      col: [c[0] * j, c[1] * j, c[2] * j], solid, emit,
    });
  }
  /* 只有碰撞、不繪製的方塊（讓外觀可以用多個小方塊拼得更細緻） */
  colBox(x0, y0, z0, x1, y1, z1) {
    this.boxes.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), col: [0, 0, 0], solid: true, emit: 0, novis: true });
  }
  boxC(cx, y0, cz, w, h, d, col, solid = true, emit = 0) {
    this.box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, col, solid, emit);
  }
  pyr(cx, y0, cz, w, d, h, col, emit = 0) {
    const c = hexRgb(col);
    const j = this.jit > 0 ? 1 + (this.rng() - 0.5) * 0.12 : 1;
    this.pyrs.push({ cx, y0, cz, w, d, h, col: [c[0] * j, c[1] * j, c[2] * j], emit });
  }
  /* 沿軸向的牆（含門／窗開口）。gaps: {a,b,y0,y1} 皆為相對牆底的高度與沿牆座標 */
  wall(x0, z0, x1, z1, yb, yt, th, col, gaps, frame) {
    const sj = this.jit; this.jit = 0;
    try { this.wall_(x0, z0, x1, z1, yb, yt, th, col, gaps, frame); } finally { this.jit = sj; }
  }
  wall_(x0, z0, x1, z1, yb, yt, th, col, gaps, frame) {
    const alongX = Math.abs(z1 - z0) < 1e-6;
    const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1);
    const a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
    const fixed = alongX ? z0 : x0;
    const put = (s, e, ya, yb2) => {
      if (e - s < 0.01 || yb2 - ya < 0.01) return;
      if (alongX) this.box(s, ya, fixed - th / 2, e, yb2, fixed + th / 2, col);
      else this.box(fixed - th / 2, ya, s, fixed + th / 2, yb2, e, col);
    };
    const gs = (gaps || []).filter(g => g.b > a0 && g.a < a1).sort((p, q) => p.a - q.a);
    let cur = a0;
    for (const g of gs) {
      const ga = Math.max(g.a, a0), gb = Math.min(g.b, a1);
      put(cur, ga, yb, yt);
      const gy0 = yb + (g.y0 || 0), gy1 = yb + (g.y1 === undefined ? 2.4 : g.y1);
      put(ga, gb, yb, gy0);
      put(ga, gb, gy1, yt);
      cur = gb;
    }
    put(cur, a1, yb, yt);
    if (frame) {          // 門框／窗框（不可碰撞的裝飾）
      const P = 0.07, E = 0.03;
      for (const g of gs) {
        const ga = Math.max(g.a, a0), gb = Math.min(g.b, a1);
        const gy0 = yb + (g.y0 || 0), gy1 = yb + (g.y1 === undefined ? 2.4 : g.y1);
        const fb = (sa, ea, ya, yb2, ex) => {
          const e0 = ex || 0;
          if (alongX) this.box(sa, ya, fixed - th / 2 - E - e0, ea, yb2, fixed + th / 2 + E + e0, frame, false);
          else this.box(fixed - th / 2 - E - e0, ya, sa, fixed + th / 2 + E + e0, yb2, ea, frame, false);
        };
        const I = 0.012;   // 向開口內縮 1.2 公分，避免與牆的開口邊共平面而閃爍
        fb(ga - P, ga + I, gy0, gy1); fb(gb - I, gb + P, gy0, gy1);
        fb(ga - P, gb + P, gy1 - I, gy1 + 0.09);
        if ((g.y0 || 0) > 0) fb(ga - P, gb + P, gy0 - 0.06, gy0 + I, 0.06);
      }
    }
  }
}

/* ---------- 碰撞世界 ---------- */
const PR = 0.32;        // 玩家半徑
const STEP = 0.55;      // 可自動跨越的階高
const GRAV = 15;

class World {
  constructor(b) {
    this.b = b;
    this.boxes = b.boxes;
    this.solid = b.boxes.filter(s => s.solid);
    this.bounds = b.bounds;
    this.cs = 5;
    this.hash = new Map();
    this.stamp = 1;
    this.solid.forEach((bx, i) => { bx._i = i; bx._s = 0; });
    for (const bx of this.solid) {
      const ix0 = Math.floor(bx.x0 / this.cs), ix1 = Math.floor(bx.x1 / this.cs);
      const iz0 = Math.floor(bx.z0 / this.cs), iz1 = Math.floor(bx.z1 / this.cs);
      for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
        const k = (ix + 512) * 1024 + (iz + 512);
        let a = this.hash.get(k);
        if (!a) { a = []; this.hash.set(k, a); }
        a.push(bx);
      }
    }
  }
  query(x0, y0, z0, x1, y1, z1, fn) {
    const st = ++this.stamp, cs = this.cs;
    const ix0 = Math.floor(x0 / cs), ix1 = Math.floor(x1 / cs), iz0 = Math.floor(z0 / cs), iz1 = Math.floor(z1 / cs);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
      const a = this.hash.get((ix + 512) * 1024 + (iz + 512));
      if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const b = a[i];
        if (b._s === st) continue;
        b._s = st;
        if (b.x1 > x0 && b.x0 < x1 && b.y1 > y0 && b.y0 < y1 && b.z1 > z0 && b.z0 < z1) {
          if (fn(b)) return true;
        }
      }
    }
    return false;
  }
  anyBox(x0, y0, z0, x1, y1, z1) { return this.query(x0, y0, z0, x1, y1, z1, () => true); }

  /* 玩家物理：p={x,y,z,vy,onGround}；h=身高 */
  hMove(p, h, axis, d) {
    if (d === 0) return;
    if (axis === 0) p.x += d; else p.z += d;
    const self = this;
    this.query(p.x - PR, p.y + 0.01, p.z - PR, p.x + PR, p.y + h, p.z + PR, b => {
      const top = b.y1;
      if (p.onGround && top - p.y <= STEP + 1e-4 && top - p.y > 0.001) {
        if (!self.anyBox(p.x - PR, top + 0.01, p.z - PR, p.x + PR, top + h, p.z + PR)) { p.y = top; return false; }
      }
      if (top <= p.y + 0.011) return false;
      if (axis === 0) { p.x = d > 0 ? b.x0 - PR - 1e-4 : b.x1 + PR + 1e-4; }
      else { p.z = d > 0 ? b.z0 - PR - 1e-4 : b.z1 + PR + 1e-4; }
      return false;
    });
  }
  vMove(p, h, dt) {
    const prev = p.y;
    p.vy -= GRAV * dt;
    p.y += p.vy * dt;
    p.onGround = false;
    if (p.y <= 0) { p.y = 0; if (p.vy < 0) p.vy = 0; p.onGround = true; }
    this.query(p.x - PR + 0.02, p.y, p.z - PR + 0.02, p.x + PR - 0.02, p.y + h, p.z + PR - 0.02, b => {
      if (p.vy <= 0 && prev >= b.y1 - 0.08) { p.y = b.y1; p.vy = 0; p.onGround = true; }
      else if (p.vy > 0 && prev + h <= b.y0 + 0.08) { p.y = b.y0 - h; p.vy = 0; }
      return false;
    });
  }
  clampBounds(p) {
    const bd = this.bounds;
    p.x = clamp(p.x, bd.x0 + 0.6, bd.x1 - 0.6);
    p.z = clamp(p.z, bd.z0 + 0.6, bd.z1 - 0.6);
  }
  /* 射線：dir 需為單位向量；回傳最近碰撞距離（無則回傳 maxD） */
  ray(ox, oy, oz, dx, dy, dz, maxD) {
    const cs = this.cs, step = cs * 0.7;
    const st = ++this.stamp;
    let best = maxD;
    for (let t = 0; t <= maxD + step; t += step) {
      const tt = Math.min(t, maxD);
      const px = ox + dx * tt, py = oy + dy * tt, pz = oz + dz * tt;
      const ix0 = Math.floor((px - cs * 0.5) / cs), ix1 = Math.floor((px + cs * 0.5) / cs);
      const iz0 = Math.floor((pz - cs * 0.5) / cs), iz1 = Math.floor((pz + cs * 0.5) / cs);
      for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
        const a = this.hash.get((ix + 512) * 1024 + (iz + 512));
        if (!a) continue;
        for (let i = 0; i < a.length; i++) {
          const b = a[i];
          if (b._s === st) continue;
          b._s = st;
          let tmin = 0, tmax = best;
          // slab
          let ok = true;
          const o = [ox, oy, oz], d = [dx, dy, dz], lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
          for (let k = 0; k < 3; k++) {
            if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) { ok = false; break; } }
            else {
              let t1 = (lo[k] - o[k]) / d[k], t2 = (hi[k] - o[k]) / d[k];
              if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
              if (t1 > tmin) tmin = t1;
              if (t2 < tmax) tmax = t2;
              if (tmin > tmax) { ok = false; break; }
            }
          }
          if (ok && tmin < best) best = tmin;
        }
      }
      if (t >= maxD) break;
    }
    return best;
  }
  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return this.ray(ax, ay, az, dx / d, dy / d, dz / d, d) >= d - 0.05;
  }
}

/* ---------- 導航網格（多樓層） ---------- */
const NAVC = 0.5;
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, rv = v[0], lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return rv;
  }
}

class Nav {
  constructor(world) {
    this.world = world;
    const bd = world.bounds;
    this.x0 = bd.x0; this.z0 = bd.z0;
    this.w = Math.ceil((bd.x1 - bd.x0) / NAVC);
    this.d = Math.ceil((bd.z1 - bd.z0) / NAVC);
    const nx = [], ny = [], nz = [];
    const start = new Int32Array(this.w * this.d + 1);
    const R = 0.3;
    const cand = [];
    for (let cz = 0; cz < this.d; cz++) {
      for (let cx = 0; cx < this.w; cx++) {
        const x = this.x0 + (cx + 0.5) * NAVC, z = this.z0 + (cz + 0.5) * NAVC;
        cand.length = 0; cand.push(0);
        world.query(x - 0.01, -1, z - 0.01, x + 0.01, 60, z + 0.01, b => {
          if (x >= b.x0 && x < b.x1 && z >= b.z0 && z < b.z1 && b.y1 > 0.1 && b.x1 - b.x0 >= 0.45 && b.z1 - b.z0 >= 0.45) cand.push(b.y1);
          return false;
        });
        cand.sort((a, b) => a - b);
        let last = -99;
        for (const y of cand) {
          if (y - last < 0.15) continue;
          if (!world.anyBox(x - R, y + 0.45, z - R, x + R, y + 1.7, z + R)) {
            nx.push(x); ny.push(y); nz.push(z); last = y;
          }
        }
        start[cz * this.w + cx + 1] = nx.length;
      }
    }
    this.start = start;
    this.nx = Float32Array.from(nx); this.ny = Float32Array.from(ny); this.nz = Float32Array.from(nz);
    this.n = nx.length;
    this.cellOf = new Int32Array(this.n);
    for (let c = 0; c < this.w * this.d; c++) for (let i = start[c]; i < start[c + 1]; i++) this.cellOf[i] = c;
    this.g = new Float32Array(this.n);
    this.seen = new Int32Array(this.n);
    this.closed = new Int32Array(this.n);
    this.parent = new Int32Array(this.n);
    this.stampN = 0;
    this.comp = new Int32Array(this.n).fill(-1);
    this.labelComponents();
  }
  cellAt(x, z) {
    const cx = Math.floor((x - this.x0) / NAVC), cz = Math.floor((z - this.z0) / NAVC);
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.d) return -1;
    return cz * this.w + cx;
  }
  nearest(x, y, z, maxR = 4) {
    const cx = Math.floor((x - this.x0) / NAVC), cz = Math.floor((z - this.z0) / NAVC);
    let best = -1, bd = 1e9;
    for (let r = 0; r <= maxR; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const ax = cx + dx, az = cz + dz;
        if (ax < 0 || az < 0 || ax >= this.w || az >= this.d) continue;
        const c = az * this.w + ax;
        for (let i = this.start[c]; i < this.start[c + 1]; i++) {
          const ddy = (this.ny[i] - y) * 2;
          const dd = (this.nx[i] - x) ** 2 + (this.nz[i] - z) ** 2 + ddy * ddy;
          if (dd < bd) { bd = dd; best = i; }
        }
      }
      if (best >= 0 && r >= 1) break;
    }
    return best;
  }
  neighbors(i, out) {
    out.length = 0;
    const c = this.cellOf[i], cx = c % this.w, cz = (c / this.w) | 0;
    const y = this.ny[i];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const ax = cx + dx, az = cz + dz;
      if (ax < 0 || az < 0 || ax >= this.w || az >= this.d) continue;
      const nc = az * this.w + ax;
      for (let j = this.start[nc]; j < this.start[nc + 1]; j++) {
        if (Math.abs(this.ny[j] - y) > 0.62) continue;
        if (dx && dz) {
          if (!this.hasNodeAt(cx + dx, cz, y) || !this.hasNodeAt(cx, cz + dz, y)) continue;
        }
        out.push(j);
      }
    }
  }
  hasNodeAt(cx, cz, y) {
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.d) return false;
    const c = cz * this.w + cx;
    for (let j = this.start[c]; j < this.start[c + 1]; j++) if (Math.abs(this.ny[j] - y) <= 0.62) return true;
    return false;
  }
  labelComponents() {
    const buf = [], q = [];
    let label = 0; this.compSize = [];
    for (let s = 0; s < this.n; s++) {
      if (this.comp[s] >= 0) continue;
      let cnt = 0; q.length = 0; q.push(s); this.comp[s] = label;
      while (q.length) {
        const i = q.pop(); cnt++;
        this.neighbors(i, buf);
        for (const j of buf) if (this.comp[j] < 0) { this.comp[j] = label; q.push(j); }
      }
      this.compSize.push(cnt); label++;
    }
    let bi = 0;
    this.compSize.forEach((c, i) => { if (c > this.compSize[bi]) bi = i; });
    this.main = bi;
  }
  inMain(i) { return i >= 0 && this.comp[i] === this.main; }
  /* A*：回傳節點索引陣列（含起訖）或 null */
  path(a, b, maxExpand = 60000) {
    if (a < 0 || b < 0) return null;
    if (a === b) return [a];
    const st = ++this.stampN, heap = new MinHeap(), buf = [];
    const tx = this.nx[b], ty = this.ny[b], tz = this.nz[b];
    const h = i => Math.hypot(this.nx[i] - tx, (this.ny[i] - ty) * 1.0, this.nz[i] - tz);
    this.g[a] = 0; this.seen[a] = st; this.parent[a] = -1;
    heap.push(h(a), a);
    let exp = 0;
    while (heap.size) {
      const i = heap.pop();
      if (this.closed[i] === st) continue;
      this.closed[i] = st;
      if (i === b) {
        const p = [];
        for (let k = b; k >= 0; k = this.parent[k]) p.push(k);
        return p.reverse();
      }
      if (++exp > maxExpand) return null;
      this.neighbors(i, buf);
      for (const j of buf) {
        if (this.closed[j] === st) continue;
        const ng = this.g[i] + Math.hypot(this.nx[i] - this.nx[j], this.ny[i] - this.ny[j] , this.nz[i] - this.nz[j]);
        if (this.seen[j] !== st || ng < this.g[j]) {
          this.seen[j] = st; this.g[j] = ng; this.parent[j] = i;
          heap.push(ng + h(j), j);
        }
      }
    }
    return null;
  }
}
