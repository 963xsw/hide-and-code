'use strict';
/* ===== 三張地圖：廢棄莊園（半森林）、廢棄都市、廢棄城堡 ===== */

function buildManor() {
  const b = new Builder(1101, { x0: -60, z0: -60, x1: 60, z1: 60 });
  b.theme = { name: '廢棄莊園', fog: [0.07, 0.10, 0.11], near: 8, far: 55, amb: 0.34, sun: 0.14, sunDir: [-0.4, 0.8, 0.3], flash: 1.0 };
  const pathTile = (x, z) => (Math.abs(x) < 4 && z > -18 && z < 58) || (Math.abs(z - 30) < 3 && x > -50 && x < 50) ? '#4a4535' : null;
  groundTiles(b, (x, z) => pathTile(x, z) || (((Math.floor(x / 10) + Math.floor(z / 10)) & 1) ? '#26352a' : '#2a3a2c'));
  boundaryWalls(b, '#1d2420', 10);
  const pal = { wall: '#6a6258', floor: '#3b322b', ceil: '#2c2724', roofCol: '#2a2230' };
  // 主屋 x∈[-18,14] z∈[-34,-18]
  building(b, { x0: -18, z0: -34, x1: 14, z1: -18, floors: 3, hallW: 10, rooms: 3, roof: 'pitched', pal, roofH: 5 });
  // 僕人小屋 x∈[28,52] z∈[-42,-26]
  building(b, { x0: 28, z0: -42, x1: 52, z1: -26, floors: 2, hallW: 10, rooms: 2, roof: 'pitched', pal: Object.assign({}, pal, { wall: '#5e5a4e', roofCol: '#3a2a22' }), roofH: 4, hideProb: 0.6 });
  // 樹籬迷宮 x∈[-16,16] z∈[-14,14]
  const mz = mazeGen(b, { ox: -16, oz: -14, cols: 8, rows: 7, cell: 4, th: 0.8, h: 2.3, col: '#244a28', entrances: [{ side: 'n', idx: 3 }, { side: 's', idx: 4 }] });
  mz.dead.forEach((d, i) => {
    const k = i % 4;
    if (k === 0 || k === 1) b.spots.code.push({ x: d.x + (b.rng() - 0.5) * 1.4, y: 0.03, z: d.z + (b.rng() - 0.5) * 1.4, hint: '迷宮死路' });
    else if (k === 2) b.spots.lock.push({ x: d.x, y: 0, z: d.z, yaw: b.rng() * TAU });
    else b.spots.ped.push({ x: d.x, y: 0, z: d.z });
  });
  b.spots.frog.push({ x: mz.dead[0] ? mz.dead[0].x : 0, y: 0.02, z: mz.dead[0] ? mz.dead[0].z + 1 : 0 });
  b.boxC(mz.center.x, 0, mz.center.z, 1.4, 0.9, 1.4, '#5a5a58');           // 迷宮中心噴泉
  b.spots.patrol.push([mz.center.x + 2, 0, mz.center.z]);
  // 墓園 x∈[-56,-30] z∈[-6,22]
  for (let gx = -52; gx <= -34; gx += 3.4) for (let gz = -2; gz <= 18; gz += 3.4) {
    if (b.rng() < 0.2) continue;
    b.boxC(gx, 0, gz, 0.9, 1.3, 0.28, '#5b5f60');
    b.boxC(gx, 1.3, gz, 0.7, 0.2, 0.28, '#6a6e70', false);
    if (b.rng() < 0.3) b.spots.code.push({ x: gx + 0.1, y: 0.03, z: gz + 0.5, hint: '墓碑後' });
  }
  b.box(-57, 0, -7, -29, 1.2, -6.6, '#2f3436'); b.box(-57, 0, 22, -29, 1.2, 22.4, '#2f3436'); b.box(-57, 0, -7, -56.6, 1.2, 22.4, '#2f3436');
  b.spots.patrol.push([-42, 0, 8]);
  // 墓室（小屋）
  b.box(-30, 0, 24, -22, 3, 24.4, '#55595a'); b.box(-30, 0, 32, -22, 3, 32.4, '#55595a');
  b.box(-30, 0, 24, -29.6, 3, 28.8, '#55595a'); b.box(-30, 0, 30.4, -29.6, 3, 32.4, '#55595a');
  b.box(-22.4, 0, 24, -22, 3, 32.4, '#55595a'); b.box(-30, 3, 24, -22, 3.3, 32.4, '#3f4446');
  b.spots.ped.push({ x: -26, y: 0, z: 30 }); b.spots.code.push({ x: -23, y: 0.03, z: 25 , hint: '墓室角落'});
  b.boxC(-26, 0, 27, 1.8, 0.8, 1.0, '#6a6a68'); b.spots.frog.push({ x: -26, y: 0.02, z: 25 });
  b.spots.patrol.push([-26, 0, 28.5]);
  // 土丘與觀景丘
  mound(b, 38, 24, 16, 16, 4, '#3a4a30'); b.spots.ped.push({ x: 38, y: 4 * 0.45, z: 24 }); b.spots.lock.push({ x: 40, y: 4 * 0.45, z: 25, yaw: 0 });
  mound(b, -14, 44, 12, 12, 3, '#3a4a30'); b.spots.code.push({ x: -14, y: 3 * 0.45 + 0.03, z: 44, hint: '丘頂' });
  mound(b, 20, -52, 10, 8, 3, '#3a4a30');
  b.spots.patrol.push([38, 4 * 0.45, 24]);
  // 井、廢墟牆、石頭
  b.boxC(22, 0, 12, 2, 1.0, 2, '#5a5e60'); b.boxC(22, 1.0, 12, 1.2, 0.15, 1.2, '#1a2024', false);
  b.spots.code.push({ x: 22, y: 0.03, z: 13.4, hint: '井邊' });
  for (let i = 0; i < 6; i++) { const x = 30 + i * 3; b.box(x, 0, 40, x + 2.2, 1.2 + (i % 3) * 0.8, 40.5, '#575b5a'); }
  b.box(30, 0, 40, 30.5, 2.4, 46, '#575b5a'); b.spots.code.push({ x: 31.2, y: 0.03, z: 43, hint: '廢牆內側' }); b.spots.lock.push({ x: 31.4, y: 0, z: 45, yaw: Math.PI / 2 });
  b.spots.patrol.push([32, 0, 43]);
  // 戶外的路燈（微弱）
  [[0, 20], [0, 34], [0, 48], [-14, 30], [14, 30]].forEach(p => lamp(b, p[0], p[1], 3.2, '#ffb868'));
  // 樹林
  const avoid = [[-22, -38, 18, -14], [24, -46, 56, -22], [-20, -16, 20, 16], [-60, -10, -28, 26], [-32, 22, -20, 34],
    [-6, 14, 6, 60], [-52, 26, 52, 34], [32, 36, 50, 50], [28, -20, 50, -6]];
  const forest = scatter(b, 330, b.bounds, 3.7, avoid, (x, z) => tree(b, x, z, 0.85 + b.rng() * 0.5));
  forest.forEach((p, i) => { if (i % 9 === 0) outSpotNear(b, 'code', p[0], p[1], '樹根'); else if (i % 41 === 0) outSpotNear(b, 'frog', p[0], p[1]); else if (i % 37 === 0) outSpotNear(b, 'lock', p[0], p[1]); else if (i % 31 === 0) outSpotNear(b, 'ped', p[0], p[1]); });
  scatter(b, 22, b.bounds, 6, avoid.concat([[-6, -18, 6, 14]]), (x, z) => bush(b, x, z));
  scatter(b, 20, b.bounds, 6, avoid, (x, z) => rock(b, x, z, 0.8 + b.rng() * 0.8));
  // 出生點（戶外空地）
  [[0, 0, 50], [-40, 0, 40], [40, 0, 6], [-8, 0, 20], [12, 0, 52], [-48, 0, 30], [48, 0, 18], [0, 0, -50], [-30, 0, -50], [44, 0, -50], [-50, 0, -20], [52, 0, 2]].forEach(p => b.spots.spawn.push(p));
  [[0, 0, 30], [-30, 0, 30], [30, 0, 30], [0, 0, 8], [-40, 0, 8], [36, 0, -10], [0, 0, -50], [-45, 0, -45], [45, 0, 45]].forEach(p => b.spots.patrol.push(p));
  // 傳送門：主屋二樓大廳 ↔ 小屋二樓大廳
  b.portals.push({ a: [-13, 3.2, -26], b: [33, 3.2, -34] });
  b.nav = { seed: [0, 0, 40] };
  return b;
}

function buildCity() {
  const b = new Builder(2202, { x0: -60, z0: -60, x1: 60, z1: 60 });
  b.theme = { name: '廢棄都市', fog: [0.06, 0.07, 0.12], near: 10, far: 62, amb: 0.36, sun: 0.16, sunDir: [0.3, 0.9, -0.3], flash: 1.0 };
  const road = (x, z) => (Math.abs(x) < 6 || Math.abs(z) < 6);
  groundTiles(b, (x, z) => road(x, z) ? '#26282c' : '#3d4146', 10);
  boundaryWalls(b, '#16181c', 12);
  // 道路標線
  for (let z = -56; z < 56; z += 6) if (Math.abs(z) > 8) b.box(-0.15, 0, z, 0.15, 0.03, z + 3, '#b8b28a', false);
  for (let x = -56; x < 56; x += 6) if (Math.abs(x) > 8) b.box(x, 0, -0.15, x + 3, 0.03, 0.15, '#b8b28a', false);
  const concrete = { wall: '#6d6f72', floor: '#3a3b3e', ceil: '#2a2b2e', wood: '#4a4038', crate: '#5a5046', trim: '#222426', cloth: '#5a4a5a', hide: '#8a8a52', stair: '#4a4c50', roofSlab: '#33353a', parapet: '#707276' };
  const brick = Object.assign({}, concrete, { wall: '#7a5a4c' });
  // 西北高塔（4 層＋屋頂）與東北高塔，以空橋相連（2 樓）
  building(b, { x0: -38, z0: -40, x1: -8, z1: -24, floors: 4, hallW: 10, rooms: 3, roof: 'access', pal: concrete, extraDoors: [{ wall: 'e', level: 2, at: -32 }], hideProb: 0.45 });
  building(b, { x0: 8, z0: -40, x1: 38, z1: -24, floors: 4, hallW: 10, rooms: 3, roof: 'access', pal: brick, extraDoors: [{ wall: 'w', level: 2, at: -32 }], hideProb: 0.45 });
  // 空橋
  const by = 2 * H_FLOOR;
  b.box(-8, by - 0.3, -33.6, 8, by, -30.4, '#3a3d42');
  b.box(-8, by, -33.7, 8, by + 1.0, -33.5, '#2a2c30'); b.box(-8, by, -30.5, 8, by + 1.0, -30.3, '#2a2c30');
  b.boxC(-6.5, 0, -32, 1.2, by - 0.3, 1.2, '#44474c'); b.boxC(6.5, 0, -32, 1.2, by - 0.3, 1.2, '#44474c');
  b.spots.code.push({ x: 0, y: by + 0.03, z: -33.2, hint: '空橋角落' }); b.spots.patrol.push([0, by, -32]);
  // 西南／東南建築
  building(b, { x0: -40, z0: 24, x1: -10, z1: 40, floors: 3, hallW: 10, rooms: 3, roof: 'access', pal: brick, hideProb: 0.5, doorN: -30 });
  building(b, { x0: 10, z0: 24, x1: 40, z1: 40, floors: 2, hallW: 10, rooms: 3, roof: 'access', pal: concrete, hideProb: 0.5 });
  // 街道物件
  const cars = [[-20, -4.2, 0], [14, 4.2, 0], [-4.2, 20, 1], [4.2, -14, 1], [30, -4, 0], [-34, 4, 0], [4.4, 46, 1], [-4.4, -48, 1]];
  cars.forEach(c => {
    const vert = c[2] === 1;
    const w = vert ? 1.9 : 4.4, d = vert ? 4.4 : 1.9;
    b.boxC(c[0], 0.25, c[1] === undefined ? 0 : (vert ? c[1] : c[1]), w, 0.8, d, '#4a5058');
    b.boxC(c[0], 1.05, vert ? c[1] : c[1], vert ? 1.7 : 2.2, 0.6, vert ? 2.2 : 1.7, '#2f3a44');
    if (b.rng() < 0.7) b.spots.code.push({ x: c[0] + (vert ? 1.2 : 0), y: 0.03, z: c[1] + (vert ? 0 : 1.2), hint: '車旁' });
  });
  // 垃圾箱（可藏）
  [[-16, -8], [16, 8], [-8, 16], [8, -16], [-46, 8], [46, -8], [-16, 20], [20, -20]].forEach((p, i) => {
    b.boxC(p[0], 0, p[1], 2.0, 1.4, 1.1, '#2e5a3a', true, 0.10);
    b.boxC(p[0], 1.4, p[1], 2.1, 0.08, 1.2, '#244a30', false);
    addHide(b, 'dumpster', p[0], 0, p[1], p[0], p[1] + 1.6, 0);
    if (i % 2 === 0) b.spots.code.push({ x: p[0] + 1.3, y: 0.03, z: p[1], hint: '垃圾箱旁' });
  });
  // 貨櫃堆（高度）：一個可爬上的貨櫃
  const cont = (x, z, y, col) => b.boxC(x, y, z, 6, 2.6, 2.4, col);
  cont(-50, -8, 0, '#6a3a30'); cont(-50, 8, 0, '#3a6a4a'); cont(-50, 14, 0, '#304a6a');
  for (let i = 0; i < 6; i++) b.box(-47 + i * 0.7, 0, -9.2, -47 + (i + 1) * 0.7, 0.43 * (6 - i), -6.8, '#55575a');
  b.spots.code.push({ x: -50, y: 2.6 + 0.03, z: -8, hint: '貨櫃頂' }); b.spots.ped.push({ x: -51.5, y: 2.6, z: -8.6 });
  b.spots.lock.push({ x: -50, y: 2.6, z: 8, yaw: 0 });
  // 路燈與障礙
  for (let x = -50; x <= 50; x += 20) { lamp(b, x, -7, 4.2, '#a8c8ff'); lamp(b, x, 7, 4.2, '#a8c8ff'); }
  for (let z = -50; z <= 50; z += 20) { lamp(b, -7, z, 4.2, '#a8c8ff'); lamp(b, 7, z, 4.2, '#a8c8ff'); }
  for (let i = 0; i < 12; i++) { const x = (b.rng() - 0.5) * 100, z = (b.rng() - 0.5) * 100; if (Math.abs(x) < 7 || Math.abs(z) < 7) continue; if ((x > -42 && x < 42 && Math.abs(z) > 22 && Math.abs(z) < 42)) continue; b.boxC(x, 0, z, 2.2, 0.9, 1.0, '#8a8e92'); b.spots.code.push({ x: x + 1.3, y: 0.03, z, hint: '路障' }); }
  // 公車亭
  b.box(10, 0, 7.6, 16, 0.2, 9, '#444'); b.box(10, 2.6, 7.6, 16, 2.8, 9.6, '#3a3f44'); b.box(10, 0, 9, 16, 2.6, 9.2, '#2c4452', true);
  b.spots.frog.push({ x: 15.4, y: 0.25, z: 8.4 });
  b.spots.ped.push({ x: 12, y: 0, z: 8.2 });
  // 出生點／巡邏
  [[0, 0, 0], [-48, 0, -48], [48, 0, -48], [-48, 0, 48], [48, 0, 48], [0, 0, 50], [0, 0, -50], [-24, 0, 0], [24, 0, 0], [-50, 0, 30], [50, 0, 20]].forEach(p => b.spots.spawn.push(p));
  [[0, 0, 0], [-24, 0, 0], [24, 0, 0], [0, 0, 30], [0, 0, -50], [40, 0, -4], [-48, 0, 24], [48, 0, 50], [-30, 0, 50]].forEach(p => b.spots.patrol.push(p));
  b.portals.push({ a: [-33, 4 * H_FLOOR, -32], b: [-25, 0, 32] });
  b.nav = { seed: [0, 0, 0] };
  return b;
}

function buildCastle() {
  const b = new Builder(3303, { x0: -55, z0: -55, x1: 55, z1: 55 });
  b.theme = { name: '廢棄城堡', fog: [0.10, 0.07, 0.06], near: 8, far: 52, amb: 0.33, sun: 0.12, sunDir: [-0.2, 0.8, 0.5], flash: 1.05 };
  groundTiles(b, (x, z) => (Math.abs(x) < 34 && Math.abs(z) < 34) ? (((Math.floor(x / 10) + Math.floor(z / 10)) & 1) ? '#3c3a36' : '#403e3a') : (((Math.floor(x / 10) + Math.floor(z / 10)) & 1) ? '#2c3328' : '#303a2c'));
  boundaryWalls(b, '#1a1614', 11);
  const stone = { wall: '#6b6a68', floor: '#3a3836', ceil: '#2c2a28', wood: '#4a3424', crate: '#5a4630', trim: '#222', cloth: '#6a3a3a', hide: '#9a7a45', stair: '#555452', roofSlab: '#383634', parapet: '#6b6a68' };
  // 主堡
  building(b, { x0: -16, z0: -14, x1: 16, z1: 2, floors: 3, hallW: 10, rooms: 3, roof: 'access', pal: stone, hideProb: 0.5 });
  // 四座角塔（內部樓梯、屋頂可上城牆）
  const tw = 9;
  const tpos = [[-31.6, -31.6], [22.6, -31.6], [-31.6, 22.6], [22.6, 22.6]];
  tpos.forEach((p, i) => {
    const o = { x0: p[0], z0: p[1], x1: p[0] + tw, z1: p[1] + tw, floors: 2, hallW: tw, rooms: 0, hallOnly: true, roof: 'access', pal: stone, windows: false, roofProps: false, noParapet: true, doorN: p[1] > 0 ? p[0] + 4.5 : undefined };
    building(b, o);
  });
  // 城牆（高 6.4，牆頂可行走，與塔頂等高）
  const wh = 6.4, wt = 2.4;
  b.box(-34, 0, -34, 34, wh, -34 + wt, stone.wall);
  b.box(-34, 0, 34 - wt, -3, wh, 34, stone.wall); b.box(3, 0, 34 - wt, 34, wh, 34, stone.wall);   // 南牆（中間留城門）
  b.box(-34 + wt, 0, 34 - wt, -3, wh, 34, stone.wall);
  b.box(-34, 0, -34, -34 + wt, wh, 34, stone.wall); b.box(34 - wt, 0, -34, 34, wh, 34, stone.wall);
  b.box(-3, 4.4, 34 - wt, 3, wh, 34, stone.wall);                       // 城門上方連接牆頂
  for (let t = -34; t < 34; t += 3) {
    b.box(t, wh, -34, t + 1.4, wh + 1.0, -34 + 0.6, stone.wall);
    if (t < -4 || t > 3) b.box(t, wh, 34 - 0.6, t + 1.4, wh + 1.0, 34, stone.wall);
    b.box(-34, wh, t, -34 + 0.6, wh + 1.0, t + 1.4, stone.wall);
    b.box(34 - 0.6, wh, t, 34, wh + 1.0, t + 1.4, stone.wall);
  }
  // 庭院中的小物
  b.boxC(-22, 0, 8, 2.2, 1.0, 2.2, '#5a5a58'); b.boxC(-22, 1.0, 8, 1.3, 0.1, 1.3, '#101418', false);
  b.spots.code.push({ x: -22, y: 0.03, z: 9.4, hint: '水井旁' });
  // 乾草（可藏）、推車
  [[-26, 18], [24, -8], [-8, 24], [18, 14]].forEach((p, i) => {
    b.boxC(p[0], 0, p[1], 1.8, 1.4, 1.4, '#8a7a3a', true, 0.10); addHide(b, 'hay', p[0], 0, p[1], p[0], p[1] + 1.7, 0);
    if (i % 2) b.spots.code.push({ x: p[0] + 1.3, y: 0.03, z: p[1], hint: '乾草旁' });
  });
  [[-12, 14], [10, 6], [-24, -2], [30, 0]].forEach(p => { b.boxC(p[0], 0.4, p[1], 2.0, 0.6, 1.2, '#4a3424'); b.boxC(p[0] - 0.9, 0, p[1], 0.7, 0.7, 0.1, '#222', false); b.spots.code.push({ x: p[0], y: 0.03, z: p[1] + 1.0, hint: '推車下' }); });
  // 地牢迷宮 x∈[6,30] z∈[8,32]（頂部有天花板）
  const dz = mazeGen(b, { ox: 6, oz: 8, cols: 6, rows: 6, cell: 4, th: 0.8, h: 3.0, col: '#4a4846', entrances: [{ side: 'w', idx: 2 }, { side: 'n', idx: 1 }], ceiling: { y0: 3.0, y1: 3.4, col: '#2c2a28' } });
  dz.dead.forEach((d, i) => {
    const k = i % 4;
    if (k === 0 || k === 1) b.spots.code.push({ x: d.x + (b.rng() - 0.5) * 1.2, y: 0.03, z: d.z + (b.rng() - 0.5) * 1.2, hint: '地牢死路' });
    else if (k === 2) b.spots.lock.push({ x: d.x, y: 0, z: d.z, yaw: b.rng() * TAU });
    else b.spots.ped.push({ x: d.x, y: 0, z: d.z });
    if (i % 5 === 4) b.spots.frog.push({ x: d.x + 0.9, y: 0.02, z: d.z - 0.9 });
  });
  b.spots.patrol.push([dz.center.x, 0, dz.center.z]);
  // 棺木／牢籠（可藏）
  [[8, 10], [28, 30]].forEach(p => { b.boxC(p[0] + 1, 0, p[1] + 1, 1.0, 0.8, 2.0, '#3a2a20', true, 0.10); addHide(b, 'coffin', p[0] + 1, 0, p[1] + 1, p[0] + 1, p[1] - 0.2, 0); });
  // 戶外樹木與石頭
  const avoid = [[-36, -36, 36, 36]];
  const forest = scatter(b, 110, b.bounds, 4.5, avoid, (x, z) => tree(b, x, z, 0.9 + b.rng() * 0.5, { leaf1: '#2a3a22', leaf2: '#34452a', trunk: '#2a1e16' }));
  forest.forEach((p, i) => { if (i % 6 === 0) outSpotNear(b, 'code', p[0], p[1], '樹根'); else if (i % 19 === 0) outSpotNear(b, 'lock', p[0], p[1]); else if (i % 17 === 0) outSpotNear(b, 'ped', p[0], p[1]); else if (i % 23 === 0) outSpotNear(b, 'frog', p[0], p[1]); });
  scatter(b, 14, b.bounds, 6, avoid, (x, z) => bush(b, x, z, { bush: '#2a4a2a', bush2: '#345a34' }));
  scatter(b, 12, b.bounds, 6, avoid, (x, z) => rock(b, x, z, 0.9 + b.rng() * 0.9));
  mound(b, 44, 0, 14, 14, 3, '#3a4430'); b.spots.ped.push({ x: 44, y: 1.35, z: 0 });
  // 火把（城門）
  [[-5, 31], [5, 31]].forEach(p => lamp(b, p[0], p[1], 2.8, '#ff9a48'));
  [[-8, 20], [8, 20], [-26, -10], [26, -16]].forEach(p => lamp(b, p[0], p[1], 2.6, '#ff9a48'));
  // 出生點／巡邏
  [[0, 0, 44], [-20, 0, 46], [20, 0, 46], [-46, 0, 0], [46, 0, 20], [0, 0, 16], [-20, 0, 16], [-40, 0, -46], [40, 0, -46], [-46, 0, 40], [46, 0, -30], [0, 0, 22]].forEach(p => b.spots.spawn.push(p));
  [[0, 0, 44], [0, 0, 22], [-20, 0, 16], [-46, 0, 0], [46, 0, 20], [0, 0, -46], [-40, 0, -46], [40, 0, 46], [-24, 0, -4]].forEach(p => b.spots.patrol.push(p));
  b.portals.push({ a: [0, 6.4, -6], b: [dz.center.x, 0, dz.center.z + 0.5] });
  b.nav = { seed: [0, 0, 44] };
  return b;
}

const MAP_DEFS = [
  { id: 'manor', name: '廢棄莊園', sub: '半森林・寬廣', icon: '🏚️', build: buildManor, axis: '寬度' },
  { id: 'city', name: '廢棄都市', sub: '高樓・空橋', icon: '🏙️', build: buildCity, axis: '高度' },
  { id: 'castle', name: '廢棄城堡', sub: '城牆・地牢', icon: '🏰', build: buildCastle, axis: '高度' },
];
