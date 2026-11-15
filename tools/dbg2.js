const { loadCore } = require('./load');
const A = loadCore(['01_util.js','02_world.js','03_gen.js','04_maps.js']);
for (const def of A.MAP_DEFS) {
const b = def.build(); const w = new A.World(b); const nav = new A.Nav(w);
const res={};
b.spots.hide.forEach(h=>{
  const i=nav.nearest(h.ex,h.y,h.ez,2);
  const ok = i>=0 && nav.inMain(i) && Math.hypot(nav.nx[i]-h.ex,nav.nz[i]-h.ez)<0.8 && Math.abs(nav.ny[i]-h.y)<0.8;
  res[h.kind]=res[h.kind]||[0,0]; res[h.kind][1]++; if(ok)res[h.kind][0]++;
});
console.log(def.id, JSON.stringify(res));
}
