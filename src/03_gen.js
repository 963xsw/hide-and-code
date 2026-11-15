'use strict';
/* ===== 地圖生成工具：多層建築、迷宮、樹林、小道具 ===== */
const H_FLOOR = 3.2, SLAB = 0.3, WT = 0.3, DOORW = 1.8, STAIR_W = 2.6, STAIR_N = 10;

function slabHole(b, x0, z0, x1, z1, y0, y1, col, hole) {
  const sj = b.jit; b.jit = 0;
  try { slabHole_(b, x0, z0, x1, z1, y0, y1, col, hole); } finally { b.jit = sj; }
}
function slabHole_(b, x0, z0, x1, z1, y0, y1, col, hole) {
  if (!hole) { b.box(x0, y0, z0, x1, y1, z1, col); return; }
  const { hx0, hx1, hz0, hz1 } = hole;
  b.box(x0, y0, z0, hx0, y1, z1, col);
  b.box(hx1, y0, z0, x1, y1, z1, col);
  b.box(hx0, y0, z0, hx1, y1, hz0, col);
  b.box(hx0, y0, hz1, hx1, y1, z1, col);
}

/* 一段樓梯 + 樓板洞 + 欄杆資訊。k=階段索引（偶數：靠西、向南上升；奇數：靠東、向北上升） */
function flightInfo(o, k) {
  const { x0, z0, x1, z1 } = o, hallW = o.hallW;
  const run = STAIR_N * 0.5;
  if (k % 2 === 0) {
    const sx0 = x0 + 0.5, sz0 = z0 + 0.8;
    return { dir: 1, sx0, sx1: sx0 + STAIR_W, sz0, sz1: sz0 + run, hole: { hx0: sx0 - 0.1, hx1: sx0 + STAIR_W + 0.1, hz0: sz0, hz1: sz0 + run } };
  }
  const sx1 = x0 + hallW - 0.5, sx0 = sx1 - STAIR_W, sz1 = z1 - 0.8;
  return { dir: -1, sx0, sx1, sz0: sz1 - run, sz1, hole: { hx0: sx0 - 0.1, hx1: sx1 + 0.1, hz0: sz1 - run, hz1: sz1 } };
}

function addStairs(b, o, k, col) {
  const sj = b.jit; b.jit = 0;
  try { return addStairs_(b, o, k, col); } finally { b.jit = sj; }
}
function addStairs_(b, o, k, col) {
  b.mat = 6;
  const f = flightInfo(o, k), yb = k * H_FLOOR, rise = H_FLOOR / STAIR_N;
  for (let i = 0; i < STAIR_N; i++) {
    const top = yb + (i + 1) * rise;
    if (f.dir === 1) b.box(f.sx0, yb, f.sz0 + i * 0.5, f.sx1, top, f.sz0 + (i + 1) * 0.5, col);
    else b.box(f.sx0, yb, f.sz1 - (i + 1) * 0.5, f.sx1, top, f.sz1 - i * 0.5, col);
  }
  // 洞口欄杆（在上層樓板高度）
  const yt = yb + H_FLOOR, h = f.hole, rc = '#2a2522';
  if (f.dir === 1) {
    b.box(h.hx1 - 0.1, yt, h.hz0, h.hx1 + 0.02, yt + 1.0, h.hz1, rc);
    b.box(h.hx0, yt, h.hz0 - 0.02, h.hx1, yt + 1.0, h.hz0 + 0.1, rc);
  } else {
    b.box(h.hx0 - 0.02, yt, h.hz0, h.hx0 + 0.1, yt + 1.0, h.hz1, rc);
    b.box(h.hx0, yt, h.hz1 - 0.1, h.hx1, yt + 1.0, h.hz1 + 0.02, rc);
  }
  return f;
}

/* ---------- 家具與藏匿／解謎點 ---------- */
function addHide(b, kind, x, y, z, ex, ez, yaw) { b.spots.hide.push({ kind, x, y, z, ex, ez, yaw }); }

/* ----- 精緻家具：全部由少量方塊拼成，維持流暢度 ----- */
function mkWardrobe(b, x, y, z, iz, P) {
  const zc = z + iz * 0.4, zf = zc + iz * 0.37;
  b.boxC(x, y + 0.1, zc, 1.3, 1.95, 0.7, P.wood);
  b.boxC(x, y, zc, 1.38, 0.12, 0.78, P.dark, false);
  b.boxC(x, y + 2.05, zc, 1.44, 0.1, 0.82, P.dark, false);
  b.boxC(x, y + 2.15, zc, 1.2, 0.07, 0.62, P.dark, false);
  b.boxC(x - 0.31, y + 0.17, zf, 0.58, 1.82, 0.03, P.door, false, 0.07);
  b.boxC(x + 0.31, y + 0.17, zf, 0.58, 1.82, 0.03, P.door, false, 0.07);
  b.boxC(x, y + 0.17, zf + iz * 0.005, 0.035, 1.82, 0.04, '#140e0a', false);
  for (const sx of [-0.31, 0.31]) {
    b.boxC(x + sx, y + 0.35, zf + iz * 0.02, 0.4, 0.55, 0.02, P.door2, false, 0.05);
    b.boxC(x + sx, y + 1.1, zf + iz * 0.02, 0.4, 0.8, 0.02, P.door2, false, 0.05);
  }
  b.boxC(x - 0.09, y + 1.0, zf + iz * 0.035, 0.035, 0.16, 0.035, P.brass, false, 0.35);
  b.boxC(x + 0.09, y + 1.0, zf + iz * 0.035, 0.035, 0.16, 0.035, P.brass, false, 0.35);
}
function mkBed(b, x, y, z, iz, P) {
  const zc = z + iz * 1.0;
  b.colBox(x - 0.55, y, zc - 1.0, x + 0.55, y + 0.62, zc + 1.0);
  for (const sx of [-0.48, 0.48]) for (const sz of [-0.94, 0.94]) b.boxC(x + sx, y, zc + sz, 0.09, 0.22, 0.09, P.dark, false);
  b.boxC(x, y + 0.2, zc, 1.04, 0.14, 2.0, P.wood, false);
  b.boxC(x, y + 0.34, zc, 0.94, 0.2, 1.9, P.mattress, false);
  b.boxC(x, y + 0.44, zc + iz * 0.4, 0.99, 0.12, 1.1, P.cloth, false, 0.04);
  b.boxC(x, y + 0.54, z + iz * 0.3, 0.62, 0.11, 0.34, P.pillow, false);
  b.boxC(x, y + 0.1, z + iz * 0.05, 1.1, 1.0, 0.08, P.wood, false);
  b.boxC(x, y + 0.1, z + iz * 1.96, 1.1, 0.5, 0.07, P.wood, false);
}
function mkCrate(b, x, y, z, P) {
  b.boxC(x, y, z, 0.95, 0.95, 0.95, P.crate);
  b.boxC(x, y + 0.93, z, 1.02, 0.06, 1.02, P.dark, false);
  for (const sx of [-0.46, 0.46]) for (const sz of [-0.46, 0.46]) b.boxC(x + sx, y, z + sz, 0.07, 0.95, 0.07, P.dark, false);
  b.boxC(x, y + 0.3, z, 1.01, 0.05, 1.01, P.dark, false);
  b.boxC(x, y + 0.64, z, 1.01, 0.05, 1.01, P.dark, false);
}
function mkShelf(b, x, y, z, iz, P) {
  b.boxC(x, y, z + iz * 0.25, 1.4, 1.9, 0.4, P.wood);
  b.boxC(x, y + 1.9, z + iz * 0.25, 1.5, 0.06, 0.46, P.dark, false);
  const cols = ['#7a3a3a', '#3a5a7a', '#5a7a3a', '#8a6a2a', '#5a3a6a', '#aaa090'];
  for (const sy of [0.42, 1.12, 1.62]) {
    b.boxC(x, y + sy - 0.03, z + iz * 0.4, 1.34, 0.04, 0.24, P.dark, false);
    let bx = -0.6;
    while (bx < 0.55) {
      const w = 0.07 + b.rng() * 0.05, h = 0.2 + b.rng() * 0.12;
      b.boxC(x + bx + w / 2, y + sy, z + iz * 0.4, w, h, 0.2, rpick(b.rng, cols), false);
      bx += w + 0.012;
    }
  }
}
function mkTable(b, x, y, z, P) {
  b.boxC(x, y + 0.75, z, 1.4, 0.08, 0.9, P.wood, false);
  b.boxC(x, y + 0.68, z, 1.3, 0.07, 0.8, P.dark, false);
  for (const dx of [-0.6, 0.6]) for (const dz of [-0.35, 0.35]) b.boxC(x + dx, y, z + dz, 0.08, 0.75, 0.08, P.wood, false);
  b.boxC(x - 0.3, y + 0.83, z + 0.1, 0.12, 0.16, 0.12, '#9ab', false, 0.12);   // 小瓶子
}
function mkDumpster(b, x, z) {
  b.colBox(x - 1.0, 0, z - 0.55, x + 1.0, 1.4, z + 0.55);
  b.boxC(x, 0.22, z, 1.9, 1.0, 1.0, '#2e5a3a', false, 0.10);
  b.boxC(x, 1.2, z, 2.04, 0.1, 1.12, '#244a30', false);
  b.boxC(x - 0.5, 1.3, z, 0.98, 0.08, 1.12, '#1e3e28', false);
  b.boxC(x + 0.5, 1.36, z, 0.98, 0.08, 1.12, '#1e3e28', false);
  for (const xs of [-0.65, 0, 0.65]) for (const zs of [-0.52, 0.52]) b.boxC(x + xs, 0.24, z + zs, 0.1, 0.95, 0.04, '#244a30', false);
  for (const xs of [-0.8, 0.8]) for (const zs of [-0.4, 0.4]) b.boxC(x + xs, 0, z + zs, 0.16, 0.22, 0.16, '#101214', false);
  b.boxC(x, 0.7, z + 0.545, 0.7, 0.16, 0.02, '#8a8a7c', false);
  b.boxC(x, 1.0, z - 0.58, 1.5, 0.05, 0.05, '#111', false);
  addHide(b, 'dumpster', x, 0, z, x, z + 1.6, 0);
}
function mkHay(b, x, z) {
  const sj = b.jit; b.jit = 0.08;
  try { mkHay_(b, x, z); } finally { b.jit = sj; }
}
function mkHay_(b, x, z) {
  b.colBox(x - 0.9, 0, z - 0.7, x + 0.9, 1.4, z + 0.7);
  b.boxC(x, 0, z, 1.8, 0.7, 1.4, '#b49a45', false, 0.10);
  b.boxC(x - 0.1, 0.7, z, 1.4, 0.7, 1.2, '#a98e3a', false, 0.10);
  for (const sx of [-0.5, 0.5]) b.boxC(x + sx, 0, z, 0.05, 0.72, 1.42, '#5a4a22', false);
  for (const sx of [-0.4, 0.3]) b.boxC(x - 0.1 + sx, 0.7, z, 0.05, 0.72, 1.22, '#5a4a22', false);
  for (let i = 0; i < 5; i++) b.pyr(x + (b.rng() - 0.5) * 1.5, 0.6 + b.rng() * 0.6, z + (b.rng() - 0.5) * 1.1, 0.25, 0.25, 0.35, '#d0b858', 0.08);
  addHide(b, 'hay', x, 0, z, x, z + 1.7, 0);
}
function mkCoffin(b, x, z) {
  b.colBox(x - 0.5, 0, z - 1.0, x + 0.5, 0.85, z + 1.0);
  b.boxC(x, 0, z - 0.2, 1.0, 0.7, 1.1, '#3a2a20', false, 0.08);
  b.boxC(x, 0, z - 0.8, 0.62, 0.7, 0.45, '#3a2a20', false, 0.08);
  b.boxC(x, 0, z + 0.65, 0.66, 0.7, 0.7, '#3a2a20', false, 0.08);
  b.boxC(x, 0.7, z - 0.2, 1.08, 0.1, 1.18, '#4a3426', false, 0.08);
  b.boxC(x, 0.7, z - 0.8, 0.7, 0.1, 0.52, '#4a3426', false, 0.08);
  b.boxC(x, 0.7, z + 0.65, 0.74, 0.1, 0.76, '#4a3426', false, 0.08);
  b.boxC(x, 0.8, z - 0.1, 0.07, 0.03, 0.9, '#c9b27a', false, 0.35);
  b.boxC(x, 0.8, z - 0.3, 0.5, 0.03, 0.07, '#c9b27a', false, 0.35);
  addHide(b, 'coffin', x, 0, z, x, z - 1.2, 0);
}
function mkTank(b, x, y, z) {
  b.colBox(x - 1.2, y, z - 1.2, x + 1.2, y + 2.2, z + 1.2);
  for (const sx of [-1.0, 1.0]) for (const sz of [-1.0, 1.0]) b.boxC(x + sx, y, z + sz, 0.14, 0.75, 0.14, '#2a2e30', false);
  b.boxC(x, y + 0.7, z, 2.3, 1.5, 2.3, '#4a5558', false, 0.06);
  b.boxC(x, y + 1.0, z, 2.42, 0.08, 2.42, '#2a3234', false);
  b.boxC(x, y + 1.7, z, 2.42, 0.08, 2.42, '#2a3234', false);
  b.pyr(x, y + 2.2, z, 2.5, 2.5, 0.7, '#2a3234');
  b.boxC(x + 1.2, y, z - 0.9, 0.06, 2.0, 0.06, '#222', false); b.boxC(x + 1.2, y, z - 0.5, 0.06, 2.0, 0.06, '#222', false);
  for (let k = 0; k < 6; k++) b.boxC(x + 1.2, y + 0.3 + k * 0.3, z - 0.7, 0.05, 0.04, 0.4, '#222', false);
  addHide(b, 'tank', x, y, z, x, z + 2.2, 0);
}

function furnishRoom(b, R, yb, pal, opt) {
  const sj = b.jit; b.jit = 0.08;
  try { furnishRoom_(b, R, yb, pal, opt); } finally { b.jit = sj; }
}
function furnishRoom_(b, R, yb, pal, opt) {
  // R: {ax0,ax1, backZ, backIn, frontZ, frontIn, doorX}
  const rng = b.rng;
  const P = Object.assign({ dark: '#2e2016', door: '#6e4d32', door2: '#7d5a3c', brass: '#c9a14a', mattress: '#cfc8b8', pillow: '#e8e0d0' }, pal);
  const cxm = (R.ax0 + R.ax1) / 2, czm = (R.backZ + R.frontZ) / 2;
  {
    // 木地板縫線與踢腳板（讓地板不再是一整片平面）
    const sj2 = b.jit; b.jit = 0;      // 地板細節不抖色，避免重疊處閃爍
    const fl = yb === 0 ? 0.04 : yb, zA = Math.min(R.backZ, R.frontZ), zB = Math.max(R.backZ, R.frontZ);
    const seam = P.seam || '#241a12', base = P.base || '#1f1812';
    const bh = 0.14, bt = 0.04;
    b.box(R.ax0, fl, R.backZ, R.ax1, fl + bh, R.backZ + R.backIn * bt, base, false);                       // 後牆
    b.box(R.ax0, fl, zA, R.ax0 + bt, fl + bh, zB, base, false);                                              // 左牆
    b.box(R.ax1 - bt, fl, zA, R.ax1, fl + bh, zB, base, false);                                              // 右牆
    const dx0 = R.doorX - 0.95, dx1 = R.doorX + 0.95;                                                         // 走廊側牆（門口留空）
    b.box(R.ax0, fl, R.frontZ, dx0, fl + bh, R.frontZ + R.frontIn * bt, base, false);
    b.box(dx1, fl, R.frontZ, R.ax1, fl + bh, R.frontZ + R.frontIn * bt, base, false);
    b.jit = sj2;
  }
  // 地毯
  {
    const rw = Math.min(3.4, R.ax1 - R.ax0 - 2.8), rd = Math.min(2.4, Math.abs(R.frontZ - R.backZ) - 2.6);
    if (rw > 1.2 && rd > 1.0) {
      const ry = yb === 0 ? 0.045 : yb + 0.006;
      const c1 = rpick(rng, ['#5a2a2a', '#2a3a4a', '#3a4a2a', '#4a3a2a', '#4a2a4a']);
      b.boxC(cxm, ry, czm, rw, 0.012, rd, c1, false);
      b.boxC(cxm, ry + 0.012, czm, rw * 0.84, 0.01, rd * 0.78, '#8a7a5a', false);
      b.boxC(cxm, ry + 0.022, czm, rw * 0.7, 0.01, rd * 0.62, c1, false);
    }
  }
  // 牆上畫作
  if (rng() < 0.75) {
    const px = R.ax0 + 1.5 + rng() * Math.max(0.5, R.ax1 - R.ax0 - 3.0), pz = R.backZ + R.backIn * 0.06;
    b.boxC(px, yb + 1.45, pz, 0.92, 0.64, 0.05, '#2a1e12', false);
    b.boxC(px, yb + 1.5, pz + R.backIn * 0.03, 0.78, 0.5, 0.04, rpick(rng, ['#3a5a6a', '#6a4a3a', '#4a5a3a', '#5a4a6a', '#6a6a4a']), false, 0.03);
  }
  const corners = shuffle(rng, [
    { x: R.ax0 + 0.8, z: R.backZ, iz: R.backIn, wall: 'back' },
    { x: R.ax1 - 0.8, z: R.backZ, iz: R.backIn, wall: 'back' },
    { x: R.ax0 + 0.8, z: R.frontZ, iz: R.frontIn, wall: 'front' },
    { x: R.ax1 - 0.8, z: R.frontZ, iz: R.frontIn, wall: 'front' },
  ]);
  const kinds = [];
  const r = rng();
  kinds.push(r < (opt.hideProb ?? 0.55) ? (rng() < 0.6 ? 'wardrobe' : 'bed') : 'crate');
  kinds.push(rng() < 0.7 ? 'shelf' : 'crate');
  kinds.push(rng() < 0.5 ? 'lock' : (rng() < 0.5 ? 'crate' : 'table'));
  kinds.push(rng() < 0.45 ? 'ped' : (rng() < 0.5 ? 'frog' : 'crate'));
  corners.forEach((c, i) => {
    const kind = kinds[i];
    const towardC = c.x < cxm ? 1 : -1;
    switch (kind) {
      case 'wardrobe':
        mkWardrobe(b, c.x, yb, c.z, c.iz, P);
        addHide(b, 'wardrobe', c.x, yb, c.z + c.iz * 0.4, c.x, c.z + c.iz * 1.5, c.iz > 0 ? Math.PI : 0);
        b.spots.code.push({ x: c.x, y: yb + 2.3, z: c.z + c.iz * 0.4, hint: '衣櫃頂' });
        break;
      case 'bed':
        mkBed(b, c.x, yb, c.z, c.iz, P);
        addHide(b, 'bed', c.x, yb, c.z + c.iz * 1.0, c.x + towardC * 1.3, c.z + c.iz * 1.0, 0);
        b.spots.code.push({ x: c.x + towardC * 0.75, y: yb + 0.04, z: c.z + c.iz * 0.35, hint: '床邊地面' });
        break;
      case 'shelf':
        mkShelf(b, c.x, yb, c.z, c.iz, P);
        b.spots.code.push({ x: c.x + (rng() - 0.5) * 0.6, y: yb + 1.2, z: c.z + c.iz * 0.5, hint: '書架' });
        break;
      case 'crate':
        mkCrate(b, c.x, yb, c.z + c.iz * 0.5, P);
        if (rng() < 0.6) b.spots.code.push({ x: c.x + towardC * 0.85, y: yb + 0.03, z: c.z + c.iz * 0.35, hint: '木箱旁' });
        break;
      case 'table':
        mkTable(b, c.x, yb, c.z + c.iz * 0.6, P);
        b.spots.code.push({ x: c.x, y: yb + 0.04, z: c.z + c.iz * 0.6, hint: '桌下' });
        break;
      case 'lock': b.spots.lock.push({ x: c.x, y: yb, z: c.z + c.iz * 0.35, yaw: c.iz > 0 ? 0 : Math.PI }); break;
      case 'ped': b.spots.ped.push({ x: c.x, y: yb, z: c.z + c.iz * 0.6 }); break;
      case 'frog': b.spots.frog.push({ x: c.x + towardC * 0.4, y: yb + 0.02, z: c.z + c.iz * 0.2 }); break;
    }
  });
}

/* ---------- 多層建築 ---------- */
function building(b, o) {
  const sj = b.jit; b.jit = 0;
  try { building_(b, o); } finally { b.jit = sj; }
}
function building_(b, o) {
  const sm = b.mat;
  try { building__(b, o); } finally { b.mat = sm; }
}
function building__(b, o) {
  o = Object.assign({ floors: 3, hallW: 10, rooms: 3, roof: 'pitched', windows: true, extraDoors: [], hideProb: 0.5 }, o);
  const { x0, z0, x1, z1, floors } = o;
  const H = H_FLOOR, cz = (z0 + z1) / 2;
  const cw = 3.2, zc0 = cz - cw / 2, zc1 = cz + cw / 2;
  const pal = Object.assign({ wall: '#6a6258', floor: '#3b322b', ceil: '#2c2724', wood: '#5a3f2a', crate: '#6b5236', trim: '#2a2320', cloth: '#7a4a4a', hide: '#9a7a45', stair: '#4a3f36', roofCol: '#2a2230' }, o.pal || {});
  const hallOnly = !!o.hallOnly;
  const FR = pal.frame || '#241c16';
  const rx0 = x0 + o.hallW, rw = hallOnly ? 0 : (x1 - rx0) / o.rooms;
  const flights = o.roof === 'access' ? floors : floors - 1;
  const roofHole = o.roof === 'access' ? flightInfo(o, floors - 1).hole : null;

  const MW = pal.matWall === undefined ? 7 : pal.matWall, MF = pal.matFloor === undefined ? 5 : pal.matFloor, MR = pal.matRoof === undefined ? 9 : pal.matRoof;
  // 地板視覺（木地板貼圖）
  b.mat = MF; b.box(x0, 0, z0, x1, 0.04, z1, pal.floor, false); b.mat = MW;
  const winGapsX = (zFixed, yb2) => {
    const gaps = [];
    if (!o.windows) return gaps;
    for (let x = x0 + 2.5; x < x1 - 1.5; x += 4.5) gaps.push({ a: x - 0.7, b: x + 0.7, y0: 1.1, y1: 2.3 });
    return gaps;
  };
  const winGapsZ = () => {
    const gaps = [];
    if (!o.windows) return gaps;
    for (let z = z0 + 2.5; z < z1 - 1.5; z += 4.5) gaps.push({ a: z - 0.7, b: z + 0.7, y0: 1.1, y1: 2.3 });
    return gaps;
  };
  const doorGap = (c, w = DOORW) => ({ a: c - w / 2, b: c + w / 2, y0: 0, y1: 2.4 });
  const stripWin = (gaps, doorC) => gaps.filter(g => doorC === undefined || Math.abs((g.a + g.b) / 2 - doorC) > 2.0);

  for (let k = 0; k < floors; k++) {
    const yb = k * H, yt = yb + H - SLAB;
    // 樓板
    if (k >= 1) { b.mat = MF; slabHole(b, x0, z0, x1, z1, yb - SLAB, yb, pal.floor, flightInfo(o, k - 1).hole); b.mat = MW; }
    // 外牆
    const ex = o.extraDoors.filter(d => d.level === k);
    const gN = stripWin(winGapsX(z0, yb)), gS = stripWin(winGapsX(z1, yb)), gW = winGapsZ(), gE = winGapsZ();
    const hallDoorX = x0 + o.hallW / 2;
    if (k === 0) {
      gS.splice(0, gS.length, ...stripWin(winGapsX(z1, yb), hallDoorX), doorGap(hallDoorX));
      if (!hallOnly) gE.splice(0, gE.length, ...stripWin(winGapsZ(), cz), doorGap(cz));
      if (o.doorN) gN.push(doorGap(o.doorN));
    }
    for (const d of ex) {
      const arr = d.wall === 'n' ? gN : d.wall === 's' ? gS : d.wall === 'w' ? gW : gE;
      const c = d.at;
      for (let i = arr.length - 1; i >= 0; i--) if (Math.abs((arr[i].a + arr[i].b) / 2 - c) < 2.4) arr.splice(i, 1);
      arr.push(doorGap(c, d.w || DOORW));
    }
    b.wall(x0, z0, x1, z0, yb, yt, WT, pal.wall, gN, FR);
    b.wall(x0, z1, x1, z1, yb, yt, WT, pal.wall, gS, FR);
    b.wall(x0, z0, x0, z1, yb, yt, WT, pal.wall, gW, FR);
    b.wall(x1, z0, x1, z1, yb, yt, WT, pal.wall, gE, FR);
    // 大廳與走廊
    if (!hallOnly) {
      b.wall(rx0, z0, rx0, z1, yb, yt, WT, pal.wall, [doorGap(cz)], FR);
      // 走廊兩側牆（每個房間一個門）
      const gaps = [];
      for (let i = 0; i < o.rooms; i++) gaps.push(doorGap(rx0 + (i + 0.5) * rw));
      b.wall(rx0, zc0, x1, zc0, yb, yt, WT, pal.wall, gaps, FR);
      b.wall(rx0, zc1, x1, zc1, yb, yt, WT, pal.wall, gaps, FR);
      for (let i = 1; i < o.rooms; i++) {
        const px = rx0 + i * rw;
        b.wall(px, z0, px, zc0, yb, yt, WT, pal.wall, []);
        b.wall(px, zc1, px, z1, yb, yt, WT, pal.wall, []);
      }
      // 房間家具
      for (let i = 0; i < o.rooms; i++) {
        const ax0 = rx0 + i * rw + WT / 2, ax1 = rx0 + (i + 1) * rw - WT / 2;
        const dx = rx0 + (i + 0.5) * rw;
        furnishRoom(b, { ax0, ax1, backZ: z0 + WT / 2, backIn: 1, frontZ: zc0 - WT / 2, frontIn: -1, doorX: dx }, yb, pal, o);
        furnishRoom(b, { ax0, ax1, backZ: z1 - WT / 2, backIn: -1, frontZ: zc1 + WT / 2, frontIn: 1, doorX: dx }, yb, pal, o);
      }
      for (let i = 1; i < o.rooms; i++) {   // 走廊壁燈（微弱暖光，增添氣氛）
        const px = rx0 + i * rw;
        b.boxC(px, yb + 1.85, zc0 + 0.2, 0.2, 0.3, 0.1, '#ffcf7a', false, 0.7);
        b.boxC(px, yb + 1.85, zc1 - 0.2, 0.2, 0.3, 0.1, '#ffcf7a', false, 0.7);
      }
      {   // 走廊長地毯
        const ry = (yb === 0 ? 0.04 : yb) + 0.01, len = (x1 - rx0) - 3.2;
        b.boxC(rx0 + (x1 - rx0) / 2 + 0.4, ry, cz, len, 0.012, 1.5, '#4a2626', false);
        b.boxC(rx0 + (x1 - rx0) / 2 + 0.4, ry + 0.012, cz, len - 0.3, 0.01, 1.14, '#7a6a44', false);
        b.boxC(rx0 + (x1 - rx0) / 2 + 0.4, ry + 0.022, cz, len - 0.6, 0.01, 0.9, '#4a2626', false);
      }
      b.spots.patrol.push([rx0 + (x1 - rx0) / 2, yb, cz]);
    }
    {   // 大廳地毯（夾在兩段樓梯開口之間）
      const ry = (yb === 0 ? 0.04 : yb) + 0.01, hc = x0 + o.hallW / 2;
      b.boxC(hc, ry, cz, 3.4, 0.012, 2.3, '#3a2a4a', false);
      b.boxC(hc, ry + 0.012, cz, 3.0, 0.01, 1.9, '#8a7a4a', false);
      b.boxC(hc, ry + 0.022, cz, 2.5, 0.01, 1.5, '#3a2a4a', false);
    }
    // 大廳的點
    b.spots.patrol.push([x0 + o.hallW / 2, yb, cz]);
    const hx = x0 + o.hallW - 0.9;
    if (k % 2 === 0) b.spots.ped.push({ x: hx, y: yb, z: z1 - 0.9 }); else b.spots.lock.push({ x: x0 + 0.9, y: yb, z: z1 - 0.9, yaw: 0 });
    if (k < flights) addStairs(b, o, k, pal.stair);
    if (hallOnly) b.spots.code.push({ x: x0 + o.hallW - 0.8, y: yb + 0.04, z: z0 + 0.8, hint: '角落' });
  }
  // 屋頂
  const yTop = floors * H;
  b.mat = o.roof === 'access' ? (pal.matRoofSlab === undefined ? 7 : pal.matRoofSlab) : MF; slabHole(b, x0, z0, x1, z1, yTop - SLAB, yTop, pal.roofSlab || pal.ceil, roofHole); b.mat = MW;
  if (o.roof === 'access') {
    // 女兒牆與屋頂小物
    const pc = pal.parapet || pal.wall, ph = o.noParapet ? 0.0 : 1.1;
    if (ph > 0) {
      b.box(x0, yTop, z0, x1, yTop + ph, z0 + 0.4, pc); b.box(x0, yTop, z1 - 0.4, x1, yTop + ph, z1, pc);
      b.box(x0, yTop, z0, x0 + 0.4, yTop + ph, z1, pc); b.box(x1 - 0.4, yTop, z0, x1, yTop + ph, z1, pc);
    }
    if (o.roofProps !== false) {
      b.boxC(x0 + o.hallW + 4, yTop, z0 + 3, 2.2, 1.2, 1.6, '#555a5c');
      b.boxC(x0 + o.hallW + 9, yTop, z1 - 3, 2.2, 1.2, 1.6, '#555a5c');
      b.spots.code.push({ x: x0 + o.hallW + 4, y: yTop + 0.04, z: z0 + 4.1, hint: '冷氣機後' });
      b.spots.lock.push({ x: x1 - 2, y: yTop, z: cz, yaw: Math.PI / 2 });
      b.spots.ped.push({ x: x0 + o.hallW + 12, y: yTop, z: z1 - 1.5 });
      b.spots.frog.push({ x: x1 - 1.0, y: yTop + 0.02, z: z0 + 0.8 });
      b.spots.patrol.push([x0 + o.hallW + 6, yTop, cz]);
      mkTank(b, x0 + o.hallW + 15, yTop, z0 + 4);
    }
  } else if (o.roof === 'pitched') {
    b.mat = MR; b.pyr((x0 + x1) / 2, yTop, (z0 + z1) / 2, (x1 - x0) + 2, (z1 - z0) + 2, o.roofH || 5, pal.roofCol); b.mat = MW;
  }
}

/* ---------- 迷宮（樹籬／地牢） ---------- */
function mazeGen(b, o) {
  const sj = b.jit; b.jit = 0;
  try { return mazeGen_(b, o); } finally { b.jit = sj; }
}
function mazeGen_(b, o) {
  b.mat = o.mat === undefined ? 10 : o.mat;
  try { return mazeGen__(b, o); } finally { b.mat = 0; }
}
function mazeGen__(b, o) {
  const { ox, oz, cols, rows, cell, th, h, col } = o;
  const rng = b.rng;
  const right = [], down = [];
  for (let r = 0; r < rows; r++) { right.push(new Array(cols).fill(true)); down.push(new Array(cols).fill(true)); }
  const vis = []; for (let r = 0; r < rows; r++) vis.push(new Array(cols).fill(false));
  const stack = [[0, Math.floor(rows / 2)]]; vis[Math.floor(rows / 2)][0] = true;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const nb = [];
    if (c > 0 && !vis[r][c - 1]) nb.push([c - 1, r, 'L']);
    if (c < cols - 1 && !vis[r][c + 1]) nb.push([c + 1, r, 'R']);
    if (r > 0 && !vis[r - 1][c]) nb.push([c, r - 1, 'U']);
    if (r < rows - 1 && !vis[r + 1][c]) nb.push([c, r + 1, 'D']);
    if (!nb.length) { stack.pop(); continue; }
    const [nc, nr, d] = rpick(rng, nb);
    if (d === 'L') right[r][nc] = false; if (d === 'R') right[r][c] = false;
    if (d === 'U') down[nr][c] = false; if (d === 'D') down[r][c] = false;
    vis[nr][nc] = true; stack.push([nc, nr]);
  }
  // 打通部分牆，製造環路
  for (let i = 0; i < Math.floor(cols * rows * 0.14); i++) {
    const c = Math.floor(rng() * (cols - 1)), r = Math.floor(rng() * (rows - 1));
    if (rng() < 0.5) right[r][c] = false; else down[r][c] = false;
  }
  const ent = o.entrances || [];
  const hasEnt = (side, idx) => ent.some(e => e.side === side && e.idx === idx);
  const seg = (x0, z0, x1, z1) => b.box(Math.min(x0, x1) - th / 2, 0, Math.min(z0, z1) - th / 2, Math.max(x0, x1) + th / 2, h, Math.max(z0, z1) + th / 2, col);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = ox + c * cell, z = oz + r * cell;
    if (c < cols - 1 && right[r][c]) seg(x + cell, z, x + cell, z + cell);
    if (r < rows - 1 && down[r][c]) seg(x, z + cell, x + cell, z + cell);
  }
  for (let c = 0; c < cols; c++) {
    if (!hasEnt('n', c)) seg(ox + c * cell, oz, ox + (c + 1) * cell, oz);
    if (!hasEnt('s', c)) seg(ox + c * cell, oz + rows * cell, ox + (c + 1) * cell, oz + rows * cell);
  }
  for (let r = 0; r < rows; r++) {
    if (!hasEnt('w', r)) seg(ox, oz + r * cell, ox, oz + (r + 1) * cell);
    if (!hasEnt('e', r)) seg(ox + cols * cell, oz + r * cell, ox + cols * cell, oz + (r + 1) * cell);
  }
  if (o.ceiling) b.box(ox - th / 2, o.ceiling.y0, oz - th / 2, ox + cols * cell + th / 2, o.ceiling.y1, oz + rows * cell + th / 2, o.ceiling.col);
  // 死路
  const dead = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let open = 0;
    if (c > 0 && !right[r][c - 1]) open++;
    if (c < cols - 1 && !right[r][c]) open++;
    if (r > 0 && !down[r - 1][c]) open++;
    if (r < rows - 1 && !down[r][c]) open++;
    if (open === 1) dead.push({ x: ox + (c + 0.5) * cell, z: oz + (r + 0.5) * cell, c, r });
  }
  return { dead, cell, center: { x: ox + Math.floor(cols / 2 + 0.5) * cell - cell / 2, z: oz + Math.floor(rows / 2 + 0.5) * cell - cell / 2 } };
}

/* ---------- 戶外 ---------- */
function groundTiles(b, colFn, tile = 6, mat = 1) {
  const bd = b.bounds, sj = b.jit, sm = b.mat; b.jit = 0; b.mat = mat;
  for (let x = bd.x0; x < bd.x1; x += tile) for (let z = bd.z0; z < bd.z1; z += tile) {
    b.box(x, -0.4, z, x + tile, 0, z + tile, colFn(x + tile / 2, z + tile / 2), false);
  }
  b.jit = sj; b.mat = sm;
}
/* 地面細節：不重疊的薄片土塊／草簇／碎石（全是靜態方塊，依區塊剔除） */
function groundDetail(b, o) {
  const sj = b.jit; b.jit = 0.1;
  const layers = [0.008, 0.014, 0.02], av = o.avoid || [];
  scatter(b, o.patches || 0, b.bounds, 3.2, av, (x, z, i) => {
    const w = 1.2 + b.rng() * 1.0, d = 1.0 + b.rng() * 1.0;
    b.boxC(x, layers[i % 3], z, w, 0.004, d, rpick(b.rng, o.cols), false);
  });
  if (o.tufts) scatter(b, o.tufts, b.bounds, 1.5, av, (x, z) => {
    b.pyr(x, 0, z, 0.34, 0.34, 0.42 + b.rng() * 0.25, o.tuft || '#2c5a30', 0.05);
    b.pyr(x + 0.14, 0, z + 0.1, 0.26, 0.26, 0.3, o.tuft2 || '#356a38', 0.05);
  });
  if (o.stones) scatter(b, o.stones, b.bounds, 1.6, av, (x, z) => {
    b.boxC(x, 0, z, 0.28 + b.rng() * 0.2, 0.1 + b.rng() * 0.06, 0.22 + b.rng() * 0.2, o.stone || '#5a5e5c', false);
  });
  b.jit = sj;
}
function boundaryWalls(b, col, h = 9) {
  const sj = b.jit; b.jit = 0;
  try { boundaryWalls_(b, col, h); } finally { b.jit = sj; }
}
function boundaryWalls_(b, col, h) {
  const bd = b.bounds, t = 2;
  b.box(bd.x0 - t, 0, bd.z0 - t, bd.x1 + t, h, bd.z0, col);
  b.box(bd.x0 - t, 0, bd.z1, bd.x1 + t, h, bd.z1 + t, col);
  b.box(bd.x0 - t, 0, bd.z0, bd.x0, h, bd.z1, col);
  b.box(bd.x1, 0, bd.z0, bd.x1 + t, h, bd.z1, col);
}
function tree(b, x, z, s = 1, pal) {
  const sj = b.jit; b.jit = 0.10;
  try { tree_(b, x, z, s, pal); } finally { b.jit = sj; }
}
function tree_(b, x, z, s, pal) {
  pal = pal || {};
  const tc = pal.trunk || '#3b2a1c';
  b.mat = 11; b.boxC(x, 0, z, 0.55 * s, 3.2 * s, 0.55 * s, tc);
  const c1 = pal.leaf1 || '#1f4a2a', c2 = pal.leaf2 || '#2a5a34';
  b.mat = 10; b.pyr(x, 2.0 * s, z, 3.4 * s, 3.4 * s, 2.6 * s, c1);
  b.pyr(x, 3.4 * s, z, 2.4 * s, 2.4 * s, 2.4 * s, c2); b.mat = 0;
}
function bush(b, x, z, pal) {
  const sj = b.jit; b.jit = 0.10;
  try { bush_(b, x, z, pal); } finally { b.jit = sj; }
}
function bush_(b, x, z, pal) {
  const c1 = (pal && pal.bush) || '#2f6a35', c2 = (pal && pal.bush2) || '#3a7a40', c3 = '#255a2c', c4 = '#4a8a48';
  b.colBox(x - 0.9, 0, z - 0.9, x + 0.9, 1.15, z + 0.9);
  b.boxC(x, 0, z, 1.3, 0.45, 1.3, c3, false, 0.08);
  // 錯落的低多邊形葉叢（四角錐），比方塊更像灌木
  const cl = [[0, 0, 0, 1.7, 1.35, c1], [-0.32, 0.28, 0, 1.3, 1.05, c2], [0.36, 0.22, 0, 1.35, 1.0, c3], [0.22, -0.4, 0, 1.25, 1.1, c2],
    [-0.35, -0.34, 0, 1.15, 0.95, c1], [0.05, 0.05, 0.25, 1.1, 1.3, c4], [-0.5, 0.45, 0, 0.9, 0.7, c3], [0.5, -0.1, 0.1, 0.85, 0.75, c4]];
  b.mat = 10; for (const [dx, dz, dy, w, h, c] of cl) b.pyr(x + dx, 0.12 + dy, z + dz, w, w, h, c, 0.09); b.mat = 0;
  for (let k = 0; k < 5; k++) {
    const an = b.rng() * TAU, rr = 0.55 + b.rng() * 0.25;
    b.boxC(x + Math.cos(an) * rr, 0.5 + b.rng() * 0.55, z + Math.sin(an) * rr, 0.1, 0.1, 0.1, rpick(b.rng, ['#ff8fb0', '#ffe27a', '#ffffff']), false, 0.55);
  }
  addHide(b, 'bush', x, 0, z, x, z + 1.8, 0);
}
function mound(b, cx, cz, w, d, layers, col, rise = 0.45) {
  for (let i = 0; i < layers; i++) {
    const inset = i * 2.2;
    b.boxC(cx, 0, cz, w - inset * 2, (i + 1) * rise, d - inset * 2, col);
  }
}
function rock(b, x, z, s, col) {
  const sj = b.jit; b.jit = 0.08;
  try { rock_(b, x, z, s, col); } finally { b.jit = sj; }
}
function rock_(b, x, z, s, col) {
  b.mat = 6; b.boxC(x, 0, z, 1.6 * s, 0.9 * s, 1.2 * s, col || '#55595a'); b.boxC(x + 0.2 * s, 0.9 * s, z, 0.9 * s, 0.4 * s, 0.8 * s, col || '#606466', false); b.mat = 0; }
function lamp(b, x, z, h = 3.4, col = '#ffd98a') { b.boxC(x, 0, z, 0.18, h, 0.18, '#2a2d30'); b.boxC(x, h, z, 0.5, 0.3, 0.5, col, false, 1.0); }
function outSpotNear(b, kind, x, z, hint) {
  const a = Math.floor(b.rng() * 8) * (Math.PI / 4);
  const px = x + Math.cos(a) * 0.55, pz = z + Math.sin(a) * 0.55;
  if (kind === 'code') b.spots.code.push({ x: px, y: 0.03, z: pz, hint: hint || '樹根' });
  else if (kind === 'frog') b.spots.frog.push({ x: px, y: 0.02, z: pz });
  else if (kind === 'lock') b.spots.lock.push({ x: px, y: 0, z: pz, yaw: a });
  else if (kind === 'ped') b.spots.ped.push({ x: px, y: 0, z: pz });
}
/* 拒絕取樣散佈：avoid 為矩形陣列 [x0,z0,x1,z1] */
function scatter(b, n, region, minD, avoid, fn) {
  const rng = b.rng, placed = [];
  let tries = 0;
  while (placed.length < n && tries++ < n * 40) {
    const x = region.x0 + rng() * (region.x1 - region.x0), z = region.z0 + rng() * (region.z1 - region.z0);
    if (avoid.some(a => x > a[0] && x < a[2] && z > a[1] && z < a[3])) continue;
    if (placed.some(p => dist2(p[0], p[1], x, z) < minD * minD)) continue;
    placed.push([x, z]); fn(x, z, placed.length - 1);
  }
  return placed;
}

/* ===== 街道與場景道具（全是少量方塊；貼圖由 shader 提供） ===== */
function bench(b, x, z, along) {      // along: 'x' 或 'z'（長邊方向），背板在 -方向側
  const L = 1.7, W = 0.5, sx = along === 'x' ? L : W, sz = along === 'x' ? W : L;
  b.colBox(x - sx / 2, 0, z - sz / 2, x + sx / 2, 0.5, z + sz / 2);
  b.boxC(x, 0.45, z, sx, 0.07, sz, '#6a4a2a', false);
  if (along === 'x') { b.boxC(x, 0.7, z - 0.22, L, 0.4, 0.05, '#5a3e24', false); for (const dx of [-0.7, 0.7]) b.boxC(x + dx, 0, z, 0.08, 0.45, W - 0.1, '#222426', false); }
  else { b.boxC(x - 0.22, 0.7, z, 0.05, 0.4, L, '#5a3e24', false); for (const dz of [-0.7, 0.7]) b.boxC(x, 0, z + dz, W - 0.1, 0.45, 0.08, '#222426', false); }
}
function hydrant(b, x, z) {
  b.boxC(x, 0, z, 0.3, 0.62, 0.3, '#a82a2a'); b.boxC(x, 0.62, z, 0.38, 0.08, 0.38, '#7a1c1c', false); b.boxC(x, 0.7, z, 0.18, 0.12, 0.18, '#a82a2a', false);
  b.boxC(x - 0.22, 0.3, z, 0.14, 0.12, 0.14, '#c9b27a', false); b.boxC(x + 0.22, 0.3, z, 0.14, 0.12, 0.14, '#c9b27a', false);
}
function trafficLight(b, x, z, fx, fz) {   // (fx,fz)=朝向路口的單位向量
  b.boxC(x, 0, z, 0.16, 4.1, 0.16, '#26282b');
  const hx = x + fx * 0.14, hz = z + fz * 0.14;
  b.boxC(hx, 3.2, hz, fx ? 0.26 : 0.42, 1.15, fz ? 0.26 : 0.42, '#17181a', false);
  const lx = x + fx * 0.3, lz = z + fz * 0.3;
  b.boxC(lx, 4.05, lz, fx ? 0.04 : 0.2, 0.2, fz ? 0.04 : 0.2, '#ff3020', false, 1.1);
  b.boxC(lx, 3.75, lz, fx ? 0.04 : 0.2, 0.2, fz ? 0.04 : 0.2, '#ffb020', false, 0.18);
  b.boxC(lx, 3.45, lz, fx ? 0.04 : 0.2, 0.2, fz ? 0.04 : 0.2, '#20ff60', false, 0.18);
}
function barrel(b, x, z, col = '#6a4a2a') {
  b.colBox(x - 0.36, 0, z - 0.36, x + 0.36, 0.95, z + 0.36);
  b.boxC(x, 0, z, 0.6, 0.95, 0.6, col, false); b.boxC(x, 0.1, z, 0.72, 0.1, 0.72, '#222', false); b.boxC(x, 0.75, z, 0.72, 0.1, 0.72, '#222', false);
  b.boxC(x, 0.42, z, 0.7, 0.1, 0.7, '#2a2a2a', false);
}
function brazier(b, x, z) {
  b.colBox(x - 0.4, 0, z - 0.4, x + 0.4, 1.0, z + 0.4);
  b.boxC(x, 0, z, 0.22, 0.7, 0.22, '#1c1c1e', false); b.boxC(x, 0.7, z, 0.8, 0.22, 0.8, '#26262a', false);
  b.boxC(x, 0.9, z, 0.6, 0.06, 0.6, '#ff7a20', false, 1.0);
  b.pyr(x, 0.95, z, 0.5, 0.5, 0.7, '#ff9a30', 1.3); b.pyr(x + 0.08, 0.95, z - 0.05, 0.28, 0.28, 0.95, '#ffd060', 1.5);
}
function banner(b, x, y, z, axis, col = '#7a1c22') {   // axis: 'z' 表示掛在朝 ±z 的牆面（寬度沿 x），'x' 表示掛在朝 ±x 的牆
  const w = 0.9, h = 2.0;
  if (axis === 'z') { b.boxC(x, y, z, w, h, 0.05, col, false, 0.05); b.boxC(x, y + h - 0.12, z, w + 0.2, 0.1, 0.09, '#a8873a', false); b.boxC(x, y + 0.5, z + 0.03, 0.18, 0.5, 0.02, '#a8873a', false, 0.1); }
  else { b.boxC(x, y, z, 0.05, h, w, col, false, 0.05); b.boxC(x, y + h - 0.12, z, 0.09, 0.1, w + 0.2, '#a8873a', false); b.boxC(x + 0.03, y + 0.5, z, 0.02, 0.5, 0.18, '#a8873a', false, 0.1); }
}
function statue(b, x, z) {
  b.mat = 6;
  b.colBox(x - 0.55, 0, z - 0.55, x + 0.55, 2.4, z + 0.55);
  b.boxC(x, 0, z, 1.1, 0.35, 1.1, '#7a7d80', false); b.boxC(x, 0.35, z, 0.7, 0.9, 0.7, '#8a8d90', false);
  b.boxC(x, 1.25, z, 0.42, 0.85, 0.3, '#9a9da0', false); b.boxC(x, 2.1, z, 0.26, 0.3, 0.26, '#9a9da0', false);
  b.boxC(x - 0.34, 1.5, z + 0.12, 0.06, 0.9, 0.4, '#8a8d90', false); b.boxC(x + 0.34, 1.5, z + 0.12, 0.06, 0.9, 0.4, '#8a8d90', false);
  b.boxC(x, 1.6, z - 0.18, 0.5, 0.2, 0.08, '#8a8d90', false);
  b.mat = 0;
}
function deadTree(b, x, z, s = 1) {
  b.mat = 11; b.boxC(x, 0, z, 0.4 * s, 3.0 * s, 0.4 * s, '#2a2018');
  b.boxC(x + 0.5 * s, 1.8 * s, z, 0.9 * s, 0.14 * s, 0.14 * s, '#2a2018', false); b.boxC(x - 0.45 * s, 2.3 * s, z + 0.1, 0.8 * s, 0.12 * s, 0.12 * s, '#2a2018', false);
  b.boxC(x, 2.6 * s, z - 0.5 * s, 0.12 * s, 0.12 * s, 0.9 * s, '#2a2018', false); b.boxC(x + 0.1, 1.2 * s, z + 0.45 * s, 0.12 * s, 0.12 * s, 0.8 * s, '#2a2018', false);
  b.mat = 0;
}
function fenceRun(b, x0, z0, x1, z1, h = 1.4, col = '#1c1e20') {
  const alongX = Math.abs(z1 - z0) < 1e-6, L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const n = Math.max(1, Math.round(L / 1.6)), step = L / n, sx = Math.sign(x1 - x0) || 1, sz = Math.sign(z1 - z0) || 1;
  if (alongX) b.colBox(Math.min(x0, x1), 0, z0 - 0.06, Math.max(x0, x1), h, z0 + 0.06); else b.colBox(x0 - 0.06, 0, Math.min(z0, z1), x0 + 0.06, h, Math.max(z0, z1));
  for (let i = 0; i <= n; i++) {
    const px = alongX ? x0 + sx * step * i : x0, pz = alongX ? z0 : z0 + sz * step * i;
    b.boxC(px, 0, pz, 0.12, h + 0.12, 0.12, col, false); b.pyr(px, h + 0.12, pz, 0.16, 0.16, 0.16, col);
  }
  for (const ry of [0.3, 0.75, 1.2]) {
    if (alongX) b.boxC((x0 + x1) / 2, ry, z0, L, 0.05, 0.05, col, false); else b.boxC(x0, ry, (z0 + z1) / 2, 0.05, 0.05, L, col, false);
  }
  const bars = Math.floor(L / 0.35);
  for (let i = 1; i < bars; i++) { const t = i * 0.35, px = alongX ? Math.min(x0, x1) + t : x0, pz = alongX ? z0 : Math.min(z0, z1) + t; b.boxC(px, 0.1, pz, 0.025, h - 0.1, 0.025, col, false); }
}
function fallenLog(b, x, z, alongX = true) {
  b.mat = 11;
  const w = alongX ? 3.0 : 0.55, d = alongX ? 0.55 : 3.0;
  b.boxC(x, 0, z, w, 0.55, d, '#3a2a1c');
  b.boxC(x + (alongX ? 1.45 : 0), 0.1, z + (alongX ? 0 : 1.45), alongX ? 0.12 : 0.4, 0.36, alongX ? 0.4 : 0.12, '#8a6a42', false);
  b.mat = 0;
}
function mushrooms(b, x, z) {
  for (let i = 0; i < 4; i++) {
    const a = b.rng() * TAU, r = b.rng() * 0.6, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = 0.12 + b.rng() * 0.18;
    b.boxC(px, 0, pz, 0.04, h, 0.04, '#b8b0a0', false); b.boxC(px, h, pz, 0.16 + b.rng() * 0.08, 0.06, 0.16 + b.rng() * 0.08, '#4fd0c0', false, 0.9);
  }
}
function gardenBed(b, x, z, w, d) {
  b.colBox(x - w / 2, 0, z - d / 2, x + w / 2, 0.4, z + d / 2);
  b.boxC(x, 0, z, w, 0.3, d, '#4a3a2a', false); b.boxC(x, 0.3, z, w - 0.2, 0.05, d - 0.2, '#2a2218', false);
  b.boxC(x, 0, z - d / 2 + 0.03, w + 0.08, 0.38, 0.06, '#5a5a56', false); b.boxC(x, 0, z + d / 2 - 0.03, w + 0.08, 0.38, 0.06, '#5a5a56', false);
  for (let i = 0; i < Math.floor(w / 0.35); i++) b.boxC(x - w / 2 + 0.25 + i * 0.35, 0.33, z + (b.rng() - 0.5) * (d - 0.4), 0.03, 0.2 + b.rng() * 0.35, 0.03, '#4a4a2a', false);
}
function manhole(b, x, z) { b.boxC(x, 0.012, z, 1.1, 0.004, 1.1, '#34363a', false); b.boxC(x, 0.012, z, 0.9, 0.012, 0.9, '#1d1f22', false); b.boxC(x, 0.024, z, 0.6, 0.002, 0.08, '#34363a', false); b.boxC(x, 0.024, z, 0.08, 0.002, 0.6, '#34363a', false); }
function neonSign(b, x, y, z, w, h, axis, col) {   // axis: 'z' 面向 ±z
  if (axis === 'z') { b.boxC(x, y, z, w + 0.1, h + 0.1, 0.05, '#17181a', false); b.boxC(x, y + 0.05, z + Math.sign(z) * 0.0, w, h, 0.06, col, false, 0.95); }
  else { b.boxC(x, y, z, 0.05, h + 0.1, w + 0.1, '#17181a', false); b.boxC(x, y + 0.05, z, 0.06, h, w, col, false, 0.95); }
}
function streetTree(b, x, z, s = 1) {
  b.colBox(x - 0.5, 0, z - 0.5, x + 0.5, 0.5, z + 0.5);
  b.boxC(x, 0, z, 1.0, 0.45, 1.0, '#4a4e52', false); b.boxC(x, 0.45, z, 0.82, 0.05, 0.82, '#2a2218', false);
  b.mat = 11; b.boxC(x, 0.45, z, 0.22 * s, 2.4 * s, 0.22 * s, '#3a2a1c'); b.mat = 10;
  b.pyr(x, 1.8 * s, z, 2.2 * s, 2.2 * s, 1.8 * s, '#3a5a3a', 0.04); b.pyr(x, 2.9 * s, z, 1.5 * s, 1.5 * s, 1.5 * s, '#4a6a44', 0.04); b.mat = 0;
}
function crosswalk(b, cx, cz, alongZ) {     // 斑馬線：9 條 0.5 寬、間隔 0.5
  for (let i = -4; i <= 4; i++) {
    if (alongZ) b.box(cx + i * 1.0 - 0.25, 0.012, cz - 1.25, cx + i * 1.0 + 0.25, 0.017, cz + 1.25, '#d8d8cf', false);
    else b.box(cx - 1.25, 0.012, cz + i * 1.0 - 0.25, cx + 1.25, 0.017, cz + i * 1.0 + 0.25, '#d8d8cf', false);
  }
}
