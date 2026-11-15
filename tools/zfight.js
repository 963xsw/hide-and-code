// 掃描靜態方塊：找「同一平面、同方向、面積重疊、但顏色不同」的面（會造成閃爍穿模）
const { loadCore } = require('./load');
const A = loadCore(['01_util.js','02_world.js','03_gen.js','04_maps.js']);
const EPS = 1e-3;
for (const def of A.MAP_DEFS) {
  const b = def.build(); const bx = b.boxes.filter(o => !o.novis);
  // 每個方塊的 6 個面：axis(0/1/2), side(+1/-1), plane 位置, 另外兩軸的範圍
  const faces = {};
  const key = (ax, sd, p) => ax + '|' + sd + '|' + Math.round(p / EPS);
  bx.forEach((o, i) => {
    const lo = [o.x0, o.y0, o.z0], hi = [o.x1, o.y1, o.z1];
    for (let ax = 0; ax < 3; ax++) for (const sd of [1, -1]) {
      if (ax === 1 && sd === -1) continue;   // 朝下的面只有從下方才看得到（地板上的裝飾不會）
      const p = sd > 0 ? hi[ax] : lo[ax]; const o1 = (ax + 1) % 3, o2 = (ax + 2) % 3;
      const k = key(ax, sd, p); (faces[k] = faces[k] || []).push({ i, a0: lo[o1], a1: hi[o1], b0: lo[o2], b1: hi[o2], col: o.col, em: o.emit });
    }
  });
  const inside = (x, y, z, skip1, skip2) => { for (let n = 0; n < bx.length; n++) { if (n === skip1 || n === skip2) continue; const o = bx[n]; if (x > o.x0 + 1e-4 && x < o.x1 - 1e-4 && y > o.y0 + 1e-4 && y < o.y1 - 1e-4 && z > o.z0 + 1e-4 && z < o.z1 - 1e-4) return true; } return false; };
  let bad = 0, total = 0; const ex = []; const sig = {};
  for (const k in faces) {
    const L = faces[k]; if (L.length < 2) continue;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const p = L[i], q = L[j];
      const ow = Math.min(p.a1, q.a1) - Math.max(p.a0, q.a0), oh = Math.min(p.b1, q.b1) - Math.max(p.b0, q.b0);
      if (ow > 0.02 && oh > 0.02) {
        // 取重疊區中心、往外 2mm 的點；若落在別的方塊內 → 被遮住，不會看到
        const ax = +k.split('|')[0], sd = +k.split('|')[1], pl = +k.split('|')[2] * EPS, o1 = (ax + 1) % 3, o2 = (ax + 2) % 3;
        const pt = [0, 0, 0]; pt[ax] = pl + sd * 0.002; pt[o1] = (Math.max(p.a0, q.a0) + Math.min(p.a1, q.a1)) / 2; pt[o2] = (Math.max(p.b0, q.b0) + Math.min(p.b1, q.b1)) / 2;
        if (inside(pt[0], pt[1], pt[2], p.i, q.i)) continue;
        total++;
        const dc = Math.abs(p.col[0] - q.col[0]) + Math.abs(p.col[1] - q.col[1]) + Math.abs(p.col[2] - q.col[2]);
        if (dc > 0.004 || Math.abs(p.em - q.em) > 0.001) { bad++; { const sg = i2 => { const o = bx[i2]; return [o.x1 - o.x0, o.y1 - o.y0, o.z1 - o.z0].map(v => +v.toFixed(2)).sort((a, b) => a - b).join('x'); }; const kk = [sg(p.i), sg(q.i)].sort().join(' | '); sig[kk] = (sig[kk] || 0) + 1; } if (process.env.DETAIL && ex.length < 10 && ow*oh>0.05) { const f=i=>{const o=bx[i];return '['+[o.x0,o.y0,o.z0,o.x1,o.y1,o.z1].map(v=>+v.toFixed(2)).join(',')+']'+(o.solid?'S':'d')}; ex.push(k+' area='+(ow*oh).toFixed(2)+' '+f(p.i)+' vs '+f(q.i)); } else if (ex.length<1) ex.push(k); }
      }
    }
  }
  if (process.env.SIG) console.log(Object.entries(sig).sort((a, b) => b[1] - a[1]).slice(0, 14).map(e => '   ' + e[1] + '  ' + e[0]).join('\n'));
  console.log(def.id, '共平面重疊面', total, '其中顏色不同(會閃爍)', bad, ex.join(' ; '));
}
