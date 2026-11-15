'use strict';
/* ===== 原生 WebGL 低多邊形渲染器 ===== */
const STRIDE = 10; // pos3 nor3 col3 emit1

const FACES = [
  // nx,ny,nz, 四個角（相對於 min/max 的選擇：0=min,1=max）
  [1, 0, 0, [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]]],
  [-1, 0, 0, [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]]],
  [0, 1, 0, [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]]],
  [0, -1, 0, [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]]],
  [0, 0, 1, [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
  [0, 0, -1, [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
];
function pushBox(a, x0, y0, z0, x1, y1, z1, c, em, skipBottom) {
  const lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let f = 0; f < 6; f++) {
    const F = FACES[f];
    if (skipBottom && f === 3) continue;
    const v = F[3].map(q => [q[0] ? hi[0] : lo[0], q[1] ? hi[1] : lo[1], q[2] ? hi[2] : lo[2]]);
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      const p = v[idx];
      a.push(p[0], p[1], p[2], F[0], F[1], F[2], c[0], c[1], c[2], em);
    }
  }
}
function pushPyr(a, cx, y0, cz, w, d, h, c, em) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, ty = y0 + h;
  const tri = (p, q, r) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const s of [p, q, r]) a.push(s[0], s[1], s[2], nx, ny, nz, c[0], c[1], c[2], em);
  };
  const A = [x0, y0, z0], B = [x1, y0, z0], C = [x1, y0, z1], D = [x0, y0, z1], T = [cx, ty, cz];
  tri(A, B, T); tri(B, C, T); tri(C, D, T); tri(D, A, T);
}

function pushPyrInv(a, cx, ytop, cz, w, d, h, c, em) {   // 尖端朝下的四角錐
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, by = ytop - h;
  const tri = (p, q, r2) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r2[0] - p[0], vy = r2[1] - p[1], vz = r2[2] - p[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const s of [p, q, r2]) a.push(s[0], s[1], s[2], nx, ny, nz, c[0], c[1], c[2], em);
  };
  const A = [x0, ytop, z0], B = [x1, ytop, z0], C = [x1, ytop, z1], D = [x0, ytop, z1], T = [cx, by, cz];
  tri(B, A, T); tri(C, B, T); tri(D, C, T); tri(A, D, T);
}

const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol; attribute float aEm;
uniform mat4 uVP; uniform mat4 uM;
varying vec3 vPos; varying vec3 vNor; varying vec3 vCol; varying float vEm;
void main(){ vec4 wp=uM*vec4(aPos,1.0); vPos=wp.xyz; vNor=mat3(uM)*aNor; vCol=aCol; vEm=aEm; gl_Position=uVP*wp; }`;
const FS = `
precision mediump float;
varying vec3 vPos; varying vec3 vNor; varying vec3 vCol; varying float vEm;
uniform vec3 uCam; uniform vec3 uFwd; uniform float uAmb; uniform float uSun; uniform vec3 uSunDir;
uniform float uFlash; uniform vec2 uCone; uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
uniform float uAlpha; uniform vec3 uTint; uniform float uEmitAdd; uniform float uGray;
void main(){
  vec3 n=normalize(vNor);
  vec3 toP=vPos-uCam; float d=length(toP); vec3 L=toP/max(d,0.001);
  float hemi=0.55+0.45*n.y;
  float sun=max(dot(n,normalize(uSunDir)),0.0)*uSun;
  float cone=smoothstep(uCone.y,uCone.x,dot(L,uFwd));
  float att=1.0/(1.0+0.06*d+0.018*d*d);
  float nl=0.55+0.45*max(dot(n,-L),0.0);
  float fl=cone*att*uFlash*nl;
  float pl=0.55/(1.0+0.9*d*d);
  vec3 base=vCol*uTint;
  vec3 col=base*(vec3(uAmb)*hemi+vec3(sun)+vec3(fl)*vec3(1.0,0.93,0.78)+vec3(pl))+base*(vEm+uEmitAdd);
  float fog=clamp((d-uFogNear)/(uFogFar-uFogNear),0.0,1.0);
  col=mix(col,uFogCol,fog*fog*(3.0-2.0*fog));
  float g=dot(col,vec3(0.3,0.59,0.11));
  col=mix(col,vec3(g),uGray);
  gl_FragColor=vec4(col,uAlpha);
}`;

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'high-performance', alpha: false }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('此瀏覽器不支援 WebGL');
    this.gl = gl;
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    this.prog = p;
    this.loc = {};
    ['uVP', 'uM', 'uCam', 'uFwd', 'uAmb', 'uSun', 'uSunDir', 'uFlash', 'uCone', 'uFogCol', 'uFogNear', 'uFogFar', 'uAlpha', 'uTint', 'uEmitAdd', 'uGray']
      .forEach(n => { this.loc[n] = gl.getUniformLocation(p, n); });
    this.attr = { aPos: gl.getAttribLocation(p, 'aPos'), aNor: gl.getAttribLocation(p, 'aNor'), aCol: gl.getAttribLocation(p, 'aCol'), aEm: gl.getAttribLocation(p, 'aEm') };
    [this.attr.aPos, this.attr.aNor, this.attr.aCol, this.attr.aEm].forEach(a => gl.enableVertexAttribArray(a));
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.vp = M4.create(); this.proj = M4.create(); this.view = M4.create(); this.mM = M4.create();
    this.scale = 1; this.drawDist = 60;
    this.theme = { fog: [0.07, 0.09, 0.1], near: 8, far: 55, amb: 0.2, sun: 0.1, sunDir: [-0.4, 0.8, 0.3], flash: 1.0 };
    this.stats = { chunks: 0, dyn: 0 };
  }
  setScale(s) { this.scale = s; this.resize(); }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.scale;
    const w = Math.max(2, Math.floor(this.canvas.clientWidth * dpr)), h = Math.max(2, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.gl.viewport(0, 0, w, h);
  }
  makeMesh(arr) {
    const gl = this.gl, buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
    return { buf, count: arr.length / STRIDE };
  }
  freeMesh(m) { if (m && m.buf) this.gl.deleteBuffer(m.buf); }
  /* 靜態地圖分塊 */
  buildStatic(builder) {
    const CH = 12, map = new Map();
    const get = (x, z) => {
      const ix = Math.floor(x / CH), iz = Math.floor(z / CH), k = ix * 4096 + iz;
      let c = map.get(k);
      if (!c) { c = { arr: [], minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, minZ: 1e9, maxZ: -1e9 }; map.set(k, c); }
      return c;
    };
    const grow = (c, x0, y0, z0, x1, y1, z1) => {
      c.minX = Math.min(c.minX, x0); c.maxX = Math.max(c.maxX, x1); c.minY = Math.min(c.minY, y0); c.maxY = Math.max(c.maxY, y1);
      c.minZ = Math.min(c.minZ, z0); c.maxZ = Math.max(c.maxZ, z1);
    };
    for (const b of builder.boxes) {
      if (b.novis) continue;
      const c = get((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      pushBox(c.arr, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.col, b.emit, b.y0 <= 0.001);
      grow(c, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1);
    }
    for (const p of builder.pyrs) {
      const c = get(p.cx, p.cz);
      pushPyr(c.arr, p.cx, p.y0, p.cz, p.w, p.d, p.h, p.col, p.emit);
      grow(c, p.cx - p.w / 2, p.y0, p.cz - p.d / 2, p.cx + p.w / 2, p.y0 + p.h, p.cz + p.d / 2);
    }
    const chunks = [];
    for (const c of map.values()) {
      const m = this.makeMesh(c.arr);
      const cx = (c.minX + c.maxX) / 2, cy = (c.minY + c.maxY) / 2, cz = (c.minZ + c.maxZ) / 2;
      chunks.push({ mesh: m, cx, cy, cz, r: Math.hypot(c.maxX - c.minX, c.maxY - c.minY, c.maxZ - c.minZ) / 2 });
    }
    return chunks;
  }
  freeStatic(chunks) { if (chunks) chunks.forEach(c => this.freeMesh(c.mesh)); }
  begin(cam, flashOn) {
    const gl = this.gl, th = this.theme, L = this.loc;
    this.resize();
    const aspect = this.canvas.width / this.canvas.height;
    M4.perspective(this.proj, (cam.fov || 72) * Math.PI / 180, aspect, 0.12, 110);
    const f = fwdVec(cam.yaw, cam.pitch);
    M4.lookAt(this.view, cam.x, cam.y, cam.z, cam.x + f[0], cam.y + f[1], cam.z + f[2]);
    M4.mul(this.vp, this.proj, this.view);
    this.cam = cam; this.fwd = f;
    this.cullDist = Math.min(this.drawDist, th.far * this.fogScale()) + 1;   // 霧完全蓋住的距離之外不用畫 this.tanH = Math.tan((cam.fov || 72) * Math.PI / 360) * aspect;
    this.tanV = Math.tan((cam.fov || 72) * Math.PI / 360);
    gl.clearColor(th.fog[0], th.fog[1], th.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(L.uVP, false, this.vp);
    gl.uniform3f(L.uCam, cam.x, cam.y, cam.z);
    gl.uniform3f(L.uFwd, f[0], f[1], f[2]);
    gl.uniform1f(L.uAmb, th.amb); gl.uniform1f(L.uSun, th.sun);
    gl.uniform3f(L.uSunDir, th.sunDir[0], th.sunDir[1], th.sunDir[2]);
    gl.uniform1f(L.uFlash, flashOn ? th.flash * 1.7 : 0);
    gl.uniform2f(L.uCone, Math.cos(0.30), Math.cos(0.62));
    gl.uniform3f(L.uFogCol, th.fog[0], th.fog[1], th.fog[2]);
    gl.uniform1f(L.uFogNear, th.near); gl.uniform1f(L.uFogFar, th.far * this.fogScale());
    gl.uniform1f(L.uAlpha, 1); gl.uniform3f(L.uTint, 1, 1, 1); gl.uniform1f(L.uEmitAdd, 0); gl.uniform1f(L.uGray, this.gray || 0);
    M4.model(this.mM, 0, 0, 0, 0, 1, 1, 1);
    gl.uniformMatrix4fv(L.uM, false, this.mM);
    gl.disable(gl.BLEND);
    this.stats.chunks = 0; this.stats.dyn = 0;
  }
  fogScale() { return this.drawDist / 60; }
  bind(mesh) {
    const gl = this.gl, a = this.attr, S = STRIDE * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
    gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, S, 0);
    gl.vertexAttribPointer(a.aNor, 3, gl.FLOAT, false, S, 12);
    gl.vertexAttribPointer(a.aCol, 3, gl.FLOAT, false, S, 24);
    gl.vertexAttribPointer(a.aEm, 1, gl.FLOAT, false, S, 36);
  }
  /* 視錐＋距離剔除 */
  visible(cx, cy, cz, r) {
    const c = this.cam, dx = cx - c.x, dy = cy - c.y, dz = cz - c.z;
    const d2 = dx * dx + dy * dy + dz * dz, lim = (this.cullDist || this.drawDist) + r;
    if (d2 > lim * lim) return false;
    if (d2 < r * r * 1.5) return true;
    const f = this.fwd;
    const zf = dx * f[0] + dy * f[1] + dz * f[2];
    if (zf < -r) return false;
    // 在視圖空間檢查左右
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    const xr = dx * rx + dz * rz;
    if (Math.abs(xr) > zf * this.tanH * 1.15 + r * 1.3) return false;
    return true;
  }
  drawStatic(chunks) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.loc.uM, false, M4.model(this.mM, 0, 0, 0, 0, 1, 1, 1));
    for (const c of chunks) {
      if (!this.visible(c.cx, c.cy, c.cz, c.r)) continue;
      this.bind(c.mesh); gl.drawArrays(gl.TRIANGLES, 0, c.mesh.count);
      this.stats.chunks++;
    }
  }
  /* 擺動的部件：以 (mx,my,mz,yaw) 為整體座標，(lx,ly,lz) 為關節位置，rx/rz 為擺動角 */
  drawPart(mesh, mx, my, mz, yaw, lx, ly, lz, rx, rz, o) {
    const gl = this.gl, L = this.loc; o = o || {};
    M4.part(this.mM, mx, my, mz, yaw, lx, ly, lz, rx || 0, rz || 0, 1);
    gl.uniformMatrix4fv(L.uM, false, this.mM);
    const t = o.tint || [1, 1, 1];
    gl.uniform3f(L.uTint, t[0], t[1], t[2]); gl.uniform1f(L.uEmitAdd, o.emit || 0);
    const al = o.alpha === undefined ? 1 : o.alpha;
    if (al < 1) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
    gl.uniform1f(L.uAlpha, al);
    this.bind(mesh); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    this.stats.dyn++;
  }
  drawDyn(mesh, x, y, z, yaw, sx, sy, sz, o) {
    const gl = this.gl, L = this.loc;
    o = o || {};
    if (o.maxDist) { const c = this.cam, ddx = x - c.x, ddz = z - c.z; if (ddx * ddx + ddz * ddz + (y - c.y) * (y - c.y) > o.maxDist * o.maxDist) return; }
    if (!this.visible(x, y + 1, z, 2.2 * Math.max(sx, sy, sz))) return;
    M4.model(this.mM, x, y, z, yaw || 0, sx || 1, sy || 1, sz || 1);
    gl.uniformMatrix4fv(L.uM, false, this.mM);
    const t = o.tint || [1, 1, 1];
    gl.uniform3f(L.uTint, t[0], t[1], t[2]);
    gl.uniform1f(L.uEmitAdd, o.emit || 0);
    const al = o.alpha === undefined ? 1 : o.alpha;
    if (al < 1) { gl.enable(gl.BLEND); } else gl.disable(gl.BLEND);
    gl.uniform1f(L.uAlpha, al);
    this.bind(mesh); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    this.stats.dyn++;
  }
}

/* ===== 密碼告示牌：七段顯示器風格的四位數字 ===== */
const SEG7 = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function buildCodeMesh(R, str) {
  const a = [], W = [1, 1, 1], dark = [0.05, 0.05, 0.06];
  pushBox(a, -0.29, -0.14, 0, 0.29, 0.14, 0.018, dark, 0);
  const bw = 0.012, zf = 0.018, zb = 0.026;
  pushBox(a, -0.29, 0.14 - bw, zf, 0.29, 0.14, zb, W, 0.5);
  pushBox(a, -0.29, -0.14, zf, 0.29, -0.14 + bw, zb, W, 0.5);
  pushBox(a, -0.29, -0.14, zf, -0.29 + bw, 0.14, zb, W, 0.5);
  pushBox(a, 0.29 - bw, -0.14, zf, 0.29, 0.14, zb, W, 0.5);
  const dw = 0.09, dh = 0.17, t = 0.018, gap = 0.034, total = 4 * dw + 3 * gap, x0 = -total / 2, y0 = -dh / 2;
  for (let i = 0; i < 4; i++) {
    const segs = SEG7[str[i]] || '', ox = x0 + i * (dw + gap), h2 = dh / 2;
    const S = {
      a: [ox + 0.012, y0 + dh - t, ox + dw - 0.012, y0 + dh], d: [ox + 0.012, y0, ox + dw - 0.012, y0 + t],
      g: [ox + 0.012, y0 + h2 - t / 2, ox + dw - 0.012, y0 + h2 + t / 2],
      b: [ox + dw - t, y0 + h2 + 0.005, ox + dw, y0 + dh - 0.008], c: [ox + dw - t, y0 + 0.008, ox + dw, y0 + h2 - 0.005],
      f: [ox, y0 + h2 + 0.005, ox + t, y0 + dh - 0.008], e: [ox, y0 + 0.008, ox + t, y0 + h2 - 0.005],
    };
    for (const k of segs) { const q = S[k]; pushBox(a, q[0], q[1], zf, q[2], q[3], zb + 0.004, W, 0.62); }
  }
  return R.makeMesh(a);
}

/* ===== 動態模型 ===== */
function buildModels(R) {
  const M = {};
  const mk = fn => { const a = []; fn(a); return R.makeMesh(a); };
  const W = [1, 1, 1];
  M.slip = mk(a => { pushBox(a, -0.14, 0, -0.1, 0.14, 0.02, 0.1, W, 0.18); pushBox(a, -0.1, 0.02, -0.02, 0.1, 0.025, 0.02, [0.1, 0.1, 0.1], 0); });
  M.slipWall = mk(a => { pushBox(a, -0.14, -0.1, 0, 0.14, 0.1, 0.02, W, 0.18); });
  M.lockBody = mk(a => { pushBox(a, -0.32, 0, -0.2, 0.32, 0.78, 0.2, [0.22, 0.23, 0.25], 0); pushBox(a, -0.26, 0.5, 0.2, 0.26, 0.72, 0.23, [0.1, 0.1, 0.12], 0); });
  M.lockBand = mk(a => { pushBox(a, -0.33, 0.30, -0.21, 0.33, 0.44, 0.21, W, 0.45); pushBox(a, -0.12, 0.54, 0.23, 0.12, 0.68, 0.25, W, 0.9); });
  M.lockOpen = mk(a => { pushBox(a, -0.32, 0, -0.2, 0.32, 0.78, 0.2, [0.16, 0.16, 0.17], 0); pushBox(a, -0.33, 0.30, -0.21, 0.33, 0.44, 0.21, [0.12, 0.12, 0.12], 0); });
  M.pedBody = mk(a => { pushBox(a, -0.4, 0, -0.4, 0.4, 0.9, 0.4, [0.28, 0.28, 0.3], 0); pushBox(a, -0.5, 0, -0.5, 0.5, 0.12, 0.5, [0.2, 0.2, 0.22], 0); });
  M.pedTop = mk(a => { pushBox(a, -0.34, 0.9, -0.34, 0.34, 0.97, 0.34, W, 0.8); });
  M.gem = mk(a => { pushBox(a, -0.12, -0.12, -0.12, 0.12, 0.12, 0.12, W, 0.9); pushBox(a, -0.09, -0.16, -0.09, 0.09, 0.16, 0.09, W, 0.9); });
  M.frog = mk(a => {
    const g = [0.35, 0.75, 0.3];
    pushBox(a, -0.07, 0, -0.09, 0.07, 0.07, 0.09, g, 0.12); pushBox(a, -0.05, 0.05, -0.12, 0.05, 0.1, -0.05, g, 0.12);
    pushBox(a, -0.06, 0.09, -0.11, -0.03, 0.12, -0.08, [1, 1, 0.8], 0.6); pushBox(a, 0.03, 0.09, -0.11, 0.06, 0.12, -0.08, [1, 1, 0.8], 0.6);
    pushBox(a, -0.09, 0, 0.04, -0.05, 0.03, 0.1, g, 0.1); pushBox(a, 0.05, 0, 0.04, 0.09, 0.03, 0.1, g, 0.1);
  });
  M.portalFrame = mk(a => { pushBox(a, -1.0, 0, -0.12, -0.8, 2.6, 0.12, [0.2, 0.2, 0.28], 0); pushBox(a, 0.8, 0, -0.12, 1.0, 2.6, 0.12, [0.2, 0.2, 0.28], 0); pushBox(a, -1.0, 2.6, -0.12, 1.0, 2.8, 0.12, [0.2, 0.2, 0.28], 0); });
  M.portalDisc = mk(a => { pushBox(a, -0.8, 0.05, -0.03, 0.8, 2.6, 0.03, [0.5, 0.35, 1.0], 1.0); });
  // ===== 怪物：駝背、巨大、噁心（由約 150 個小方塊組成，分成可擺動的部件）=====
  {
    const fl = [0.36, 0.33, 0.30], dk = [0.2, 0.17, 0.16], red = [0.5, 0.07, 0.08], bone = [0.84, 0.8, 0.66], slime = [0.45, 0.95, 0.22], pale = [0.58, 0.5, 0.44];
    const mon = {};
    mon.body = mk(a => {
      pushBox(a, -0.5, 0.85, -0.35, 0.5, 1.4, 0.4, dk, 0);                               // 骨盆
      pushBox(a, -0.44, 0.92, -0.55, 0.44, 1.46, -0.33, pale, 0.14);                     // 腫脹蒼白的腹部
      pushBox(a, -0.3, 1.06, -0.6, 0.3, 1.3, -0.54, [0.62, 0.16, 0.16], 0.32);            // 潰爛的腹口
      pushBox(a, -0.12, 0.9, -0.62, 0.12, 1.08, -0.56, slime, 0.8);                      // 黏液囊
      pushBox(a, -0.78, 1.4, -0.62, 0.78, 2.1, 0.36, fl, 0);                              // 寬厚的胸腔
      pushBox(a, -0.62, 1.45, -0.68, 0.62, 2.02, -0.6, red, 0.1);                         // 剝開的肌肉
      for (let i = 0; i < 5; i++) pushBox(a, -0.64, 1.5 + i * 0.11, -0.74, 0.64, 1.55 + i * 0.11, -0.66, bone, 0.06);   // 外露肋骨
      for (const vx of [-0.45, -0.15, 0.2, 0.5]) pushBox(a, vx, 1.5, -0.7, vx + 0.025, 2.0, -0.66, [0.75, 0.1, 0.1], 0.45);   // 血管
      pushBox(a, -0.46, 1.95, 0.0, 0.46, 2.52, 0.68, dk, 0);                              // 背上的駝峰
      for (let i = 0; i < 6; i++) pushPyr(a, -0.34 + i * 0.136, 2.52, 0.3 + (i % 2) * 0.1, 0.13, 0.13, 0.38 + (i % 3) * 0.1, bone, 0);   // 脊刺
      for (const sx of [-1, 1]) {
        pushBox(a, sx * 0.72, 1.62, -0.22, sx * 1.02, 2.18, 0.22, [0.42, 0.36, 0.3], 0);  // 肩部腫瘤
        pushBox(a, sx * 0.8, 2.14, -0.12, sx * 0.98, 2.34, 0.1, slime, 0.75);             // 發光膿包
        pushBox(a, sx * 0.86, 1.7, -0.3, sx * 0.94, 1.9, -0.2, red, 0.3);                // 潰瘍
      }
      pushBox(a, -0.3, 0.55, -0.1, 0.3, 0.9, 0.3, dk, 0);                                 // 腰部
    });
    mon.head = mk(a => {      // 關節在頸部 (0,0,0)，頭向前（-Z）伸出
      pushBox(a, -0.37, -0.05, -0.66, 0.37, 0.52, 0.12, [0.62, 0.6, 0.52], 0);          // 頭骨
      pushBox(a, -0.4, 0.28, -0.72, 0.4, 0.4, -0.5, dk, 0);                               // 眉骨
      for (const sx of [-1, 1]) pushBox(a, sx * 0.4, 0.04, -0.55, sx * 0.5, 0.3, -0.2, fl, 0);   // 臉頰腫塊
      for (const sx of [-1, 1]) { pushBox(a, sx * 0.1, 0.3, -0.74, sx * 0.27, 0.46, -0.68, [1.0, 0.95, 0.15], 2.0); pushBox(a, sx * 0.14, 0.34, -0.752, sx * 0.2, 0.42, -0.738, [0.1, 0, 0], 0); }   // 大眼（黃綠發光，細瞳孔）
      for (const [ex, ey] of [[0, 0.46], [-0.33, 0.14], [0.33, 0.14]]) pushBox(a, ex - 0.05, ey, -0.72, ex + 0.05, ey + 0.1, -0.68, [1.0, 0.4, 0.1], 1.8);   // 多餘的小眼
      pushBox(a, -0.1, 0.1, -0.7, 0.1, 0.2, -0.66, [0.04, 0, 0], 0);                      // 鼻孔
      for (let i = 0; i < 9; i++) pushPyrInv(a, -0.32 + i * 0.08, 0.0, -0.64, 0.07, 0.07, 0.17 + (i % 2) * 0.07, bone, 0.08);   // 上排尖牙
      for (const sx of [-1, 1]) pushPyr(a, sx * 0.3, 0.52, -0.08, 0.14, 0.14, 0.55, bone, 0);   // 犄角
      for (const sx of [-1, 1]) pushPyr(a, sx * 0.44, 0.1, -0.1, 0.1, 0.1, 0.3, dk, 0);
    });
    mon.jaw = mk(a => {       // 下顎，關節在 (0,0,0)
      pushBox(a, -0.31, -0.2, -0.68, 0.31, -0.04, 0.0, [0.5, 0.46, 0.4], 0);
      for (let i = 0; i < 8; i++) pushPyr(a, -0.27 + i * 0.077, -0.04, -0.64, 0.065, 0.065, 0.16 + (i % 2) * 0.07, bone, 0.08);   // 下排尖牙
      pushBox(a, -0.08, -0.12, -0.7, 0.08, -0.06, -0.12, [0.7, 0.1, 0.15], 0.35);        // 舌頭
      pushBox(a, -0.06, -0.5, -0.64, 0.06, -0.12, -0.56, [0.7, 0.1, 0.15], 0.35);         // 垂下的長舌
    });
    const arm = sx => mk(a => {   // 關節在肩膀 (0,0,0)，向下垂至接近地面
      pushBox(a, -0.12, -0.88, -0.12, 0.12, 0.05, 0.12, fl, 0);                           // 上臂
      pushBox(a, -0.15, -1.0, -0.15, 0.15, -0.82, 0.15, red, 0.12);                       // 肘部肉瘤
      pushBox(a, -0.09, -1.66, -0.1, 0.09, -0.92, 0.1, dk, 0);                            // 前臂
      pushBox(a, -0.15, -1.82, -0.17, 0.15, -1.62, 0.1, fl, 0);                           // 手掌
      for (let i = 0; i < 4; i++) pushPyrInv(a, -0.11 + i * 0.073, -1.8, -0.06 + (i % 2) * 0.04, 0.06, 0.06, 0.34 + (i % 2) * 0.06, bone, 0.06);   // 爪
      pushBox(a, sx * 0.1, -0.7, -0.08, sx * 0.13, -0.3, 0.08, red, 0.3);                  // 傷口
    });
    mon.armL = arm(-1); mon.armR = arm(1);
    const leg = () => mk(a => {   // 關節在髖部 (0,0,0)
      pushBox(a, -0.17, -0.62, -0.16, 0.17, 0.04, 0.16, fl, 0);
      pushBox(a, -0.14, -0.72, -0.13, 0.14, -0.56, 0.22, dk, 0);
      pushBox(a, -0.1, -0.96, 0.02, 0.1, -0.64, 0.22, dk, 0);
      pushBox(a, -0.15, -0.96, -0.4, 0.15, -0.86, 0.16, fl, 0);
      for (let i = 0; i < 3; i++) pushPyr(a, -0.09 + i * 0.09, -0.96, -0.46, 0.07, 0.12, 0.1, bone, 0);
    });
    mon.legL = leg(); mon.legR = leg();
    mon.tend = [0, 1, 2, 3].map(k => mk(a => {   // 背上的觸手，向上延伸
      let y = 0, w = 0.1;
      for (let i = 0; i < 6; i++) { pushBox(a, -w / 2, y, -w / 2, w / 2, y + 0.3, w / 2, i % 2 ? red : dk, 0.1 + i * 0.04); y += 0.28; w *= 0.84; }
      pushBox(a, -0.05, y, -0.05, 0.05, y + 0.1, 0.05, slime, 1.2);
    }));
    mon.drip = mk(a => pushBox(a, -0.025, -0.1, -0.025, 0.025, 0.04, 0.025, slime, 1.3));
    mon.blob = mk(a => pushBox(a, -1.0, 0, -1.0, 1.0, 0.012, 1.0, [0.02, 0.02, 0.02], 0));
    M.mon = mon;
  }
  M.pBody = mk(a => { pushBox(a, -0.26, 0.8, -0.15, 0.26, 1.4, 0.15, W, 0.05); pushBox(a, -0.42, 0.85, -0.1, -0.26, 1.4, 0.1, W, 0.05); pushBox(a, 0.26, 0.85, -0.1, 0.42, 1.4, 0.1, W, 0.05); });
  M.pHead = mk(a => { pushBox(a, -0.18, 1.4, -0.18, 0.18, 1.76, 0.18, [0.86, 0.7, 0.58], 0.05); pushBox(a, -0.19, 1.62, -0.19, 0.19, 1.78, 0.19, [0.15, 0.1, 0.08], 0.0); });
  M.pLegs = mk(a => { pushBox(a, -0.22, 0, -0.1, -0.02, 0.8, 0.1, [0.15, 0.17, 0.25], 0); pushBox(a, 0.02, 0, -0.1, 0.22, 0.8, 0.1, [0.15, 0.17, 0.25], 0); });
  M.codePost = mk(a => pushBox(a, -0.018, -1, -0.045, 0.018, 0, -0.01, [0.08, 0.08, 0.09], 0));
  M.codeFoot = mk(a => pushBox(a, -0.14, 0, -0.17, 0.14, 0.03, 0.03, [0.07, 0.07, 0.08], 0));
  M.cube = mk(a => { pushBox(a, -0.5, 0, -0.5, 0.5, 1, 0.5, W, 0); });
  return M;
}
