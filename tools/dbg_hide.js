const { chromium } = require('playwright'); const path=require('path');
(async()=>{
 const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-gl=angle'] });
 const page = await browser.newPage({viewport:{width:900,height:500}});
 await page.goto('file://'+path.resolve(__dirname,'..','index.html'));
 await page.evaluate(()=>{window.__HC.Store.d.map=2});
 for (let k=0;k<4;k++){
  await page.evaluate(()=>{ if(window.__HC.G.mode==='menu') return; });
  if(k===0) await page.click('#b-start'); else { await page.keyboard.press('Escape'); await page.click('#p-restart'); }
  await page.waitForTimeout(1500);
  await page.waitForFunction(()=>window.__HC.G.mode==='play'&&window.__HC.G.sim&&window.__HC.G.sim.t>=0,null,{timeout:60000});
  const r = await page.evaluate(()=>{
    const G=window.__HC.G; G.countdown=0; G.simDelay=0; G.sim.mon.cool=1e9;
    const b=G.bundle.b,sim=G.sim,nav=sim.nav,W=sim.world;
    const list=sim.bundle.valid.hide.map(i=>({i,h:b.spots.hide[i]})); const pick=list.find(o=>o.h.kind!=='bush');
    const h=pick.h; const me=G.me; const nn=nav.nearest(h.ex,h.y,h.ez,4); me.x=nav.nx[nn]; me.y=nav.ny[nn]; me.z=nav.nz[nn];
    const ty=h.y+(h.kind==='wardrobe'||h.kind==='tank'?1.0:0.6), dx=h.x-me.x,dz=h.z-me.z,dy=ty-(me.y+1.55);
    me.yaw=Math.atan2(-dx,-dz); me.pitch=Math.atan2(dy,Math.hypot(dx,dz));
    return {kind:h.kind, i:pick.i, spot:[h.x,h.y,h.z], ex:[h.ex,h.ez], me:[me.x,me.y,me.z], d:Math.hypot(dx,dy,dz)};
  });
  await page.waitForTimeout(400);
  const r2 = await page.evaluate(()=>{ const G=window.__HC.G; return {inter:G.inter, mode:G.mode, menu:G.menuOpen, st:G.me.st, codes:G.codes.map(c=>c.spot), locks:G.locks.map(c=>c.spot)};});
  console.log(JSON.stringify(r), JSON.stringify(r2));
 }
 await browser.close();
})();
