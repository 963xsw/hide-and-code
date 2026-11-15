'use strict';
// 視覺巡覽：傳送到各視點截圖（檢查建模、光線、比例）
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/314c8df9-9874-5fa8-bc96-0d4b45210a6f/scratchpad';
const VIEWS = {
  0: [['front', -13, 0, -9, 0, 0.18], ['hall', -13, 0, -20, 0, 0.0], ['hall_up', -13, 3.2, -22, 0, 0.0], ['corridor', 0, 0, -26, Math.PI / 2 * 3, 0], ['room', 4, 0, -30, Math.PI, 0.05], ['maze', -2, 0, 16, 0, 0.0], ['forest', 30, 0, 10, 2.2, 0.0], ['grave', -36, 0, 10, 1.6, 0.0]],
  1: [['street', 0, 0, 14, 0, 0.1], ['tower', -23, 0, -20, 0, 0.1], ['bridge', -6, 6.4, -32, -Math.PI / 2, 0], ['roof', -20, 12.8, -32, 0, -0.2], ['container', -44, 0, -2, Math.PI / 2, 0.1], ['hall', -33, 0, -30, 0, 0]],
  2: [['gate', 0, 0, 44, 0, 0.1], ['court', 0, 0, 18, 0, 0.1], ['keep', -2, 0, 8, 0, 0.05], ['dungeon', 4, 0, 14, -Math.PI / 2, 0], ['wallwalk', 0, 6.4, -32, 0, 0], ['hall', -11, 0, -10, 0, 0]],
};
(async () => {
  const map = +(process.env.MAP || 0);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.evaluate(m => { window.__HC.Store.d.map = m; }, map);
  await page.click('#b-start');
  await page.waitForFunction(() => window.__HC.G.mode === 'play', null, { timeout: 60000 });
  await page.evaluate(() => { const G = window.__HC.G; G.countdown = 0; G.sim.mon.cool = 1e9; G.simDelay = 1e9; document.getElementById('keyhint').classList.add('hidden'); });
  for (const [name, x, y, z, yaw, pitch] of VIEWS[map]) {
    await page.evaluate(([x, y, z, yaw, pitch]) => { const m = window.__HC.G.me; m.x = x; m.y = y; m.z = z; m.yaw = yaw; m.pitch = pitch; m.vy = 0; }, [x, y, z, yaw, pitch]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/t${map}_${name}.png` });
  }
  console.log('ERRORS:', errs.length ? errs.slice(0, 8).join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('TOUR FAIL', e); process.exit(1); });
