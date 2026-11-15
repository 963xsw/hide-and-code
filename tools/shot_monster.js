'use strict';
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT;
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.evaluate(() => { window.__HC.Store.d.map = 0; });
  await page.click('#b-start'); await page.waitForFunction(() => window.__HC.G.mode === 'play', null, { timeout: 60000 });
  await page.evaluate(() => { const G = window.__HC.G; G.countdown = 0; G.simDelay = 1e9; G.sim.mon.cool = 1e9; document.getElementById('keyhint').classList.add('hidden'); });
  const shots = [['patrol', 4.2, 0], ['chase', 3.6, 2], ['far', 9, 1]];
  for (const [name, d, st] of shots) {
    await page.evaluate(([d, st]) => {
      const G = window.__HC.G, nav = G.sim.nav; const i = nav.nearest(0, 0, 26, 3);
      const px = nav.nx[i], pz = nav.nz[i];
      G.me.x = px; G.me.y = 0; G.me.z = pz; G.me.yaw = Math.PI; G.me.pitch = 0.05; // 面向 +Z（正南）
      const mo = G.mon; mo.init = true; mo.x = mo.tx = px; mo.z = mo.tz = pz + d; mo.y = mo.ty = 0; mo.yaw = mo.tyaw = 0; mo.st = st; mo.target = st === 2 ? G.myId : ''; mo.phase = 1.2;
    }, [d, st]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/mon_${name}.png` });
  }
  console.log('errors:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
