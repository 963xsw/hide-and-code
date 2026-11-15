'use strict';
/* ===== 三張地圖（約 60×60 公尺，城堡 56×56）：廢棄莊園（半森林）、廢棄都市、廢棄城堡 ===== */

/* 平鋪的貼地方塊（泥土路、柏油、鋪石…），材質由 shader 產生細節 */
function flat(b, x0, z0, x1, z1, y1, col, mat) { const sm = b.mat; b.mat = mat; b.box(x0, 0, z0, x1, y1, z1, col, false); b.mat = sm; }

function buildManor() {
  const b = new Builder(1101, { x0: -30, z0: -30, x1: 30, z1: 30 });
  b.theme = { name: '廢棄莊園', fog: [0.07, 0.10, 0.11], near: 7, far: 46, amb: 0.36, sun: 0.14, sunDir: [-0.4, 0.8, 0.3], flash: 1.0 };
  groundTiles(b, () => '#2d3d2d', 10, 1);
  boundaryWalls(b, '#1d2420', 9);
  // 泥土小徑：大門 → 迷宮入口 → 往南的主路，以及通往小屋、墓園的岔路
  const dirt = '#5a5040';
  flat(b, -9, -14, -6, -11, 0.012, dirt, 8); flat(b, -9, -12, 0.5, -10, 0.012, dirt, 8); flat(b, -4, -11, 0, -10, 0.012, dirt, 8);
  flat(b, -3, 6, 1, 30, 0.012, dirt, 8); flat(b, 1, 24.5, 18, 26.5, 0.012, dirt, 8); flat(b, 15.5, 24, 17.5, 26.5, 0.012, dirt, 8);
  flat(b, -22, 11, -3, 13, 0.012, dirt, 8); flat(b, -24, 13, -22, 15, 0.012, dirt, 8);
  const pal = { wall: '#6a6258', floor: '#3b322b', ceil: '#2c2724', roofCol: '#3a2a30', matWall: 7 };
  building(b, { x0: -12, z0: -28, x1: 12, z1: -14, floors: 3, hallW: 9, rooms: 2, roof: 'pitched', pal, roofH: 5 });
  building(b, { x0: 12, z0: 10, x1: 28, z1: 24, floors: 2, hallW: 9, rooms: 1, roof: 'pitched', pal: Object.assign({}, pal, { wall: '#5e5a4e', roofCol: '#3a2a22' }), roofH: 4, hideProb: 0.6 });
  // 樹籬迷宮 x∈[-8,8] z∈[-10,6]
  const mz = mazeGen(b, { ox: -8, oz: -10, cols: 4, rows: 4, cell: 4, th: 0.8, h: 2.3, col: '#244a28', entrances: [{ side: 'n', idx: 1 }, { side: 's', idx: 1 }] });
  mz.dead.forEach((d, i) => {
    const k = i % 4;
    if (k === 0 || k === 1) b.spots.code.push({ x: d.x + (b.rng() - 0.5) * 1.2, y: 0.03, z: d.z + (b.rng() - 0.5) * 1.2, hint: '迷宮死路' });
    else if (k === 2) b.spots.lock.push({ x: d.x, y: 0, z: d.z, yaw: b.rng() * TAU });
    else b.spots.ped.push({ x: d.x, y: 0, z: d.z });
  });
  if (mz.dead[0]) b.spots.frog.push({ x: mz.dead[0].x, y: 0.02, z: mz.dead[0].z + 1 });
  b.mat = 6; b.boxC(mz.center.x, 0, mz.center.z, 1.4, 0.9, 1.4, '#5a5a58'); b.boxC(mz.center.x, 0.9, mz.center.z, 0.9, 0.12, 0.9, '#2a4a5a', false, 0.15); b.mat = 0;   // 迷宮中心噴泉
  b.spots.patrol.push([mz.center.x + 2, 0, mz.center.z]);
  // 墓園 x∈[-28,-14] z∈[-8,6]：墓碑、石板、鐵柵欄
  b.mat = 6;
  for (let gx = -26; gx <= -17; gx += 3.2) for (let gz = -6; gz <= 4; gz += 3.2) {
    if (b.rng() < 0.2) continue;
    b.boxC(gx, 0, gz, 0.9, 1.3, 0.28, '#5b5f60'); b.boxC(gx, 1.3, gz, 0.7, 0.2, 0.28, '#6a6e70', false); b.boxC(gx, 0, gz + 0.6, 0.7, 0.06, 1.1, '#4a4e48', false);
    if (b.rng() < 0.3) b.spots.code.push({ x: gx + 0.1, y: 0.03, z: gz + 0.5, hint: '墓碑後' });
  }
  b.mat = 0;
  fenceRun(b, -29, -9, -13, -9); fenceRun(b, -29, 7, -13, 7); fenceRun(b, -29, -9, -29, 7);
  fenceRun(b, -13, -9, -13, -2); fenceRun(b, -13, 2, -13, 7);   // 東側留出入口
  statue(b, -11, -6.5);
  b.spots.patrol.push([-20, 0, 0]);
  // 墓室 x∈[-27,-21] z∈[14,20]
  b.mat = 6;
  b.box(-27, 0, 14, -21, 3, 14.4, '#55595a'); b.box(-27, 0, 19.6, -21, 3, 20, '#55595a');
  b.box(-27, 0, 14, -26.6, 3, 16.6, '#55595a'); b.box(-27, 0, 18.2, -26.6, 3, 20, '#55595a');
  b.box(-21.4, 0, 14, -21, 3, 20, '#55595a'); b.box(-27, 3, 14, -21, 3.3, 20, '#3f4446');
  b.mat = 0;
  b.spots.ped.push({ x: -22.4, y: 0, z: 18.6 }); b.spots.code.push({ x: -22, y: 0.03, z: 15, hint: '墓室角落' });
  b.mat = 6; b.boxC(-24, 0, 16.5, 1.6, 0.8, 0.9, '#6a6a68'); b.mat = 0; b.spots.frog.push({ x: -24, y: 0.02, z: 15 });
  b.spots.patrol.push([-24, 0, 17.4]);
  // 土丘、水井、廢墟牆
  mound(b, 18, -14, 8, 8, 3, '#3a4a30'); b.spots.ped.push({ x: 18, y: 1.35, z: -14 }); b.spots.lock.push({ x: 19.4, y: 1.35, z: -13.2, yaw: 0 });
  mound(b, -8, 22, 8, 8, 3, '#3a4a30'); b.spots.code.push({ x: -8, y: 1.38, z: 22, hint: '丘頂' });
  b.spots.patrol.push([18, 1.35, -14]);
  b.mat = 6; b.boxC(18, 0, -1, 2, 1.0, 2, '#5a5e60'); b.boxC(18, 1.0, -1, 1.2, 0.15, 1.2, '#1a2024', false); b.mat = 0;
  b.boxC(18, 1.0, -1, 0.1, 1.2, 0.1, '#3a2a1c', false); b.boxC(18, 2.1, -1, 1.5, 0.1, 0.1, '#3a2a1c', false);
  b.spots.code.push({ x: 18, y: 0.03, z: 0.4, hint: '井邊' });
  b.mat = 6;
  for (let i = 0; i < 5; i++) { const x = -6 + i * 2.8; b.box(x, 0, 26, x + 2.0, 1.2 + (i % 3) * 0.8, 26.5, '#575b5a'); }
  b.box(-6, 0, 26, -5.5, 2.4, 29.6, '#575b5a'); b.mat = 0;
  b.spots.code.push({ x: -4.6, y: 0.03, z: 28, hint: '廢牆內側' }); b.spots.lock.push({ x: -4.6, y: 0, z: 29, yaw: Math.PI / 2 });
  b.spots.patrol.push([-3, 0, 28]);
  // 花圃、長椅、燈籠、倒木、發光蘑菇、枯樹
  gardenBed(b, -10.5, -16.4, 3, 1.3); gardenBed(b, 9.5, -16.4, 3, 1.3);
  bench(b, 4, -12.2, 'x'); bench(b, 14, 8, 'x');
  [[0, 12], [0, 22], [-9, -9.2], [10, 0]].forEach(p => lamp(b, p[0], p[1], 3.2, '#ffb868'));
  fallenLog(b, 8, 16, true); fallenLog(b, -14, 18, false); fallenLog(b, 22, -4, true);
  [[-16, 22], [6, 18], [24, -20], [-22, -20], [10, 28]].forEach(p => mushrooms(b, p[0], p[1]));
  [[-18, -24], [20, -24], [24, 6], [-14, 10], [4, 30 - 3]].forEach(p => deadTree(b, p[0], p[1], 0.9 + b.rng() * 0.3));
  // 樹林與地面細節
  const avoid = [[-15, -31, 15, -12], [10, 8, 31, 27], [-10, -12, 10, 8], [-31, -10, -12, 8], [-29, 12, -19, 22], [12, -19, 24, -8],
    [-13, 18, -3, 27], [-8, 24, 8, 31], [-4, 6, 3, 31], [15, -5, 21, 2], [-12, -9, -10, -4]];
  groundDetail(b, { patches: 26, cols: ['#2f3d2a', '#3a3a2c', '#344a30', '#2a3426'], tufts: 110, stones: 30, avoid });
  const forest = scatter(b, 70, b.bounds, 3.4, avoid, (x, z) => tree(b, x, z, 0.85 + b.rng() * 0.5));
  forest.forEach((p, i) => { if (i % 6 === 0) outSpotNear(b, 'code', p[0], p[1], '樹根'); else if (i % 19 === 0) outSpotNear(b, 'frog', p[0], p[1]); else if (i % 17 === 0) outSpotNear(b, 'lock', p[0], p[1]); else if (i % 13 === 0) outSpotNear(b, 'ped', p[0], p[1]); });
  scatter(b, 10, b.bounds, 5.5, avoid, (x, z) => bush(b, x, z));
  scatter(b, 8, b.bounds, 5.5, avoid, (x, z) => rock(b, x, z, 0.8 + b.rng() * 0.8));
  [[0, 0, 20], [-16, 0, 24], [22, 0, 4], [-20, 0, -22], [20, 0, -23], [-24, 0, -14], [24, 0, -6], [0, 0, 27], [9, 0, 2], [-8, 0, 12], [24, 0, 28], [-26, 0, 26]].forEach(p => b.spots.spawn.push(p));
  [[0, 0, 20], [-22, 0, 0], [22, 0, -6], [-16, 0, 26], [22, 0, 28], [-22, 0, -22], [18, 0, -22], [8, 0, 12]].forEach(p => b.spots.patrol.push(p));
  b.portals.push({ a: [-7.5, 3.2, -21], b: [16.5, 3.2, 17] });
  return b;
}

function buildCity() {
  const b = new Builder(2202, { x0: -30, z0: -30, x1: 30, z1: 30 });
  b.theme = { name: '廢棄都市', fog: [0.06, 0.07, 0.12], near: 8, far: 48, amb: 0.37, sun: 0.16, sunDir: [0.3, 0.9, -0.3], flash: 1.0 };
  groundTiles(b, () => '#585c62', 10, 3);                       // 人行道方磚（貼圖）
  boundaryWalls(b, '#16181c', 11);
  const ROAD = '#2a2c30', ASPH = 2;
  flat(b, -5, -30, 5, 30, 0.012, ROAD, ASPH); flat(b, -30, -5, 30, 5, 0.012, ROAD, ASPH);   // 十字路口：柏油路面
  // 人行道帶（略高、顏色較亮）與路緣
  const SW = '#6b7076', CB = '#8c9096';
  for (const s of [-1, 1]) {
    for (const [z0, z1] of [[-30, -5], [5, 30]]) { flat(b, s > 0 ? 5 : -7, z0, s > 0 ? 7 : -5, z1, 0.03, SW, 3); b.box(s > 0 ? 5 : -5.18, 0.03, z0, s > 0 ? 5.18 : -5, 0.045, z1, CB, false); }
    for (const [x0, x1] of [[-30, -5], [5, 30]]) { flat(b, x0, s > 0 ? 5 : -7, x1, s > 0 ? 7 : -5, 0.03, SW, 3); b.box(x0, 0.03, s > 0 ? 5 : -5.18, x1, 0.045, s > 0 ? 5.18 : -5, CB, false); }
  }
  // 路面標線：雙黃線、虛線車道、邊線、斑馬線、停止線（皆不重疊）
  const Y = '#c9a23a', W = '#d8d8cf';
  for (const [a, c] of [[9, 30], [-30, -9]]) {
    b.box(-0.2, 0.012, a, -0.08, 0.017, c, Y, false); b.box(0.08, 0.012, a, 0.2, 0.017, c, Y, false);
    b.box(a, 0.012, -0.2, c, 0.017, -0.08, Y, false); b.box(a, 0.012, 0.08, c, 0.017, 0.2, Y, false);
    b.box(-4.76, 0.012, a, -4.64, 0.017, c, W, false); b.box(4.64, 0.012, a, 4.76, 0.017, c, W, false);
    b.box(a, 0.012, -4.76, c, 0.017, -4.64, W, false); b.box(a, 0.012, 4.64, c, 0.017, 4.76, W, false);
  }
  for (let t = 10; t < 29; t += 4) for (const s of [-1, 1]) {
    b.box(-2.55, 0.012, s * t, -2.45, 0.017, s * t + 2 * s, W, false); b.box(2.45, 0.012, s * t, 2.55, 0.017, s * t + 2 * s, W, false);
    b.box(s * t, 0.012, -2.55, s * t + 2 * s, 0.017, -2.45, W, false); b.box(s * t, 0.012, 2.45, s * t + 2 * s, 0.017, 2.55, W, false);
  }
  crosswalk(b, 0, -7.25, true); crosswalk(b, 0, 7.25, true); crosswalk(b, -7.25, 0, false); crosswalk(b, 7.25, 0, false);
  b.box(-4.5, 0.012, -9.6, -0.35, 0.017, -9.2, W, false); b.box(0.35, 0.012, 9.2, 4.5, 0.017, 9.6, W, false);
  b.box(-9.6, 0.012, 0.35, -9.2, 0.017, 4.5, W, false); b.box(9.2, 0.012, -4.5, 9.6, 0.017, -0.35, W, false);
  [[2.5, -15], [-2.5, 15], [15, -2.5], [-15, 2.5], [-2.5, -22], [22, 2.5]].forEach(p => manhole(b, p[0], p[1]));
  groundDetail(b, { patches: 0, tufts: 0, stones: 40, stone: '#6a6c6e', avoid: [[-6, -31, 6, 31], [-31, -6, 31, 6]] });
  const concrete = { wall: '#6d6f72', floor: '#3a3b3e', ceil: '#2a2b2e', wood: '#4a4038', crate: '#5a5046', trim: '#222426', cloth: '#5a4a5a', hide: '#8a8a52', stair: '#4a4c50', roofSlab: '#33353a', parapet: '#707276', frame: '#202226', base: '#1c1d20', seam: '#26231f', matWall: 7, matRoofSlab: 7 };
  const brick = Object.assign({}, concrete, { wall: '#8a5a48', matWall: 6 });
  // 高塔（4 層＋屋頂）兩棟，以空橋相連（2 樓）
  building(b, { x0: -28, z0: -27, x1: -7, z1: -13, floors: 4, hallW: 9, rooms: 2, roof: 'access', pal: concrete, extraDoors: [{ wall: 'e', level: 2, at: -20 }], hideProb: 0.45 });
  building(b, { x0: 7, z0: -27, x1: 28, z1: -13, floors: 4, hallW: 9, rooms: 2, roof: 'access', pal: brick, extraDoors: [{ wall: 'w', level: 2, at: -20 }], hideProb: 0.45 });
  const by = 2 * H_FLOOR;
  b.mat = 7; b.box(-7, by - 0.3, -21.6, 7, by, -18.4, '#3a3d42'); b.box(-7, by, -21.7, 7, by + 1.0, -21.5, '#2a2c30'); b.box(-7, by, -18.5, 7, by + 1.0, -18.3, '#2a2c30'); b.mat = 0;
  b.boxC(-6, 0, -20, 1.2, by - 0.3, 1.2, '#44474c'); b.boxC(6, 0, -20, 1.2, by - 0.3, 1.2, '#44474c');
  for (let i = -6; i <= 6; i += 3) b.boxC(i, by + 0.1, -21.6, 0.06, 0.9, 0.04, '#1a1c1e', false);
  b.spots.code.push({ x: 0, y: by + 0.03, z: -21.2, hint: '空橋角落' }); b.spots.patrol.push([0, by, -20]);
  building(b, { x0: -28, z0: 13, x1: -7, z1: 27, floors: 3, hallW: 9, rooms: 2, roof: 'access', pal: brick, hideProb: 0.5, doorN: -18 });
  building(b, { x0: 7, z0: 13, x1: 28, z1: 27, floors: 2, hallW: 9, rooms: 2, roof: 'access', pal: concrete, hideProb: 0.5 });
  // 霓虹招牌（朝向路口的立面）
  neonSign(b, 14, 2.5, -12.75, 3, 0.7, 'z', '#ff3ea0'); neonSign(b, -14, 2.5, -12.75, 2.4, 0.7, 'z', '#3ec8ff');
  neonSign(b, 14, 2.6, 12.75, 2.8, 0.7, 'z', '#ffd23e'); neonSign(b, -17, 2.6, 12.75, 3, 0.7, 'z', '#5aff8a');
  neonSign(b, -6.82, 3.4, -14.5, 3, 0.8, 'x', '#ff6a3e');
  // 號誌、消防栓、長椅、行道樹、路燈
  const tl = [[6.6, 6.6, -1, -1], [-6.6, 6.6, 1, -1], [6.6, -6.6, -1, 1], [-6.6, -6.6, 1, 1]];
  tl.forEach(t => trafficLight(b, t[0], t[1], Math.abs(t[2]) > 0 ? 0 : 0, t[3]));
  [[6.6, -12], [-6.6, 12], [12, 6.6], [-12, -6.6]].forEach(p => hydrant(b, p[0], p[1]));
  bench(b, 6.2, -10, 'z'); bench(b, -6.2, 10, 'z'); bench(b, 10, -6.2, 'x'); bench(b, -10, 6.2, 'x');
  [[6, -18], [-6, -22], [6, 18], [-6, 24], [18, 6], [-18, -6], [24, -6], [-24, 6]].forEach(p => streetTree(b, p[0], p[1]));
  for (let x = -24; x <= 24; x += 12) { if (Math.abs(x) < 4) continue; lamp(b, x, -6.7, 4.2, '#a8c8ff'); lamp(b, x, 6.7, 4.2, '#a8c8ff'); }
  for (let z = -24; z <= 24; z += 12) { if (Math.abs(z) < 4) continue; lamp(b, -6.7, z, 4.2, '#a8c8ff'); lamp(b, 6.7, z, 4.2, '#a8c8ff'); }
  // 車輛、垃圾箱
  [[-16, -2.5, 0], [16, 2.5, 0], [22, -2.5, 0], [-22, 2.5, 0], [-2.5, 16, 1], [2.5, -16, 1], [2.5, 24, 1], [-2.5, -24, 1]].forEach(c => {
    const vert = c[2] === 1, w = vert ? 1.9 : 4.4, d = vert ? 4.4 : 1.9;
    b.boxC(c[0], 0.25, c[1], w, 0.8, d, '#4a5058');
    b.boxC(c[0], 1.05, c[1], vert ? 1.7 : 2.2, 0.6, vert ? 2.2 : 1.7, '#2f3a44');
    b.boxC(c[0], 0.9, c[1], vert ? 1.96 : 4.46, 0.08, vert ? 4.46 : 1.96, '#2a2e34', false);
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.5, 0.5]) b.boxC(c[0] + (vert ? sx * 1.5 : sx * 3.2), 0, c[1] + (vert ? sz * 3.6 : sz * 2.0), 0.34, 0.34, 0.34, '#111214', false);
    if (b.rng() < 0.7) b.spots.code.push({ x: c[0] + (vert ? 1.4 : 0), y: 0.03, z: c[1] + (vert ? 0 : 1.4), hint: '車旁' });
  });
  [[-12, -10], [12, 10], [-12, 10], [12, -10], [-24, 10], [24, -10], [-14, 28.6]].forEach((p, i) => {
    mkDumpster(b, p[0], p[1]);
    if (i % 2 === 0) b.spots.code.push({ x: p[0] + 1.3, y: 0.03, z: p[1], hint: '垃圾箱旁' });
  });
  // 貨櫃（可爬上去）
  const cont = (x, z, col) => { b.boxC(x, 0, z, 6, 2.6, 2.4, col); b.boxC(x, 2.6, z, 6.1, 0.08, 2.5, '#2a2c2e', false); for (let k = -2; k <= 2; k++) b.boxC(x + k * 1.2, 0, z + 1.21, 0.1, 2.6, 0.04, '#1a1a1a', false); };
  cont(-25, -10, '#6a3a30'); cont(-25, 10.5, '#3a6a4a');
  for (let i = 0; i < 6; i++) b.box(-22 + i * 0.7, 0, -11.2, -22 + (i + 1) * 0.7, 0.43 * (6 - i), -8.8, '#55575a');
  b.spots.code.push({ x: -25, y: 2.71, z: -10, hint: '貨櫃頂' }); b.spots.ped.push({ x: -26.2, y: 2.68, z: -10.6 });
  b.spots.lock.push({ x: -23.6, y: 2.68, z: -9.4, yaw: Math.PI });
  // 路障、公車亭
  for (let i = 0; i < 7; i++) {
    const x = (b.rng() - 0.5) * 54, z = (b.rng() - 0.5) * 54;
    if (Math.abs(x) < 7.5 && Math.abs(z) < 7.5) continue; if ((Math.abs(x) > 6 && Math.abs(x) < 29 && z > -28 && z < -12) || (Math.abs(x) > 6 && z > 12 && z < 28)) continue;
    if (Math.abs(x) > 7.2 && Math.abs(z) > 7.2 && z < 28) continue;
    b.boxC(x, 0, z, 2.2, 0.9, 1.0, '#8a8e92'); b.boxC(x, 0.55, z, 2.24, 0.12, 1.04, '#c9622a', false, 0.15); b.spots.code.push({ x: x + 1.4, y: 0.03, z, hint: '路障' });
  }
  b.box(9, 0.03, 7.4, 15, 0.2, 8.6, '#444'); b.box(9, 2.6, 7.4, 15, 2.8, 8.8, '#3a3f44'); b.box(9, 0.2, 8.6, 15, 2.6, 8.8, '#2c4452');
  for (const px of [9.1, 14.9]) b.boxC(px, 0.2, 7.6, 0.12, 2.4, 0.12, '#2a2e32', false);
  b.spots.frog.push({ x: 14.4, y: 0.25, z: 8 }); b.spots.ped.push({ x: 11, y: 0.2, z: 8 });
  [[0, 0, 0], [-12, 0, 0], [12, 0, 0], [0, 0, 12], [0, 0, -10], [-24, 0, 28.4], [24, 0, 28.4], [-12, 0, 28.4], [14, 0, 28.4], [-6, 0, -3], [8, 0, 0]].forEach(p => b.spots.spawn.push(p));
  [[0, 0, 0], [-14, 0, 0], [14, 0, 0], [0, 0, 14], [0, 0, -10], [-24, 0, 28.4], [24, 0, 28.4], [-20, 0, -10], [20, 0, 10]].forEach(p => b.spots.patrol.push(p));
  b.portals.push({ a: [-18, 4 * H_FLOOR, -20], b: [-23.5, 0, 20] });
  return b;
}

function buildCastle() {
  const b = new Builder(3303, { x0: -28, z0: -28, x1: 28, z1: 28 });
  b.theme = { name: '廢棄城堡', fog: [0.10, 0.07, 0.06], near: 7, far: 44, amb: 0.34, sun: 0.12, sunDir: [-0.2, 0.8, 0.5], flash: 1.05 };
  groundTiles(b, () => '#2e3629', 10, 1);
  boundaryWalls(b, '#1a1614', 10);
  flat(b, -20, -20, 20, 20, 0.012, '#403e3a', 4);                  // 庭院鋪石（貼圖）
  flat(b, -2.6, 20, 2.6, 28, 0.012, '#5a5040', 8);                 // 城門外的泥土路
  for (const s of [-1.1, 1.1]) b.box(s - 0.08, 0.012, 20, s + 0.08, 0.016, 28, '#3a3228', false);   // 車輪輾痕
  const stone = { wall: '#6b6a68', floor: '#3a3836', ceil: '#2c2a28', wood: '#4a3424', crate: '#5a4630', trim: '#222', cloth: '#6a3a3a', hide: '#9a7a45', stair: '#555452', roofSlab: '#383634', parapet: '#6b6a68', frame: '#26221e', base: '#1f1c1a', seam: '#2a2622', matWall: 6, matRoofSlab: 6 };
  const KZ0 = -11, KZ1 = 3;
  building(b, { x0: -8, z0: KZ0, x1: 8, z1: KZ1, floors: 3, hallW: 9, rooms: 1, roof: 'access', pal: stone, hideProb: 0.5 });
  const towerR = [[-17.6, -17.6], [8.6, -17.6], [-17.6, 8.6], [8.6, 8.6]];
  towerR.forEach(p => {
    building(b, { x0: p[0], z0: p[1], x1: p[0] + 9, z1: p[1] + 9, floors: 2, hallW: 9, rooms: 0, hallOnly: true, roof: 'access', pal: stone, windows: false, roofProps: false, noParapet: true, doorN: p[1] > 0 ? p[0] + 4.5 : undefined });
  });
  // 城牆（高 6.4，牆頂可行走）；南牆中間留城門
  const wh = 6.4, wt = 2.4;
  b.mat = 6;
  b.box(-20, 0, -20, 20, wh, -20 + wt, stone.wall);
  b.box(-20, 0, 20 - wt, -3, wh, 20, stone.wall); b.box(3, 0, 20 - wt, 20, wh, 20, stone.wall); b.box(-3, 4.4, 20 - wt, 3, wh, 20, stone.wall);
  b.box(-20, 0, -20, -20 + wt, wh, 20, stone.wall); b.box(20 - wt, 0, -20, 20, wh, 20, stone.wall);
  for (let t = -20; t < 20; t += 3) {
    b.box(t, wh, -20, t + 1.4, wh + 1.0, -20 + 0.6, stone.wall);
    if (t < -4 || t > 3) b.box(t, wh, 20 - 0.6, t + 1.4, wh + 1.0, 20, stone.wall);
    b.box(-20, wh, t, -20 + 0.6, wh + 1.0, t + 1.4, stone.wall);
    b.box(20 - 0.6, wh, t, 20, wh + 1.0, t + 1.4, stone.wall);
  }
  b.mat = 0;
  // 旗幟（掛在城牆內側）與火盆
  for (const x of [-12, -4, 4, 12]) banner(b, x, 2.6, -17.55, 'z');
  for (const z of [-4, 4]) { banner(b, -17.55, 2.6, z, 'x', '#223a6a'); banner(b, 17.55, 2.6, z, 'x', '#223a6a'); }
  [[-12, -14], [12, -14], [-12, 0], [12, 0], [-5, 22.5], [5, 22.5]].forEach(p => brazier(b, p[0], p[1]));
  // 庭院小物
  b.mat = 6; b.boxC(-13, 0, 3, 2.2, 1.0, 2.2, '#5a5a58'); b.boxC(-13, 1.0, 3, 1.3, 0.1, 1.3, '#101418', false); b.mat = 0;
  b.spots.code.push({ x: -13, y: 0.03, z: 4.4, hint: '水井旁' });
  [[-13, -4], [13, -4], [13, 4], [-13, 6]].forEach((p, i) => { mkHay(b, p[0], p[1]); if (i % 2) b.spots.code.push({ x: p[0] + 1.3, y: 0.03, z: p[1], hint: '乾草旁' }); });
  [[-12, -14.5], [12, -14.5], [0, -15]].forEach(p => { b.boxC(p[0], 0.4, p[1], 2.0, 0.6, 1.2, '#4a3424'); b.boxC(p[0] - 0.9, 0, p[1], 0.7, 0.7, 0.1, '#222', false); b.spots.code.push({ x: p[0], y: 0.03, z: p[1] + 1.0, hint: '推車下' }); });
  [[-6, -15], [6, -15], [-14, 14]].forEach(p => barrel(b, p[0], p[1]));
  barrel(b, 14.4, 6.6, '#4a3424'); barrel(b, 15.1, 7.3);
  for (const x of [-14, 14]) { b.colBox(x - 0.1, 0, -9.1, x + 0.1, 1.9, -8.9); b.boxC(x, 0, -9, 0.1, 1.9, 0.1, '#4a3424', false); b.boxC(x, 1.35, -9, 0.9, 0.1, 0.1, '#4a3424', false); b.boxC(x, 1.55, -9, 0.34, 0.34, 0.34, '#8a7a4a', false); b.boxC(x, 0.8, -9.0, 0.5, 0.7, 0.2, '#6a5a3a', false); }   // 訓練假人
  // 地牢迷宮 x∈[-6,6] z∈[5,13]（與角塔之間留出通道，城門後的空地才接得到庭院）
  const dz = mazeGen(b, { ox: -6, oz: 5, cols: 3, rows: 2, cell: 4, th: 0.8, h: 3.0, col: '#4a4846', mat: 6, entrances: [{ side: 'n', idx: 0 }, { side: 'n', idx: 2 }], ceiling: { y0: 3.0, y1: 3.4, col: '#2c2a28' } });
  dz.dead.forEach((d, i) => {
    const k = i % 4;
    if (k === 0 || k === 1) b.spots.code.push({ x: d.x + (b.rng() - 0.5) * 1.0, y: 0.03, z: d.z + (b.rng() - 0.5) * 1.0, hint: '地牢死路' });
    else if (k === 2) b.spots.lock.push({ x: d.x, y: 0, z: d.z, yaw: b.rng() * TAU });
    else b.spots.ped.push({ x: d.x, y: 0, z: d.z });
    if (i % 4 === 3) b.spots.frog.push({ x: d.x + 0.9, y: 0.02, z: d.z - 0.9 });
  });
  b.spots.patrol.push([dz.center.x, 0, dz.center.z]);
  mkCoffin(b, -4, 7); mkCoffin(b, 4, 11);
  // 戶外
  const avoid = [[-21, -21, 21, 21], [-4, 20, 4, 28]];
  groundDetail(b, { patches: 14, cols: ['#2a3326', '#343a2c', '#2c2f26'], tufts: 50, stones: 20, avoid });
  const forest = scatter(b, 26, b.bounds, 3.8, avoid, (x, z) => tree(b, x, z, 0.9 + b.rng() * 0.5, { leaf1: '#2a3a22', leaf2: '#34452a', trunk: '#2a1e16' }));
  forest.forEach((p, i) => { if (i % 4 === 0) outSpotNear(b, 'code', p[0], p[1], '樹根'); else if (i % 9 === 0) outSpotNear(b, 'lock', p[0], p[1]); else if (i % 7 === 0) outSpotNear(b, 'ped', p[0], p[1]); else if (i % 11 === 0) outSpotNear(b, 'frog', p[0], p[1]); });
  scatter(b, 6, b.bounds, 5, avoid, (x, z) => bush(b, x, z, { bush: '#2a4a2a', bush2: '#345a34' }));
  scatter(b, 6, b.bounds, 5, avoid, (x, z) => rock(b, x, z, 0.9 + b.rng() * 0.9));
  [[-23, -12], [24, 14]].forEach(p => deadTree(b, p[0], p[1]));
  mound(b, 24.5, -6, 6, 6, 3, '#3a4430'); b.spots.ped.push({ x: 24.5, y: 1.35, z: -6 });
  [[0, 0, 24], [-9, 0, 25], [9, 0, 25], [-24, 0, 0], [24, 0, 8], [-24, 0, -20], [24, 0, -20], [0, 0, -14], [-12, 0, -5], [12, 0, -5], [-24, 0, 22]].forEach(p => b.spots.spawn.push(p));
  [[0, 0, 24], [0, 0, -14], [-12, 0, 0], [12, 0, 0], [-24, 0, -10], [24, 0, 10], [-24, 0, 22]].forEach(p => b.spots.patrol.push(p));
  b.portals.push({ a: [-3.5, 6.4, -4], b: [dz.center.x, 0, dz.center.z + 0.5] });
  return b;
}

const MAP_DEFS = [
  { id: 'manor', name: '廢棄莊園', sub: '半森林・寬廣', icon: '🏚️', build: buildManor, axis: '寬度' },
  { id: 'city', name: '廢棄都市', sub: '高樓・空橋', icon: '🏙️', build: buildCity, axis: '高度' },
  { id: 'castle', name: '廢棄城堡', sub: '城牆・地牢', icon: '🏰', build: buildCastle, axis: '高度' },
];
