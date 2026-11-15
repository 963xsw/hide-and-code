'use strict';
// 視覺巡覽：傳送到各視點截圖（檢查建模、光線、比例）
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/314c8df9-9874-5fa8-bc96-0d4b45210a6f/scratchpad';
const VIEWS = {
  0: [['front', -9.5, 0, -15.5, 0, 0.2], ['hall', -9.5, 0, -22, 0, 0.0], ['room', -1.5, 0, -27.5, 0, 0.05], ['corridor', -3, 0, -25, -Math.PI / 2, 0], ['maze', 0, 0, 6, 0, 0.0], ['grave', -26, 0, 12, Math.PI / 2 * 3, 0.0], ['forest', 26, 0, 24, 2.2, 0.0]],
  1: [['street', 0, 0, 16, 0, 0.1], ['tower', -20, 0, -14, 0, 0.25], ['bridge', -6, 6.4, -27, -Math.PI / 2, 0], ['roof', -19, 12.8, -24, 0, -0.2], ['container', -22, 0, -6, Math.PI / 2, 0.1], ['hall', -29.5, 0, 20, 0, 0]],
  2: [['gate', 0, 0, 30, 0, 0.15], ['court', 0, 0, -17, Math.PI, 0.15], ['keep', -2, 0, 6, 0, 0.0], ['dungeon', -13, 0, 14, -Math.PI / 2, 0], ['wallwalk', 0, 6.4, -22.8, -Math.PI / 2, 0], ['hall', -6.5, 0, -5, 0, 0]],
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
