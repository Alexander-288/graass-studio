'use strict';

// ================= settings =================
const isSmall = matchMedia('(pointer: coarse)').matches;
const MAX_OBJECTS = 24, PUSH_OBJECTS = 16;   // objects drawn / objects that push grass
const DEFAULTS = {
  // wind
  angle: 70, gust: 0.28, speed: 0.35, gustSize: 20, flutter: 0.035, flutterSpeed: 1.6, gustGlow: 0.07,
  // blades
  blades: isSmall ? 30000 : 50000, height: 1.95, heightVar: 0.46, width: 0.58, lean: 1.0, twist: 1.2, taper: 0.9,
  // color
  base: '#05423a', mid: '#127a61', tipShade: '#299e75', tipSun: '#9eeb61', fog: '#0f6654',
  variation: 0.12, sideShade: 0.22,
  // light
  patchStrength: 1.0, patchSize: 25, patchDrift: 0.0, brightness: 1.0,
  // view
  camHeight: 19, camTilt: 48, camYaw: 0, fov: 45, fogNear: 30, fogFar: 62,
  resolution: isSmall ? 1.25 : 1.5, stats: true,
  // placed objects: { src, x, z, size, sink, flatten, flip }
  objects: [],
};
// keys a preset or randomize may change; the rest (count, camera, quality) stay yours
const LOOK = ['angle','gust','speed','gustSize','flutter','flutterSpeed','gustGlow','height','heightVar','width','lean','twist','taper',
  'base','mid','tipShade','tipSun','fog','variation','sideShade','patchStrength','patchSize','patchDrift','brightness'];

const PRESETS = [
  { name: 'Meadow', look: {} },
  { name: 'Calm', look: { gust: 0.08, speed: 0.15, flutter: 0.012, gustGlow: 0.03 } },
  { name: 'Storm', look: { base: '#0a1d1a', mid: '#1d4a3f', tipShade: '#3c6c5b', tipSun: '#a6c98a', fog: '#21332f',
    gust: 0.7, speed: 1.1, gustSize: 14, flutter: 0.09, flutterSpeed: 3.2, gustGlow: 0.16, patchStrength: 0.5, patchDrift: 0.6, brightness: 0.85 } },
  { name: 'Dusk', look: { base: '#1c1630', mid: '#4a3760', tipShade: '#8c5a72', tipSun: '#ffb46b', fog: '#3b2b48',
    gust: 0.32, speed: 0.3, patchDrift: 0.15 } },
  { name: 'Autumn', look: { base: '#3a230f', mid: '#7c5220', tipShade: '#b07f3a', tipSun: '#f3d27a', fog: '#8a6a3a',
    height: 1.6, width: 0.5, lean: 1.2 } },
  { name: 'Frost', look: { base: '#1b3a49', mid: '#4f7d8c', tipShade: '#9dc1cb', tipSun: '#f3fbff', fog: '#7fa6b5',
    gust: 0.14, flutter: 0.012, lean: 0.7, sideShade: 0.3 } },
  { name: 'Tall reeds', look: { height: 3.4, heightVar: 0.7, width: 0.32, lean: 0.55, twist: 0.6, taper: 1.3,
    gust: 0.4, speed: 0.45, flutter: 0.05 } },
];

// load: share link first, then last session, then defaults
function loadCfg(){
  let saved = {};
  try {
    if (location.hash.length > 1) saved = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));
    else saved = JSON.parse(localStorage.getItem('graass:cfg') || '{}');
  } catch (e) { saved = {}; }
  const c = { ...DEFAULTS };
  for (const k in saved) if (k in DEFAULTS && typeof saved[k] === typeof DEFAULTS[k]) c[k] = saved[k];
  const known = new Set((window.OBJECT_LIBRARY || []).map(o => 'lib:' + o.id));
  c.objects = Array.isArray(c.objects) ? c.objects.filter(o => o && typeof o.src === 'string' && (!o.src.startsWith('lib:') || known.has(o.src))).slice(0, MAX_OBJECTS) : [];
  return c;
}
const cfg = loadCfg();
let saveTimer = 0;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem('graass:cfg', JSON.stringify(cfg)); } catch (e) {} }, 300);
}

// ================= WebGL =================
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { antialias: true });
if (!gl) { document.body.innerHTML = '<p style="padding:24px;color:#fff">WebGL2 is not supported in this browser.</p>'; throw new Error('no webgl2'); }

const NOISE = `
vec2 hash2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);
  return mix(mix(dot(hash2(i),f), dot(hash2(i+vec2(1,0)),f-vec2(1,0)),u.x),
             mix(dot(hash2(i+vec2(0,1)),f-vec2(0,1)), dot(hash2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);
}`;

const grassVS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aBlade;   // t (0 base..1 tip), side (-1..1)
layout(location=1) in vec4 aI0;      // x, z, rand, height rand
layout(location=2) in vec4 aI1;      // grow, rand, lean rand, color jitter
uniform mat4 uVP; uniform vec3 uCam; uniform float uTime;
uniform vec2 uWind, uOffset, uPatchOff;
uniform float uGust, uGustScale, uFlutter, uFlutterSpeed, uLean;
uniform float uHeight, uHeightVar, uWidth, uTwist, uTaper;
uniform float uPatchScale, uFogNear, uFogFar;
uniform vec4 uObj[16]; uniform int uObjCount;   // x, z, radius, strength
out float vOcc;
out float vT; out float vSide; out float vPatch; out float vFog; out float vJit; out float vGust;
${NOISE}
vec2 rot(vec2 v, float a){ float c=cos(a), s=sin(a); return vec2(c*v.x-s*v.y, s*v.x+c*v.y); }
void main(){
  float t=aBlade.x, side=aBlade.y;
  vec2 base=aI0.xy; float r2=aI0.z, hr=aI0.w;
  float grow=aI1.x, rnd=aI1.y, leanR=aI1.z;
  vec2 wd=normalize(uWind);

  float h = uHeight*(1.0 - 0.5*uHeightVar + uHeightVar*hr)*grow;
  float w = uWidth*(0.8 + 0.4*fract(r2*7.13))*grow;

  // slow travelling gust patches + a small per-blade flutter
  float g = smoothstep(0.3, 0.85, noise(base*uGustScale - uOffset)*0.5+0.5);
  float fl = sin(uTime*uFlutterSpeed + rnd*6.2832 + dot(base,wd)*0.9) * uFlutter;
  float bend = max(uLean*(0.55 + 0.55*leanR) + g*uGust + fl, 1e-3);

  // constant-curvature arc, keeps blade length
  vec2 bdir = rot(wd, (rnd-0.5)*0.7);

  // objects push nearby blades outward and flatten them a bit
  float occ = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uObjCount) break;
    vec4 ob = uObj[i];
    vec2 dv = base - ob.xy; float d = length(dv);
    float k = (1.0 - smoothstep(ob.z*0.3, ob.z, d)) * ob.w;
    if (k > 0.0) {
      vec2 away = d > 1e-3 ? dv/d : bdir;
      bdir = normalize(mix(bdir, away, k) + 1e-4);
      bend += k*0.75;
      occ = max(occ, k);
    }
  }
  vOcc = occ;
  float a = bend*t;
  float along = h*(1.0-cos(a))/bend;
  float up    = h*sin(a)/bend;

  // blade faces across its bend, with some twist; leaf-shaped width
  vec2 wv = rot(vec2(-bdir.y, bdir.x), (r2-0.5)*uTwist);
  float hw = 0.5*w*pow(1.0-t, uTaper)*(0.7 + 0.3*smoothstep(0.0, 0.25, t));

  vec3 p = vec3(base.x + bdir.x*along + wv.x*side*hw, up, base.y + bdir.y*along + wv.y*side*hw);
  gl_Position = uVP*vec4(p,1.0);

  vT=t; vSide=side; vJit=aI1.w; vGust=g;
  vec2 pp = base*uPatchScale + uPatchOff;
  vPatch = smoothstep(-0.25, 0.3, noise(pp + 3.7) + 0.4*noise(pp*2.5 - 1.3));
  vFog = smoothstep(uFogNear, uFogFar, distance(p, uCam));
}`;

const grassFS = `#version 300 es
precision highp float;
in float vT; in float vSide; in float vPatch; in float vFog; in float vJit; in float vGust; in float vOcc;
uniform vec3 uBase, uMid, uTipShade, uTipSun, uFogCol;
uniform float uPatchStr, uVar, uSide, uGlow, uBright;
out vec4 o;
void main(){
  float p = mix(0.5, vPatch, uPatchStr);
  vec3 tip = mix(uTipShade, uTipSun, p);
  vec3 col = mix(uBase, uMid, smoothstep(0.0, 0.45, vT));
  col = mix(col, tip, smoothstep(0.35, 0.95, vT));
  col *= mix(1.0 - uSide, 1.0 + uSide*0.35, vSide*0.5+0.5);   // two-tone fold
  col *= 1.0 + vJit*uVar;                                      // per-blade variation
  col *= 1.0 + vGust*uGlow*vT;                                 // gusts catch a little light
  col *= 1.0 - 0.16*vOcc*(1.0 - 0.6*vT);                         // soft contact shade near objects
  col *= uBright;
  o = vec4(mix(col, uFogCol, vFog), 1.0);
}`;

const groundVS = `#version 300 es
layout(location=0) in vec2 aPos;
uniform mat4 uVP; uniform vec3 uCam; uniform float uFogNear, uFogFar;
out float vFog;
void main(){ vec3 p=vec3(aPos.x,0.0,aPos.y); vFog=smoothstep(uFogNear,uFogFar,distance(p,uCam)); gl_Position=uVP*vec4(p,1.0); }`;
const groundFS = `#version 300 es
precision highp float;
in float vFog; uniform vec3 uBase, uFogCol; uniform float uBright; out vec4 o;
void main(){ o=vec4(mix(uBase*0.85*uBright, uFogCol, vFog),1.0); }`;

function program(vs, fs){
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
function locations(p, names){ const o = {}; for (const n of names) o[n] = gl.getUniformLocation(p, n); return o; }
const grassProg = program(grassVS, grassFS);
const groundProg = program(groundVS, groundFS);
const G = locations(grassProg, ['uVP','uCam','uTime','uWind','uOffset','uPatchOff','uGust','uGustScale','uFlutter','uFlutterSpeed','uLean',
  'uHeight','uHeightVar','uWidth','uTwist','uTaper','uPatchScale','uFogNear','uFogFar',
  'uBase','uMid','uTipShade','uTipSun','uFogCol','uPatchStr','uVar','uSide','uGlow','uBright','uObj','uObjCount']);
const F = locations(groundProg, ['uVP','uCam','uFogNear','uFogFar','uBase','uFogCol','uBright']);

// ---- objects: upright cards that always face the camera ----
const objVS = `#version 300 es
layout(location=0) in vec2 aUV;
uniform mat4 uVP; uniform vec3 uCam, uPos, uRight, uUp; uniform vec2 uSize; uniform float uFlip, uSink, uFogNear, uFogFar;
out vec2 vUV; out float vFog; out float vH;
void main(){
  vec3 p = uPos + uRight*(aUV.x-0.5)*uSize.x + uUp*(aUV.y*uSize.y - uSink);
  vUV = vec2(uFlip > 0.5 ? 1.0-aUV.x : aUV.x, 1.0-aUV.y);
  vH = aUV.y; vFog = smoothstep(uFogNear, uFogFar, distance(p, uCam));
  gl_Position = uVP*vec4(p,1.0);
}`;
const objFS = `#version 300 es
precision highp float;
in vec2 vUV; in float vFog; in float vH;
uniform sampler2D uTex; uniform vec3 uFogCol, uShade; uniform float uBright;
out vec4 o;
void main(){
  vec4 c = texture(uTex, vUV);          // premultiplied alpha
  if (c.a < 0.004) discard;
  vec3 col = c.rgb * uBright;
  col *= mix(uShade, vec3(1.0), smoothstep(0.0, 0.3, vH));   // darker where it meets the grass
  o = vec4(mix(col, uFogCol*c.a, vFog), c.a);
}`;
const objProg = program(objVS, objFS);
const O = locations(objProg, ['uVP','uCam','uPos','uRight','uUp','uSize','uFlip','uSink','uFogNear','uFogFar','uTex','uFogCol','uShade','uBright']);
const quadVAO = gl.createVertexArray();
gl.bindVertexArray(quadVAO);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 1,1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindVertexArray(null);

// textures by source: 'lib:<id>' for built-ins, 'img:<id>' for uploads (kept in localStorage)
const textures = new Map();
const LIB = new Map((window.OBJECT_LIBRARY || []).map(o => [o.id, o]));
const svgURL = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
let sourceURL = function(src){
  if (src.startsWith('lib:')) { const o = LIB.get(src.slice(4)); return o ? (o.url || svgURL(o.svg)) : null; }
  if (src.startsWith('img:')) { try { return localStorage.getItem('graass:' + src); } catch (e) { return null; } }
  return null;
}
function texture(src){
  if (textures.has(src)) return textures.get(src);
  const entry = { tex: null, aspect: 1, ready: false, missing: false };
  textures.set(src, entry);
  const url = sourceURL(src);
  if (!url) { entry.missing = true; return entry; }
  const img = new Image();
  img.onload = () => {
    // draw into a canvas so svg and huge images both end up a sane size
    const max = 1024, k = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
    const w = Math.max(1, Math.round((img.naturalWidth || max) * k)), h = Math.max(1, Math.round((img.naturalHeight || max) * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    Object.assign(entry, { tex: t, aspect: w / h, ready: true });
    dirty = true;
    if (typeof refreshObjectUI === 'function') refreshObjectUI();
  };
  img.onerror = () => { entry.missing = true; };
  img.src = url;
  return entry;
}

// one blade: a triangle strip from base to a single tip vertex
const SEGMENTS = 5;
const bladeVerts = [];
for (let i = 0; i < SEGMENTS; i++) { const t = i / SEGMENTS; bladeVerts.push(t, -1, t, 1); }
bladeVerts.push(1, 0);
const bladeCount = bladeVerts.length / 2;

const grassVAO = gl.createVertexArray();
gl.bindVertexArray(grassVAO);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bladeVerts), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const instBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);  gl.vertexAttribDivisor(1, 1);
gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);

const groundVAO = gl.createVertexArray();
gl.bindVertexArray(groundVAO);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-400,-400, 400,-400, -400,400, 400,400]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindVertexArray(null);

// ================= camera =================
const v3 = {
  sub: (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
  add: (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
  scale: (a, s) => [a[0]*s, a[1]*s, a[2]*s],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; },
  cross: (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  dot: (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
};
function perspective(fovy, aspect, near, far){
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
}
function lookAt(e, c){
  const z = v3.norm(v3.sub(e, c)), x = v3.norm(v3.cross([0,1,0], z)), y = v3.cross(z, x);
  return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -v3.dot(x,e),-v3.dot(y,e),-v3.dot(z,e),1];
}
function mul(a, b){
  const r = new Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+j] * b[i*4+k]; r[i*4+j] = s;
  }
  return r;
}

const view = { cam: [0, 0, 0], vp: null, fovy: 1, aspect: 1, yaw: 0 };
function updateCamera(){
  const tilt = Math.min(cfg.camTilt, 89.5) * Math.PI / 180;
  const yaw = cfg.camYaw * Math.PI / 180;
  const back = cfg.camHeight / Math.tan(tilt);
  view.yaw = yaw;
  view.cam = [Math.sin(yaw) * back, cfg.camHeight, Math.cos(yaw) * back];
  view.aspect = canvas.width / canvas.height;
  // wider vertical view on tall screens so the sides don't feel cramped
  const f = view.aspect < 1 ? Math.min(cfg.fov * 1.33, 100) : cfg.fov;
  view.fovy = f * Math.PI / 180;
  const up = Math.abs(cfg.camTilt) > 89 ? [Math.sin(yaw) * -1e-3, 1, Math.cos(yaw) * -1e-3] : null;
  view.vp = mul(perspective(view.fovy, view.aspect, 0.1, cfg.fogFar + 60), lookAt(view.cam, up ? [up[0], 0, up[2]] : [0, 0, 0]));
}

// ground area the camera can see, as a quad (blades only go where they can be seen)
function footprint(){
  const cam = view.cam, F0 = v3.norm(v3.scale(cam, -1));
  const R = v3.norm(v3.cross(F0, [0, 1, 0])), U = v3.cross(R, F0);
  const ty = Math.tan(view.fovy / 2) * 1.15, tx = ty * view.aspect;
  const maxD = cfg.fogFar + 4;
  const pts = [];
  for (const [sx, sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
    const d = v3.add(F0, v3.add(v3.scale(R, sx * tx), v3.scale(U, sy * ty)));
    let x, z;
    if (d[1] < -1e-3) { const t = -cam[1] / d[1]; x = cam[0] + d[0]*t; z = cam[2] + d[2]*t; }
    else { const h = Math.hypot(d[0], d[2]) || 1; x = cam[0] + d[0]/h*maxD; z = cam[2] + d[2]/h*maxD; }
    // clamp to fog distance
    const dx = x - cam[0], dz = z - cam[2], dist = Math.hypot(dx, dz);
    if (dist > maxD) { x = cam[0] + dx/dist*maxD; z = cam[2] + dz/dist*maxD; }
    pts.push([x, z]);
  }
  // pad outward so leaning blades from outside the edge still fill it
  const cx = pts.reduce((s, p) => s + p[0], 0) / 4, cz = pts.reduce((s, p) => s + p[1], 0) / 4;
  return pts.map(([x, z]) => { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; return [x + dx/l*3, z + dz/l*3]; });
}
function insideQuad(q, x, z){
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = q[i], [bx, bz] = q[(i + 1) % 4];
    const c = (bx - ax) * (z - az) - (bz - az) * (x - ax);
    if (c !== 0) { if (sign === 0) sign = Math.sign(c); else if (Math.sign(c) !== sign) return false; }
  }
  return true;
}

let bladeTotal = 0;
function buildBlades(){
  const q = footprint();
  const xs = q.map(p => p[0]), zs = q.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const cx = view.cam[0], cz = view.cam[2];
  const near = Math.min(...q.map(([x, z]) => Math.hypot(x - cx, z - cz)));
  const count = cfg.blades, inst = new Float32Array(count * 8);
  let n = 0, tries = 0;
  while (n < count && tries < count * 40) {
    tries++;
    const x = minX + Math.random() * (maxX - minX), z = minZ + Math.random() * (maxZ - minZ);
    if (!insideQuad(q, x, z)) continue;
    const d = Math.max(0, Math.hypot(x - cx, z - cz) - near);
    if (Math.random() > Math.min(1, Math.max(0.3, 1.3 - d / 35))) continue;  // thinner far away
    const o = n * 8;
    inst[o] = x; inst[o+1] = z; inst[o+2] = Math.random(); inst[o+3] = Math.random();
    inst[o+4] = 1 + d * 0.015;                 // far blades a bit bigger to keep coverage
    inst[o+5] = Math.random(); inst[o+6] = Math.random(); inst[o+7] = Math.random() * 2 - 1;
    n++;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
  bladeTotal = n;
}

function resize(){
  const dpr = Math.min(devicePixelRatio || 1, cfg.resolution);
  canvas.width = Math.max(1, Math.round(innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(innerHeight * dpr));
  gl.viewport(0, 0, canvas.width, canvas.height);
  updateCamera();
  requestRebuild();
}
let rebuildAt = -1;
function requestRebuild(){ if (rebuildAt < 0) rebuildAt = performance.now() + 60; }
addEventListener('resize', resize);

// ================= state + render loop =================
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.3 : 1;
// dial angle is screen-relative: 0 = up the screen, clockwise
function windTarget(){
  const a = cfg.angle * Math.PI / 180, y = view.yaw;
  const fwd = [-Math.sin(y), -Math.cos(y)], right = [Math.cos(y), -Math.sin(y)];
  return [right[0]*Math.sin(a) + fwd[0]*Math.cos(a), right[1]*Math.sin(a) + fwd[1]*Math.cos(a)];
}

let paused = false, simTime = 0, last = performance.now(), dirty = true, shotPending = false;
let wind = null, offset = [0, 0], patchOff = [0, 0];
let fpsFrames = 0, fpsSince = performance.now();
const statsEl = document.getElementById('stats');

gl.enable(gl.DEPTH_TEST);

function frame(now){
  const dt = Math.min(0.05, (now - last) / 1000); last = now;

  if (rebuildAt >= 0 && now >= rebuildAt) { rebuildAt = -1; buildBlades(); dirty = true; }

  const target = windTarget();
  if (!wind) wind = target;
  if (!paused) {
    simTime += dt;
    // turn the wind smoothly toward the dial
    const k = 1 - Math.exp(-dt * 3);
    wind = [wind[0] + (target[0] - wind[0]) * k, wind[1] + (target[1] - wind[1]) * k];
    const len = Math.hypot(wind[0], wind[1]) || 1; wind = [wind[0] / len, wind[1] / len];
    // patches drift along the wind; accumulated so speed changes never jump
    offset[0] += wind[0] * cfg.speed * dt; offset[1] += wind[1] * cfg.speed * dt;
    patchOff[0] -= wind[0] * cfg.patchDrift * 0.05 * dt; patchOff[1] -= wind[1] * cfg.patchDrift * 0.05 * dt;
  }

  // while paused only redraw when something changed
  if (!paused || dirty || shotPending) {
    draw();
    dirty = false;
    if (shotPending) { shotPending = false; saveShot(); }
  }

  updateRing();
  fpsFrames++;
  if (now - fpsSince > 500) {
    const fps = Math.round(fpsFrames * 1000 / (now - fpsSince));
    statsEl.textContent = `${paused ? 'paused' : fps + ' fps'}  ·  ${(bladeTotal / 1000).toFixed(0)}k blades  ·  ${canvas.width}×${canvas.height}`;
    fpsFrames = 0; fpsSince = now;
  }
  requestAnimationFrame(frame);
}

function draw(){
  const fog = hex(cfg.fog), base = hex(cfg.base);
  gl.clearColor(fog[0], fog[1], fog[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // grass first so the ground is mostly rejected by the depth test
  gl.useProgram(grassProg);
  gl.uniformMatrix4fv(G.uVP, false, view.vp);
  gl.uniform3fv(G.uCam, view.cam);
  gl.uniform1f(G.uTime, simTime);
  gl.uniform2fv(G.uWind, wind);
  gl.uniform2fv(G.uOffset, offset);
  gl.uniform2fv(G.uPatchOff, patchOff);
  gl.uniform1f(G.uGust, cfg.gust * calm);
  gl.uniform1f(G.uGustScale, 1 / cfg.gustSize);
  gl.uniform1f(G.uFlutter, cfg.flutter * calm);
  gl.uniform1f(G.uFlutterSpeed, cfg.flutterSpeed);
  gl.uniform1f(G.uLean, cfg.lean);
  gl.uniform1f(G.uHeight, cfg.height);
  gl.uniform1f(G.uHeightVar, cfg.heightVar);
  gl.uniform1f(G.uWidth, cfg.width);
  gl.uniform1f(G.uTwist, cfg.twist);
  gl.uniform1f(G.uTaper, cfg.taper);
  gl.uniform1f(G.uPatchScale, 1 / cfg.patchSize);
  gl.uniform1f(G.uFogNear, cfg.fogNear);
  gl.uniform1f(G.uFogFar, Math.max(cfg.fogFar, cfg.fogNear + 1));
  gl.uniform3fv(G.uBase, base);
  gl.uniform3fv(G.uMid, hex(cfg.mid));
  gl.uniform3fv(G.uTipShade, hex(cfg.tipShade));
  gl.uniform3fv(G.uTipSun, hex(cfg.tipSun));
  gl.uniform3fv(G.uFogCol, fog);
  gl.uniform1f(G.uPatchStr, cfg.patchStrength);
  gl.uniform1f(G.uVar, cfg.variation);
  gl.uniform1f(G.uSide, cfg.sideShade);
  gl.uniform1f(G.uGlow, cfg.gustGlow);
  gl.uniform1f(G.uBright, cfg.brightness);
  objectUniforms();
  gl.bindVertexArray(grassVAO);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, bladeCount, bladeTotal);

  gl.useProgram(groundProg);
  gl.uniformMatrix4fv(F.uVP, false, view.vp);
  gl.uniform3fv(F.uCam, view.cam);
  gl.uniform1f(F.uFogNear, cfg.fogNear);
  gl.uniform1f(F.uFogFar, Math.max(cfg.fogFar, cfg.fogNear + 1));
  gl.uniform3fv(F.uBase, base);
  gl.uniform3fv(F.uFogCol, fog);
  gl.uniform1f(F.uBright, cfg.brightness);
  gl.bindVertexArray(groundVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  drawObjects(fog);
}

// cards always face the camera: from straight above they lie in the grass, from a low angle they stand in it.
// The more they lie down, the higher they float so the grass only tucks around them.
function camBasis(){
  const F0 = v3.norm(v3.scale(view.cam, -1)), R = v3.norm(v3.cross(F0, [0, 1, 0]));
  const down = -F0[1];                                   // 0 = looking across, 1 = looking straight down
  const k = Math.min(1, Math.max(0, (down - 0.3) / 0.7));
  const lift = cfg.height * 0.95 * k * k * (3 - 2 * k);
  return [R, v3.cross(R, F0), lift, down];
}
function objSize(o){ const t = texture(o.src); return [o.size * t.aspect, o.size]; }

function drawObjects(fog){
  if (!cfg.objects.length) return;
  // far to near so overlapping cards blend correctly; grass in front still hides them
  const list = cfg.objects.map(o => [o, (o.x - view.cam[0]) ** 2 + (o.z - view.cam[2]) ** 2]).sort((a, b) => b[1] - a[1]);
  gl.useProgram(objProg);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.uniformMatrix4fv(O.uVP, false, view.vp);
  gl.uniform3fv(O.uCam, view.cam);
  const [right, up, lift, down] = camBasis();
  gl.uniform3fv(O.uRight, right);
  gl.uniform3fv(O.uUp, up);
  gl.uniform1f(O.uFogNear, cfg.fogNear);
  gl.uniform1f(O.uFogFar, Math.max(cfg.fogFar, cfg.fogNear + 1));
  gl.uniform3fv(O.uFogCol, fog);
  // contact shade at the base only makes sense while standing up
  gl.uniform3fv(O.uShade, hex(cfg.base).map(v => { const sh = 0.45 + v * 0.8; return sh + (1 - sh) * down; }));
  gl.uniform1f(O.uBright, cfg.brightness);
  gl.uniform1i(O.uTex, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindVertexArray(quadVAO);
  for (const [o] of list) {
    const t = texture(o.src); if (!t.ready) continue;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.uniform3f(O.uPos, o.x, lift, o.z);
    gl.uniform2fv(O.uSize, objSize(o));
    gl.uniform1f(O.uFlip, o.flip ? 1 : 0);
    gl.uniform1f(O.uSink, o.sink * o.size);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}

// grass push data for the shader
const objData = new Float32Array(PUSH_OBJECTS * 4);
function objectUniforms(){
  const n = Math.min(cfg.objects.length, PUSH_OBJECTS);
  objData.fill(0);
  for (let i = 0; i < n; i++) {
    const o = cfg.objects[i], [w] = objSize(o);
    objData.set([o.x, o.z, Math.max(w * 0.5, o.size * 0.25) + 0.4, o.flatten], i * 4);
  }
  gl.uniform4fv(G.uObj, objData);
  gl.uniform1i(G.uObjCount, n);
}

// ================= UI =================
const $ = id => document.getElementById(id);
const fmt = {
  n2: v => v.toFixed(2), n3: v => v.toFixed(3), n1: v => v.toFixed(1), int: v => String(Math.round(v)),
  deg: v => Math.round(v) + '°', k: v => (v / 1000).toFixed(0) + 'k', x: v => v.toFixed(2) + '×', m: v => Math.round(v) + 'm',
  pct: v => Math.round(v * 100) + '%',
};
// what each control does on change: 'cam' moves the camera and refits blades, 'blades' refits, 'res' resizes
const TABS = [
  { id: 'wind', label: 'Wind', dial: true, groups: [
    ['Gusts', [['gust', 'Strength', 0, 0.9, 0.01, fmt.n2], ['speed', 'Speed', 0, 2, 0.01, fmt.n2], ['gustSize', 'Size', 5, 60, 1, fmt.m],
               ['gustGlow', 'Shimmer', 0, 0.3, 0.01, fmt.n2]]],
    ['Flutter', [['flutter', 'Amount', 0, 0.15, 0.005, fmt.n3], ['flutterSpeed', 'Speed', 0.2, 5, 0.1, fmt.n1]]],
  ]},
  { id: 'blades', label: 'Blades', groups: [
    ['Shape', [['height', 'Height', 0.5, 4, 0.05, fmt.n2], ['heightVar', 'Height variety', 0, 1, 0.01, fmt.pct],
               ['width', 'Width', 0.1, 1.5, 0.01, fmt.n2], ['taper', 'Tip sharpness', 0.3, 2, 0.05, fmt.n2]]],
    ['Pose', [['lean', 'Lean', 0, 1.8, 0.01, fmt.n2], ['twist', 'Twist', 0, 3, 0.05, fmt.n2]]],
    ['Field', [['blades', 'Count', 5000, 200000, 5000, fmt.k, 'blades']]],
  ]},
  { id: 'color', label: 'Color', colors: [['tipSun', 'Tips in sun'], ['tipShade', 'Tips in shade'], ['mid', 'Body'], ['base', 'Roots'], ['fog', 'Haze']],
    groups: [['Shading', [['variation', 'Variation', 0, 0.4, 0.01, fmt.n2], ['sideShade', 'Fold shading', 0, 0.5, 0.01, fmt.n2]]]] },
  { id: 'light', label: 'Light', groups: [
    ['Sun patches', [['patchStrength', 'Strength', 0, 1, 0.01, fmt.pct], ['patchSize', 'Size', 8, 80, 1, fmt.m],
                     ['patchDrift', 'Cloud drift', 0, 1, 0.01, fmt.n2]]],
    ['Exposure', [['brightness', 'Brightness', 0.5, 1.5, 0.01, fmt.x]]],
  ]},
  { id: 'objects', label: 'Objects', custom: page => buildObjectsPage(page), groups: [] },
  { id: 'view', label: 'View', groups: [
    ['Camera', [['camHeight', 'Height', 6, 45, 0.5, fmt.m, 'cam'], ['camTilt', 'Tilt', 20, 89, 1, fmt.deg, 'cam'],
                ['camYaw', 'Turn', 0, 359, 1, fmt.deg, 'cam'], ['fov', 'Field of view', 20, 80, 1, fmt.deg, 'cam']]],
    ['Haze', [['fogNear', 'Starts at', 5, 100, 1, fmt.m], ['fogFar', 'Fully at', 20, 150, 1, fmt.m, 'cam']]],
    ['Quality', [['resolution', 'Resolution', 0.5, 2, 0.05, fmt.x, 'res']]],
  ], toggles: [['stats', 'Show stats']], actions: true },
];

const controls = {};   // key -> sync function
// object state lives here because the Objects tab is built with the other tabs
let selected = null, placing = null, drag = null, refreshObjectUI = () => {};
const imgMemory = new Map();   // uploads that did not fit in localStorage
function el(tag, cls, html){ const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

function onChange(key, effect){
  dirty = true; save();
  if (effect === 'cam') { updateCamera(); requestRebuild(); }
  else if (effect === 'blades') requestRebuild();
  else if (effect === 'res') resize();
  else if (key === 'stats') statsEl.hidden = !cfg.stats;
}

function slider([key, label, min, max, step, f, effect]){
  const row = el('label', 'row');
  const head = el('span', 'row-head'); head.append(el('span', null, label));
  const out = el('output'); head.append(out); row.append(head);
  const input = el('input'); Object.assign(input, { type: 'range', min, max, step });
  row.append(input);
  const sync = () => {
    input.value = cfg[key]; out.textContent = f(cfg[key]);
    input.style.setProperty('--p', ((cfg[key] - min) / (max - min) * 100) + '%');
  };
  input.addEventListener('input', () => { cfg[key] = +input.value; sync(); onChange(key, effect); });
  controls[key] = sync; sync();
  return row;
}

function colorSwatch([key, label]){
  const sw = el('label', 'swatch');
  const chip = el('span', 'chip'), text = el('span', 'swatch-text');
  const name = el('b', null, label), code = el('i');
  text.append(name, code);
  const input = el('input'); input.type = 'color'; input.setAttribute('aria-label', label);
  sw.append(chip, text, input);
  const sync = () => { input.value = cfg[key]; chip.style.setProperty('--c', cfg[key]); code.textContent = cfg[key]; };
  input.addEventListener('input', () => { cfg[key] = input.value; sync(); onChange(key); });
  controls[key] = sync; sync();
  return sw;
}

function toggle([key, label]){
  const row = el('label', 'switch'); row.append(el('span', null, label));
  const input = el('input'); input.type = 'checkbox';
  row.append(input, el('span', 'knob'));
  const sync = () => { input.checked = cfg[key]; };
  input.addEventListener('change', () => { cfg[key] = input.checked; onChange(key); });
  controls[key] = sync; sync();
  return row;
}

function dial(){
  const row = el('div', 'dial-row');
  const d = el('div', 'dial');
  Object.assign(d, { tabIndex: 0 });
  d.setAttribute('role', 'slider'); d.setAttribute('aria-label', 'Wind direction');
  d.setAttribute('aria-valuemin', '0'); d.setAttribute('aria-valuemax', '359');
  let ticks = '';
  for (let i = 0; i < 24; i++) { const a = i * 15 * Math.PI / 180, r1 = i % 6 ? 41 : 37; ticks += `<line x1="${Math.sin(a)*r1}" y1="${-Math.cos(a)*r1}" x2="${Math.sin(a)*44}" y2="${-Math.cos(a)*44}"/>`; }
  d.innerHTML = `<svg viewBox="-46 -46 92 92" aria-hidden="true"><g class="ticks">${ticks}</g>
    <g class="needle" id="needle"><path d="M0 12 V-30"/><path d="M-6 -23 L0 -31 L6 -23"/></g></svg>`;
  const info = el('div', 'dial-info'); const out = el('output'); info.append(out, 'Drag to steer the wind');
  row.append(d, info);
  const needle = d.querySelector('#needle');
  const set = a => { cfg.angle = ((Math.round(a) % 360) + 360) % 360; sync(); onChange('angle'); };
  const sync = () => { needle.setAttribute('transform', `rotate(${cfg.angle})`); out.textContent = cfg.angle + '°'; d.setAttribute('aria-valuenow', cfg.angle); };
  const fromPointer = e => {
    const r = d.getBoundingClientRect();
    set(Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI);
  };
  d.addEventListener('pointerdown', e => { d.setPointerCapture(e.pointerId); fromPointer(e); });
  d.addEventListener('pointermove', e => { if (d.hasPointerCapture(e.pointerId)) fromPointer(e); });
  d.addEventListener('keydown', e => {
    const s = e.shiftKey ? 15 : 5;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { set(cfg.angle + s); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { set(cfg.angle - s); e.preventDefault(); }
  });
  controls.angle = sync; sync();
  return row;
}

// build tabs and pages
const tabsEl = $('tabs'), pagesEl = $('pages'), lens = $('lens');
const tabBtns = [];
for (const tab of TABS) {
  const b = el('button', 'tab', tab.label);
  b.setAttribute('role', 'tab'); b.id = 'tab-' + tab.id; b.setAttribute('aria-controls', 'page-' + tab.id);
  tabsEl.append(b); tabBtns.push(b);
  const page = el('section', 'page'); page.id = 'page-' + tab.id; page.setAttribute('role', 'tabpanel'); page.setAttribute('aria-labelledby', b.id);
  if (tab.dial) { page.append(el('div', 'group-title', 'Direction'), dial()); }
  if (tab.custom) tab.custom(page);
  if (tab.colors) {
    page.append(el('div', 'group-title', 'Palette'));
    const grid = el('div', 'swatches'); tab.colors.forEach(c => grid.append(colorSwatch(c))); page.append(grid);
  }
  for (const [title, list] of tab.groups) { page.append(el('div', 'group-title', title)); list.forEach(c => page.append(slider(c))); }
  if (tab.toggles) { page.append(el('div', 'group-title', 'Interface')); tab.toggles.forEach(t => page.append(toggle(t))); }
  if (tab.actions) {
    const a = el('div', 'actions');
    const reset = el('button', 'chip-btn', 'Reset all'), copy = el('button', 'chip-btn', 'Copy JSON');
    reset.addEventListener('click', () => applyCfg({ ...DEFAULTS }, 'Reset to defaults'));
    copy.addEventListener('click', () => copyText(JSON.stringify(cfg, null, 2), 'Settings copied as JSON'));
    a.append(reset, copy); page.append(a);
  }
  pagesEl.append(page);
  b.addEventListener('click', () => selectTab(tab.id));
}
function moveLens(){
  const b = tabBtns.find(t => t.getAttribute('aria-selected') === 'true');
  if (b) { lens.style.left = b.offsetLeft + 'px'; lens.style.width = b.offsetWidth + 'px'; }
}
function selectTab(id){
  TABS.forEach((t, i) => {
    const on = t.id === id;
    tabBtns[i].setAttribute('aria-selected', on); tabBtns[i].tabIndex = on ? 0 : -1;
    $('page-' + t.id).classList.toggle('active', on);
  });
  moveLens();
  try { localStorage.setItem('graass:tab', id); } catch (e) {}
}
tabsEl.addEventListener('keydown', e => {
  const i = tabBtns.indexOf(document.activeElement); if (i < 0) return;
  const j = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : -1;
  if (j >= 0) { selectTab(TABS[j].id); tabBtns[j].focus(); e.preventDefault(); }
});
let startTab = 'wind';
try { const t = localStorage.getItem('graass:tab'); if (TABS.some(x => x.id === t)) startTab = t; } catch (e) {}
selectTab(startTab);
addEventListener('resize', moveLens);
document.fonts && document.fonts.ready.then(moveLens);

// glint follows the cursor on glass surfaces
for (const g of document.querySelectorAll('.glass')) {
  g.addEventListener('pointermove', e => {
    const r = g.getBoundingClientRect();
    g.style.setProperty('--mx', (e.clientX - r.left) + 'px'); g.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
}

function applyCfg(next, message){
  const camChanged = ['camHeight','camTilt','camYaw','fov','fogFar','blades'].some(k => next[k] !== cfg[k]);
  const resChanged = next.resolution !== cfg.resolution;
  Object.assign(cfg, next);
  for (const k in controls) controls[k]();
  statsEl.hidden = !cfg.stats;
  if (resChanged) resize(); else if (camChanged) { updateCamera(); requestRebuild(); }
  if (!cfg.objects.includes(selected)) selected = null;
  refreshObjectUI();
  dirty = true; save();
  if (message) toast(message);
}

// ---- toast ----
let toastTimer = 0;
function toast(text){
  const t = $('toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
function copyText(text, message){
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => toast(message), () => { prompt('Copy this:', text); });
}

// ---- dock ----
const panel = $('panel'), bPanel = $('b-panel');
function setPanel(open){
  panel.classList.toggle('hidden', !open);
  bPanel.setAttribute('aria-expanded', String(open));
  if (open) moveLens();
}
bPanel.addEventListener('click', () => setPanel(panel.classList.contains('hidden')));
if (isSmall && innerWidth < 640) setPanel(false);

// presets menu
const menu = $('menu'), bPresets = $('b-presets');
for (const p of PRESETS) {
  const look = { ...pickLook(DEFAULTS), ...p.look };
  const item = el('button', 'menu-item');
  item.setAttribute('role', 'menuitem');
  item.innerHTML = `<span>${p.name}</span><span class="dots">${['base', 'mid', 'tipSun'].map(k => `<i style="background:${look[k]}"></i>`).join('')}</span>`;
  item.addEventListener('click', () => { applyCfg(look, p.name); openMenu(false); });
  menu.append(item);
}
function pickLook(src){ const o = {}; for (const k of LOOK) o[k] = src[k]; return o; }
function openMenu(open){
  menu.classList.toggle('open', open);
  bPresets.setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('button').focus({ preventScroll: true });
}
bPresets.addEventListener('click', e => { e.stopPropagation(); openMenu(!menu.classList.contains('open')); });
document.addEventListener('click', e => { if (!menu.contains(e.target)) openMenu(false); });
menu.addEventListener('keydown', e => {
  const items = [...menu.querySelectorAll('button')], i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { items[(i + 1) % items.length].focus(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { items[(i - 1 + items.length) % items.length].focus(); e.preventDefault(); }
  if (e.key === 'Escape') { openMenu(false); bPresets.focus(); }
});

// randomize: a coherent palette around one hue plus fresh wind and shape
function hsl(h, s, l){
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
function randomize(){
  const r = (a, b) => a + Math.random() * (b - a);
  const hue = Math.random() < 0.6 ? r(85, 175) : r(0, 360), shift = r(-40, 40);
  applyCfg({
    base: hsl(hue + 10, r(45, 75), r(8, 16)), mid: hsl(hue + 5, r(45, 70), r(22, 32)),
    tipShade: hsl(hue, r(35, 60), r(38, 50)), tipSun: hsl(hue + shift, r(60, 90), r(62, 80)),
    fog: hsl(hue + 5, r(30, 55), r(22, 36)),
    angle: Math.round(r(0, 359)), gust: r(0.1, 0.5), speed: r(0.15, 0.7), gustSize: Math.round(r(12, 35)),
    flutter: r(0.01, 0.06), flutterSpeed: r(1, 2.6),
    height: r(1.2, 2.8), heightVar: r(0.2, 0.7), width: r(0.3, 0.8), lean: r(0.5, 1.4), twist: r(0.4, 1.8),
    patchStrength: r(0.5, 1), patchSize: Math.round(r(15, 45)),
  }, 'Randomized');
}
$('b-random').addEventListener('click', randomize);

// pause
const bPause = $('b-pause');
function setPaused(p){
  paused = p; dirty = true;
  bPause.setAttribute('aria-pressed', String(p));
  bPause.dataset.tip = p ? 'Play  Space' : 'Pause  Space';
  bPause.setAttribute('aria-label', p ? 'Play' : 'Pause');
}
bPause.addEventListener('click', () => setPaused(!paused));

// screenshot: grab the canvas right after a draw, in the same frame
$('b-shot').addEventListener('click', () => { shotPending = true; });
function saveShot(){
  canvas.toBlob(blob => {
    if (!blob) return;
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'graass.png';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Image saved');
  });
}

// share link: settings packed into the URL hash
$('b-share').addEventListener('click', () => {
  // uploaded images are too big for a URL, so only built-in objects travel in the link
  const shared = { ...cfg, objects: cfg.objects.filter(o => o.src.startsWith('lib:')) };
  const url = location.href.split('#')[0] + '#' + btoa(unescape(encodeURIComponent(JSON.stringify(shared))));
  history.replaceState(null, '', url);
  copyText(url, shared.objects.length < cfg.objects.length ? 'Link copied (uploaded images stay on this device)' : 'Link copied');
});

// theme
$('b-theme').addEventListener('click', () => {
  const root = document.documentElement;
  const isLight = root.dataset.theme ? root.dataset.theme === 'light' : matchMedia('(prefers-color-scheme: light)').matches;
  root.dataset.theme = isLight ? 'dark' : 'light';
  try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
});

// keyboard shortcuts (not while typing in a field)
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, textarea, [role="slider"], [role="tab"]') && e.key !== 'Escape') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'h' || e.key === 'H') setPanel(panel.classList.contains('hidden'));
  else if (e.key === 'r' || e.key === 'R') randomize();
  else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) { setPaused(!paused); e.preventDefault(); }
  else if (e.key === 'Escape') { openMenu(false); if (placing) setPlacing(null); else select(null); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { removeObject(selected); e.preventDefault(); }
});

// ================= objects: placing, picking, dragging =================
const ring = $('sel-ring');

function project(x, y, z){
  const m = view.vp;
  const cx = m[0]*x + m[4]*y + m[8]*z + m[12], cy = m[1]*x + m[5]*y + m[9]*z + m[13], w = m[3]*x + m[7]*y + m[11]*z + m[15];
  if (w <= 0) return null;
  return [(cx / w * 0.5 + 0.5) * innerWidth, (0.5 - cy / w * 0.5) * innerHeight];
}
// where a screen point meets the ground
function groundAt(px, py){
  const cam = view.cam, F0 = v3.norm(v3.scale(cam, -1));
  const R = v3.norm(v3.cross(F0, [0, 1, 0])), U = v3.cross(R, F0);
  const ty = Math.tan(view.fovy / 2), tx = ty * (innerWidth / innerHeight);
  const nx = px / innerWidth * 2 - 1, ny = 1 - py / innerHeight * 2;
  const d = v3.add(F0, v3.add(v3.scale(R, nx * tx), v3.scale(U, ny * ty)));
  if (d[1] > -1e-3) return null;
  const t = -cam[1] / d[1];
  return [cam[0] + d[0] * t, cam[2] + d[2] * t];
}
// on-screen box of an object card
function screenBox(o){
  const [, U, lift] = camBasis(), s0 = -o.sink * o.size, s1 = o.size * (1 - o.sink);
  const base = project(o.x + U[0]*s0, lift + U[1]*s0, o.z + U[2]*s0), top = project(o.x + U[0]*s1, lift + U[1]*s1, o.z + U[2]*s1);
  if (!base || !top) return null;
  const h = base[1] - top[1], [w] = objSize(o);
  const ww = h * (w / o.size);
  return { x: base[0] - ww / 2, y: top[1], w: ww, h, bx: base[0], by: base[1] };
}
function pick(px, py){
  const near = cfg.objects.map(o => [o, (o.x - view.cam[0]) ** 2 + (o.z - view.cam[2]) ** 2]).sort((a, b) => a[1] - b[1]);
  for (const [o] of near) {
    const b = screenBox(o);
    if (b && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h + 8) return o;
  }
  return null;
}

function select(o){ selected = o; refreshObjectUI(); }
function setPlacing(src){
  placing = src;
  document.body.classList.toggle('placing', !!src);
  refreshObjectUI();
  if (src) toast('Click the field to place it');
}
function addObject(src, x, z){
  if (cfg.objects.length >= MAX_OBJECTS) { toast(`Up to ${MAX_OBJECTS} objects`); return null; }
  const lib = LIB.get(src.slice(4));
  const o = { src, x, z, size: lib ? lib.height : 5, sink: 0.03, flatten: 0.5, flip: false };
  cfg.objects.push(o); texture(src);
  dirty = true; save();
  return o;
}
function removeObject(o){
  cfg.objects = cfg.objects.filter(x => x !== o);
  if (selected === o) selected = null;
  dirty = true; save(); refreshObjectUI();
}

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const g = groundAt(e.clientX, e.clientY);
  if (placing) {
    if (g) {
      const o = addObject(placing, g[0], g[1]);
      if (o) selected = o;
      if (!e.shiftKey) setPlacing(null); else refreshObjectUI();
    }
    return;
  }
  const o = pick(e.clientX, e.clientY);
  if (o) {
    select(o);
    drag = { o, dx: g ? g[0] - o.x : 0, dz: g ? g[1] - o.z : 0 };
    canvas.setPointerCapture(e.pointerId);
    document.body.classList.add('dragging');
  } else if (selected) select(null);
});
canvas.addEventListener('pointermove', e => {
  if (drag) {
    const g = groundAt(e.clientX, e.clientY);
    if (g) { drag.o.x = g[0] - drag.dx; drag.o.z = g[1] - drag.dz; dirty = true; }
  } else if (!placing && cfg.objects.length) {
    canvas.style.cursor = pick(e.clientX, e.clientY) ? 'grab' : '';
  }
});
const endDrag = () => { if (drag) { drag = null; save(); document.body.classList.remove('dragging'); } };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ring under the selected object, follows it every frame
function updateRing(){
  const b = selected && texture(selected.src).ready ? screenBox(selected) : null;
  if (!b) { ring.hidden = true; return; }
  ring.hidden = false;
  const w = Math.max(24, b.w * 0.9);
  ring.style.transform = `translate(${b.bx - w / 2}px, ${b.by - w * 0.14}px)`;
  ring.style.width = w + 'px'; ring.style.height = (w * 0.28) + 'px';
}

// uploads: keep a copy (max 1024px) so the object survives a reload
function readUpload(file){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      if (file.type === 'image/svg+xml') return resolve(fr.result);
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, 1024 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
const storedURL = sourceURL;
sourceURL = src => imgMemory.get(src) || storedURL(src);

// ---- Objects tab ----
function buildObjectsPage(page){
  page.append(el('div', 'group-title', 'Add to the field'));
  const grid = el('div', 'lib');
  for (const item of LIB.values()) {
    const b = el('button', 'lib-card');
    b.dataset.src = 'lib:' + item.id;
    b.innerHTML = `<img alt="" src="${item.url || svgURL(item.svg)}"><span>${item.name}</span>`;
    b.addEventListener('click', () => setPlacing(placing === b.dataset.src ? null : b.dataset.src));
    grid.append(b);
  }
  const up = el('label', 'lib-card upload');
  up.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/></svg><span>Your image</span>`;
  const file = el('input'); Object.assign(file, { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml' });
  file.setAttribute('aria-label', 'Upload an image or SVG');
  up.append(file);
  file.addEventListener('change', async () => {
    const f = file.files[0]; file.value = '';
    if (!f) return;
    try {
      const url = await readUpload(f);
      const src = 'img:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      try { localStorage.setItem('graass:' + src, url); } catch (e) { imgMemory.set(src, url); toast('Too big to keep after a reload'); }
      if (!storedURL(src)) imgMemory.set(src, url);
      setPlacing(src);
    } catch (e) { toast('Could not read that image'); }
  });
  grid.append(up);
  page.append(grid);
  page.append(el('p', 'hint', 'Pick one, then click the field. Drag objects to move them. Shift+click places several.'));

  // selected object
  const selBox = el('div', 'sel-box');
  const selHead = el('div', 'group-title', 'Selected');
  const fields = [['size', 'Size', 0.5, 30, 0.1, v => v.toFixed(1) + 'm'], ['sink', 'Sink into grass', 0, 0.5, 0.01, fmt.pct],
                  ['flatten', 'Flatten grass', 0, 1, 0.01, fmt.pct]];
  const syncs = [];
  selBox.append(selHead);
  for (const [key, label, min, max, step, f] of fields) {
    const row = el('label', 'row');
    const head = el('span', 'row-head'); head.append(el('span', null, label));
    const out = el('output'); head.append(out); row.append(head);
    const input = el('input'); Object.assign(input, { type: 'range', min, max, step }); row.append(input);
    const sync = () => {
      if (!selected) return;
      input.value = selected[key]; out.textContent = f(selected[key]);
      input.style.setProperty('--p', ((selected[key] - min) / (max - min) * 100) + '%');
    };
    input.addEventListener('input', () => { if (!selected) return; selected[key] = +input.value; sync(); dirty = true; save(); });
    syncs.push(sync); selBox.append(row);
  }
  const acts = el('div', 'actions');
  const flip = el('button', 'chip-btn', 'Flip'), dup = el('button', 'chip-btn', 'Duplicate'), del = el('button', 'chip-btn danger', 'Delete');
  flip.addEventListener('click', () => { if (selected) { selected.flip = !selected.flip; dirty = true; save(); } });
  dup.addEventListener('click', () => {
    if (!selected) return;
    const s = selected, r = s.size * 0.6;
    const o = addObject(s.src, s.x + r, s.z + r * 0.4);
    if (o) { Object.assign(o, { size: s.size, sink: s.sink, flatten: s.flatten, flip: !s.flip }); select(o); }
  });
  del.addEventListener('click', () => selected && removeObject(selected));
  acts.append(flip, dup, del);
  selBox.append(acts);
  page.append(selBox);

  // everything in the field
  const listHead = el('div', 'group-title');
  const list = el('div', 'obj-list');
  const clear = el('button', 'chip-btn wide', 'Remove all');
  clear.addEventListener('click', () => { cfg.objects = []; selected = null; dirty = true; save(); refreshObjectUI(); });
  page.append(listHead, list, clear);

  refreshObjectUI = () => {
    for (const c of grid.querySelectorAll('.lib-card[data-src]')) c.setAttribute('aria-pressed', String(c.dataset.src === placing));
    selBox.hidden = !selected;
    if (selected) {
      const lib = LIB.get(selected.src.slice(4));
      selHead.textContent = 'Selected · ' + (lib ? lib.name : 'Your image');
      syncs.forEach(f => f());
    }
    listHead.textContent = `In the field · ${cfg.objects.length}/${MAX_OBJECTS}`;
    list.replaceChildren(...cfg.objects.map(o => {
      const b = el('button', 'obj-chip');
      const url = sourceURL(o.src);
      if (url) { const im = el('img'); im.alt = ''; im.src = url; b.append(im); } else b.textContent = '?';
      const lib = LIB.get(o.src.slice(4));
      b.setAttribute('aria-label', 'Select ' + (lib ? lib.name : 'image'));
      b.setAttribute('aria-pressed', String(o === selected));
      b.addEventListener('click', () => select(o));
      return b;
    }));
    clear.hidden = !cfg.objects.length;
    if (!cfg.objects.length) list.append(el('p', 'hint', 'Nothing placed yet.'));
  };
  refreshObjectUI();
}

// ================= start =================
cfg.objects.forEach(o => texture(o.src));
statsEl.hidden = !cfg.stats;
resize();
requestAnimationFrame(frame);
