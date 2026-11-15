'use strict';
// 輸錯密碼 → 怪物必須在 10 秒內抵達該鎖附近（所有巡邏點 × 4 個鎖）
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'src');
let code = ['01_util.js', '02_world.js', '03_gen.js', '04_maps.js', '08_sim.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
code += '\n;globalThis.__api = { Sim, MAP_DEFS, getBundle, F_HIDDEN };';
const ctx = { console, Math, Float32Array, Int32Array, Map, Set, Array, Object, JSON, performance }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
const A = ctx.__api;
let fails = 0;
for (let mi = 0; mi < 3; mi++) {
  const seeds = [11, 22, 33];
  let trials = 0, worst = 0, worstFrom = '', late = 0, teleports = 0, sum = 0;
  for (const seed of seeds) {
    const ev = [];
    const sim = new A.Sim(mi, seed, [{ id: 'h', name: 'A', av: 0 }], (to, m) => ev.push(m));
    const bun = sim.bundle, nav = sim.nav, p = sim.players.get('h');
    for (let c = 0; c < 4; c++) {
      const lk = sim.b.spots.lock[sim.locks[c].spot];
      for (const wn of bun.route) {
        const m = sim.mon;
        // 重設怪物到該巡邏點
        m.x = nav.nx[wn]; m.y = nav.ny[wn]; m.z = nav.nz[wn]; m.st = 'patrol'; m.path = null; m.cool = 0; m.idle = 0; m.target = null; m.rushSpeed = 0;
        p.x = lk.x; p.y = lk.y; p.z = lk.z + 1; p.flags = A.F_HIDDEN; p.st = 'alive'; p.prot = 99; p.hideIdx = -1;
        const startPos = [m.x, m.z];
        ev.length = 0;
        sim.handle('h', { t: 'unlock', c, code: '0000' });
        const lure = ev.find(e => e.t === 'lure');
        if (!lure) { fails++; console.log('  ✗ 沒有觸發 lure', mi, c); continue; }
        let t = 0, arrived = -1;
        while (t < 14) { sim.tick(0.05); t += 0.05; if (Math.hypot(m.x - lk.x, m.z - lk.z) <= 3.3 && Math.abs(m.y - lk.y) < 3) { arrived = t; break; } }
        trials++;
        if (arrived < 0 || arrived > 10) { late++; fails++; console.log(`  ✗ ${A.MAP_DEFS[mi].name} seed${seed} 鎖${c} 從(${startPos.map(v => v.toFixed(0))}) 抵達 ${arrived < 0 ? '未抵達' : arrived.toFixed(1) + 's'} ${JSON.stringify(sim.lastLure)}`); }
        if (arrived > worst) { worst = arrived; worstFrom = startPos.map(v => v.toFixed(0)).join(','); }
        sum += Math.max(0, arrived);
        if (Math.hypot(m.x - startPos[0], m.z - startPos[1]) < 0) teleports++;
      }
    }
  }
  console.log(`${A.MAP_DEFS[mi].name}: 測試 ${trials} 次，最慢 ${worst.toFixed(1)} 秒（起點 ${worstFrom}），平均 ${(sum / trials).toFixed(1)} 秒，超過 10 秒 ${late} 次`);
}
console.log(fails ? `失敗 ${fails}` : '全部在 10 秒內抵達');
process.exit(fails ? 1 : 0);
