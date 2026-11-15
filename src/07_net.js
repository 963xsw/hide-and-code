'use strict';
/* ===== 網路層：PeerJS（P2P，正式使用）與 BroadcastChannel（同瀏覽器分頁，供測試／同裝置） ===== */
const ROOM_PREFIX = 'hidecode-v1-';
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genRoomCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  return s;
}
function normalizeCode(s) { return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1'); }

/* 統一介面：
   host: new HostNet(mode).open(code, {onReady(code), onJoin(id), onData(id,msg), onLeave(id), onError(err)})
   client: new ClientNet(mode).connect(code, {onOpen(), onData(msg), onClose(), onError(err)}) */
class HostNet {
  constructor(mode) { this.mode = mode; this.conns = new Map(); this.closed = false; }
  open(code, cb) {
    this.cb = cb; this.code = code;
    if (this.mode === 'bc') return this.openBC(code);
    const opts = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };
    const peer = new Peer(ROOM_PREFIX + code, opts);
    this.peer = peer;
    peer.on('open', () => cb.onReady && cb.onReady(code));
    peer.on('error', e => {
      if (e.type === 'unavailable-id') { cb.onError && cb.onError({ type: 'taken' }); }
      else cb.onError && cb.onError(e);
    });
    peer.on('connection', conn => {
      const id = conn.peer;
      conn.on('open', () => { this.conns.set(id, conn); cb.onJoin && cb.onJoin(id); });
      conn.on('data', d => cb.onData && cb.onData(id, d));
      conn.on('close', () => { if (this.conns.delete(id)) cb.onLeave && cb.onLeave(id); });
      conn.on('error', () => { if (this.conns.delete(id)) cb.onLeave && cb.onLeave(id); });
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
  }
  openBC(code) {
    const ch = new BroadcastChannel('hc-' + code);
    this.ch = ch;
    this.hostAlive = true;
    ch.onmessage = ev => {
      const m = ev.data;
      if (!m || m.to !== 'H') return;
      if (m.hello) { this.conns.set(m.from, true); ch.postMessage({ to: m.from, from: 'H', d: { t: 'ack' } }); this.cb.onJoin && this.cb.onJoin(m.from); }
      else if (m.bye) { if (this.conns.delete(m.from)) this.cb.onLeave && this.cb.onLeave(m.from); }
      else this.cb.onData && this.cb.onData(m.from, m.d);
    };
    setTimeout(() => this.cb.onReady && this.cb.onReady(code), 10);
  }
  send(id, msg) {
    if (this.mode === 'bc') { this.ch.postMessage({ to: id, from: 'H', d: msg }); return; }
    const c = this.conns.get(id); if (c && c.open) c.send(msg);
  }
  broadcast(msg) { for (const id of this.conns.keys()) this.send(id, msg); }
  kick(id) {
    if (this.mode === 'bc') { this.ch.postMessage({ to: id, from: 'H', kick: true }); this.conns.delete(id); return; }
    const c = this.conns.get(id); if (c) { c.close(); this.conns.delete(id); }
  }
  close() {
    this.closed = true;
    if (this.mode === 'bc') { try { this.ch.postMessage({ to: '*', from: 'H', hostGone: true }); this.ch.close(); } catch (e) { /* ignore */ } return; }
    try { this.peer.destroy(); } catch (e) { /* ignore */ }
  }
}

class ClientNet {
  constructor(mode) { this.mode = mode; this.open_ = false; }
  connect(code, cb) {
    this.cb = cb; this.code = code;
    if (this.mode === 'bc') return this.connectBC(code);
    const opts = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };
    const peer = new Peer(undefined, opts);
    this.peer = peer;
    let done = false;
    const fail = e => { if (!done) { done = true; cb.onError && cb.onError(e); } };
    peer.on('error', e => fail(e));
    peer.on('open', () => {
      const conn = peer.connect(ROOM_PREFIX + code, { reliable: true });
      this.conn = conn;
      const to = setTimeout(() => fail({ type: 'timeout' }), 12000);
      conn.on('open', () => { clearTimeout(to); done = true; this.open_ = true; cb.onOpen && cb.onOpen(); });
      conn.on('data', d => cb.onData && cb.onData(d));
      conn.on('close', () => { this.open_ = false; cb.onClose && cb.onClose(); });
      conn.on('error', e => fail(e));
    });
  }
  connectBC(code) {
    const id = 'c' + Math.random().toString(36).slice(2, 8);
    this.id = id;
    const ch = new BroadcastChannel('hc-' + code);
    this.ch = ch;
    let got = false;
    ch.onmessage = ev => {
      const m = ev.data;
      if (!m || (m.to !== id && m.to !== '*')) return;
      if (m.hostGone) { this.open_ = false; this.cb.onClose && this.cb.onClose(); return; }
      if (m.kick) { this.open_ = false; this.cb.onClose && this.cb.onClose(); return; }
      if (!got) { got = true; this.open_ = true; this.cb.onOpen && this.cb.onOpen(); }
      this.cb.onData && this.cb.onData(m.d);
    };
    ch.postMessage({ to: 'H', from: id, hello: true });
    setTimeout(() => { if (!got) this.cb.onError && this.cb.onError({ type: 'peer-unavailable' }); }, 2500);
  }
  send(msg) {
    if (this.mode === 'bc') { this.ch.postMessage({ to: 'H', from: this.id, d: msg }); return; }
    if (this.conn && this.conn.open) this.conn.send(msg);
  }
  close() {
    if (this.mode === 'bc') { try { this.ch.postMessage({ to: 'H', from: this.id, bye: true }); this.ch.close(); } catch (e) { /* ignore */ } return; }
    try { this.peer.destroy(); } catch (e) { /* ignore */ }
  }
}
