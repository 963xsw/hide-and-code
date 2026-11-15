const fs=require('fs'),path=require('path'),vm=require('vm');
const dir=path.join(__dirname,'..','src');
let code=['01_util.js','02_world.js','03_gen.js','04_maps.js','08_sim.js'].map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
code+='\n;globalThis.__api={getBundle,MAP_DEFS};';
const ctx={console,Math,Float32Array,Int32Array,Map,Set,Array,Object,JSON,performance};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
const A=ctx.__api;
for(let i=0;i<3;i++){const c=A.getBundle(i,true);const hints={};c.valid.code.forEach(k=>{const h=c.b.spots.code[k].hint;hints[h]=(hints[h]||0)+1});
 console.log(A.MAP_DEFS[i].name,'可用密碼點',c.valid.code.length,'/',c.b.spots.code.length,JSON.stringify(hints));}
