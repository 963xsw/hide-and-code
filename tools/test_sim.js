'use strict';
const { loadCore } = require('./load');
const fs = require('fs'), path = require('path'), vm = require('vm');
// 載入 Sim（需額外匯出）
const dir = path.join(__dirname, '..', 'src');
let code = ['01_util.js', '02_world.js', '03_gen.js', '04_maps.js', '08_sim.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
code += '\n;globalThis.__api = { Sim, MAP_DEFS, getBundle, COLORS, MON, F_HIDDEN, F_CROUCH, ROUND_TIME };';
const ctx = { console, Math, Float32Array, Int32Array, Map, Set, Array, Object, JSON, performance };
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
const A = ctx.__api;
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('  ✗ FAIL', msg); } else console.log('  ✓', msg); };

for (let mi = 0; mi < 3; mi++) {
  console.log('== 地圖', A.MAP_DEFS[mi].name);
  const ev = [];
  const sim = new A.Sim(mi, 12345 + mi, [{ id: 'h', name: 'A', av: 0 }, { id: 'p1', name: 'B', av: 1 }], (to, m) => ev.push([to, m]));
  const b = sim.b;
  ok(sim.locks.length === 4 && sim.peds.length === 4 && sim.codes.length === 4, '配置 4 組鎖/放置點/密碼');
  // 1) 怪物巡邏 60 秒：確認會移動
  const m0 = { x: sim.mon.x, z: sim.mon.z };
  let moved = 0;
  for (let i = 0; i < 60 * 20; i++) { const px = sim.mon.x, pz = sim.mon.z; sim.tick(0.05); moved += Math.hypot(sim.mon.x - px, sim.mon.z - pz); }
  // 玩家可能被抓；重置
  console.log('   巡邏 60s 移動距離', moved.toFixed(1), 'm；事件', ev.map(e => e[1].t).join(','));
  ok(moved > 60, '怪物會沿路線巡邏（移動距離>60m）');
  // 2) 偵測 2 秒：把玩家放在怪物前方 8 公尺（需視線通暢），蹲下 false
  const sim2 = new A.Sim(mi, 777 + mi, [{ id: 'h', name: 'A', av: 0 }], (to, m) => ev.push([to, m]));
  ev.length = 0;
  const m = sim2.mon, p = sim2.players.get('h');
  p.prot = 0; m.cool = 0;
  // 找一個前方 8m 視線通暢的位置
  let placed = false;
  for (let a = 0; a < 32 && !placed; a++) {
    const ang = a * Math.PI / 16; m.yaw = ang;
    const fx = -Math.sin(ang), fz = -Math.cos(ang);
    for (const d of [8, 6, 10, 5, 4, 3, 12]) {
      const x = m.x + fx * d, z = m.z + fz * d;
      if (sim2.world.los(m.x, m.y + 1.9, m.z, x, m.y + 1.5, z)) {
        const i = sim2.nav.nearest(x, m.y, z, 2);
        if (i >= 0 && Math.abs(sim2.nav.ny[i] - m.y) < 0.3 && Math.hypot(sim2.nav.nx[i] - x, sim2.nav.nz[i] - z) < 0.5) { p.x = x; p.y = m.y; p.z = z; placed = true; break; }
      }
    }
  }
  ok(placed, '找到可視位置');
  m.st = 'patrol'; m.path = null; m.idle = 100; // 先讓怪物站著，避免轉向
  let t = 0, chaseAt = -1;
  for (let i = 0; i < 100 && chaseAt < 0; i++) { sim2.tick(0.05); t += 0.05; if (m.st === 'chase') chaseAt = t; }
  console.log('   進入追逐時間', chaseAt.toFixed(2), 's');
  ok(chaseAt >= 1.9 && chaseAt <= 2.4, '視線內約 2 秒才開始追逐');
  // 3) 追逐後抓到：玩家不動
  let caught = false;
  for (let i = 0; i < 20 * 25 && !caught; i++) { sim2.tick(0.05); if (ev.some(e => e[1].t === 'caught')) caught = true; }
  ok(caught, '追逐後會抓到玩家');
  ok(p.lives === 2 && p.st === 'dead', '被抓扣 1 命並進入死亡狀態');
  // 4) 重生
  for (let i = 0; i < 20 * 6; i++) sim2.tick(0.05);
  ok(p.st === 'alive', '倒數後重生');
  // 5) 躲藏：追逐中躲進櫃子→放棄
  const hs = sim2.bundle.valid.hide.map(i => ({ i, h: b.spots.hide[i] })).find(o => o.h.kind !== 'bush') || { i: sim2.bundle.valid.hide[0], h: b.spots.hide[sim2.bundle.valid.hide[0]] };
  // 6) 解鎖流程
  const s2 = new A.Sim(mi, 4242, [{ id: 'h', name: 'A', av: 0 }, { id: 'p1', name: 'B', av: 1 }], (to, m) => ev.push([to, m]));
  s2.mon.cool = 1e9; // 暫停怪物威脅
  ev.length = 0;
  const q = s2.players.get('h'), q1 = s2.players.get('p1');
  const lk = s2.b.spots.lock[s2.locks[0].spot];
  q.x = lk.x; q.y = lk.y; q.z = lk.z + 1; q1.x = lk.x; q1.y = lk.y; q1.z = lk.z - 1;
  s2.handle('h', { t: 'unlock', c: 0, code: '0000' });
  ok(ev.some(e => e[1].t === 'wrong'), '錯誤密碼 → wrong 事件');
  const cs = s2.b.spots.code[s2.codes[0].spot];
  q.x = cs.x; q.y = cs.y; q.z = cs.z + 0.8;
  s2.handle('h', { t: 'insp', c: 0 });
  const note = ev.find(e => e[1].t === 'note');
  ok(note && note[1].v === s2.codes[0].value && note[0] === 'h', '檢查密碼條 → 只回傳給檢查者');
  q.x = lk.x; q.y = lk.y; q.z = lk.z + 1;
  s2.handle('h', { t: 'unlock', c: 0, code: s2.codes[0].value });
  ok(s2.locks[0].open && s2.locks[0].by === 'h' && q.items.includes(0), '正確密碼 → 解鎖並獲得物品');
  s2.handle('p1', { t: 'unlock', c: 0, code: s2.codes[0].value });
  ok(!q1.items.includes(0), '同一個鎖第二次無法再取得（先到先得）');
  // 7) 死亡重置
  const oldSpot = s2.codes[0].spot, oldVal = s2.codes[0].value;
  s2.mon.cool = 0; s2.caught(q);
  ok(!s2.locks[0].open && q.items.length === 0, '死亡 → 鎖重新上鎖、物品歸還');
  ok(s2.codes[0].spot !== oldSpot && s2.codes[0].value !== oldVal, '死亡 → 密碼重新隨機生成到別處（位置與數值皆變）');
  ok(ev.some(e => e[1].t === 'reset'), '廣播 reset 事件');
  // 8) 放置獲勝
  s2.mon.cool = 1e9;
  q1.st = 'alive'; q1.prot = 0;
  const cs1 = s2.b.spots.code[s2.codes[1].spot], lk1 = s2.b.spots.lock[s2.locks[1].spot], pd1 = s2.b.spots.ped[s2.peds[1].spot];
  q1.x = cs1.x; q1.y = cs1.y; q1.z = cs1.z + 0.8; s2.handle('p1', { t: 'insp', c: 1 });
  q1.x = lk1.x; q1.y = lk1.y; q1.z = lk1.z + 1; s2.handle('p1', { t: 'unlock', c: 1, code: s2.codes[1].value });
  ok(q1.items.includes(1), '玩家 B 解鎖第 2 色');
  q1.x = pd1.x; q1.y = pd1.y; q1.z = pd1.z + 1; s2.handle('p1', { t: 'place', c: 1 });
  const endEv = ev.find(e => e[1].t === 'end');
  ok(endEv && endEv[1].winner === 'p1' && endEv[1].reason === 'place', '放置匹配 → 該玩家獲勝，回合結束');
  // 9) 奶蛙
  const s3 = new A.Sim(mi, 99, [{ id: 'h', name: 'A', av: 0 }], (to, m) => ev.push([to, m]));
  s3.mon.cool = 1e9; ev.length = 0;
  const fr = s3.b.spots.frog[s3.frog.spot], pp = s3.players.get('h'); pp.x = fr.x; pp.y = fr.y; pp.z = fr.z + 0.5;
  s3.handle('h', { t: 'frog' });
  ok(ev.some(e => e[1].t === 'end' && e[1].reason === 'frog'), '找到奶蛙 → 直接通關');
  // 10) 三條命用完 → 幽靈；全員幽靈 → 結束
  const s4 = new A.Sim(mi, 55, [{ id: 'h', name: 'A', av: 0 }], (to, m) => ev.push([to, m]));
  ev.length = 0; const pg = s4.players.get('h');
  for (let i = 0; i < 3; i++) { pg.st = 'alive'; s4.caught(pg); }
  ok(pg.st === 'ghost' && pg.lives === 0, '三條命用完 → 幽靈（不再倒數重生）');
  ok(ev.some(e => e[1].t === 'end' && e[1].reason === 'alldead'), '全員淘汰 → 回合結束');
  // 11) 躲藏放棄追逐
  const s5 = new A.Sim(mi, 31, [{ id: 'h', name: 'A', av: 0 }], (to, m) => ev.push([to, m]));
  const hp = s5.players.get('h'), mm = s5.mon, hh = s5.b.spots.hide[hs.i];
  hp.prot = 0; hp.x = hh.ex; hp.y = hh.y; hp.z = hh.ez; mm.x = hh.ex + 9; mm.y = hh.y; mm.z = hh.ez; mm.st = 'chase'; mm.target = 'h'; mm.cool = 0;
  s5.handle('h', { t: 'hide', i: hs.i });
  ok(mm.st === 'patrol' && hp.hideIdx === hs.i, '追逐中躲進藏匿點（尚未被碰到）→ 怪物放棄追逐並回到巡邏');
}
console.log(fails ? `\n失敗 ${fails} 項` : '\n全部通過');
process.exit(fails ? 1 : 0);
