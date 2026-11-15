// 建置：把 src/*.js 與 PeerJS 內嵌成單一 index.html
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const src = path.join(root, 'src');
const files = fs.readdirSync(src).filter(f => /^\d+_.*\.js$/.test(f)).sort();
// 注意：每個檔案開頭的 'use strict' 只需保留第一個
let app = files.map((f, i) => {
  let t = fs.readFileSync(path.join(src, f), 'utf8');
  if (i > 0) t = t.replace(/^'use strict';\s*/, '');
  return `/* ---- ${f} ---- */\n` + t;
}).join('\n');
const peer = fs.readFileSync(path.join(root, 'vendor', 'peerjs.min.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
app = app.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(src, 'template.html'), 'utf8');
html = html.replace('/*__PEERJS__*/', () => '/* PeerJS 1.5.5 (MIT) https://peerjs.com */\n' + peer).replace('/*__APP__*/', () => app);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' KB');
