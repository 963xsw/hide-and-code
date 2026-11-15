const { loadCore } = require('./load');
const A = loadCore(['01_util.js','02_world.js','03_gen.js','04_maps.js']);
const mi = +(process.env.MAP||2);
const b = A.MAP_DEFS[mi].build(); const w = new A.World(b); const nav = new A.Nav(w);
const ids = {}; let nid = 0; const sym = c => (ids[c] === undefined ? (ids[c] = 'abcdefghijklmnopqrstuvwxyz0123456789'[nid++ % 36]) : ids[c]);
const bd = b.bounds;
for (let z = bd.z0 + 1; z < bd.z1; z += 2) { let line = ''; for (let x = bd.x0 + 1; x < bd.x1; x += 1.5) { const i = nav.nearest(x, 0, z, 1); line += (i < 0 || Math.hypot(nav.nx[i]-x, nav.nz[i]-z) > 0.8) ? '#' : (nav.comp[i] === nav.main ? '.' : sym(nav.comp[i])); } console.log(line); }
console.log('--- probes (x,z -> comp, main?) ---');
for (const [x,z] of [[0,25],[0,22],[0,19],[0,18],[0,16.5],[0,15],[10,16],[-10,16],[10,12],[0,-14],[12,0]]) { const i = nav.nearest(x,0,z,2); console.log(x,z,'->', i<0?'none':nav.comp[i]+(nav.comp[i]===nav.main?' (main)':''), i>=0?[nav.nx[i],nav.nz[i]].map(v=>+v.toFixed(2)).join(','):''); }
w.query(-5,0,15.5,5,3,20.5,o=>{ console.log('box near gate', [o.x0,o.y0,o.z0,o.x1,o.y1,o.z1].map(v=>+v.toFixed(2)).join(',')); });
console.log('--- boxes in x[0,10] z[14.5,17.6], y[0,2] ---');
w.query(0,0.45,14.5,10,1.7,17.6,o=>{ console.log([o.x0,o.y0,o.z0,o.x1,o.y1,o.z1].map(v=>+v.toFixed(2)).join(',')); });
for (let x=0.25;x<10;x+=0.5){ const i=nav.nearest(x,0,16.25,0); const j=nav.nearest(x,0,16.25,1); console.log('x',x,'node?',i,'comp',i>=0?nav.comp[i]:'-'); }
