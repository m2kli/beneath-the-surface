'use strict';
// ======================================================================= the village: a cut-away diorama of the bay
const dio = new THREE.Scene();
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#f4f5ee'); g.addColorStop(0.6, '#e3ebe4'); g.addColorStop(1, '#c6d6d1');
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; dio.background = null;
}
const dioCam = new THREE.PerspectiveCamera(26, innerWidth/innerHeight, 1, 3000); window.dioCam = dioCam;
dioCam.position.set(146, 136, 178);
const controls = new OrbitControls(dioCam, renderer.domElement); window.dioControls = controls;
controls.target.set(-6, -3, -14); controls.enableDamping = true; controls.minDistance = 120; controls.maxDistance = 620;
controls.maxPolarAngle = 1.32; controls.enablePan = false; controls.enabled = false; controls.update();
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const hemiL = new THREE.HemisphereLight(0xfff6e8, 0x6f8090, 1.15); dio.add(hemiL);
const moonL = new THREE.DirectionalLight(0x8fb4ff, 0); moonL.position.set(80, 120, -60); dio.add(moonL);
const srgb = h => new THREE.Color(h).convertLinearToSRGB();
const SKY = { day: [srgb('#9fcde4'), srgb('#d7e9ea')], dusk: [srgb('#fbd9b0'), srgb('#d99a86')], night: [srgb('#26364f'), srgb('#0f1826')] };
const bgMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: SKY.day[0].clone() }, bot: { value: SKY.day[1].clone() } },
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ gl_FragColor = vec4(mix(bot, top, smoothstep(-0.45, 0.65, vP.y)), 1.0); }` });
const bgSphere = new THREE.Mesh(new THREE.SphereGeometry(1600, 32, 16), bgMat); bgSphere.renderOrder = -5; dio.add(bgSphere);
const sunL = new THREE.DirectionalLight(0xfff0dc, 2.7);
sunL.position.set(-70, 130, 80); sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048);
Object.assign(sunL.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 10, far: 520 });
sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.5; dio.add(sunL); sunL.target.position.set(0, 0, 10); dio.add(sunL.target);

const SM = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o });
function dm(geo, mat, x = 0, y = 0, z = 0, parent = dio){ const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
const DREEF = [[-20, 32, 7, 3.6], [5, 38, 8, 4.4], [24, 29, 6, 3.2], [-3, 24, 5, 2.6], [-32, 43, 6, 3.0], [31, 44, 5, 2.8], [16, 46, 4, 2.4]];
// one diorama unit = MK ocean units; the diorama's shoreline sits on the real bay's shore
const MK = 2.56, MZ0 = 3, MZ1 = -145;
function toOcean(v, out){ return out.set(v.x*MK, SURFACE + v.y*MK, (v.z - MZ0)*MK + MZ1); }
function oceanFloorDio(x, z){ return (topAt(x*MK, (z - MZ0)*MK + MZ1) - SURFACE)/MK; }
function dioH(x, z){
  const real = oceanFloorDio(x, z);
  const land = 2.2 + 1.3*fbm(x*0.05 + 3, z*0.05 + 1) + Math.min(Math.max(0, -z - 32)*0.12, 4.2 + Math.max(0, -z - 67)*0.05);
  const beach = Math.min(real, 1.1);
  return lerp(real > 0 ? beach : real, land, smooth(-0.5, -6, z));
}
function dioH_old(x, z){
  const land = 2.6 + 1.5*fbm(x*0.05 + 3, z*0.05 + 1) + Math.max(0, -z - 32)*0.12;
  const sea = -10.5 - 2.5*fbm(x*0.04 + 7, z*0.04 + 2);
  let h = lerp(land, sea, smooth(-1, 16, z));
  if(z > 12) for(const [rx, rz, rr, rh] of DREEF) h = Math.max(h, sea + rh*Math.exp(-((x - rx)**2 + (z - rz)**2)/(rr*rr)) * (0.85 + 0.4*fbm(x*0.3, z*0.3)));
  return h;
}
const PATHS = [[[8, 0], [6, -7], [0, -13], [-10, -13], [-21, -11]], [[0, -13], [5, -22], [15, -14], [26, -10], [33, -6]], [[-10, -13], [-14, -25], [-27, -30]],
  [[-14, -25], [-12, -40], [-9, -58], [0, -74]], [[5, -22], [13, -40], [10, -60]], [[-24, -60], [-9, -58], [10, -60], [22, -62]]];
function pathDist(x, z){ let d = 1e9;
  for(const pl of PATHS) for(let i=0;i<pl.length-1;i++){ const [ax, az] = pl[i], [bx, bz] = pl[i + 1], vx = bx - ax, vz = bz - az;
    const t = clamp(((x - ax)*vx + (z - az)*vz)/(vx*vx + vz*vz), 0, 1); d = Math.min(d, Math.hypot(x - ax - vx*t, z - az - vz*t)); }
  return d; }
function dioColor(h, x, z, out){
  const n = fbm(x*0.08 + 11, z*0.08 - 4);
  if(h > 1.25){ out.set('#6fa443').lerp(new THREE.Color('#8dbb55'), n); const pd = pathDist(x, z); if(pd < 1.6) out.lerp(new THREE.Color('#d8c49a'), smooth(1.6, 0.8, pd)); }
  else if(h > -0.9) out.set(h > 0.15 ? '#ecdcae' : '#d6c08e');
  else { out.set('#dccb9e').lerp(new THREE.Color('#9fb0a2'), smooth(-2, -12, h)); if(h > -9 && z > 14) out.lerp(new THREE.Color('#a89a86'), 0.5); }
  return out;
}
{
  // top surface
  const g = new THREE.PlaneGeometry(100, 90 + 140, 120, 260).rotateX(-Math.PI/2).translate(0, 0, (140 - 90)/2), p = g.attributes.position, col = new Float32Array(p.count*3), c = new THREE.Color();
  const grass = new Float32Array(p.count);
  for(let i=0;i<p.count;i++){ const x = p.getX(i), z = p.getZ(i), h = dioH(x, z); p.setY(i, h); dioColor(h, x, z, c); col.set([c.r, c.g, c.b], i*3);
    grass[i] = smooth(1.0, 1.6, h) * smooth(0.9, 1.7, pathDist(x, z)); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aGrass', new THREE.BufferAttribute(grass, 1)); g.computeVertexNormals();
  // the grass takes the season's tint (paths and sand don't), so the ground always matches the trees
  const gm = dio.userData.groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  gm.customProgramCacheKey = () => 'grassTint';
  gm.onBeforeCompile = sh => { sh.uniforms.uGrassTint = grassTint;
    sh.vertexShader = `attribute float aGrass; varying float vGrass;
` + sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
 vGrass = aGrass;`);
    sh.fragmentShader = `uniform vec3 uGrassTint; varying float vGrass;
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
 diffuseColor.rgb *= mix(vec3(1.0), uGrassTint, vGrass);`); };
  dm(g, gm);
  // cut-away walls with soil layers
  const pos = [], cols = [], N = 120;
  const sides = [t => [-50 + t*100, 140], t => [50, 140 - t*230], t => [50 - t*100, -90], t => [-50, -90 + t*230]];
  const band = ['#8c6a43', '#9a6a3e', '#7b4f2d', '#8a857c', '#6d6862'].map(h => new THREE.Color(h));
  const levels = (h, x, z) => { const j = vnoise(x*0.25 + z*0.25, 3.7); return [h, h - 0.9, Math.min(h - 3.5, -11 + j), Math.min(h - 6.5, -17 + j*1.5), Math.min(h - 9, -22 - j*2.5), -40]; };
  for(const side of sides) for(let i=0;i<N*2;i++){
    const [x0, z0] = side(i/(N*2)), [x1, z1] = side((i + 1)/(N*2));
    const r0 = levels(dioH(x0, z0), x0, z0), r1 = levels(dioH(x1, z1), x1, z1);
    for(let r=0;r<5;r++){
      const c0 = r === 0 ? dioColor(r0[0], x0, z0, new THREE.Color()).multiplyScalar(0.85) : band[r];
      const quad = [[x0, r0[r], z0], [x1, r1[r], z1], [x1, r1[r + 1], z1], [x0, r0[r], z0], [x1, r1[r + 1], z1], [x0, r0[r + 1], z0]];
      quad.forEach(v => { pos.push(...v); const k = 0.9 + 0.15*vnoise(v[0]*0.6 + v[2]*0.6, v[1]*0.9); cols.push(c0.r*k, c0.g*k, c0.b*k); });
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); wg.computeVertexNormals();
  dm(wg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  dm(new THREE.BoxGeometry(99.5, 1, 229.5), SM('#5c5751'), 0, -40.4, 25);
  for(let k=0;k<52;k++){ const x = (rng() - 0.5)*86, z = -86 + rng()*(140 + 82), l = 3 + rng()*11;
    dm(new THREE.ConeGeometry(1.2 + rng()*3, l, 6).rotateX(Math.PI), SM(rng() < 0.5 ? '#77716a' : '#5f5a54'), x, -40.8 - l/2, z); }
  for(let k=0;k<20;k++){ const x = (rng() - 0.5)*90, z = -90 + rng()*90, l = 4 + rng()*7;
    dm(new THREE.CylinderGeometry(0.08, 0.15, l, 4), SM('#4a3a2a'), x, -40 - l/2, z); }
}
// water: a translucent block you can see the reef through
const portalU = { tPortal: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uDay: { value: 1 }, uFx: { value: 1 },
  uPlume: { value: 0 }, uBloom: { value: 0 }, uT: { value: 0 }, uSrc: { value: new THREE.Vector2(-22, 4) } };
const PORTAL_VERT = `varying vec3 vW; varying vec3 vN; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const waterTopMat = new THREE.ShaderMaterial({ uniforms: portalU, vertexShader: PORTAL_VERT, fragmentShader: /* glsl */`
  uniform sampler2D tPortal; uniform vec2 uRes; uniform float uDay; uniform float uFx; varying vec3 vW; varying vec3 vN;
  uniform float uPlume; uniform float uBloom; uniform float uT; uniform vec2 uSrc; uniform float uRain; uniform float uGrey; uniform float uCloudS; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
  float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
  float fb2(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*vn2(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
  // sewage and algae on the surface of the bay: they drift east along the shore and curl in the current
  vec3 pollute(vec3 c, vec2 xz){
    vec2 fl = vec2(uT*0.9, uT*0.12);
    vec2 w = vec2(fb2(xz*0.05 + fl*0.03), fb2(xz*0.05 + vec2(5.2, 1.3) - fl*0.025));
    float n = fb2(xz*0.085 + w*3.2 - fl*0.05);
    float st = fb2(vec2(xz.x*0.04 - uT*0.035, xz.y*0.2) + w*2.4);
    vec2 q = xz - uSrc;
    vec2 qs = vec2(q.x - 4.0 - 6.0*uPlume, q.y - 2.0 - 1.5*uPlume)/vec2(7.0 + 8.0*uPlume, 3.0 + 3.0*uPlume);
    float tongue = exp(-dot(qs, qs)) + exp(-dot(q, q)/7.0);
    float plume = clamp(smoothstep(0.42, 0.72, n*0.95 + st*0.25 + tongue*0.5 - 0.3)*min(tongue, 1.0)*sqrt(uPlume)*1.5, 0.0, 0.62);
    vec3 murk = mix(vec3(0.30, 0.31, 0.16), vec3(0.45, 0.42, 0.24), st) * mix(0.45, 1.0, uDay);
    c = mix(c, c*0.5 + murk*0.55, plume);
    c += vec3(0.5, 0.48, 0.38)*smoothstep(0.035, 0.0, abs(n*0.9 + tongue*0.55 - 0.62))*min(tongue, 1.0)*uPlume*0.35;
    float shoreK = smoothstep(46.0, 4.0, xz.y);
    float fld = n*0.7 + st*0.4 + shoreK*0.22;
    float tide = smoothstep(0.6, 0.78, fld)*uBloom;
    vec3 rust = mix(vec3(0.36, 0.12, 0.07), vec3(0.62, 0.27, 0.13), smoothstep(0.35, 0.75, st)) * mix(0.4, 1.0, uDay);
    c = mix(c, c*vec3(1.08, 0.7, 0.58), uBloom*0.6);
    c = mix(c, rust, tide*0.72);
    c += vec3(0.42, 0.3, 0.2)*smoothstep(0.018, 0.0, abs(fld - 0.62))*uBloom*0.3;
    return c;
  }
  void main(){
    vec3 n = normalize(vN);
    if(uRain > 0.01){ n.x += (vn2(vW.xz*2.6 + vec2(uT*6.0, 0.0)) - 0.5)*uRain*0.5; n.z += (vn2(vW.xz*2.6 + vec2(17.0, -uT*6.0)) - 0.5)*uRain*0.5; n = normalize(n); }
    vec2 uv = gl_FragCoord.xy / uRes + n.xz * 0.012 * uFx;
    vec3 c = texture2D(tPortal, uv).rgb;
    vec3 v = normalize(cameraPosition - vW);
    float fr = 0.03 + 0.97*pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 sky = vec3(0.86, 0.93, 0.95) * mix(0.22, 1.0, uDay);
    c = mix(c, c*vec3(0.8, 0.98, 1.0), 0.3*uFx);
    if(uPlume + uBloom > 0.004) c = mix(c, pollute(c, vW.xz), uFx);
    c = mix(c, sky, (fr*0.55 + 0.05) * uFx);
    float csh = uCloudS > 0.01 ? uCloudS*smoothstep(0.42, 0.62, fb2(vW.xz*0.016 + vec2(-uT*0.035, uT*0.01))) : 0.0;
    c *= 1.0 - 0.3*csh*uFx;
    c += pow(max(dot(reflect(-v, n), normalize(vec3(-0.45, 0.8, 0.4))), 0.0), 140.0) * 0.7 * uDay * (1.0 - csh) * uFx;
    c = mix(c, c*0.82, uRain*0.5*uFx); c *= 1.0 - 0.4*uGrey*uFx;
    c = mix(c, uFogC, smoothstep(uFogN, uFogF, distance(cameraPosition, vW))*uFx);
    gl_FragColor = vec4(c, 1.0);
  }` });
const waterSideMat = new THREE.ShaderMaterial({ uniforms: portalU, side: THREE.DoubleSide, vertexShader: PORTAL_VERT, fragmentShader: /* glsl */`
  uniform sampler2D tPortal; uniform vec2 uRes; uniform float uDay; uniform float uFx; varying vec3 vW; varying vec3 vN; uniform float uBloom; uniform float uGrey; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF;
  void main(){
    vec3 c = texture2D(tPortal, gl_FragCoord.xy / uRes).rgb;
    float rim = smoothstep(-0.9, 0.0, vW.y);
    c = mix(c, c*vec3(0.9, 1.0, 1.05) + vec3(0.05, 0.08, 0.09)*rim*mix(0.3, 1.0, uDay), uFx);
    c = mix(c, c*vec3(0.95, 0.62, 0.48), uBloom*0.7*uFx); c *= 1.0 - 0.45*uGrey*uFx;
    c = mix(c, uFogC, smoothstep(uFogN, uFogF, distance(cameraPosition, vW))*uFx);
    gl_FragColor = vec4(c, 1.0);
  }` });
const portalMeshes = [];
const SEA_Z = 140;   // the far edge of the diorama's sea: the bay, the reef wall, and the open sea beyond
const wTopGeo = new THREE.PlaneGeometry(99.6, SEA_Z - 1, 60, 84).rotateX(-Math.PI/2).translate(0, -0.05, (SEA_Z + 1.8)/2);
const wTop = new THREE.Mesh(wTopGeo, waterTopMat); dio.add(wTop); portalMeshes.push(wTop);
const wBase = Float32Array.from(wTopGeo.attributes.position.array);
// side windows follow the cut: from the seabed up to the waterline, nothing where the edge is dry land
for(const side of [t => [-49.85 + t*99.7, SEA_Z - 0.15], t => [-49.85, 0.9 + t*(SEA_Z - 1.05)], t => [49.85, 0.9 + t*(SEA_Z - 1.05)]]){
  const pos = [], N = 260;
  for(let i=0;i<N;i++){
    const [x0, z0] = side(i/N), [x1, z1] = side((i + 1)/N);
    const h0 = Math.min(dioH(x0, z0), 0), h1 = Math.min(dioH(x1, z1), 0);
    if(h0 >= -0.02 && h1 >= -0.02) continue;
    const b0 = h0 - 1.5, b1 = h1 - 1.5;
    pos.push(x0, 0, z0, x1, 0, z1, x1, b1, z1, x0, 0, z0, x1, b1, z1, x0, b0, z0);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, waterSideMat); m.position.y = -0.05; dio.add(m); portalMeshes.push(m);
}
// reef life in miniature: coral colour = reef health, fish count = fish stock
const dCorals = [], dCoralMeshes = [];
{
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true });
  const shapes = [[new THREE.IcosahedronGeometry(0.8, 0), 80], [new THREE.ConeGeometry(0.35, 1.9, 5).translate(0, 0.9, 0), 110], [new THREE.CylinderGeometry(1.0, 0.45, 0.35, 7).translate(0, 0.7, 0), 45]];
  for(const [geo, n] of shapes){
    const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = im.receiveShadow = true;
    for(let i=0;i<n;i++){
      const R = DREEF[(rng()*DREEF.length)|0], a = rng()*6.283, r = Math.sqrt(rng())*R[2]*0.95, x = R[0] + Math.cos(a)*r, z = R[1] + Math.sin(a)*r;
      dummy.position.set(x, dioH(x, z) - 0.15, z); dummy.rotation.set((rng() - .5)*0.4, rng()*6.28, (rng() - .5)*0.4);
      dummy.scale.setScalar(0.7 + rng()*0.9); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      const c = PAL[(rng()*PAL.length)|0].clone(); im.setColorAt(i, c); dCorals.push({ im, i, c, thr: rng() });
    }
    im.visible = false; dio.add(im); dCoralMeshes.push(im);
  }
  for(let k=0;k<26;k++){ const x = (rng() - 0.5)*90, z = 16 + rng()*32, l = 2 + rng()*3;
    const m = dm(new THREE.ConeGeometry(0.35, l, 4), SM(rng() < 0.5 ? '#6fa04a' : '#9a9a3a'), x, dioH(x, z) + l/2, z); m.rotation.set((rng()-.5)*0.3, rng()*3, (rng()-.5)*0.3); }
}
let lastCoral = -1;
function updateDioCorals(){
  if(Math.abs(eco.coral - lastCoral) < 0.004) return; lastCoral = eco.coral;
  const bleach = new THREE.Color('#f1eee4'), dead = new THREE.Color('#8b8a72'), c = new THREE.Color();
  for(const d of dCorals){ c.copy(eco.coral > d.thr*0.95 ? d.c : (d.thr > 0.78 ? dead : bleach)); d.im.setColorAt(d.i, c); }
  dCoralMeshes.forEach(m => m.instanceColor.needsUpdate = true);
}
const DF = 220, DB = 110;
const dFish = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 1.05, 5).rotateX(Math.PI/2), new THREE.MeshStandardMaterial({ roughness: 0.45, flatShading: true }), DF);
const dBait = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.6, 4).rotateX(Math.PI/2), new THREE.MeshStandardMaterial({ color: '#c9d6de', roughness: 0.25, metalness: 0.6, flatShading: true }), DB);
const dFishP = [];
{
  const fc = ['#ffc22e', '#2f7cff', '#ff6a3a', '#ff5fae', '#2fd6b4'].map(h => new THREE.Color(h));
  for(let i=0;i<DF;i++){ const R = DREEF[i % DREEF.length]; dFishP.push({ cx: R[0], cz: R[1], r: 2.5 + rng()*5, y: -7 + rng()*5, ph: rng()*6.28, sp: (0.25 + rng()*0.35)*(rng() < 0.5 ? 1 : -1) }); dFish.setColorAt(i, fc[i % 5]); }
  dFish.visible = dBait.visible = false; dio.add(dFish); dio.add(dBait);
}
function updateDioFish(t){
  dummy.scale.setScalar(1);
  dFish.count = Math.round(clamp(eco.fish, 0, 1)*DF); dBait.count = Math.round(clamp(eco.bait, 0, 1)*DB);
  for(let i=0;i<dFish.count;i++){ const f = dFishP[i], a = f.ph + t*f.sp;
    dummy.position.set(f.cx + Math.cos(a)*f.r, f.y + Math.sin(a*2)*0.4, f.cz + Math.sin(a)*f.r*0.7);
    dummy.lookAt(f.cx + Math.cos(a + 0.1*Math.sign(f.sp))*f.r, f.y, f.cz + Math.sin(a + 0.1*Math.sign(f.sp))*f.r*0.7);
    dummy.scale.setScalar(1); dummy.updateMatrix(); dFish.setMatrixAt(i, dummy.matrix); }
  for(let i=0;i<dBait.count;i++){ const lay = ((i*0.618) % 1) - 0.5, a = i*2.4 + t*0.9, r = 2.6*Math.sqrt(1 - 4*lay*lay) + 0.4;
    dummy.position.set(-2 + Math.cos(a)*r, -5.5 + lay*4, 33 + Math.sin(a)*r);
    dummy.lookAt(-2 + Math.cos(a + 0.1)*r, -5.5 + lay*4, 33 + Math.sin(a + 0.1)*r); dummy.updateMatrix(); dBait.setMatrixAt(i, dummy.matrix); }
  dFish.instanceMatrix.needsUpdate = true; dBait.instanceMatrix.needsUpdate = true;
}
const dNets = [0, 2, 1, 4].map(k => { const R = DREEF[k], g = new THREE.PlaneGeometry(5, 5, 6, 6).rotateX(-Math.PI/2), gp = g.attributes.position;
  for(let i=0;i<gp.count;i++) gp.setY(i, -0.12*(gp.getX(i)**2 + gp.getZ(i)**2)*0.3 + Math.sin(gp.getX(i))*0.3);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#1f3b34', wireframe: true })); m.position.set(R[0] + 1, dioH(R[0], R[1]) + 0.6, R[1]); m.visible = false; dio.add(m); return m; });

// village buildings
const VB = {};
const winMat = new THREE.MeshStandardMaterial({ color: '#2f4a5c', roughness: 0.25, flatShading: true, emissive: new THREE.Color('#ffc46b'), emissiveIntensity: 0 });
const lampMat = new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: new THREE.Color('#ffd27a'), emissiveIntensity: 0 });
const canopyMats = [], SWAY = [];
// a subtropical island: fresh green in spring, deep green in summer, some broadleaf trees turn amber in autumn,
// and the dry winter goes olive with khaki grass. Palms stay green all year.
const SEASON_COL = ['#8cc95a', '#5d9a3a', '#7f9a3a', '#6f8a42'].map(h => new THREE.Color(h));
const SEASON_ALT = ['#9ad064', '#4f8d34', '#c9843a', '#8a8a48'].map(h => new THREE.Color(h)); // the other half of the trees
const GRASS_TINT = [[1.0, 1.06, 0.9], [0.84, 0.96, 0.8], [1.22, 1.02, 0.58], [1.3, 1.02, 0.56]].map(a => new THREE.Vector3(...a));
const grassTint = { value: GRASS_TINT[0].clone() };
function prism(r, len){ return new THREE.CylinderGeometry(r, r, len, 3).rotateZ(Math.PI/2).rotateX(-Math.PI/2); }
function merged(parts, mat, parent = dio){
  const m = new THREE.Mesh(mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)), mat);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function house(color, roof, two){
  const g = new THREE.Group(), H = two ? 4.8 : 2.9, W = two ? 4.4 : 4.2, D = 3.6, base = 0.5;
  const trim = SM('#f5f0e6'), wood = SM('#7a5a3c'), roofM = SM(roof), stone = SM('#a69d8f');
  dm(new THREE.BoxGeometry(W + 0.35, base, D + 0.35), stone, 0, base/2, 0, g);
  dm(new THREE.BoxGeometry(W, H, D), SM(color), 0, base + H/2, 0, g);
  const tr = [];
  for(const sx of [-1, 1]) for(const sz of [-1, 1]) tr.push(new THREE.BoxGeometry(0.2, H, 0.2).translate(sx*W/2, base + H/2, sz*D/2));
  if(two) tr.push(new THREE.BoxGeometry(W + 0.12, 0.2, D + 0.12).translate(0, base + H*0.5, 0));
  tr.push(new THREE.BoxGeometry(W + 0.12, 0.22, D + 0.12).translate(0, base + H, 0));
  merged(tr, trim, g);
  const r = (D + 1.5)/1.732, ry = 0.62, roofY = base + H + 0.5*r*ry;
  dm(prism(r, W + 0.9).scale(1, ry, 1), roofM, 0, roofY, 0, g);
  dm(new THREE.BoxGeometry(W + 1.0, 0.22, 0.3), SM('#5b3b2a'), 0, roofY + r*ry - 0.04, 0, g);
  dm(new THREE.BoxGeometry(0.55, 1.5, 0.55), SM('#9c5a44'), W*0.25, roofY + r*ry*0.45, -D*0.2, g);
  dm(new THREE.BoxGeometry(0.95, 1.75, 0.12), wood, 0.85, base + 0.875, D/2 + 0.03, g);
  dm(new THREE.BoxGeometry(1.4, 0.2, 0.7), stone, 0.85, base*0.5, D/2 + 0.45, g);
  const win = (x, y, z, rot) => { const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.y = rot; g.add(w);
    dm(new THREE.BoxGeometry(1.05, 0.95, 0.1), trim, 0, 0, 0, w); dm(new THREE.BoxGeometry(0.8, 0.7, 0.12), winMat, 0, 0, 0.01, w);
    for(const sx of [-1, 1]) dm(new THREE.BoxGeometry(0.32, 0.95, 0.06), roofM, sx*0.72, 0, 0.02, w); };
  win(-1.05, base + 1.55, D/2 + 0.05, 0);
  dm(new THREE.BoxGeometry(1.0, 0.25, 0.32), wood, -1.05, base + 0.98, D/2 + 0.2, g);
  for(let k=0;k<4;k++) dm(new THREE.IcosahedronGeometry(0.15, 0), SM(['#ff6b8a', '#ffd166', '#ff8c42', '#e05a9c'][k]), -1.4 + k*0.24, base + 1.2, D/2 + 0.22, g);
  win(W/2 + 0.05, base + 1.55, 0, Math.PI/2); win(-W/2 - 0.05, base + 1.55, 0, -Math.PI/2);
  if(two){ win(-1.05, base + H*0.76, D/2 + 0.05, 0); win(1.05, base + H*0.76, D/2 + 0.05, 0); }
  return g;
}
function tree(x, z, s){
  const g = new THREE.Group(); g.position.set(x, dioH(x, z), z); g.scale.setScalar(s); g.rotation.y = rng()*6; dio.add(g); SWAY.push({ g, ph: Math.random()*6, k: 1 });
  const bark = SM('#6f4e33');
  dm(new THREE.CylinderGeometry(0.26, 0.45, 4.2, 7), bark, 0, 2.1, 0, g);
  dm(new THREE.CylinderGeometry(0.1, 0.18, 2, 5), bark, 0.6, 3.6, 0, g).rotation.z = -0.8;
  const m1 = SM('#5f9a3c'), m2 = SM('#76b04a'); m1.userData.v = rng(); m2.userData.v = rng(); canopyMats.push(m1, m2);
  for(let k=0;k<8;k++){ const a = k*0.8 + rng(), r = k ? 1.3 + rng()*0.6 : 0;
    dm(new THREE.IcosahedronGeometry(1.25 + rng()*0.7, 1), k % 2 ? m1 : m2, Math.cos(a)*r, 4.6 + rng()*1.4 + (k ? 0 : 1), Math.sin(a)*r, g); }
  return g;
}
function bush(x, z, s){
  const g = new THREE.Group(); g.position.set(x, dioH(x, z), z); g.scale.setScalar(s); dio.add(g); SWAY.push({ g, ph: Math.random()*6, k: 0.6 });
  const m = SM(rng() < 0.5 ? '#5a9238' : '#6fa847'); m.userData.v = rng(); canopyMats.push(m);
  for(let k=0;k<4;k++) dm(new THREE.IcosahedronGeometry(0.55 + rng()*0.35, 1), m, (rng() - .5)*1.2, 0.4 + rng()*0.3, (rng() - .5)*1.2, g);
  if(rng() < 0.5) for(let k=0;k<3;k++) dm(new THREE.IcosahedronGeometry(0.12, 0), SM(['#ff7aa2', '#fff1a8', '#ff9f43'][k]), (rng() - .5)*1.3, 0.9, (rng() - .5)*1.3, g);
}
function palm(x, z, s){
  const g = new THREE.Group(); g.position.set(x, dioH(x, z), z); g.scale.setScalar(s); g.rotation.y = rng()*6; dio.add(g); SWAY.push({ g, ph: Math.random()*6, k: 1.8 });
  const N = 8, Ht = 7.5, lean = 1.8, segs = [];
  let top = new THREE.Vector3();
  for(let i=0;i<N;i++){ const t0 = i/N, t1 = (i + 1)/N;
    const a = new THREE.Vector3(lean*t0*t0, Ht*t0, 0), b = new THREE.Vector3(lean*t1*t1, Ht*t1, 0), len = a.distanceTo(b);
    const c = new THREE.CylinderGeometry(0.2 - 0.06*t1, 0.24 - 0.06*t0, len*1.02, 6);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    c.translate((a.x + b.x)/2, (a.y + b.y)/2, 0); segs.push(c); top = b; }
  merged(segs, SM('#8b6d48'), g);
  const leaf = []; const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for(let k=0;k<9;k++){ let pz = 0, py = 0;
    for(let j=0;j<5;j++){ const th = 0.35 - j*0.32, w = 0.75*(1 - j*0.16);
      const sg = new THREE.BoxGeometry(w, 0.05, 0.9); pz += Math.cos(th)*0.45; py += Math.sin(th)*0.45;
      e.set(-th, k/9*Math.PI*2, 0, 'YXZ'); q.setFromEuler(e);
      const off = new THREE.Vector3(0, py, pz).applyAxisAngle(new THREE.Vector3(0, 1, 0), k/9*Math.PI*2);
      M4.compose(off.add(top), q, new THREE.Vector3(1, 1, 1)); sg.applyMatrix4(M4); leaf.push(sg);
      pz += Math.cos(th)*0.45; py += Math.sin(th)*0.45; } }
  const lm = SM('#3f8a34');
  merged(leaf, lm, g);
  for(let k=0;k<3;k++) dm(new THREE.SphereGeometry(0.22, 8, 6), SM('#6a4a26'), top.x + Math.cos(k*2.1)*0.3, top.y - 0.25, Math.sin(k*2.1)*0.3, g);
  return g;
}
function hullGeo(L, W, Hh){
  const g = new THREE.BoxGeometry(W, Hh, L, 4, 3, 14), hp = g.attributes.position;
  for(let i=0;i<hp.count;i++){ let x = hp.getX(i), y = hp.getY(i); const z = hp.getZ(i), u = z/(L/2);
    const wf = u > 0 ? Math.sqrt(Math.max(0, 1 - u*u)) : 1 - 0.18*u*u;
    x *= Math.max(0.04, wf);
    if(y < 0) x *= 0.5 + 0.5*(1 + y/(Hh/2));
    if(y > 0) y += 0.35*Math.max(0, u)*Math.max(0, u)*Hh;
    hp.setXYZ(i, x, y, z); }
  g.computeVertexNormals(); return g;
}
function makeBoat(color, kind){
  const big = kind === 'trawl', tour = kind === 'tour', L = big ? 6.6 : tour ? 3.6 : 4.0, W = big ? 2.2 : 1.45, Hh = big ? 1.2 : 0.9;
  const g = new THREE.Group();
  dm(hullGeo(L, W, Hh), SM(color, { flatShading: false, roughness: 0.6 }), 0, 0.15, 0, g);
  dm(hullGeo(L*1.01, W*1.04, Hh*0.14), SM(big ? '#c9a24a' : tour ? '#2f8fd6' : '#2b3a4a'), 0, 0.15 + Hh*0.36, 0, g);
  dm(new THREE.BoxGeometry(W*0.78, 0.08, L*0.78), SM('#c9a77a'), 0, 0.15 + Hh*0.42, -L*0.04, g);
  if(tour){
    dm(new THREE.BoxGeometry(W*0.7, 0.06, L*0.4), SM('#ffffff'), 0, 1.4, -L*0.08, g);
    for(const sx of [-1, 1]) for(const sz of [-1, 1]) dm(new THREE.BoxGeometry(0.05, 0.8, 0.05), SM('#9aa'), sx*W*0.32, 1.0, -L*0.08 + sz*L*0.18, g);
    for(let k=0;k<3;k++) dm(new THREE.CapsuleGeometry(0.16, 0.3, 2, 6), SM(['#ff7a59', '#4fc3d9', '#ffd166'][k]), (k - 1)*0.4, 0.95, -L*0.15, g);
  } else {
    const cabH = big ? 1.5 : 0.8, cabL = L*(big ? 0.26 : 0.3), cz = big ? L*0.12 : -L*0.12;
    dm(new THREE.BoxGeometry(W*0.6, cabH, cabL), SM('#f1ece0'), 0, 0.6 + cabH/2, cz, g);
    dm(new THREE.BoxGeometry(W*0.61, 0.24, cabL*1.01), winMat, 0, 0.6 + cabH*0.72, cz, g);
    dm(new THREE.BoxGeometry(W*0.72, 0.1, cabL*1.2), SM(big ? '#b8452f' : color), 0, 0.65 + cabH, cz, g);
    if(!big){ dm(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 5), SM('#6b5034'), 0, 1.7, L*0.18, g);
      dm(new THREE.BoxGeometry(0.03, 0.32, 0.5), SM('#ffd166'), 0, 2.6, L*0.18 - 0.28, g); }
  }
  if(big){
    const steel = SM('#2e2e2e');
    for(const sx of [-1, 1]){ dm(new THREE.BoxGeometry(0.14, 3, 0.14), steel, sx*0.85, 2.0, -L*0.4, g);
      const boom = dm(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 5), steel, sx*1.6, 2.2, -L*0.05, g); boom.rotation.z = sx*1.0; }
    dm(new THREE.BoxGeometry(1.9, 0.14, 0.14), steel, 0, 3.45, -L*0.4, g);
    dm(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 10).rotateZ(Math.PI/2), SM('#3d6b5a'), 0, 0.95, -L*0.25, g);
    const net = dm(new THREE.ConeGeometry(1.4, 5, 8, 1, true).rotateX(-Math.PI/2), new THREE.MeshStandardMaterial({ color: '#203a33', wireframe: true }), 0, -3.2, -L*0.5 - 4, g);
    net.visible = false; g.userData.net = net;
  }
  dio.add(g); g.visible = false;
  return g;
}
{
  const ROOF = ['#c2593a', '#b9744a', '#4c7aa0', '#c9a24a', '#9b4a3b', '#5f8f6e'];
  const WALL = ['#f2d6a2', '#9fd3c7', '#f4a698', '#c7d8f0', '#f7e3b5', '#b9e2a8', '#f0c0d0', '#e9e4d8'];
  const slots = [[-18, -8], [-9, -9], [-1, -6.5], [17, -7.5], [25, -5.5], [-27, -18], [-16, -20], [-5, -19], [6, -23], [15, -19.5], [25, -21], [35, -14]];
  // vegetable garden with a fence
  { const gx = -30, gz = -8, y = dioH(gx, gz);
    dm(new THREE.BoxGeometry(7, 0.25, 5), SM('#7a5a3c'), gx, y + 0.1, gz);
    for(let r=0;r<4;r++) for(let c=0;c<6;c++) dm(new THREE.IcosahedronGeometry(0.32, 0), SM(r % 2 ? '#6bab3e' : '#8cc152'), gx - 2.8 + c*1.1, y + 0.45, gz - 1.6 + r*1.05);
    const fence = [];
    for(let i=0;i<=8;i++){ fence.push(new THREE.BoxGeometry(0.12, 0.9, 0.12).translate(gx - 4 + i, y + 0.45, gz - 3)); fence.push(new THREE.BoxGeometry(0.12, 0.9, 0.12).translate(gx - 4 + i, y + 0.45, gz + 3)); }
    for(const zz of [-3, 3]) fence.push(new THREE.BoxGeometry(8, 0.1, 0.08).translate(gx, y + 0.7, gz + zz));
    merged(fence, SM('#e8dcc2')); }
  // resort
  { const g = new THREE.Group(), x = -31, z = -34; g.position.set(x, dioH(x, z), z);
    dm(new THREE.BoxGeometry(16, 6.5, 7), SM('#f6f2ea'), 0, 3.25, 0, g); dm(new THREE.BoxGeometry(10, 3.5, 6), SM('#f6f2ea'), -2, 8.25, 0, g);
    for(const y of [2.1, 4.4]) dm(new THREE.BoxGeometry(16.2, 0.25, 7.6), SM('#9fb0b8'), 0, y, 0, g);
    for(const y of [1.2, 3.4, 5.6]) dm(new THREE.BoxGeometry(15.6, 0.9, 7.08), winMat, 0, y, 0, g);
    dm(new THREE.BoxGeometry(9.6, 0.9, 6.08), winMat, -2, 8.2, 0, g);
    dm(new THREE.BoxGeometry(7, 0.3, 3.6), SM('#5fd6e4', { roughness: 0.1 }), 2, 0.2, 6.5, g);
    for(const [px, c] of [[-3, '#ff7a59'], [-1, '#ffd166'], [6, '#4fc3d9']]){ dm(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), SM('#555'), px, 1.1, 6.6, g); dm(new THREE.ConeGeometry(1.1, 0.6, 8), SM(c), px, 2.3, 6.6, g); }
    g.scale.setScalar(0.001); g.visible = false; dio.add(g); VB.resort = g; }
  // treatment plant
  { const g = new THREE.Group(), x = -42, z = -18; g.position.set(x, dioH(x, z), z);
    dm(new THREE.BoxGeometry(5, 2.6, 4), SM('#a4a9ad'), 0, 1.3, 0, g); dm(new THREE.BoxGeometry(5.2, 0.2, 4.2), SM('#7d8387'), 0, 2.7, 0, g);
    for(const dx of [-1.4, 1.6]){ dm(new THREE.CylinderGeometry(1.4, 1.4, 1.8, 16), SM('#cfd4d6'), dx, 0.9, 3.6, g); dm(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 16), SM('#6f9f8c'), dx, 1.82, 3.6, g); }
    g.scale.setScalar(0.001); g.visible = false; dio.add(g); VB.plant = g; }
  // net recycling
  { const g = new THREE.Group(), x = 34, z = -4; g.position.set(x, dioH(x, z), z);
    dm(new THREE.BoxGeometry(5, 3, 4), SM('#d7bf92'), 0, 1.5, 0, g); dm(prism(3.2, 5.4).scale(1, 0.5, 1), SM('#8b5a3c'), 0, 3.6, 0, g);
    dm(new THREE.BoxGeometry(1.8, 2.0, 0.1), SM('#5a4030'), 0, 1.0, 2.02, g);
    for(let k=0;k<4;k++) dm(new THREE.BoxGeometry(1.2, 1, 1.1), SM('#3e8a66'), -2 + k*1.35, 0.5, 2.9, g);
    g.scale.setScalar(0.001); g.visible = false; dio.add(g); VB.recycle = g; }
  // protected-zone buoys
  VB.buoys = [];
  for(let k=0;k<26;k++){ const a = k/26*Math.PI*2, x = -1 + Math.cos(a)*33, z = 34 + Math.sin(a)*13.5;
    const g = new THREE.Group(); g.position.set(x, 0.2, z); g.userData.a = a; dm(new THREE.SphereGeometry(0.55, 12, 10), SM('#ff6a1a', { flatShading: false }), 0, 0, 0, g);
    dm(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 4), SM('#333'), 0, 0.9, 0, g); dm(new THREE.BoxGeometry(0.03, 0.35, 0.5), SM('#ffffff'), 0, 1.5, 0.25, g);
    g.scale.setScalar(0.001); g.visible = false; dio.add(g); VB.buoys.push(g); }
  // cold store
  { const g = new THREE.Group(), x = 25, z = -11; g.position.set(x, dioH(x, z), z);
    dm(new THREE.BoxGeometry(4.6, 2.8, 3.6), SM('#e8eef0'), 0, 1.4, 0, g); dm(new THREE.BoxGeometry(4.8, 0.25, 3.8), SM('#8aa4ad'), 0, 2.9, 0, g);
    for(const dx of [-1.2, 1.2]) dm(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 12), SM('#5a6a72'), dx, 3.1, 0, g);
    dm(new THREE.BoxGeometry(1.4, 1.9, 0.1), SM('#4f7d8c'), 0, 0.95, 1.82, g);
    g.scale.setScalar(0.001); g.visible = false; dio.add(g); VB.cold = g; }
  // coral nursery: a shed on the beach and frames of baby coral in the shallows
  { const g = new THREE.Group(), x = -42, z = -4; g.position.set(x, dioH(x, z), z);
    dm(new THREE.BoxGeometry(3.6, 2.2, 3), SM('#cfe9e3'), 0, 1.1, 0, g); dm(prism(2.5, 4.2).scale(1, 0.5, 1), SM('#e07a5f'), 0, 2.6, 0, g);
    dm(new THREE.BoxGeometry(0.06, 2.6, 0.06), SM('#444'), 1.9, 1.3, 1.2, g); dm(new THREE.BoxGeometry(0.9, 0.5, 0.04), SM('#ff7aa2'), 2.35, 2.35, 1.2, g);
    g.scale.setScalar(0.001); g.visible = false; dio.add(g); VB.nursery = g;
    VB.frames = [];
    for(let k=0;k<5;k++){ const fx = -40 + k*3.2, fz = 13 + (k % 2)*2.2; const f = new THREE.Group(); f.position.set(fx, 0.25, fz);
      dm(new THREE.SphereGeometry(0.35, 10, 8), SM('#ffffff'), 0, 0, 0, f); dm(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), SM('#333'), 0, 0.5, 0, f);
      f.visible = false; dio.add(f); VB.frames.push(f); } }
  // fishermen's school
  { const g = new THREE.Group(), x = -2, z = -29; g.position.set(x, dioH(x, z), z);
    dm(new THREE.BoxGeometry(6, 3, 4), SM('#f3e3c3'), 0, 1.5, 0, g); dm(prism(3.3, 6.6).scale(1, 0.55, 1), SM('#3f6e9a'), 0, 3.85, 0, g);
    dm(new THREE.BoxGeometry(0.9, 1.2, 0.9), SM('#f3e3c3'), 0, 5.0, 0, g); dm(new THREE.ConeGeometry(0.75, 0.9, 4), SM('#3f6e9a'), 0, 6.05, 0, g);
    for(const dx of [-1.8, 0, 1.8]) dm(new THREE.BoxGeometry(0.9, 0.9, 0.1), winMat, dx, 1.7, 2.02, g);
    g.scale.setScalar(0.001); g.visible = false; dio.add(g); VB.school = g; }
  // greenery and rocks
  [[-44, -44, 1.3], [-36, -46, 1.1], [-20, -44, 1.2], [-6, -42, 1.0], [10, -45, 1.3], [24, -42, 1.1], [40, -44, 1.2], [44, -30, 1.0], [-45, -30, 1.1], [42, -22, 0.9], [-12, -33, 0.9], [8, -33, 1.0], [30, -31, 0.95], [-38, -38, 0.8], [18, -38, 0.85]].forEach(([x, z, s]) => tree(x, z, s));
  [[-38, 0.5], [-30, -1], [0, 0.5], [22, 0.2], [30, -1.5], [44, 0], [-46, -1], [38, -2]].forEach(([x, z]) => palm(x, z, 0.75 + rng()*0.3));
  for(let k=0;k<26;k++){ const x = -44 + rng()*88, z = -44 + rng()*38; if(pathDist(x, z) < 3.0 || Math.abs(x - 8) < 3) continue; bush(x, z, 0.7 + rng()*0.6); }
  for(let k=0;k<22;k++){ const x = -46 + rng()*92, z = -46 + rng()*50; const rk = dm(new THREE.IcosahedronGeometry(0.4 + rng()*0.8, 0), SM(rng() < 0.5 ? '#9a958c' : '#b3ab9e'), x, dioH(x, z) + 0.1, z); rk.rotation.set(rng()*3, rng()*3, rng()*3); rk.scale.y = 0.6; }
  for(let k=0;k<40;k++){ const side = k % 4, t = rng()*100 - 50, y = -2.5 - rng()*14;
    const [x, z] = side === 0 ? [t, 50.3] : side === 1 ? [50.3, t] : side === 2 ? [t, -50.3] : [-50.3, t];
    if(dioH(x === 50.3 ? 49.9 : x === -50.3 ? -49.9 : x, z === 50.3 ? 49.9 : z === -50.3 ? -49.9 : z) < y + 1) continue;
    const rk = dm(new THREE.IcosahedronGeometry(0.6 + rng()*1.1, 0), SM(rng() < 0.5 ? '#8a857c' : '#a49d90'), x, y, z); rk.rotation.set(rng()*3, rng()*3, rng()*3); }
}
// shoreline foam
const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });
{
  const pts = [];
  for(let x = -49.6; x <= 49.6; x += 0.8){ let a = -6, b = 20; for(let it=0;it<22;it++){ const m = (a + b)/2; if(dioH(x, m) > 0.05) a = m; else b = m; } pts.push([x, a]); }
  const pos = [], idx = [];
  pts.forEach(([x, z], i) => { pos.push(x, 0.24, z - 0.2, x, 0.24, z + 0.7); if(i){ const k = i*2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, foamMat); m.renderOrder = 3; dio.add(m);
}
// clouds: invisible to the camera, but their shadows sweep across the model
const clouds = [];
{
  const cm = new THREE.MeshStandardMaterial({ colorWrite: false, depthWrite: false });
  for(let k=0;k<13;k++){ const g = new THREE.Group();
    for(let j=0;j<5;j++){ const m = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + rng()*3, 1), cm); m.position.set((j - 2)*3.5, rng()*2, (rng() - .5)*4); m.castShadow = true; g.add(m); }
    g.position.set(-110 + rng()*220, 40 + rng()*8, -60 + rng()*120); g.renderOrder = -1; dio.add(g); clouds.push({ g, sp: 0.6 + rng()*0.7 }); }
}
// boats and villagers
const LINE_COL = ['#e65a4a', '#2f78c4', '#f2c14e', '#3aa57a', '#e88a3a', '#7a5fc2', '#e5e1d6', '#d65a8a'];
const dBoats = [];
for(let i=0;i<10;i++) dBoats.push({ g: makeBoat(LINE_COL[i % LINE_COL.length], 'line'), role: 'line', idx: i, home: new THREE.Vector3(8 + (i % 2 ? 2.6 : -2.6), 0, 4 + Math.floor(i/2)*4.6) });
for(let i=0;i<3;i++) dBoats.push({ g: makeBoat('#3a4652', 'trawl'), role: 'trawl', idx: i, home: new THREE.Vector3(15, 0, 6 + i*7.2) });
for(let i=0;i<4;i++) dBoats.push({ g: makeBoat('#f4f4f2', 'tour'), role: 'tour', idx: i, home: new THREE.Vector3(-13 - i*4, 0, 5.5) });
dBoats.forEach(b => { b.pos = b.home.clone(); b.tgt = b.home.clone(); b.away = null; b.head = 0; b.ph = rng()*6; b.path = null; });
