const { loadCore } = require('./load');
const A = loadCore(['01_util.js','02_world.js','03_gen.js','04_maps.js']);
const b = A.MAP_DEFS[0].build(); const w = new A.World(b); const nav = new A.Nav(w);
const pts=[[-13,0,-16],[-13,0,-17.5],[-13,0,-18],[-13,0,-18.5],[-13,0,-20],[-13,0,-26]];
for(const p of pts){const i=nav.nearest(p[0],p[1],p[2],2); console.log(p.join(','), i, i>=0?[nav.nx[i],nav.ny[i],nav.nz[i],nav.comp[i]].join(' '):'none');}
// boxes near door
w.query(-14.5,0,-18.6,-11.5,3,-17.4,bx=>{console.log('box',bx.x0.toFixed(2),bx.y0.toFixed(2),bx.z0.toFixed(2),bx.x1.toFixed(2),bx.y1.toFixed(2),bx.z1.toFixed(2));});
