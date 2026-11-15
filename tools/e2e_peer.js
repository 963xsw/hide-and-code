'use strict';
// 檢查真實 PeerJS 連線：兩個獨立瀏覽器環境，用房間代碼經 PeerJS 雲端媒合後建立 WebRTC 連線
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const srv = http.createServer((req, res) => {
  const f = path.join(root, 'index.html');
  fs.readFile(f, (e, d) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d); });
});
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
  const c1 = await browser.newContext(), c2 = await browser.newContext();
  const A = await c1.newPage(), B = await c2.newPage();
  const log = [];
  for (const [n, p] of [['A', A], ['B', B]]) { p.on('console', m => log.push(n + ' ' + m.type() + ': ' + m.text())); p.on('pageerror', e => log.push(n + ' PAGEERROR ' + e.message)); }
  await A.goto(url); await B.goto(url);
  await A.click('#b-create');
  const res = await A.waitForFunction(() => window.__HC.G.mode === 'lobby' || document.getElementById('m-err').textContent, null, { timeout: 25000 }).then(() => A.evaluate(() => ({ mode: window.__HC.G.mode, err: document.getElementById('m-err').textContent, code: document.getElementById('l-code').textContent }))).catch(e => ({ timeout: true }));
  console.log('建立房間結果:', JSON.stringify(res));
  if (res.mode === 'lobby') {
    await B.click('#b-join'); await B.fill('#j-code', res.code); await B.click('#j-go');
    const r2 = await B.waitForFunction(() => window.__HC.G.mode === 'lobby' || document.getElementById('j-err').textContent, null, { timeout: 30000 }).then(() => B.evaluate(() => ({ mode: window.__HC.G.mode, err: document.getElementById('j-err').textContent }))).catch(() => ({ timeout: true }));
    console.log('加入房間結果:', JSON.stringify(r2));
  }
  console.log(log.filter(l => /peer|Peer|error|ERR/i.test(l)).slice(0, 8).join('\n'));
  await browser.close(); srv.close();
})().catch(e => { console.error('PEER TEST FAIL', e); srv.close(); process.exit(2); });
