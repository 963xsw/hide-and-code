'use strict';
// 多人端對端（BroadcastChannel 傳輸，同瀏覽器兩個分頁）：房間、代碼加入、同步、先到先得、搶先獲勝
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/314c8df9-9874-5fa8-bc96-0d4b45210a6f/scratchpad';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FAIL', m); } else console.log('  ✓', m); };
const root = path.resolve(__dirname, '..');
const srv = http.createServer((req, res) => {
  const f = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d); } });
});
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/index.html?bc=1`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 520 } });
  const A = await ctx.newPage(), B = await ctx.newPage();
  const errs = [];
  for (const [n, p] of [['A', A], ['B', B]]) { p.on('console', m => { if (m.type() === 'error') errs.push(n + ': ' + m.text()); }); p.on('pageerror', e => errs.push(n + ' PAGEERROR: ' + e.message)); }
  await A.goto(url); await B.goto(url);
  await A.evaluate(() => { window.__HC.Store.d.name = '房主甲'; window.__HC.Store.d.map = 1; window.__HC.Store.d.av = 'a0'; });
  await B.evaluate(() => { window.__HC.Store.d.name = '玩家乙'; window.__HC.Store.d.av = 'a0'; });
  // 1) 創建房間
  await A.click('#b-create');
  await A.waitForFunction(() => window.__HC.G.mode === 'lobby', null, { timeout: 15000 });
  const code = await A.evaluate(() => document.getElementById('l-code').textContent);
  ok(/^[A-Z0-9]{5}$/.test(code), '房主建立房間，代碼 ' + code);
  // 2) 乙輸入代碼加入
  await B.click('#b-join'); await B.fill('#j-code', code.toLowerCase()); await B.click('#j-go');
  await B.waitForFunction(() => window.__HC.G.mode === 'lobby', null, { timeout: 15000 });
  await A.waitForFunction(() => window.__HC.G.room.players.length === 2, null, { timeout: 5000 });
  const names = await B.evaluate(() => window.__HC.G.room.players.map(p => p.name).join(','));
  ok(/房主甲/.test(names) && /玩家乙/.test(names), '代碼加入成功，大廳顯示兩位玩家：' + names);
  // 錯誤代碼
  const C = await ctx.newPage(); await C.goto(url); await C.click('#b-join'); await C.fill('#j-code', 'ZZZZZ'); await C.click('#j-go');
  await C.waitForFunction(() => document.getElementById('j-err').textContent.length > 0, null, { timeout: 8000 });
  ok(/找不到/.test(await C.evaluate(() => document.getElementById('j-err').textContent)), '輸入不存在的代碼 → 顯示「找不到房間」');
  await C.close();
  // 3) 大廳聊天
  await B.fill('#l-chatin', '大家好'); await B.click('#l-send');
  await A.waitForFunction(() => document.getElementById('l-chat').textContent.includes('大家好'), null, { timeout: 4000 });
  ok(true, '大廳文字聊天互通');
  // 4) 乙看不到開始按鈕，房主開始
  ok(await B.evaluate(() => document.getElementById('l-start').classList.contains('hidden')), '非房主看不到「開始遊戲」');
  await A.screenshot({ path: `${OUT}/m_lobby.png` });
  await A.click('#l-start');
  await A.waitForFunction(() => window.__HC.G.mode === 'play', null, { timeout: 60000 });
  await B.waitForFunction(() => window.__HC.G.mode === 'play', null, { timeout: 20000 });
  ok(true, '兩位玩家同時進入遊戲（地圖：' + await B.evaluate(() => window.__HC.MAP_DEFS[window.__HC.G.mapIdx].name) + '）');
  await A.evaluate(() => { const G = window.__HC.G; G.countdown = 0; G.simDelay = 0; G.sim.mon.cool = 1e9; });
  await B.evaluate(() => { const G = window.__HC.G; G.countdown = 0; });
  // 5) 位置同步：A 傳送後，B 應看到
  await A.evaluate(() => { const m = window.__HC.G.me; m.x = 3; m.y = 0; m.z = 3; });
  await B.waitForTimeout(900);
  const seen = await B.evaluate(() => { const o = [...window.__HC.G.others.values()][0]; return o && { x: o.tx, z: o.tz, st: o.st }; });
  ok(seen && Math.abs(seen.x - 3) < 0.5 && Math.abs(seen.z - 3) < 0.5, '玩家位置同步：乙看到甲在 ' + JSON.stringify(seen));
  await B.screenshot({ path: `${OUT}/m_B_play.png` });
  // 6) 工具：乙取得顏色 1 的密碼並解鎖（甲之後無法再開）
  await B.evaluate(() => {
    const G = window.__HC.G, bun = window.__HC.getBundle(G.mapIdx, true), nav = bun.nav, W = bun.world;
    window.standLookB = (tx, ty, tz, minD = 0.9, maxD = 2.2) => {
      const me = G.me;
      for (let r = minD; r <= maxD; r += 0.25) for (let a = 0; a < 16; a++) {
        const ang = a * Math.PI / 8, x = tx + Math.cos(ang) * r, z = tz + Math.sin(ang) * r;
        const i = nav.nearest(x, ty, z, 2); if (i < 0 || !nav.inMain(i)) continue;
        if (Math.hypot(nav.nx[i] - x, nav.nz[i] - z) > 0.3 || nav.ny[i] - ty > 0.3 || ty - nav.ny[i] > 2.6) continue;
        const ey = nav.ny[i] + 1.55; if (!W.los(nav.nx[i], ey, nav.nz[i], tx, ty, tz)) continue;
        me.x = nav.nx[i]; me.y = nav.ny[i]; me.z = nav.nz[i];
        const dx = tx - me.x, dy = ty - ey, dz = tz - me.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, Math.hypot(dx, dz)); me.vx = me.vz = me.vy = 0; return true;
      } return false;
    };
  });
  const spots = await B.evaluate(() => { const G = window.__HC.G, b = G.bundle.b; const v1 = G.codeViews[1], c = { x: v1.px, y: v1.y - 0.05, z: v1.pz }, l = b.spots.lock[G.locks[1].spot], p = b.spots.ped[G.peds[1].spot]; return { c: [c.x, c.y + 0.05, c.z], l: [l.x, l.y + 0.5, l.z], p: [p.x, p.y + 0.8, p.z] }; });
  await B.evaluate(s => window.standLookB(...s.c, 1.2, 3.6), spots); await B.waitForTimeout(300); await B.keyboard.press('KeyE'); await B.waitForTimeout(500);
  const note = await B.evaluate(() => window.__HC.G.notes[1]);
  ok(/^\d{4}$/.test(note), '乙檢查密碼條取得藍色密碼 ' + note + '（只有乙知道）');
  ok(await A.evaluate(() => window.__HC.G.notes[1] === undefined), '甲不會得知乙找到的密碼');
  await B.evaluate(s => window.standLookB(...s.l, 1.0, 2.2), spots); await B.waitForTimeout(300); await B.keyboard.press('KeyE'); await B.waitForTimeout(300);
  for (const k of note.split('')) await B.keyboard.press(k);
  await B.keyboard.press('Enter'); await B.waitForTimeout(700);
  ok(await B.evaluate(() => window.__HC.G.me.items.includes(1)), '乙解鎖藍色鎖並取得物品');
  ok(await A.evaluate(() => window.__HC.G.locks[1].open === true && window.__HC.G.locks[1].by !== window.__HC.G.myId), '甲端同步看到藍色鎖已被乙開啟（先到先得）');
  ok(await A.evaluate(() => /已被解鎖/.test(document.getElementById('hud-tasks').textContent)), '甲的任務面板顯示「已被解鎖」');
  // 6.5) 幽靈：甲三條命用完，乙仍存活 → 甲成為幽靈，乙看不到甲
  await A.evaluate(() => { const G = window.__HC.G, sim = G.sim, p = sim.players.get('h'); p.lives = 1; p.prot = 0; G.me.prot = 0; sim.mon.cool = 0; sim.mon.x = G.me.x + 0.5; sim.mon.y = G.me.y; sim.mon.z = G.me.z; sim.mon.path = null; });
  await A.waitForFunction(() => window.__HC.G.me.st === 'ghost', null, { timeout: 40000 });
  ok(await A.evaluate(() => !document.getElementById('ghostbar').classList.contains('hidden')), '甲三條命用完 → 成為幽靈（顯示觀戰列，無重生倒數）');
  await B.waitForTimeout(600);
  ok(await B.evaluate(() => [...window.__HC.G.others.values()][0].st === 2), '乙端：甲的狀態為幽靈（乙看不到甲，不會繪製）');
  await A.screenshot({ path: `${OUT}/m_A_ghost.png` });
  ok(await B.evaluate(() => window.__HC.G.ended === false && window.__HC.G.me.st === 'alive'), '只要還有玩家存活，回合繼續');
  await A.evaluate(() => { window.__HC.G.me.spec = null; });
  await B.evaluate(() => { window.__HC.G.sim ? 0 : 0; });
  // 7) 乙放置 → 乙獲勝，甲看到結算
  await B.evaluate(s => window.standLookB(...s.p, 1.2, 2.4), spots); await B.waitForTimeout(300); await B.keyboard.press('KeyE');
  await A.waitForFunction(() => window.__HC.G.ended === true, null, { timeout: 6000 });
  await B.waitForFunction(() => window.__HC.G.ended === true, null, { timeout: 6000 });
  ok(await A.evaluate(() => window.__HC.G.results.winner !== window.__HC.G.myId), '甲端收到結算：獲勝者為乙');
  await A.waitForTimeout(4800);
  const ta = await A.evaluate(() => document.getElementById('r-title').textContent), tb = await B.evaluate(() => document.getElementById('r-title').textContent);
  ok(/玩家乙|通關了/.test(ta) && /通關成功/.test(tb), `甲看到「${ta}」，乙看到「${tb}」`);
  await A.screenshot({ path: `${OUT}/m_A_result.png` });
  // 8) 回到大廳
  ok(await B.evaluate(() => document.getElementById('r-lobby').disabled === true), '非房主不能按「回到大廳」');
  await A.click('#r-lobby');
  await B.waitForFunction(() => window.__HC.G.mode === 'lobby', null, { timeout: 8000 });
  ok(true, '房主按回到大廳 → 兩人都回到大廳');
  // 9) 乙離開 → 房主名單更新
  await B.click('#l-leave');
  await A.waitForFunction(() => window.__HC.G.room.players.length === 1, null, { timeout: 6000 });
  ok(true, '乙離開房間 → 房主名單更新為 1 人');
  const bad = errs.filter(e => !/favicon/.test(e));
  console.log('ERRORS:', bad.length ? bad.slice(0, 8).join('\n') : 'none');
  console.log(fails ? `失敗 ${fails} 項` : '多人測試全部通過');
  await browser.close(); srv.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('MULTI FAIL', e); srv.close(); process.exit(2); });
