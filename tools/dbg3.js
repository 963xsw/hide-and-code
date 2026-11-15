const { loadCore } = require('./load');
const A = loadCore(['01_util.js','02_world.js','03_gen.js','04_maps.js']);
const b = A.MAP_DEFS[2].build(); const w = new A.World(b); const nav = new A.Nav(w);
const pb = b.portals[0].b; console.log('portal B', pb);
const i = nav.nearest(pb[0], pb[1], pb[2], 4); console.log('nearest node', i, i>=0&&[nav.nx[i],nav.ny[i],nav.nz[i],nav.comp[i],nav.main].join(' '));
// 列出迷宮範圍內被擋住的格子與附近盒子
const bx=[]; w.query(pb[0]-3,0,pb[2]-3,pb[0]+3,3,pb[2]+3,o=>{bx.push([o.x0,o.y0,o.z0,o.x1,o.y1,o.z1].map(v=>+v.toFixed(2)).join(','))}); console.log('boxes near B:', bx.length); bx.slice(0,12).forEach(s=>console.log('  ',s));
// 迷宮入口附近的節點所屬元件
for (const p of [[5.5,0,18],[12,0,7],[6,0,18],[16,0,9]]) { const j=nav.nearest(p[0],p[1],p[2],3); console.log('probe',p.join(','),'->',j,j>=0?nav.comp[j]:'-'); }
console.log('--- maze cell components (rows z, cols x) ---');
for (let r=0;r<6;r++){ let line=''; for(let c=0;c<6;c++){ const x=6+(c+0.5)*4, z=8+(r+0.5)*4; const j=nav.nearest(x,0,z,2); line += (j>=0? String(nav.comp[j]).padStart(4):'  --'); } console.log(line); }
// 與迷宮重疊的非牆物件
const seen=new Set(); w.query(6,0,8,30,3,32,o=>{ const wd=Math.min(o.x1-o.x0,o.z1-o.z0); if(wd>0.85 || (o.y1-o.y0)<2.9) console.log('  non-wall:',[o.x0,o.y0,o.z0,o.x1,o.y1,o.z1].map(v=>+v.toFixed(2)).join(',')) });
