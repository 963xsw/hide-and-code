'use strict';
// UI／功能端對端：設定存檔、商店、稱號、暫停、重新開始、躲藏、幽靈觀戰、聊天、小地圖、手機版面
const { chromium, devices } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/314c8df9-9874-5fa8-bc96-0d4b45210a6f/scratchpad';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FAIL', m); } else console.log('  ✓', m); };
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'];
const file = 'file://' + path.resolve(__dirname, '..', 'index.html');
(async () => {
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 620 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto(file);
  // --- 設定 ---
  await page.click('#b-set');
  await page.fill('#st-name', '測試員');
  await page.selectOption('#st-q', 'low');
  await page.evaluate(() => { const e = document.getElementById('st-vol'); e.value = 35; e.dispatchEvent(new Event('input')); });
  await page.click('#st-back');
  await page.reload();
  const d = await page.evaluate(() => ({ n: window.__HC.Store.d.name, q: window.__HC.Store.d.q, v: window.__HC.Store.d.vol }));
  ok(d.n === '測試員' && d.q === 'low' && d.v === 35, '設定（暱稱／畫質／音量）重新整理後仍保存：' + JSON.stringify(d));
  // --- 商店 ---
  await page.evaluate(() => { window.__HC.Store.d.coins = 100; window.__HC.Store.save(); });
  await page.click('#b-shop');
  await page.click('#sh-list .item:nth-child(2) button');
  const sh = await page.evaluate(() => ({ c: window.__HC.Store.d.coins, av: window.__HC.Store.d.av, owned: window.__HC.Store.d.owned }));
  ok(sh.c === 70 && sh.av === 'a1' && sh.owned.includes('a1'), '商店購買頭像：金幣 100→70，已裝備 ' + sh.av);
  await page.click('#sh-list .item:nth-child(6) button');
  ok(/金幣不足/.test(await page.textContent('#sh-err')), '金幣不足時提示');
  await page.screenshot({ path: `${OUT}/u_shop.png` });
  await page.click('#sh-back');
  // --- 稱號 ---
  await page.evaluate(() => { const d = window.__HC.Store.d; d.titles.push('winner'); window.__HC.Store.save(); });
  await page.click('#b-titles');
  await page.click('#tt-list .pl:nth-child(3) button');
  ok(await page.evaluate(() => window.__HC.Store.d.title === 'winner'), '稱號可佩戴');
  await page.click('#tt-back');
  // --- 選地圖 ---
  await page.click('#b-maps'); await page.click('#mp-list .mapcard:nth-child(3)'); await page.click('#mp-back');
  ok(/廢棄城堡/.test(await page.textContent('#m-map')), '選地圖：主畫面顯示「廢棄城堡」');
  // --- 開始遊戲 ---
  await page.click('#b-start');
  await page.waitForFunction(() => window.__HC.G.mode === 'play', null, { timeout: 60000 });
  await page.evaluate(() => { const G = window.__HC.G; G.countdown = 0; G.simDelay = 0; G.sim.mon.cool = 1e9; });
  // --- 暫停 ---
  await page.keyboard.press('Escape');
  ok(await page.evaluate(() => !document.getElementById('pause').classList.contains('hidden') && window.__HC.G.menuOpen), 'Esc 開啟選單');
  const before = await page.evaluate(() => window.__HC.G.tm);
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__HC.G.tm);
  ok(before - after > 1.0, '開選單時遊戲仍在進行（倒數繼續：' + (before - after).toFixed(1) + 's）');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
  const p0 = await page.evaluate(() => ({ x: window.__HC.G.me.x, z: window.__HC.G.me.z }));
  await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
  const p1 = await page.evaluate(() => ({ x: window.__HC.G.me.x, z: window.__HC.G.me.z }));
  ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.05, '開選單時角色停在原地');
  await page.screenshot({ path: `${OUT}/u_pause.png` });
  await page.click('#p-resume');
  ok(await page.evaluate(() => !window.__HC.G.menuOpen), '繼續遊戲');
  // 音量／設定（暫停中）
  await page.keyboard.press('Escape'); await page.click('#p-set');
  ok(await page.evaluate(() => !document.getElementById('s-settings').classList.contains('hidden')), '暫停選單可開設定');
  await page.click('#st-back'); await page.click('#p-resume');
  // --- 躲藏 ---
  const hs = await page.evaluate(() => {
    const G = window.__HC.G, b = G.bundle.b, sim = G.sim, nav = sim.nav;
    const list = sim.bundle.valid.hide.map(i => ({ i, h: b.spots.hide[i] }));
    const pick = list.find(o => o.h.kind !== 'bush') || list[0];
    const h = pick.h;
    // 站在出口位置，面向藏匿點
    const me = G.me; const nn = nav.nearest(h.ex, h.y, h.ez, 4); me.x = nav.nx[nn]; me.y = nav.ny[nn]; me.z = nav.nz[nn]; me.vx = me.vz = 0;
    const ty = h.y + (h.kind === 'wardrobe' || h.kind === 'tank' ? 1.0 : 0.6), dx = h.x - me.x, dz = h.z - me.z, dy = ty - (me.y + 1.55);
    me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    return { kind: h.kind, i: pick.i };
  });
  await page.waitForTimeout(300);
  const it = await page.evaluate(() => window.__HC.G.inter && window.__HC.G.inter.type);
  ok(it === 'hide', '對準可躲藏物件（' + hs.kind + '）→ 顯示「躲藏」提示');
  if (it !== 'hide') console.log('   DIAG', JSON.stringify(await page.evaluate((hi) => { const G = window.__HC.G, b = G.bundle.b; const h = b.spots.hide[hi]; const m = G.me; return { inter: G.inter, me: [m.x, m.y, m.z, m.yaw, m.pitch, m.st, m.hidden, m.crouch, G.eyeY], menu: G.menuOpen, kp: !!G.keypad, mode: G.mode, ended: G.ended, hide: [h.x, h.y, h.z, h.ex, h.ez, h.kind], mon: [G.sim.mon.x, G.sim.mon.z, G.sim.mon.st], t: G.tm }; }, hs.i)));
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__HC.G.me.hidden && !document.getElementById('hidemask').classList.contains('hidden')), '按 E 躲進去（畫面變暗只剩縫隙）');
  await page.screenshot({ path: `${OUT}/u_hidden.png` });
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => !window.__HC.G.me.hidden), '再按 E 離開躲藏處');
  // --- 聊天 ---
  await page.keyboard.press('Enter'); await page.waitForTimeout(150); await page.keyboard.type('測試訊息'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  ok(/測試訊息/.test(await page.textContent('#chat')), '遊戲中文字聊天（Enter 開啟、Enter 送出）');
  // --- 小地圖收合 ---
  await page.keyboard.press('KeyM');
  ok(await page.evaluate(() => document.getElementById('hud-mini').classList.contains('min')), 'M 鍵收合小地圖');
  await page.keyboard.press('KeyM');
  // --- 手電筒 ---
  await page.keyboard.press('KeyF'); ok(await page.evaluate(() => window.__HC.G.flash === false), 'F 切換手電筒'); await page.keyboard.press('KeyF');
  // --- 蹲下與跳躍 ---
  await page.keyboard.down('ControlLeft'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => window.__HC.G.me.crouch), 'Ctrl 蹲下'); await page.keyboard.up('ControlLeft'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => !window.__HC.G.me.crouch), '放開 Ctrl 起身');
  await page.evaluate(() => { const m = window.__HC.G.me; m.x = 0; m.z = 44; m.y = 0; });
  await page.waitForTimeout(200);
  await page.keyboard.down('Space'); await page.waitForTimeout(250);
  const jy = await page.evaluate(() => window.__HC.G.me.y); await page.keyboard.up('Space');
  ok(jy > 0.2, '空白鍵跳躍（高度 ' + jy.toFixed(2) + 'm）');
  // --- 三條命用完（單人：全員淘汰 → 結算）---
  await page.evaluate(() => { const G = window.__HC.G, sim = G.sim, p = sim.players.get('h'); p.lives = 1; p.prot = 0; G.me.prot = 0; sim.mon.cool = 0; sim.mon.x = G.me.x + 0.5; sim.mon.y = G.me.y; sim.mon.z = G.me.z; sim.mon.path = null; });
  await page.waitForFunction(() => window.__HC.G.ended, null, { timeout: 15000 }).catch(() => {});
  const ended = await page.evaluate(() => window.__HC.G.ended);
  ok(ended, '單人且成為幽靈 → 全員淘汰，回合結束');
  await page.waitForFunction(() => !document.getElementById('result').classList.contains('hidden'), null, { timeout: 30000 }).catch(() => {});
  ok(/淘汰/.test(await page.textContent('#r-title')), '顯示結算：' + await page.textContent('#r-title'));
  await page.click('#r-home');
  ok(await page.evaluate(() => window.__HC.G.mode === 'menu'), '返回主畫面');
  // --- 重新開始 ---
  await page.click('#b-start'); await page.waitForFunction(() => window.__HC.G.mode === 'play', null, { timeout: 60000 });
  const oldCodes = await page.evaluate(() => { window.__oldSim = window.__HC.G.sim; return JSON.stringify(window.__HC.G.codes); });
  await page.keyboard.press('Escape'); await page.click('#p-restart');
  await page.waitForFunction(() => window.__HC.G.mode === 'play' && window.__HC.G.sim && window.__HC.G.sim !== window.__oldSim && window.__HC.G.countdown > 0, null, { timeout: 30000 });
  const st2 = await page.evaluate(() => ({ lives: window.__HC.G.me.lives, items: window.__HC.G.me.items.length, notes: Object.keys(window.__HC.G.notes).length, tm: window.__HC.G.tm, codes: JSON.stringify(window.__HC.G.codes) }));
  ok(st2.lives === 3 && st2.items === 0 && st2.notes === 0 && st2.tm > 1190, '重新開始 → 狀態完整重置（命、物品、筆記、時間）');
  ok(st2.codes !== oldCodes, '重新開始 → 密碼位置重新隨機');
  const bad = errs.filter(e => !/favicon/.test(e));
  await ctx.close();

  // --- 手機版面 ---
  const mctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const mp = await mctx.newPage();
  mp.on('console', m => { if (m.type() === 'error') errs.push('M ' + m.text()); }); mp.on('pageerror', e => errs.push('M PAGEERROR: ' + e.message));
  await mp.goto(file);
  await mp.screenshot({ path: `${OUT}/u_mobile_menu.png` });
  await mp.tap('#b-start');
  await mp.waitForFunction(() => window.__HC.G.mode === 'play', null, { timeout: 60000 });
  await mp.evaluate(() => { const G = window.__HC.G; G.countdown = 0; G.simDelay = 0; G.sim.mon.cool = 1e9; });
  await mp.waitForTimeout(600);
  ok(await mp.evaluate(() => !document.getElementById('touch').classList.contains('hidden')), '手機：顯示觸控按鈕');
  ok(await mp.evaluate(() => window.__HC.Store.d.q === 'low'), '手機：預設畫質為「低」以維持流暢');
  await mp.screenshot({ path: `${OUT}/u_mobile_play.png` });
  // 搖桿向前
  const jb = await mp.evaluate(() => { const r = document.getElementById('joy').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const z0 = await mp.evaluate(() => ({ x: window.__HC.G.me.x, z: window.__HC.G.me.z }));
  await mp.evaluate(() => { window.__HC.T.jx = 0; window.__HC.T.jy = 1; });
  await mp.waitForTimeout(800);
  await mp.evaluate(() => { window.__HC.T.jy = 0; });
  const z1 = await mp.evaluate(() => ({ x: window.__HC.G.me.x, z: window.__HC.G.me.z }));
  ok(Math.hypot(z1.x - z0.x, z1.z - z0.z) > 1.0, '手機：搖桿輸入可移動角色');
  await mp.tap('#tb-crouch'); await mp.waitForTimeout(300);
  ok(await mp.evaluate(() => window.__HC.G.me.crouch), '手機：蹲下按鈕');
  await mp.tap('#tb-crouch');
  await mp.tap('#tb-menu'); ok(await mp.evaluate(() => window.__HC.G.menuOpen), '手機：選單按鈕');
  await mp.screenshot({ path: `${OUT}/u_mobile_pause.png` });
  await mctx.close();
  console.log('ERRORS:', errs.filter(e => !/favicon/.test(e)).length ? errs.filter(e => !/favicon/.test(e)).slice(0, 8).join('\n') : 'none');
  console.log(fails ? `失敗 ${fails} 項` : 'UI 測試全部通過');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('UI FAIL', e); process.exit(2); });
