'use strict';
/* ===== 原生 WebGL 低多邊形渲染器 ===== */
const STRIDE = 11; // pos3 nor3 col3 emit1 mat1
let PMAT = 0;      // 目前要寫入的材質編號（靜態地圖建構時由方塊提供）

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
      a.push(p[0], p[1], p[2], F[0], F[1], F[2], c[0], c[1], c[2], em, PMAT);
    }
  }
}
function pushPyr(a, cx, y0, cz, w, d, h, c, em) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, ty = y0 + h;
  const tri = (p, q, r) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const s of [p, q, r]) a.push(s[0], s[1], s[2], nx, ny, nz, c[0], c[1], c[2], em, PMAT);
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
    for (const s of [p, q, r2]) a.push(s[0], s[1], s[2], nx, ny, nz, c[0], c[1], c[2], em, PMAT);
  };
  const A = [x0, ytop, z0], B = [x1, ytop, z0], C = [x1, ytop, z1], D = [x0, ytop, z1], T = [cx, by, cz];
  tri(B, A, T); tri(C, B, T); tri(D, C, T); tri(A, D, T);
}

const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol; attribute float aEm; attribute float aMat;
uniform mat4 uVP; uniform mat4 uM;
varying vec3 vPos; varying vec3 vNor; varying vec3 vCol; varying float vEm; varying float vMat;
void main(){ vec4 wp=uM*vec4(aPos,1.0); vPos=wp.xyz; vNor=mat3(uM)*aNor; vCol=aCol; vEm=aEm; vMat=aMat; gl_Position=uVP*wp; }`;
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTexH; uniform sampler2D uTexN;
varying vec3 vPos; varying vec3 vNor; varying vec3 vCol; varying float vEm; varying float vMat;
uniform vec3 uCam; uniform vec3 uFwd; uniform float uAmb; uniform float uSun; uniform vec3 uSunDir;
uniform float uFlash; uniform vec2 uCone; uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
uniform float uAlpha; uniform vec3 uTint; uniform float uEmitAdd; uniform float uGray; uniform float uDetail;
/* 雜訊改用 64x64 小貼圖查表（比 sin 雜湊快，也不受手機低精度浮點影響）：hash 需傳入整數格座標，vn 為雙線性插值的值雜訊 */
float hash(vec2 p){ return texture2D(uTexH, (p+0.5)/64.0).r; }
float vn(vec2 p){ return texture2D(uTexN, p/64.0).g; }
/* 程序貼圖：依世界座標產生細節，完全不增加幾何量；回傳明暗倍率 */
float pattern(float m, vec3 p, vec3 n, float fade){
  bool top = abs(n.y) > 0.6;
  vec2 q = top ? p.xz : vec2(abs(n.x) > abs(n.z) ? p.z : p.x, p.y);
  float v = 1.0;
  if (m < 1.5) {                       // 1 草地／泥土：大塊色斑＋細碎雜點
    v = 0.74 + 0.36*vn(q*0.4) + 0.2*vn(q*1.7) + 0.12*(hash(floor(q*10.0))-0.5);
  } else if (m < 2.5) {                // 2 柏油：顆粒＋髒污
    v = 0.84 + 0.22*vn(q*0.3) + 0.2*(hash(floor(q*16.0))-0.5) - 0.08*step(0.72,vn(q*2.1));
  } else if (m < 3.5) {                // 3 人行道方磚（0.9 公尺）
    vec2 g = q/0.9, id = floor(g), f = fract(g);
    float line = max(step(f.x,0.035), step(f.y,0.035));
    v = (0.88 + 0.22*hash(id) + 0.07*(hash(floor(q*13.0))-0.5)) * (1.0 - 0.38*line);
  } else if (m < 4.5) {                // 4 鵝卵石／石板（錯縫）
    vec2 g = vec2(q.x/0.5, q.y/0.36); float row = floor(g.y); g.x += mod(row,2.0)*0.5;
    vec2 id = floor(g), f = fract(g);
    float edge = min(min(f.x,1.0-f.x)*0.9, min(f.y,1.0-f.y));
    v = (0.8 + 0.34*hash(id)) * (0.62 + 0.38*smoothstep(0.02,0.14,edge)) + 0.05*(hash(floor(q*11.0))-0.5);
  } else if (m < 5.5) {                // 5 木地板（沿 X 方向的木條，錯縫）
    float pw = 0.2; float row = floor(q.y/pw); float off = hash(vec2(row,3.0))*1.7;
    float col = floor((q.x+off)/1.5);
    float line = step(fract(q.y/pw),0.07) + step(fract((q.x+off)/1.5),0.012);
    v = (0.82 + 0.3*hash(vec2(row,col))) * (1.0 - 0.45*min(line,1.0));
  } else if (m < 6.5) {                // 6 磚石牆（磚縫、磚面深淺）
    vec2 g = vec2(q.x/0.52, q.y/0.26); float row = floor(g.y); g.x += mod(row,2.0)*0.5;
    vec2 id = floor(g), f = fract(g);
    float mortar = max(step(f.x,0.06), step(f.y,0.1));
    v = (0.78 + 0.36*hash(id)) * (1.0 - 0.34*mortar);
  } else if (m < 7.5) {                // 7 混凝土／灰泥：髒污、雨痕、板縫
    float seam = max(step(fract(q.x/2.6),0.008), step(fract(q.y/3.2),0.008));
    v = 0.84 + 0.22*vn(q*0.55) + 0.12*vn(q*2.3) + 0.06*(hash(floor(q*12.0))-0.5) - 0.10*seam;
    if (!top) v -= 0.14*smoothstep(0.6,1.0,vn(vec2(q.x*2.2, q.y*0.12)));
  } else if (m < 8.5) {                // 8 泥土小徑：碎石點
    v = 0.76 + 0.3*vn(q*0.7) + 0.24*(hash(floor(q*9.0))-0.5) + 0.2*step(0.93,hash(floor(q*5.0)));
  } else if (m < 9.5) {                // 9 屋瓦：橫向瓦列
    float row = floor(p.y*3.4); float x = p.x+p.z;
    v = (0.8 + 0.28*hash(vec2(row, floor((x+row*0.37)*2.0)))) * (1.0 - 0.28*step(fract(p.y*3.4),0.12));
  } else if (m < 10.5) {               // 10 樹葉／樹籬：葉簇深淺
    v = 0.72 + 0.4*vn(q*1.9) + 0.22*vn(q*5.5) + 0.1*(hash(floor(q*14.0))-0.5);
  } else {                             // 11 樹皮：縱向裂紋
    v = 0.74 + 0.4*hash(vec2(floor((p.x+p.z)*16.0), 1.0)) + 0.14*vn(vec2((p.x+p.z)*9.0, p.y*1.4));
  }
  return mix(v, 1.0, fade);
}
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
  if (uDetail > 0.5 && vMat > 0.5 && d < 30.0) base *= pattern(vMat, vPos, n, smoothstep(9.0, 30.0, d));
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
    ['uVP', 'uM', 'uCam', 'uFwd', 'uAmb', 'uSun', 'uSunDir', 'uFlash', 'uCone', 'uFogCol', 'uFogNear', 'uFogFar', 'uAlpha', 'uTint', 'uEmitAdd', 'uGray', 'uDetail', 'uTexH', 'uTexN']
      .forEach(n => { this.loc[n] = gl.getUniformLocation(p, n); });
    this.attr = { aPos: gl.getAttribLocation(p, 'aPos'), aNor: gl.getAttribLocation(p, 'aNor'), aCol: gl.getAttribLocation(p, 'aCol'), aEm: gl.getAttribLocation(p, 'aEm'), aMat: gl.getAttribLocation(p, 'aMat') };
    [this.attr.aPos, this.attr.aNor, this.attr.aCol, this.attr.aEm, this.attr.aMat].forEach(a => gl.enableVertexAttribArray(a));
    {   // 雜訊貼圖（固定亂數，每次外觀一致）
      const N = 64, data = new Uint8Array(N * N * 4); let sd = 1234567;
      for (let i = 0; i < data.length; i++) { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; data[i] = sd >>> 24; }
      const mkTex = (unit, filter) => {
        const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      };
      mkTex(0, gl.NEAREST); mkTex(1, gl.LINEAR);
      gl.uniform1i(this.loc.uTexH, 0); gl.uniform1i(this.loc.uTexN, 1);
    }
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.vp = M4.create(); this.proj = M4.create(); this.view = M4.create(); this.mM = M4.create();
    this.scale = 1; this.drawDist = 60; this.detail = 1;
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
      PMAT = b.mat || 0;
      pushBox(c.arr, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.col, b.emit, b.y0 <= 0.001);
      grow(c, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1);
    }
    for (const p of builder.pyrs) {
      const c = get(p.cx, p.cz);
      PMAT = p.mat || 0;
      pushPyr(c.arr, p.cx, p.y0, p.cz, p.w, p.d, p.h, p.col, p.emit);
      grow(c, p.cx - p.w / 2, p.y0, p.cz - p.d / 2, p.cx + p.w / 2, p.y0 + p.h, p.cz + p.d / 2);
    }
    PMAT = 0;
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
    gl.uniform1f(L.uAlpha, 1); gl.uniform3f(L.uTint, 1, 1, 1); gl.uniform1f(L.uEmitAdd, 0); gl.uniform1f(L.uGray, this.gray || 0); gl.uniform1f(L.uDetail, this.detail);
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
    gl.vertexAttribPointer(a.aMat, 1, gl.FLOAT, false, S, 40);
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
  M.monster = mk(a => {
    const k = [0.06, 0.05, 0.07];
    pushBox(a, -0.32, 0.9, -0.2, 0.32, 1.9, 0.2, k, 0);                      // 軀幹
    pushBox(a, -0.26, 1.9, -0.24, 0.26, 2.4, 0.24, [0.1, 0.09, 0.11], 0);    // 頭
    pushBox(a, -0.17, 2.1, -0.26, -0.07, 2.2, -0.24, [1, 0.15, 0.1], 1.4); pushBox(a, 0.07, 2.1, -0.26, 0.17, 2.2, -0.24, [1, 0.15, 0.1], 1.4); // 眼
    pushBox(a, -0.62, 0.45, -0.12, -0.34, 1.85, 0.12, k, 0); pushBox(a, 0.34, 0.45, -0.12, 0.62, 1.85, 0.12, k, 0); // 長手臂
    pushBox(a, -0.26, 0, -0.14, -0.04, 0.9, 0.14, k, 0); pushBox(a, 0.04, 0, -0.14, 0.26, 0.9, 0.14, k, 0);
  });
  M.blob = mk(a => pushBox(a, -1.0, 0, -1.0, 1.0, 0.012, 1.0, [0.02, 0.02, 0.02], 0));
  M.pBody = mk(a => { pushBox(a, -0.26, 0.8, -0.15, 0.26, 1.4, 0.15, W, 0.05); pushBox(a, -0.42, 0.85, -0.1, -0.26, 1.4, 0.1, W, 0.05); pushBox(a, 0.26, 0.85, -0.1, 0.42, 1.4, 0.1, W, 0.05); });
  M.pHead = mk(a => { pushBox(a, -0.18, 1.4, -0.18, 0.18, 1.76, 0.18, [0.86, 0.7, 0.58], 0.05); pushBox(a, -0.19, 1.62, -0.19, 0.19, 1.78, 0.19, [0.15, 0.1, 0.08], 0.0); });
  M.pLegs = mk(a => { pushBox(a, -0.22, 0, -0.1, -0.02, 0.8, 0.1, [0.15, 0.17, 0.25], 0); pushBox(a, 0.02, 0, -0.1, 0.22, 0.8, 0.1, [0.15, 0.17, 0.25], 0); });
  M.codePost = mk(a => pushBox(a, -0.018, -1, -0.045, 0.018, 0, -0.01, [0.08, 0.08, 0.09], 0));
  M.codeFoot = mk(a => pushBox(a, -0.14, 0, -0.17, 0.14, 0.03, 0.03, [0.07, 0.07, 0.08], 0));
  M.cube = mk(a => { pushBox(a, -0.5, 0, -0.5, 0.5, 1, 0.5, W, 0); });
  return M;
}
