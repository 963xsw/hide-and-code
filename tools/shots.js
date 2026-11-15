'use strict';
// 截圖：密碼告示牌與各種藏匿點的外觀
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT; const map = +(process.env.MAP || 0);
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.evaluate(m => { window.__HC.Store.d.map = m; }, map);
  await page.click('#b-start'); await page.waitForFunction(() => window.__HC.G.mode === 'play', null, { timeout: 60000 });
  await page.evaluate(() => { const G = window.__HC.G; G.countdown = 0; G.simDelay = 1e9; G.sim.mon.cool = 1e9; document.getElementById('keyhint').classList.add('hidden');
    window.look = (px, py, pz, tx, ty, tz, yawOff = 0) => { const m = G.me; m.x = px; m.y = py; m.z = pz; m.vy = 0; const e = py + 1.55, dx = tx - px, dz = tz - pz; m.yaw = Math.atan2(-dx, -dz); m.pitch = Math.atan2(ty - e, Math.hypot(dx, dz)); };
    window.nodeNear = (x, y, z, r) => { const nav = G.sim.nav; for (let q = r; q < r + 3; q += 0.3) for (let a = 0; a < 16; a++) { const i = nav.nearest(x + Math.cos(a * Math.PI / 8) * q, y, z + Math.sin(a * Math.PI / 8) * q, 1); if (i >= 0 && nav.inMain(i) && Math.abs(nav.ny[i] - y) < 2.7) return [nav.nx[i], nav.ny[i], nav.nz[i]]; } return null; }; });
  // 1) 每個密碼告示牌（四色）
  for (let c = 0; c < 4; c++) {
    const ok = await page.evaluate(c => { const G = window.__HC.G, v = G.codeViews[c]; const m = G.me; const d = 2.4; const px = v.px + Math.sin(v.yaw) * d, pz = v.pz + Math.cos(v.yaw) * d; const nav = G.sim.nav; const i = nav.nearest(px, v.fy, pz, 3); if (i < 0) return false; m.x = nav.nx[i]; m.y = nav.ny[i]; m.z = nav.nz[i]; m.vy = 0; const e = m.y + 1.55, dx = v.px - m.x, dz = v.pz - m.z; m.yaw = Math.atan2(-dx, -dz); m.pitch = Math.atan2(v.y - e, Math.hypot(dx, dz)); return true; }, c);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/s${map}_code${c}.png` });
  }
  // 2) 藏匿點外觀
  const hides = await page.evaluate(() => { const b = window.__HC.G.bundle.b, seen = {}; const out = []; b.spots.hide.forEach((h, i) => { if (!seen[h.kind]) { seen[h.kind] = 1; out.push({ i, k: h.kind, x: h.x, y: h.y, z: h.z, ex: h.ex, ez: h.ez }); } }); return out; });
  for (const h of hides) {
    await page.evaluate(h => {
      const G = window.__HC.G, m = G.me, nav = G.sim.nav;
      const dx = h.ex - h.x, dz = h.ez - h.z, d = Math.hypot(dx, dz) || 1;
      const tx = h.ex + dx / d * 1.0, tz = h.ez + dz / d * 1.0;
      let i = nav.nearest(tx, h.y, tz, 2); if (i < 0) i = nav.nearest(h.ex, h.y, h.ez, 3);
      m.x = nav.nx[i]; m.y = nav.ny[i]; m.z = nav.nz[i]; m.vy = 0;
      const e = m.y + 1.55, ty = h.y + (h.k === 'wardrobe' || h.k === 'tank' ? 1.2 : 0.6), ddx = h.x - m.x, ddz = h.z - m.z;
      m.yaw = Math.atan2(-ddx, -ddz); m.pitch = Math.atan2(ty - e, Math.hypot(ddx, ddz));
    }, h);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/s${map}_hide_${h.k}.png` });
  }
  console.log('hide kinds:', hides.map(h => h.k).join(','), '| errors:', errs.length ? errs.slice(0, 4).join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('SHOTS FAIL', e); process.exit(1); });
