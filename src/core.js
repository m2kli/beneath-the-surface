'use strict';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const LOW = params.get('q') === 'low';
const Q = { pr: Math.min(devicePixelRatio, LOW ? 1 : 1.5), shadow: LOW ? 1024 : 2048, steps: LOW ? 14 : 28, samples: LOW ? 0 : 4 };
const SURFACE = 42, WORLD_R = 128;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const rng = mulberry32(20261116);
const gauss = () => (rng() + rng() + rng() + rng() - 2);

// ======================================================================= terrain (JS)
function hash2(ix, iz){ let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, z){ const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx*fx*(3-2*fx), sz = fz*fz*(3-2*fz);
  return lerp(lerp(hash2(ix,iz), hash2(ix+1,iz), sx), lerp(hash2(ix,iz+1), hash2(ix+1,iz+1), sx), sz); }
function fbm(x, z){ let a = .5, s = 0; for(let i=0;i<4;i++){ s += a*vnoise(x,z); x*=2.03; z*=2.03; a*=.5; } return s; }
// the seabed rises to the village's shore on the -z side, so the reef seen from the beach is the same reef you dive in
function heightAt(x, z){
  const zz = z - 0.0006*x*x;
  let h = 1.5 + 12*fbm(x*.014+10, z*.014+10) + 2.2*fbm(x*.07, z*.07) + 34*smooth(-124, -150, zz) + 0.25*Math.max(0, -150 - zz);
  // a fringing reef crest parallel to the shore, cut by spur-and-groove channels that run out to sea
  const crest = Math.exp(-((zz + 104)**2)/162);
  h += crest*(6.5 + 4*Math.sin(x*0.22 + 2.5*fbm(x*0.05 + 3, z*0.05)));
  // past the crest the outer slope drops away toward open water
  h -= 3.5*smooth(-70, -20, zz);
  // a white-sand channel meanders from the lagoon out across the bay
  const chan = Math.exp(-((x - chanX(zz))**2)/60)*smooth(-112, -92, zz);
  // rocky ridges break up the open bay
  const rid = 1 - Math.abs(2*fbm(x*0.022 - 5, z*0.022 + 4) - 1);
  h += 8.5*smooth(0.84, 0.97, rid)*smooth(-96, -82, zz)*(1 - chan);
  h -= 3.4*chan;
  // and past mid-bay the floor steps off a wall into deep blue
  h -= 14*smooth(35, 42, zz + 9*Math.sin(x*0.045) + 5*fbm(x*0.06, 3.3));
  // beyond, a second step down into the open-ocean basin, and a seamount rising out of it
  h -= 16*smooth(104, 122, zz + 10*Math.sin(x*0.03) + 6*fbm(x*0.04, 7.1));
  h += 30*Math.exp(-((x - 55)**2 + (z - 190)**2)/420)*(0.8 + 0.4*fbm(x*0.1, z*0.1));
  return h;
}
function chanX(zz){ return 22 + 16*Math.sin(zz*0.034) + 6*Math.sin(zz*0.09 + 1.3); }

// ======================================================================= renderer + targets
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pr);
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.3, 900); window.__ocam = camera;

const sceneRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: Q.samples });
sceneRT.depthTexture = new THREE.DepthTexture(4, 4); sceneRT.depthTexture.type = THREE.UnsignedIntType;
const volRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
const shadowRT = new THREE.WebGLRenderTarget(Q.shadow, Q.shadow, { format: THREE.RedFormat });
shadowRT.depthTexture = new THREE.DepthTexture(Q.shadow, Q.shadow); shadowRT.depthTexture.type = THREE.UnsignedIntType;

// ======================================================================= shared uniforms + GLSL
const patchLife = new Float32Array(14);
const BAY_DEPTH_LAYER = 4;
const CAUSTIC_TILE_SIZE = 512;
let bayRenderActive = false;
const U = {
  uTime: { value: 0 }, uHealth: { value: 0 }, uCausticTile: { value: null },
  uSunDir: { value: new THREE.Vector3(0.36, 0.88, 0.3).normalize() },
  uSunCol: { value: new THREE.Vector3(3.3, 3.15, 2.9) },
  uAbs: { value: new THREE.Vector3() }, uSca: { value: new THREE.Vector3() },
  uShadowMap: { value: shadowRT.depthTexture }, uShadowMat: { value: new THREE.Matrix4() }, uShadowTexel: { value: 1/Q.shadow },
  uPulse: { value: new THREE.Vector4(0, -999, 0, 0) }, uPulseFade: { value: 0 },
  uPatchLife: { value: patchLife }, uRise: { value: 1 }, uNight: { value: 0 },
  uPortal: { value: 0 }, uBoxMin: { value: new THREE.Vector3() }, uBoxMax: { value: new THREE.Vector3() },
};
const CAUSTIC_LAYER = /* glsl */`
float causticLayer(vec2 p, float t){
  const float TAU = 6.28318530718;
  vec2 q = mod(p * TAU, TAU) - 250.0; vec2 i = q; float c = 1.0; const float inten = 0.005;
  for(int n = 0; n < 4; n++){
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / inten), q.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}`;
const COMMON = /* glsl */`
#define SURF 42.0
${LOW ? '#define LOWQ 1' : ''}
uniform float uTime; uniform float uHealth;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAbs; uniform vec3 uSca;
uniform sampler2D uShadowMap; uniform mat4 uShadowMat; uniform float uShadowTexel;
uniform vec4 uPulse; uniform float uPulseFade; uniform float uRise; uniform float uNight;
#ifdef BAY_VIEW
  #define uPortal 0.0
  uniform sampler2D uCausticTile;
#else
  uniform float uPortal;
#endif
uniform vec3 uBoxMin; uniform vec3 uBoxMax;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f*f*(3.0-2.0*f);
  float a = mix(mix(hash13(i), hash13(i+vec3(1,0,0)), u.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), u.x), u.y);
  float b = mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), u.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), u.x), u.y);
  return mix(a, b, u.z); }
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }

// ---- the water as a medium (per-channel absorption + scattering, Beer-Lambert)
vec3 sunAt(float y){ float path = max(SURF - y, 0.0) / max(uSunDir.y, 0.25); return uSunCol * exp(-(uAbs + uSca * 0.25) * path); }
float hg(float c, float g){ float g2 = g*g; return (1.0 - g2) / pow(max(1.0 + g2 - 2.0*g*c, 1e-4), 1.5); }
vec3 mediumLight(vec3 dir, float y){
  vec3 alb = uSca / (uAbs + uSca);
  float yEff = clamp(y + dir.y * 16.0, -30.0, SURF);
  return sunAt(yEff) * alb * (0.11 + 0.03 * hg(dot(dir, uSunDir), 0.6));
}
// Seen from the shore, the reef is looked at through the diorama's water block: one camera, true scale.
// Anything outside the block is cut away, and the water only starts absorbing where the ray enters it.
float portalEntry(vec3 wp, out float d){
  vec3 v = wp - cameraPosition; d = length(v);
  vec3 rd = v / d; rd = sign(rd) * max(abs(rd), vec3(1e-5));
  vec3 t0 = (uBoxMin - cameraPosition) / rd, t1 = (uBoxMax - cameraPosition) / rd;
  vec3 tn = min(t0, t1);
  return max(max(max(tn.x, tn.y), tn.z), 0.0);
}
// only what lies between the camera and the glass is cut away; past the far walls the sea simply continues
void clipPortal(vec3 wp){
#ifndef BAY_VIEW
  if(uPortal < 0.5) return;
  float d; float te = portalEntry(wp, d);
  if(d < te - 0.1 || wp.y > uBoxMax.y + 0.05) discard;
#endif
}
float waterPath(vec3 wp){
  float d; float te = uPortal > 0.5 ? portalEntry(wp, d) : 0.0;
  if(uPortal < 0.5) return distance(wp, cameraPosition);
  return max(d - te, 0.0);
}
vec3 fogged(vec3 col, vec3 wp){
  clipPortal(wp);
  vec3 v = wp - cameraPosition; float d = waterPath(wp) * (uPortal > 0.5 ? 1.2 : 1.0);
  vec3 T = exp(-(uAbs + uSca) * d);
  return col * T + mediumLight(normalize(v), uPortal > 0.5 ? SURF - 1.0 : cameraPosition.y) * (1.0 - T);
}
vec3 transmit(float d){ return exp(-(uAbs + uSca) * d); }

// ---- caustics, projected along the refracted sun so they slide correctly over relief
${CAUSTIC_LAYER}
#ifdef BAY_VIEW
vec2 causticUV(vec2 p){
  // Both ends of the original period have their own texel, including the slight jump at the seam.
  return (fract(p) * ${CAUSTIC_TILE_SIZE - 1}.0 + 0.5) / ${CAUSTIC_TILE_SIZE}.0;
}
#endif
vec3 caustics(vec3 wp, vec3 n){
  vec2 p = (wp.xz + uSunDir.xz / uSunDir.y * (SURF - wp.y)) * 0.042;
  float t = uTime * 0.42;
#ifdef BAY_VIEW
  vec2 offset = vec2(0.0035, 0.0);
  vec3 c = vec3(textureLod(uCausticTile, causticUV(p + offset), 0.0).r,
                textureLod(uCausticTile, causticUV(p), 0.0).r,
                textureLod(uCausticTile, causticUV(p - offset), 0.0).r);
  c = c * 0.7 + textureLod(uCausticTile, causticUV(p * 1.71 + 0.37), 0.0).g * 0.3;
#elif defined(LOWQ)
  vec3 c = vec3(causticLayer(p, t));
#else
  vec3 c = vec3(causticLayer(p + vec2(0.0035, 0.0), t), causticLayer(p, t), causticLayer(p - vec2(0.0035, 0.0), t));
  c = c * 0.7 + causticLayer(p * 1.71 + 0.37, t * 1.13) * 0.3;
#endif
  float depth = SURF - wp.y;
  float focus = smoothstep(1.0, 10.0, depth) * mix(1.0, 0.4, smoothstep(22.0, 46.0, depth));
  return c * focus * smoothstep(-0.35, 0.5, n.y);
}

// ---- soft sun shadows (rotated Poisson PCF)
const vec2 POISSON[8] = vec2[8](vec2(-0.613,0.617), vec2(0.170,-0.040), vec2(-0.299,-0.792), vec2(0.645,0.493),
  vec2(-0.651,-0.100), vec2(0.421,-0.602), vec2(-0.081,0.983), vec2(0.962,-0.183));
float shadowAt(vec3 wp, vec3 n){
  vec4 sc = uShadowMat * vec4(wp + n * 0.1, 1.0);
  vec3 p = sc.xyz * 0.5 + 0.5;
  if(p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  float a = hash12(gl_FragCoord.xy) * 6.2832; float ca = cos(a), sa = sin(a);
  mat2 R = mat2(ca, sa, -sa, ca);
  float s = 0.0;
#ifdef LOWQ
  for(int i=0;i<4;i++){ s += step(p.z - 0.0012, textureLod(uShadowMap, p.xy + R * POISSON[i] * 3.0 * uShadowTexel, 0.0).r); }
  s *= 0.25;
#else
  for(int i=0;i<8;i++){ s += step(p.z - 0.0012, textureLod(uShadowMap, p.xy + R * POISSON[i] * 3.5 * uShadowTexel, 0.0).r); }
  s *= 0.125;
#endif
  vec2 e = abs(p.xy - 0.5) * 2.0;
  return mix(s, 1.0, smoothstep(0.82, 1.0, max(e.x, e.y)));
}

// ---- derivative bump mapping (no tangents needed)
vec3 bump(vec3 n, vec3 p, float h, float k){
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  float hx = dFdx(h), hy = dFdy(h);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  if(abs(det) < 1e-10) return n;
  vec3 g = sign(det) * (hx * r1 + hy * r2);
  vec3 m = abs(det) * n - g * k;
  float l = dot(m, m);
  return l > 1e-20 ? m * inversesqrt(l) : n;
}

vec3 shade(vec3 alb, vec3 n, vec3 wp, float ao){
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 direct = vec3(0.0);
  if(ndl > 0.0){
    float sh = shadowAt(wp, n);
    if(sh > 0.0){
      vec3 c = vec3(0.0);
      if(n.y > -0.35 && wp.y < SURF - 1.0) c = caustics(wp, n);
      direct = sunAt(wp.y) * ndl * sh * (0.55 + c * 2.4 * mix(0.3, 1.0, uHealth));
    }
  }
  vec3 tint = uSca / (uAbs + uSca);
  vec3 amb = sunAt(wp.y + 8.0) * mix(tint * 0.07, tint * 0.32 + 0.05, n.y * 0.5 + 0.5) * ao;
  vec3 col = alb * (direct + amb);
  if(uPulseFade > 0.0){
    float rq = (distance(wp, uPulse.xyz) - uPulse.w) * 0.3;
    col += vec3(0.25, 0.95, 1.0) * exp(-rq * rq) * uPulseFade * 1.2;
  }
  return col;
}`;
function selectOceanProgram(){
  if(!!this.defines.BAY_VIEW === bayRenderActive) return;
  if(bayRenderActive) this.defines.BAY_VIEW = 1;
  else delete this.defines.BAY_VIEW;
  this.needsUpdate = true;
}
const mat = (o) => {
  const m = new THREE.ShaderMaterial({ ...o, uniforms: { ...U, ...(o.uniforms || {}) } });
  if(o.fragmentShader.startsWith(COMMON)) m.onBeforeRender = selectOceanProgram;
  return m;
};

// depth-only twin of a material, used by the sun shadow pass
const casters = [];
const LIVE_SHADOW = 1, FIXED_REEF_SHADOW = 3;
const depthMaterials = new WeakMap();
const DEPTH_FRAG = `
#ifdef FAN
varying vec3 vL;
#endif
void main(){
#ifdef FAN
  float a = atan(vL.y, vL.x), r = length(vL.xy);
  if(max(step(0.55, abs(sin(a*24.0))), step(0.66, abs(sin(r*18.0)))) < 0.5) discard;
#endif
  gl_FragColor = vec4(1.0);
}`;
function caster(mesh, layer = LIVE_SHADOW){
  const m = mesh.material;
  let d = depthMaterials.get(m);
  if(!d){
    d = new THREE.ShaderMaterial({ vertexShader: m.vertexShader, fragmentShader: DEPTH_FRAG, uniforms: m.uniforms,
      defines: { ...(m.defines || {}), DEPTH_PASS: 1 }, side: THREE.DoubleSide, colorWrite: false });
    depthMaterials.set(m, d);
  }
  mesh.layers.enable(layer); casters.push([mesh, m, d]); return mesh;
}

// ======================================================================= backdrop + surface
const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), mat({
  side: THREE.BackSide, depthWrite: false,
  vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: COMMON + `varying vec3 vD; void main(){ gl_FragColor = vec4(mediumLight(normalize(vD), cameraPosition.y), 1.0); }`,
}));
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

const surface = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800).rotateX(Math.PI/2), mat({
  side: THREE.DoubleSide,
  vertexShader: `varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: COMMON + /* glsl */`
  varying vec3 vW;
  float waveH(vec2 p, float t){
    return fbm2(p*0.11 + vec2(t*0.06, t*0.035)) * 1.4 + fbm2(p*0.34 - vec2(t*0.1, -t*0.07)) * 0.4
         + sin(dot(p, vec2(0.19, 0.06)) + t*0.9) * 0.35 + sin(dot(p, vec2(-0.07, 0.16)) + t*0.7) * 0.3;
  }
  void main(){
    vec3 v = normalize(vW - cameraPosition);
    float dist = distance(vW, cameraPosition);
    float t = uTime;
    float e = 0.2;
    float h0 = waveH(vW.xz, t);
    vec2 g = vec2(waveH(vW.xz + vec2(e, 0.0), t) - h0, waveH(vW.xz + vec2(0.0, e), t) - h0) / e;
    g *= mix(0.35, 1.0, exp(-dist * 0.01));
    vec3 n = normalize(vec3(g.x * 1.6, -1.0, g.y * 1.6));
    float cosi = clamp(-dot(v, n), 0.0, 1.0);
    float k = 1.0 - 1.33*1.33*(1.0 - cosi*cosi);
    float window = smoothstep(0.0, 0.18, k);
    vec3 rf = k > 0.0 ? normalize(refract(v, n, 1.33)) : vec3(0.0, 1.0, 0.0);
    float sd = max(dot(rf, normalize(uSunDir + vec3(0.0, 0.6, 0.0))), 0.0);
    vec3 skyc = mix(vec3(0.32, 0.66, 1.0), vec3(0.92, 0.97, 1.0), pow(sd, 4.0)) * mix(vec3(0.5, 0.55, 0.36), vec3(1.6), uHealth);
    skyc += vec3(1.0, 0.96, 0.88) * (pow(sd, 260.0) * mix(4.0, 40.0, uHealth) + pow(sd, 24.0) * 1.5);
    skyc += vec3(1.0) * smoothstep(0.0, 0.05, k) * smoothstep(0.24, 0.04, k) * 0.6;   // bright rim of Snell's window
    skyc *= 1.0 - 0.92 * uNight;
    vec3 refl = mediumLight(reflect(v, n), SURF) * 0.9;
    vec3 col = mix(refl, skyc, window);
    gl_FragColor = vec4(fogged(col, vW), 1.0);
  }`,
}));
surface.position.y = SURFACE; surface.frustumCulled = false; scene.add(surface);
