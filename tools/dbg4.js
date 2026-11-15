const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'src');
let code = ['01_util.js','02_world.js','03_gen.js','04_maps.js','08_sim.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
code += '\n;globalThis.__api = { Sim, MAP_DEFS, getBundle };';
const ctx = { console, Math, Float32Array, Int32Array, Map, Set, Array, Object, JSON, performance }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
const A = ctx.__api;
for (let mi = 0; mi < 3; mi++) {
  for (const seed of [11, 22, 33]) {
    const sim = new A.Sim(mi, seed, [{ id: 'h', name: 'A', av: 0 }], () => {}); const nav = sim.nav;
    sim.locks.forEach((l, c) => {
      const s = sim.b.spots.lock[l.spot]; const t = nav.nearest(s.x, s.y, s.z, 6);
      const dh = Math.hypot(nav.nx[t] - s.x, nav.nz[t] - s.z), dy = nav.ny[t] - s.y;
      if (dh > 1.6 || Math.abs(dy) > 0.8) console.log(A.MAP_DEFS[mi].name, 'seed', seed, 'lock', c, 'spot', l.spot, 'pos', [s.x, s.y, s.z].map(v => +v.toFixed(1)), '最近節點距離', dh.toFixed(2), 'dy', dy.toFixed(2));
    });
  }
}
