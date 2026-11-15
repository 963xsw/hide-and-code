'use strict';
const { chromium } = require('playwright');
const files = { 舊版: process.env.OLD, 新版: require('path').resolve(__dirname, '..', 'index.html') };
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
  for (const map of [0, 1, 2]) for (const [name, f] of Object.entries(files)) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.goto('file://' + f);
    await page.evaluate(m => { window.__HC.Store.d.map = m; window.__HC.Store.d.q = 'mid'; }, map);
    await page.click('#b-start'); await page.waitForFunction(() => window.__HC.G.mode === 'play', null, { timeout: 60000 });
    await page.evaluate(() => { const G = window.__HC.G; G.countdown = 0; G.simDelay = 1e9; G.sim.mon.cool = 1e9; });
    const out = [];
    for (const v of [[0, 0, 0.0], [Math.PI / 2, 0, 0.0], [Math.PI, 0, 0.0]]) {
      await page.evaluate(([yaw]) => { const m = window.__HC.G.me; const nav = window.__HC.G.sim.nav; const i = nav.nearest(0, 0, 8, 6); m.x = nav.nx[i]; m.y = nav.ny[i]; m.z = nav.nz[i]; m.yaw = yaw; m.pitch = 0; }, v);
      await page.waitForTimeout(600);
      const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2500) res(n / ((performance.now() - t0) / 1000)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
      out.push(fps.toFixed(0));
    }
    const st = await page.evaluate(() => ({ chunks: window.__HC.G.chunks ? window.__HC.G.chunks.length : 0, verts: window.__HC.G.chunks ? window.__HC.G.chunks.reduce((s, c) => s + c.mesh.count, 0) : 0 }));
    console.log(['廢棄莊園', '廢棄都市', '廢棄城堡'][map], name, 'FPS(三個方向)', out.join('/'), '| 區塊', st.chunks, '總頂點', (st.verts / 1000).toFixed(0) + 'k');
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
