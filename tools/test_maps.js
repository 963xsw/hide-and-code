'use strict';
const { loadCore } = require('./load');
const A = loadCore(['01_util.js', '02_world.js', '03_gen.js', '04_maps.js']);
function reach(nav, p, maxH = 0.9, maxY = 0.9) {
  const i = nav.nearest(p.x, p.y, p.z, 3);
  if (i < 0) return false;
  const dh = Math.hypot(nav.nx[i] - p.x, nav.nz[i] - p.z), dy = Math.abs(nav.ny[i] - p.y);
  return dh <= maxH && dy <= maxY && nav.inMain(i);
}
for (const def of A.MAP_DEFS) {
  const t0 = Date.now();
  const b = def.build();
  const t1 = Date.now();
  const w = new A.World(b);
  const nav = new A.Nav(w);
  const t2 = Date.now();
  const cnt = {};
  for (const k of ['code', 'lock', 'ped', 'frog', 'hide']) {
    const arr = b.spots[k];
    const ok = arr.filter(p => reach(nav, p, 1.6, 1.2)).length;
    cnt[k] = ok + '/' + arr.length;
  }
  const sp = b.spots.spawn.filter(p => reach(nav, { x: p[0], y: p[1], z: p[2] }, 1.0, 0.6)).length + '/' + b.spots.spawn.length;
  const pt = b.spots.patrol.filter(p => reach(nav, { x: p[0], y: p[1], z: p[2] }, 1.0, 0.6)).length + '/' + b.spots.patrol.length;
  const pr = b.portals.map(p => [reach(nav, { x: p.a[0], y: p.a[1], z: p.a[2] }, 1.0, 0.6), reach(nav, { x: p.b[0], y: p.b[1], z: p.b[2] }, 1.0, 0.6)]);
  console.log(`${def.id}: boxes=${b.boxes.length} solid=${w.solid.length} pyr=${b.pyrs.length} navNodes=${nav.n} comps=${nav.compSize.length} main=${nav.compSize[nav.main]} build=${t1 - t0}ms nav=${t2 - t1}ms`);
  if (pr.some(q => !q[0] || !q[1])) { console.log('  ✗ 傳送門出口走不到！'); process.exitCode = 1; }
  console.log('  spots reachable', JSON.stringify(cnt), 'spawn', sp, 'patrol', pt, 'portals', JSON.stringify(pr));
  // 三層測試：各樓層節點分佈
  const ys = {};
  for (let i = 0; i < nav.n; i++) if (nav.inMain(i)) { const k = Math.round(nav.ny[i] / 3.2); ys[k] = (ys[k] || 0) + 1; }
  console.log('  main nodes by level(~3.2m):', JSON.stringify(ys));
}
