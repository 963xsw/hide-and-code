'use strict';
// 視覺巡覽：傳送到各視點截圖（檢查建模、光線、比例）
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/314c8df9-9874-5fa8-bc96-0d4b45210a6f/scratchpad';
const VIEWS = {
  0: [['front', -7.5, 0, -11.5, 0, 0.22], ['hall', -7.5, 0, -16, 0, 0.0], ['room', 1, 0, -24.5, 0, 0.0], ['corridor', -1, 0, -21, -Math.PI / 2, 0], ['maze', 0, 0, 9, 0, 0.0], ['grave', -12, 0, 0, Math.PI / 2, 0.0], ['forest', 22, 0, 18, 2.2, 0.0]],
  1: [['street', 0, 0, 18, 0, 0.12], ['cross', 0, 0, 12, 0, 0.18], ['tower', -14, 0, -9, 0, 0.3], ['bridge', -5, 6.4, -20, -Math.PI / 2, 0], ['plaza', -12, 0, 9.5, Math.PI / 2, 0.15], ['hall', -23.5, 0, 17, 0, 0]],
  2: [['gate', 0, 0, 26, 0, 0.15], ['court', 0, 0, -14.5, Math.PI, 0.15], ['keep', -4, 0, 8, 0, 0.0], ['dungeon', 0, 0, 4, 0, 0], ['wallwalk', 0, 6.4, -18.8, -Math.PI / 2, 0], ['hall', -3.5, 0, -4, 0, 0]],
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
