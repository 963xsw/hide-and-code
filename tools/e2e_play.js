'use strict';
// 單人端對端：用真實按鍵完成整個解謎流程，並測試被抓／重生／重置
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/314c8df9-9874-5fa8-bc96-0d4b45210a6f/scratchpad';
const map = +(process.env.MAP || 0);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FAIL', m); } else console.log('  ✓', m); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.evaluate(m => { window.__HC.Store.d.map = m; }, map);
  console.log('== 地圖', map);
  await page.click('#b-start');
  await page.waitForFunction(() => window.__HC.G.mode === 'play', null, { timeout: 60000 });
  await page.evaluate(() => {
    const G = window.__HC.G;
    G.countdown = 0; G.simDelay = 0; G.sim.mon.cool = 1e9;  // 暫時讓怪物不威脅
    document.getElementById('keyhint').classList.add('hidden');
    // 輔助：站到某個點附近（有視線）並看向它
    window.standLook = (tx, ty, tz, minD = 0.9, maxD = 2.0) => {
      const sim = G.sim, nav = sim.nav, W = sim.world, me = G.me;
      for (let r = minD; r <= maxD; r += 0.25) for (let a = 0; a < 16; a++) {
        const ang = a * Math.PI / 8, x = tx + Math.cos(ang) * r, z = tz + Math.sin(ang) * r;
        const i = nav.nearest(x, ty, z, 2); if (i < 0 || !nav.inMain(i)) continue;
        if (Math.hypot(nav.nx[i] - x, nav.nz[i] - z) > 0.3 || nav.ny[i] - ty > 0.3 || ty - nav.ny[i] > 2.6) continue;
        const ey = nav.ny[i] + 1.55;
        if (!W.los(nav.nx[i], ey, nav.nz[i], tx, ty, tz)) continue;
        me.x = nav.nx[i]; me.y = nav.ny[i]; me.z = nav.nz[i];
        const dx = tx - me.x, dy = ty - ey, dz = tz - me.z;
        me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, Math.hypot(dx, dz)); me.vy = 0; me.vx = me.vz = 0; me.crouch = false;
        return true;
      }
      return false;
    };
  });
  const st = () => page.evaluate(() => { const G = window.__HC.G; return { items: G.me.items.slice(), notes: Object.assign({}, G.notes), inter: G.inter && G.inter.type + ':' + G.inter.idx, st: G.me.st, lives: G.me.lives, kp: !!G.keypad, ended: G.ended, locks: G.locks.map(l => l.open) }; });

  // 1) 找密碼條（顏色 0）
  const cInfo = await page.evaluate(() => { const G = window.__HC.G, v = G.codeViews[0], s = G.bundle.b.spots.code[G.codes[0].spot]; return { x: v.px, y: v.y, z: v.pz, hint: s.hint, val: G.codeVals[0] }; });
  console.log('   紅色密碼位置', JSON.stringify(cInfo));
  const stood = await page.evaluate(c => window.standLook(c.x, c.y, c.z, 1.2, 3.6), cInfo);
  ok(stood, '可站到密碼條附近（有視線）');
  await page.waitForTimeout(250);
  let s = await st();
  ok(s.inter === 'code:0', '準心對準密碼條 → 顯示互動提示（' + s.inter + '）');
  await page.screenshot({ path: `${OUT}/p${map}_1_code.png` });
  await page.keyboard.press('KeyE'); await page.waitForTimeout(250);
  s = await st();
  ok(s.notes[0] && /^\d{4}$/.test(s.notes[0]) && s.notes[0] === cInfo.val, '按 E 記下告示牌上的密碼 ' + s.notes[0] + '（與牆上顯示的數字相同）');

  // 2) 找鎖並輸入密碼
  const lInfo = await page.evaluate(() => { const G = window.__HC.G, b = G.bundle.b, s = b.spots.lock[G.locks[0].spot]; return { x: s.x, y: s.y + 0.5, z: s.z }; });
  ok(await page.evaluate(l => window.standLook(l.x, l.y, l.z, 1.0, 2.2), lInfo), '可站到紅色鎖附近');
  await page.waitForTimeout(250);
  s = await st(); ok(s.inter === 'lock:0', '準心對準鎖 → 提示（' + s.inter + '）');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(250);
  s = await st(); ok(s.kp, '按 E 開啟密碼鎖面板');
  await page.screenshot({ path: `${OUT}/p${map}_2_keypad.png` });
  // 先輸入錯誤密碼
  for (const k of ['0', '0', '0', '0']) await page.keyboard.press(k);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const wrongFlash = await page.evaluate(() => document.getElementById('kp-disp').classList.contains('shake'));
  ok(wrongFlash, '輸入錯誤密碼 → 鎖頭震動並顯示紅色');
  {
    const lp = await page.evaluate(() => ({ ping: !!window.__HC.G.lurePing, toast: document.getElementById('toasts').textContent.includes('引來了怪物') }));
    ok(lp.ping && lp.toast, '輸錯密碼 → 顯示「怪物被引來」警告與小地圖橘圈');
    // 讓玩家躲起來（避免被怪物看見而改為追擊），然後計時：怪物須在 10 秒內走到鎖前
    await page.evaluate(() => { const G = window.__HC.G; window.__lureT0 = G.sim.t; G.sim.players.get('h').flags |= 2; });
    const arr = await page.evaluate(async () => {
      const G = window.__HC.G, sim = G.sim, lk = sim.b.spots.lock[sim.locks[0].spot], m = sim.mon;
      sim.mon.cool = 0;
      return await new Promise(res => { const iv = setInterval(() => { const d = Math.hypot(m.x - lk.x, m.z - lk.z); if (d <= 3.3 && Math.abs(m.y - lk.y) < 3) { clearInterval(iv); res(sim.t - window.__lureT0); } if (sim.t - window.__lureT0 > 14) { clearInterval(iv); res(-1); } }, 100); });
    });
    ok(arr > 0 && arr <= 10, '怪物在遊戲時間 ' + arr.toFixed(1) + ' 秒內抵達該密碼鎖（要求 ≤ 10 秒）');
    await page.evaluate(() => { const G = window.__HC.G; G.sim.mon.cool = 1e9; G.sim.mon.st = 'patrol'; G.sim.players.get('h').flags &= ~2; });
  }
  const monAttract = await page.evaluate(() => window.__HC.G.sim.mon.st);
  // 再輸入正確密碼
  await page.waitForTimeout(500);
  for (const k of s.notes ? [] : []) { /* noop */ }
  const code = (await st()).notes[0];
  for (const k of code.split('')) await page.keyboard.press(k);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  s = await st();
  ok(s.items.includes(0) && s.locks[0] === true && !s.kp, '輸入正確密碼 → 解鎖並獲得物品，面板關閉');

  // 3) 找放置點並放置 → 獲勝
  const pInfo = await page.evaluate(() => { const G = window.__HC.G, b = G.bundle.b, s = b.spots.ped[G.peds[0].spot]; return { x: s.x, y: s.y + 0.8, z: s.z }; });
  ok(await page.evaluate(p => window.standLook(p.x, p.y, p.z, 1.2, 2.4), pInfo), '可站到紅色放置點附近');
  await page.waitForTimeout(250);
  s = await st(); ok(s.inter === 'ped:0', '準心對準放置點 → 提示（' + s.inter + '）');
  await page.screenshot({ path: `${OUT}/p${map}_3_ped.png` });
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
  s = await st(); ok(s.ended, '放置匹配 → 回合結束（獲勝）');
  await page.waitForTimeout(4800);
  const res = await page.evaluate(() => ({ vis: !document.getElementById('result').classList.contains('hidden'), title: document.getElementById('r-title').textContent, sub: document.getElementById('r-sub').textContent, reward: document.getElementById('r-reward').textContent }));
  ok(res.vis && /通關/.test(res.title), '顯示通關結算畫面：' + res.title + ' / ' + res.sub + ' / ' + res.reward);
  await page.screenshot({ path: `${OUT}/p${map}_4_result.png` });
  const coins = await page.evaluate(() => window.__HC.Store.d.coins);
  ok(coins > 0, '獲得金幣 ' + coins);

  // 4) 再玩一次：被抓 → 死亡畫面 → 重生 → 重置
  await page.click('#r-lobby');
  await page.waitForFunction(() => window.__HC.G.mode === 'play' && window.__HC.G.me.st === 'alive', null, { timeout: 60000 });
  await page.evaluate(() => { const G = window.__HC.G; G.countdown = 0; G.simDelay = 0; G.sim.mon.cool = 1e9; });
  // 先取得密碼並解鎖紅鎖，再讓怪物抓住
  const c2 = await page.evaluate(() => { const G = window.__HC.G, b = G.bundle.b; const v = G.codeViews[0], l = b.spots.lock[G.locks[0].spot]; return { s: { x: v.px, y: v.y, z: v.pz }, l: { x: l.x, y: l.y, z: l.z } }; });
  await page.evaluate(c => { window.standLook(c.s.x, c.s.y, c.s.z, 1.2, 3.6); }, c2);
  await page.waitForTimeout(250); await page.keyboard.press('KeyE'); await page.waitForTimeout(250);
  const oldSpot = await page.evaluate(() => window.__HC.G.codes[0].spot);
  await page.evaluate(c => { window.standLook(c.l.x, c.l.y + 0.5, c.l.z, 1.0, 2.2); }, c2);
  await page.waitForTimeout(250); await page.keyboard.press('KeyE'); await page.waitForTimeout(200);
  const code2 = (await st()).notes[0];
  for (const k of code2.split('')) await page.keyboard.press(k);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  s = await st(); ok(s.items.includes(0), '第二局：解鎖紅鎖');
  // 讓怪物抓住玩家
  await page.evaluate(() => { const G = window.__HC.G, sim = G.sim, m = sim.mon, p = sim.players.get('h'); p.prot = 0; G.me.prot = 0; sim.mon.cool = 0; m.x = G.me.x + 0.6; m.y = G.me.y; m.z = G.me.z; m.path = null; m.st = 'patrol'; });
  await page.waitForTimeout(700);
  s = await st();
  ok(s.st === 'dead' && s.lives === 2, '被怪物碰到 → 死亡且剩 2 條命');
  const dv = await page.evaluate(() => !document.getElementById('death').classList.contains('hidden'));
  ok(dv, '顯示死亡畫面');
  await page.screenshot({ path: `${OUT}/p${map}_5_death.png` });
  ok(s.items.length === 0 && s.locks[0] === false, '死亡 → 物品歸還、鎖重新上鎖');
  const newSpot = await page.evaluate(() => window.__HC.G.codes[0].spot);
  ok(newSpot !== oldSpot && Object.keys(s.notes).indexOf('0') < 0, '密碼條被重新藏到別處，舊筆記作廢');
  await page.waitForTimeout(5500);
  s = await st(); ok(s.st === 'alive', '倒數後在隨機位置重生');
  const bad = errs.filter(e => !/favicon|net::ERR/.test(e));
  console.log('ERRORS:', bad.length ? bad.slice(0, 6).join('\n') : 'none');
  console.log(fails ? `失敗 ${fails} 項` : '本地圖全部通過');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('E2E FAIL', e); process.exit(2); });
