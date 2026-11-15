'use strict';
/* ===== 三張地圖（縮小至原本邊長的約 3/5）：廢棄莊園（半森林）、廢棄都市、廢棄城堡 ===== */

function buildManor() {
  const b = new Builder(1101, { x0: -36, z0: -36, x1: 36, z1: 36 });
  b.theme = { name: '廢棄莊園', fog: [0.07, 0.10, 0.11], near: 8, far: 50, amb: 0.34, sun: 0.14, sunDir: [-0.4, 0.8, 0.3], flash: 1.0 };
  const isPath = (x, z) => (Math.abs(x) < 2.6 && z > 2) || (Math.abs(x + 9.5) < 2 && z > -18 && z < -14);
  groundTiles(b, (x, z) => isPath(x, z) ? '#4a4535' : (((Math.floor(x / 6) + Math.floor(z / 6)) & 1) ? '#26352a' : '#2a3a2c'), 6);
  boundaryWalls(b, '#1d2420', 9);
  const pal = { wall: '#6a6258', floor: '#3b322b', ceil: '#2c2724', roofCol: '#2a2230' };
  // 主屋 x∈[-14,10] z∈[-32,-18]
  building(b, { x0: -14, z0: -32, x1: 10, z1: -18, floors: 3, hallW: 9, rooms: 2, roof: 'pitched', pal, roofH: 5 });
  // 僕人小屋 x∈[14,34] z∈[6,20]
  building(b, { x0: 14, z0: 6, x1: 34, z1: 20, floors: 2, hallW: 9, rooms: 2, roof: 'pitched', pal: Object.assign({}, pal, { wall: '#5e5a4e', roofCol: '#3a2a22' }), roofH: 4, hideProb: 0.6 });
  // 樹籬迷宮 x∈[-10,10] z∈[-14,2]
  const mz = mazeGen(b, { ox: -10, oz: -14, cols: 5, rows: 4, cell: 4, th: 0.8, h: 2.3, col: '#244a28', entrances: [{ side: 'n', idx: 2 }, { side: 's', idx: 2 }] });
  mz.dead.forEach((d, i) => {
    const k = i % 4;
    if (k === 0 || k === 1) b.spots.code.push({ x: d.x + (b.rng() - 0.5) * 1.2, y: 0.03, z: d.z + (b.rng() - 0.5) * 1.2, hint: '迷宮死路' });
    else if (k === 2) b.spots.lock.push({ x: d.x, y: 0, z: d.z, yaw: b.rng() * TAU });
    else b.spots.ped.push({ x: d.x, y: 0, z: d.z });
  });
  if (mz.dead[0]) b.spots.frog.push({ x: mz.dead[0].x, y: 0.02, z: mz.dead[0].z + 1 });
  b.boxC(mz.center.x, 0, mz.center.z, 1.4, 0.9, 1.4, '#5a5a58');           // 迷宮中心噴泉
  b.boxC(mz.center.x, 0.9, mz.center.z, 0.9, 0.12, 0.9, '#2a4a5a', false, 0.15);
  b.spots.patrol.push([mz.center.x + 2, 0, mz.center.z]);
  // 墓園 x∈[-34,-18] z∈[-8,8]
  for (let gx = -32; gx <= -20; gx += 3.2) for (let gz = -6; gz <= 6; gz += 3.2) {
    if (b.rng() < 0.2) continue;
    b.boxC(gx, 0, gz, 0.9, 1.3, 0.28, '#5b5f60');
    b.boxC(gx, 1.3, gz, 0.7, 0.2, 0.28, '#6a6e70', false);
    b.boxC(gx, 0, gz + 0.6, 0.7, 0.06, 1.1, '#4a4e48', false);                  // 墓前石板
    if (b.rng() < 0.3) b.spots.code.push({ x: gx + 0.1, y: 0.03, z: gz + 0.5, hint: '墓碑後' });
  }
  b.box(-35, 0, -9, -17, 1.2, -8.6, '#2f3436'); b.box(-35, 0, 8.6, -17, 1.2, 9, '#2f3436'); b.box(-35, 0, -9, -34.6, 1.2, 9, '#2f3436');
  b.spots.patrol.push([-26, 0, 0]);
  // 墓室 x∈[-30,-22] z∈[14,22]
  b.box(-30, 0, 14, -22, 3, 14.4, '#55595a'); b.box(-30, 0, 21.6, -22, 3, 22, '#55595a');
  b.box(-30, 0, 14, -29.6, 3, 18.4, '#55595a'); b.box(-30, 0, 20.2, -29.6, 3, 22, '#55595a');
  b.box(-22.4, 0, 14, -22, 3, 22, '#55595a'); b.box(-30, 3, 14, -22, 3.3, 22, '#3f4446');
  b.spots.ped.push({ x: -25, y: 0, z: 20.6 }); b.spots.code.push({ x: -23.2, y: 0.03, z: 15.2, hint: '墓室角落' });
  b.boxC(-26, 0, 17, 1.8, 0.8, 1.0, '#6a6a68'); b.spots.frog.push({ x: -26, y: 0.02, z: 15.2 });
  b.spots.patrol.push([-26, 0, 19.3]);
  // 土丘
  mound(b, 24, -18, 10, 10, 3, '#3a4a30'); b.spots.ped.push({ x: 24, y: 1.35, z: -18 }); b.spots.lock.push({ x: 25.5, y: 1.35, z: -17, yaw: 0 });
  mound(b, -6, 26, 9, 9, 3, '#3a4a30'); b.spots.code.push({ x: -6, y: 1.38, z: 26, hint: '丘頂' });
  b.spots.patrol.push([24, 1.35, -18]);
  // 井、廢墟牆
  b.boxC(20, 0, -4, 2, 1.0, 2, '#5a5e60'); b.boxC(20, 1.0, -4, 1.2, 0.15, 1.2, '#1a2024', false);
  b.spots.code.push({ x: 20, y: 0.03, z: -2.6, hint: '井邊' });
  for (let i = 0; i < 5; i++) { const x = 12 + i * 2.8; b.box(x, 0, 28, x + 2.0, 1.2 + (i % 3) * 0.8, 28.5, '#575b5a'); }
  b.box(12, 0, 28, 12.5, 2.4, 33, '#575b5a'); b.spots.code.push({ x: 13.4, y: 0.03, z: 31, hint: '廢牆內側' }); b.spots.lock.push({ x: 13.4, y: 0, z: 32.4, yaw: Math.PI / 2 });
  b.spots.patrol.push([14, 0, 31]);
  [[0, 8], [0, 20], [0, 30], [-8, 24], [8, 24]].forEach(p => lamp(b, p[0], p[1], 3.2, '#ffb868'));
  // 樹林與地面細節
  const avoid = [[-18, -36, 14, -14], [10, 2, 38, 24], [-13, -17, 13, 5], [-37, -11, -16, 11], [-33, 11, -19, 25], [9, 25, 27, 37],
    [18, -24, 30, -12], [-12, 20, 0, 32], [-4, 2, 4, 36], [16, -8, 24, 0]];
  groundDetail(b, { patches: 60, cols: ['#2f3d2a', '#3a3a2c', '#344a30', '#2a3426'], tufts: 130, stones: 40, avoid });
  const forest = scatter(b, 120, b.bounds, 3.5, avoid, (x, z) => tree(b, x, z, 0.85 + b.rng() * 0.5));
  forest.forEach((p, i) => { if (i % 6 === 0) outSpotNear(b, 'code', p[0], p[1], '樹根'); else if (i % 29 === 0) outSpotNear(b, 'frog', p[0], p[1]); else if (i % 23 === 0) outSpotNear(b, 'lock', p[0], p[1]); else if (i % 19 === 0) outSpotNear(b, 'ped', p[0], p[1]); });
  scatter(b, 12, b.bounds, 6, avoid, (x, z) => bush(b, x, z));
  scatter(b, 10, b.bounds, 6, avoid, (x, z) => rock(b, x, z, 0.8 + b.rng() * 0.8));
  [[0, 0, 26], [-20, 0, 30], [30, 0, 28], [-6, 0, 32], [30, 0, -6], [24, 0, -28], [-26, 0, -26], [-30, 0, 30], [14, 0, -8], [-16, 0, 14], [10, 0, 24], [32, 0, 0], [-30, 0, -12], [0, 0, -34]].forEach(p => b.spots.spawn.push(p));
  [[0, 0, 24], [-26, 0, 28], [30, 0, 26], [24, 0, -28], [-30, 0, -26], [0, 0, -14], [12, 0, -8], [-20, 0, 8]].forEach(p => b.spots.patrol.push(p));
  // 傳送門：主屋二樓大廳 ↔ 小屋二樓大廳
  b.portals.push({ a: [-9.5, 3.2, -25], b: [18.5, 3.2, 13] });
  return b;
}

function buildCity() {
  const b = new Builder(2202, { x0: -36, z0: -36, x1: 36, z1: 36 });
  b.theme = { name: '廢棄都市', fog: [0.06, 0.07, 0.12], near: 9, far: 54, amb: 0.36, sun: 0.16, sunDir: [0.3, 0.9, -0.3], flash: 1.0 };
  const road = (x, z) => (Math.abs(x) < 6 || Math.abs(z) < 6);
  groundTiles(b, (x, z) => road(x, z) ? '#26282c' : '#3d4146', 6);
  boundaryWalls(b, '#16181c', 11);
  // 路面標線、路緣、裂縫
  for (let z = -34; z < 34; z += 6) if (Math.abs(z) > 8) b.box(-0.15, 0, z, 0.15, 0.012, z + 3, '#b8b28a', false);
  for (let x = -34; x < 34; x += 6) if (Math.abs(x) > 8) b.box(x, 0, -0.15, x + 3, 0.012, 0.15, '#b8b28a', false);
  for (const sx of [-6.2, 6.2]) { b.box(sx - 0.15, 0, -36, sx + 0.15, 0.1, -6.4, '#555a60', false); b.box(sx - 0.15, 0, 6.4, sx + 0.15, 0.1, 36, '#555a60', false); }
  for (const sz of [-6.2, 6.2]) { b.box(-36, 0, sz - 0.15, -6.4, 0.1, sz + 0.15, '#555a60', false); b.box(6.4, 0, sz - 0.15, 36, 0.1, sz + 0.15, '#555a60', false); }
  groundDetail(b, { patches: 40, cols: ['#2e3135', '#1f2124', '#34373b', '#47484a'], stones: 50, stone: '#6a6c6e', avoid: [[-36, -36, 36, -19], [-36, 13, 36, 29]] });
  const concrete = { wall: '#6d6f72', floor: '#3a3b3e', ceil: '#2a2b2e', wood: '#4a4038', crate: '#5a5046', trim: '#222426', cloth: '#5a4a5a', hide: '#8a8a52', stair: '#4a4c50', roofSlab: '#33353a', parapet: '#707276', frame: '#202226', base: '#1c1d20', seam: '#26231f' };
  const brick = Object.assign({}, concrete, { wall: '#7a5a4c' });
  // 高塔（4 層＋屋頂）兩棟，以空橋相連（2 樓）
  building(b, { x0: -34, z0: -34, x1: -8, z1: -20, floors: 4, hallW: 9, rooms: 2, roof: 'access', pal: concrete, extraDoors: [{ wall: 'e', level: 2, at: -27 }], hideProb: 0.45 });
  building(b, { x0: 8, z0: -34, x1: 34, z1: -20, floors: 4, hallW: 9, rooms: 2, roof: 'access', pal: brick, extraDoors: [{ wall: 'w', level: 2, at: -27 }], hideProb: 0.45 });
  const by = 2 * H_FLOOR;
  b.box(-8, by - 0.3, -28.6, 8, by, -25.4, '#3a3d42');
  b.box(-8, by, -28.7, 8, by + 1.0, -28.5, '#2a2c30'); b.box(-8, by, -25.5, 8, by + 1.0, -25.3, '#2a2c30');
  b.boxC(-7, 0, -27, 1.2, by - 0.3, 1.2, '#44474c'); b.boxC(7, 0, -27, 1.2, by - 0.3, 1.2, '#44474c');
  b.spots.code.push({ x: 0, y: by + 0.03, z: -28.2, hint: '空橋角落' }); b.spots.patrol.push([0, by, -27]);
  building(b, { x0: -34, z0: 14, x1: -10, z1: 28, floors: 3, hallW: 9, rooms: 2, roof: 'access', pal: brick, hideProb: 0.5, doorN: -26 });
  building(b, { x0: 10, z0: 14, x1: 34, z1: 28, floors: 2, hallW: 9, rooms: 2, roof: 'access', pal: concrete, hideProb: 0.5 });
  // 車輛、垃圾箱
  [[-16, -3, 0], [14, 3, 0], [24, -3, 0], [-24, 3, 0], [-3, 16, 1], [3, -12, 1], [3, 31, 1], [-3, -24, 1]].forEach(c => {
    const vert = c[2] === 1, w = vert ? 1.9 : 4.4, d = vert ? 4.4 : 1.9;
    b.boxC(c[0], 0.25, c[1], w, 0.8, d, '#4a5058');
    b.boxC(c[0], 1.05, c[1], vert ? 1.7 : 2.2, 0.6, vert ? 2.2 : 1.7, '#2f3a44');
    b.boxC(c[0], 0.9, c[1], vert ? 1.96 : 4.46, 0.08, vert ? 4.46 : 1.96, '#2a2e34', false);
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.5, 0.5]) b.boxC(c[0] + (vert ? sx * 1.5 : sx * 3.2), 0, c[1] + (vert ? sz * 3.6 : sz * 2.0), 0.34, 0.34, 0.34, '#111214', false);
    if (b.rng() < 0.7) b.spots.code.push({ x: c[0] + (vert ? 1.4 : 0), y: 0.03, z: c[1] + (vert ? 0 : 1.4), hint: '車旁' });
  });
  [[-10, -8], [10, 8], [-8, 10], [8, -10], [-26, 10], [26, -8], [-12, 31], [20, 31]].forEach((p, i) => {
    mkDumpster(b, p[0], p[1]);
    if (i % 2 === 0) b.spots.code.push({ x: p[0] + 1.3, y: 0.03, z: p[1], hint: '垃圾箱旁' });
  });
  // 貨櫃（可爬上去）
  const cont = (x, z, col) => { b.boxC(x, 0, z, 6, 2.6, 2.4, col); b.boxC(x, 2.6, z, 6.1, 0.08, 2.5, '#2a2c2e', false); for (let k = -2; k <= 2; k++) b.boxC(x + k * 1.2, 0, z + 1.21, 0.1, 2.6, 0.04, '#00000033'.slice(0, 7), false); };
  cont(-31, -6, '#6a3a30'); cont(-31, 6, '#3a6a4a'); cont(-31, 11.5, '#304a6a');
  for (let i = 0; i < 6; i++) b.box(-28 + i * 0.7, 0, -7.2, -28 + (i + 1) * 0.7, 0.43 * (6 - i), -4.8, '#55575a');
  b.spots.code.push({ x: -31, y: 2.71, z: -6, hint: '貨櫃頂' }); b.spots.ped.push({ x: -32.2, y: 2.68, z: -6.6 });
  b.spots.lock.push({ x: -29.6, y: 2.68, z: -5.4, yaw: Math.PI });
  // 路燈、路障、公車亭
  for (let x = -30; x <= 30; x += 15) { lamp(b, x, -7.2, 4.2, '#a8c8ff'); lamp(b, x, 7.2, 4.2, '#a8c8ff'); }
  for (let z = -30; z <= 30; z += 15) { lamp(b, -7.2, z, 4.2, '#a8c8ff'); lamp(b, 7.2, z, 4.2, '#a8c8ff'); }
  for (let i = 0; i < 9; i++) {
    const x = (b.rng() - 0.5) * 66, z = (b.rng() - 0.5) * 66;
    if (Math.abs(x) < 7 && Math.abs(z) < 7) continue; if ((x < -9 && x > -34 && z > -35 && z < -19) || (x > 9 && x < 34 && z > -35 && z < -19) || (z > 13 && z < 29 && Math.abs(x) > 9)) continue;
    if (Math.abs(x) > 6.4 && Math.abs(z) > 6.4 && !(z > 29)) continue;
    b.boxC(x, 0, z, 2.2, 0.9, 1.0, '#8a8e92'); b.boxC(x, 0.55, z, 2.24, 0.12, 1.04, '#c9622a', false, 0.15); b.spots.code.push({ x: x + 1.4, y: 0.03, z, hint: '路障' });
  }
  b.box(8, 0, 6.8, 14, 0.2, 8.0, '#444'); b.box(8, 2.6, 6.8, 14, 2.8, 8.2, '#3a3f44'); b.box(8, 0, 8.0, 14, 2.6, 8.2, '#2c4452');
  for (const px of [8.1, 13.9]) b.boxC(px, 0.2, 7.0, 0.12, 2.4, 0.12, '#2a2e32', false);
  b.spots.frog.push({ x: 13.4, y: 0.25, z: 7.4 }); b.spots.ped.push({ x: 10, y: 0.2, z: 7.4 });
  [[0, 0, 0], [-20, 0, 0], [20, 0, 0], [0, 0, 20], [0, 0, -12], [-30, 0, 31], [30, 0, 31], [-20, 0, 31], [18, 0, 31], [-8, 0, -4], [10, 0, 0]].forEach(p => b.spots.spawn.push(p));
  [[0, 0, 0], [-20, 0, 0], [20, 0, 0], [0, 0, 22], [0, 0, -14], [-30, 0, 31], [30, 0, 31], [-20, 0, 31]].forEach(p => b.spots.patrol.push(p));
  b.portals.push({ a: [-19, 4 * H_FLOOR, -27], b: [-29.5, 0, 21] });
  return b;
}

function buildCastle() {
  const b = new Builder(3303, { x0: -33, z0: -33, x1: 33, z1: 33 });
  b.theme = { name: '廢棄城堡', fog: [0.10, 0.07, 0.06], near: 8, far: 48, amb: 0.33, sun: 0.12, sunDir: [-0.2, 0.8, 0.5], flash: 1.05 };
  const inYard = (x, z) => Math.abs(x) < 24 && Math.abs(z) < 24;
  groundTiles(b, (x, z) => inYard(x, z) ? (((Math.floor(x / 6) + Math.floor(z / 6)) & 1) ? '#3c3a36' : '#403e3a') : (((Math.floor(x / 6) + Math.floor(z / 6)) & 1) ? '#2c3328' : '#303a2c'), 6);
  boundaryWalls(b, '#1a1614', 10);
  const stone = { wall: '#6b6a68', floor: '#3a3836', ceil: '#2c2a28', wood: '#4a3424', crate: '#5a4630', trim: '#222', cloth: '#6a3a3a', hide: '#9a7a45', stair: '#555452', roofSlab: '#383634', parapet: '#6b6a68', frame: '#26221e', base: '#1f1c1a', seam: '#2a2622' };
  // 庭院鋪石（兩色方磚，薄片、避開建築）
  const keep = [-11, -12, 11, 2], towerR = [[-21.6, -21.6], [12.6, -21.6], [-21.6, 12.6], [12.6, 12.6]];
  for (let x = -21; x < 21; x += 3) for (let z = -21; z < 21; z += 3) {
    if (x + 3 > keep[0] - 0.5 && x < keep[2] + 0.5 && z + 3 > keep[1] - 0.5 && z < keep[3] + 0.5) continue;
    if (towerR.some(t => x + 3 > t[0] - 0.2 && x < t[0] + 9.2 && z + 3 > t[1] - 0.2 && z < t[1] + 9.2)) continue;
    if (((Math.floor((x + 21) / 3) + Math.floor((z + 21) / 3)) & 1) === 0) b.box(x + 0.04, 0, z + 0.04, x + 2.96, 0.01, z + 2.96, '#33312e', false);
  }
  // 主堡
  building(b, { x0: -11, z0: -12, x1: 11, z1: 2, floors: 3, hallW: 9, rooms: 2, roof: 'access', pal: stone, hideProb: 0.5 });
  // 四座角塔（內部樓梯、屋頂可上城牆）
  towerR.forEach(p => {
    building(b, { x0: p[0], z0: p[1], x1: p[0] + 9, z1: p[1] + 9, floors: 2, hallW: 9, rooms: 0, hallOnly: true, roof: 'access', pal: stone, windows: false, roofProps: false, noParapet: true, doorN: p[1] > 0 ? p[0] + 4.5 : undefined });
  });
  // 城牆（高 6.4，牆頂可行走，與塔頂等高）；南牆中間留城門
  const wh = 6.4, wt = 2.4;
  b.box(-24, 0, -24, 24, wh, -24 + wt, stone.wall);
  b.box(-24, 0, 24 - wt, -3, wh, 24, stone.wall); b.box(3, 0, 24 - wt, 24, wh, 24, stone.wall);
  b.box(-3, 4.4, 24 - wt, 3, wh, 24, stone.wall);
  b.box(-24, 0, -24, -24 + wt, wh, 24, stone.wall); b.box(24 - wt, 0, -24, 24, wh, 24, stone.wall);
  for (let t = -24; t < 24; t += 3) {
    b.box(t, wh, -24, t + 1.4, wh + 1.0, -24 + 0.6, stone.wall);
    if (t < -4 || t > 3) b.box(t, wh, 24 - 0.6, t + 1.4, wh + 1.0, 24, stone.wall);
    b.box(-24, wh, t, -24 + 0.6, wh + 1.0, t + 1.4, stone.wall);
    b.box(24 - 0.6, wh, t, 24, wh + 1.0, t + 1.4, stone.wall);
  }
  // 庭院小物
  b.boxC(-17, 0, 6, 2.2, 1.0, 2.2, '#5a5a58'); b.boxC(-17, 1.0, 6, 1.3, 0.1, 1.3, '#101418', false);
  b.spots.code.push({ x: -17, y: 0.03, z: 7.4, hint: '水井旁' });
  [[-17, 2], [16, -4], [10, 12], [-16, -6]].forEach((p, i) => { mkHay(b, p[0], p[1]); if (i % 2) b.spots.code.push({ x: p[0] + 1.3, y: 0.03, z: p[1], hint: '乾草旁' }); });
  [[-16, -2], [14, 6], [0, -17], [8, 8]].forEach(p => { b.boxC(p[0], 0.4, p[1], 2.0, 0.6, 1.2, '#4a3424'); b.boxC(p[0] - 0.9, 0, p[1], 0.7, 0.7, 0.1, '#222', false); b.spots.code.push({ x: p[0], y: 0.03, z: p[1] + 1.0, hint: '推車下' }); });
  // 地牢迷宮 x∈[-10,6] z∈[4,20]（頂部有天花板；避開角塔與城牆）
  const dz = mazeGen(b, { ox: -10, oz: 4, cols: 4, rows: 4, cell: 4, th: 0.8, h: 3.0, col: '#4a4846', entrances: [{ side: 'w', idx: 2 }, { side: 'n', idx: 1 }], ceiling: { y0: 3.0, y1: 3.4, col: '#2c2a28' } });
  dz.dead.forEach((d, i) => {
    const k = i % 4;
    if (k === 0 || k === 1) b.spots.code.push({ x: d.x + (b.rng() - 0.5) * 1.0, y: 0.03, z: d.z + (b.rng() - 0.5) * 1.0, hint: '地牢死路' });
    else if (k === 2) b.spots.lock.push({ x: d.x, y: 0, z: d.z, yaw: b.rng() * TAU });
    else b.spots.ped.push({ x: d.x, y: 0, z: d.z });
    if (i % 4 === 3) b.spots.frog.push({ x: d.x + 0.9, y: 0.02, z: d.z - 0.9 });
  });
  b.spots.patrol.push([dz.center.x, 0, dz.center.z]);
  mkCoffin(b, -8, 6); mkCoffin(b, 0, 14);
  // 戶外
  const avoid = [[-26, -26, 26, 26]];
  groundDetail(b, { patches: 22, cols: ['#2a3326', '#343a2c', '#2c2f26'], tufts: 60, stones: 24, avoid });
  const forest = scatter(b, 42, b.bounds, 4.2, avoid, (x, z) => tree(b, x, z, 0.9 + b.rng() * 0.5, { leaf1: '#2a3a22', leaf2: '#34452a', trunk: '#2a1e16' }));
  forest.forEach((p, i) => { if (i % 4 === 0) outSpotNear(b, 'code', p[0], p[1], '樹根'); else if (i % 11 === 0) outSpotNear(b, 'lock', p[0], p[1]); else if (i % 9 === 0) outSpotNear(b, 'ped', p[0], p[1]); else if (i % 13 === 0) outSpotNear(b, 'frog', p[0], p[1]); });
  scatter(b, 8, b.bounds, 6, avoid, (x, z) => bush(b, x, z, { bush: '#2a4a2a', bush2: '#345a34' }));
  scatter(b, 8, b.bounds, 6, avoid, (x, z) => rock(b, x, z, 0.9 + b.rng() * 0.9));
  mound(b, 28, 0, 8, 8, 3, '#3a4430'); b.spots.ped.push({ x: 28, y: 1.35, z: 0 });
  [[-5, 26.5], [5, 26.5]].forEach(p => lamp(b, p[0], p[1], 2.8, '#ff9a48'));
  [[-14, 0], [14, 0], [-16, -10], [16, 8]].forEach(p => lamp(b, p[0], p[1], 2.6, '#ff9a48'));
  [[0, 0, 28], [-12, 0, 29], [12, 0, 29], [-29, 0, 0], [29, 0, 12], [0, 0, -17], [-17, 0, -6], [17, 0, -6], [-29, 0, -22], [29, 0, -22], [-29, 0, 24], [8, 0, 10]].forEach(p => b.spots.spawn.push(p));
  [[0, 0, 28], [0, 0, -17], [-17, 0, 0], [17, 0, 0], [-29, 0, -10], [29, 0, 12], [0, 0, 22]].forEach(p => b.spots.patrol.push(p));
  b.portals.push({ a: [-6.5, 6.4, -5], b: [dz.center.x, 0, dz.center.z + 0.5] });
  return b;
}

const MAP_DEFS = [
  { id: 'manor', name: '廢棄莊園', sub: '半森林・寬廣', icon: '🏚️', build: buildManor, axis: '寬度' },
  { id: 'city', name: '廢棄都市', sub: '高樓・空橋', icon: '🏙️', build: buildCity, axis: '高度' },
  { id: 'castle', name: '廢棄城堡', sub: '城牆・地牢', icon: '🏰', build: buildCastle, axis: '高度' },
];
