'use strict';
// 在 Node 中載入純邏輯模組（無 DOM），供測試使用
const fs = require('fs'), path = require('path'), vm = require('vm');
function loadCore(files) {
  const dir = path.join(__dirname, '..', 'src');
  let code = '';
  for (const f of files) code += fs.readFileSync(path.join(dir, f), 'utf8') + '\n';
  code += '\n;globalThis.__api = { ' + 'Builder, World, Nav, MAP_DEFS, mulberry32, PR, STEP, GRAV, NAVC, shuffle, rpick, hashStr, angDiff, clamp, lerp, TAU, dist2, fwdVec };';
  const ctx = { console, Math, Float32Array, Int32Array, Map, Set, Array, Object, JSON, performance: { now: () => Date.now() } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'core.js' });
  return ctx.__api;
}
module.exports = { loadCore };
