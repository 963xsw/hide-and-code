const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'src');
let code = ['01_util.js','02_world.js','03_gen.js','04_maps.js','08_sim.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
code += '\n;globalThis.__api = { Sim, MAP_DEFS, getBundle, F_HIDDEN, MON };';
const ctx = { console, Math, Float32Array, Int32Array, Map, Set, Array, Object, JSON, performance }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
const A = ctx.__api;
const sim = new A.Sim(0, 33, [{ id: 'h', name: 'A', av: 0 }], () => {}); const nav = sim.nav, m = sim.mon, p = sim.players.get('h');
const lk = sim.b.spots.lock[sim.locks[3].spot]; console.log('lock3', [lk.x, lk.y, lk.z].map(v => +v.toFixed(1)));
const wn = sim.bundle.route.find(n => Math.hypot(nav.nx[n] - 29, nav.nz[n] - 13) < 1.5);
m.x = nav.nx[wn]; m.y = nav.ny[wn]; m.z = nav.nz[wn];
p.x = lk.x; p.y = lk.y; p.z = lk.z + 1; p.flags = A.F_HIDDEN; p.prot = 99;
const a = nav.nearest(m.x, m.y, m.z, 4), t = nav.nearest(lk.x, lk.y, lk.z, 6); const path2 = nav.path(a, t, 120000);
let acc = 0, k = path2.length - 1; const keep = A.MON.lureMax * A.MON.lureTime;
while (k > 0 && acc < keep) { const n0 = path2[k], n1 = path2[k - 1]; acc += Math.hypot(nav.nx[n0] - nav.nx[n1], nav.ny[n0] - nav.ny[n1], nav.nz[n0] - nav.nz[n1]); k--; }
const dp = (x, y, z) => ({ d3: Math.hypot(p.x - x, p.y - y, p.z - z).toFixed(1), los: sim.world.los(p.x, p.y + 1.5, p.z, x, y + 1.6, z), h: Math.hypot(p.x - x, p.z - z).toFixed(1) });
console.log('path nodes', path2.length, 'k', k, 'dest', [nav.nx[path2[k]], nav.ny[path2[k]], nav.nz[path2[k]]].map(v => +v.toFixed(1)), 'vs player', JSON.stringify(dp(nav.nx[path2[k]], nav.ny[path2[k]], nav.nz[path2[k]])));
console.log('monster', [m.x, m.y, m.z].map(v => +v.toFixed(1)), 'vs player', JSON.stringify(dp(m.x, m.y, m.z)));
