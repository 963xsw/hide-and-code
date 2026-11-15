'use strict';
/* ===== Web Audio 合成音效（不使用外部素材） ===== */
const Sfx = (() => {
  let ctx = null, master = null, vol = 0.7, ambGain = null, ambNodes = [], hbTimer = 0, noiseBuf = null;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
    const len = ctx.sampleRate * 1;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function setVolume(v) { vol = v; if (master) master.gain.value = v; }
  function tone(freq, dur, type = 'sine', g = 0.2, when = 0, slide = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, g = 0.2, f = 800, q = 1, when = 0, type = 'lowpass') {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const gn = ctx.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(gn); gn.connect(master); s.start(t, Math.random() * 0.5, dur + 0.05);
  }
  const api = {
    init, setVolume,
    step(run) { noise(0.07, run ? 0.16 : 0.09, run ? 700 : 450, 0.7); },
    land() { noise(0.12, 0.2, 350, 0.7); tone(70, 0.1, 'sine', 0.12); },
    pickup() { tone(660, 0.09, 'triangle', 0.16); tone(990, 0.12, 'triangle', 0.14, 0.07); },
    unlock() { tone(523, 0.12, 'square', 0.1); tone(659, 0.12, 'square', 0.1, 0.1); tone(784, 0.25, 'square', 0.1, 0.2); },
    wrong() { tone(140, 0.35, 'sawtooth', 0.2, 0, -60); noise(0.2, 0.12, 300, 1); },
    portal() { tone(300, 0.5, 'sine', 0.16, 0, 700); noise(0.4, 0.07, 1500, 2, 0, 'bandpass'); },
    alert() { tone(880, 0.15, 'sawtooth', 0.16); tone(660, 0.25, 'sawtooth', 0.16, 0.12); },
    caught() { noise(0.5, 0.35, 220, 1); tone(90, 0.7, 'sawtooth', 0.25, 0, -60); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.2, i * 0.14)); tone(1047, 0.7, 'triangle', 0.18, 0.6); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.14, i * 0.22)); },
    click() { tone(520, 0.05, 'square', 0.07); },
    place() { tone(440, 0.1, 'triangle', 0.18); tone(880, 0.3, 'sine', 0.2, 0.08); },
    hide() { noise(0.15, 0.1, 500, 1); },
    chat() { tone(740, 0.06, 'sine', 0.08); },
    heartbeat(intensity) {
      if (!ctx) return;
      const t = performance.now();
      const gap = 1000 - intensity * 620;
      if (t - hbTimer < gap) return;
      hbTimer = t; tone(58, 0.14, 'sine', 0.25 * intensity + 0.05); tone(52, 0.16, 'sine', 0.2 * intensity + 0.04, 0.17);
    },
    ambient(kind) {
      if (!ctx) return;
      api.stopAmbient();
      ambGain = ctx.createGain(); ambGain.gain.value = 0.0001; ambGain.connect(master);
      ambGain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 2);
      const base = kind === 'city' ? 55 : kind === 'castle' ? 43 : 49;
      [1, 1.5, 2.01].forEach((m, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = base * m;
        g.gain.value = 0.05 / (i + 1);
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07 + i * 0.05; lg.gain.value = 0.02;
        lfo.connect(lg); lg.connect(g.gain); lfo.start();
        o.connect(g); g.connect(ambGain); o.start(); ambNodes.push(o, lfo);
      });
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'city' ? 380 : 260;
      const g = ctx.createGain(); g.gain.value = 0.03;
      s.connect(f); f.connect(g); g.connect(ambGain); s.start(); ambNodes.push(s);
    },
    stopAmbient() {
      ambNodes.forEach(n => { try { n.stop(); } catch (e) { /* ignore */ } });
      ambNodes = [];
      if (ambGain) { try { ambGain.disconnect(); } catch (e) { /* ignore */ } ambGain = null; }
    },
  };
  return api;
})();
