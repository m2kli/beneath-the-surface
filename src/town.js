'use strict';
// ======================================================================= the village grows: stilt-hut hamlet → fishing town → seaside town
// every building is kit-bashed from coloured parts and merged, so a whole house costs one or two draw calls
const KM = new THREE.Matrix4(), KV = new THREE.Vector3(), KQ = new THREE.Quaternion(), KE = new THREE.Euler(), K1 = new THREE.Vector3(1, 1, 1), KC = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, flatShading: true });
const glassMat = new THREE.MeshStandardMaterial({ color: '#cfeef2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.4, depthWrite: false });
vcMat.envMap = skyEnv; vcMat.envMapIntensity = 0.35; glassMat.envMap = skyEnv; glassMat.envMapIntensity = 1.4;
class Kit {
  constructor(){ this.L = { p: [], w: [], l: [], g: [] }; }
  put(list, geo, col, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0){
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if(g.attributes.uv) g.deleteAttribute('uv');
    if(g.attributes.uv1) g.deleteAttribute('uv1');
    g.applyMatrix4(KM.compose(KV.set(x, y, z), KQ.setFromEuler(KE.set(rx, ry, rz, 'YXZ')), K1));
    // baked light: each part gets a slight tone of its own, and everything darkens toward the ground (walls meet the earth, eaves shade the top of the wall)
    if(list === 'p'){ KC.set(col); const n = g.attributes.position.count, a = new Float32Array(n*3), pp = g.attributes.position, j = 1 + (Math.random() - 0.5)*0.07;
      for(let i=0;i<n;i++){ const y = pp.getY(i), k = j*(0.66 + 0.34*Math.min(1, Math.max(0, y/1.6))); a[i*3] = KC.r*k; a[i*3 + 1] = KC.g*k; a[i*3 + 2] = KC.b*k; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    this.L[list].push(g); return this;
  }
  box(w, h, d, col, x, y, z, ry, rx, rz){ return this.put('p', new THREE.BoxGeometry(w, h, d), col, x, y, z, ry, rx, rz); }
  cyl(rt, rb, h, seg, col, x, y, z, ry, rx, rz){ return this.put('p', new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y, z, ry, rx, rz); }
  ball(r, col, x, y, z, det = 0){ return this.put('p', new THREE.IcosahedronGeometry(r, det), col, x, y, z); }
  geo(g, col, x, y, z, ry, rx, rz){ return this.put('p', g, col, x, y, z, ry, rx, rz); }
  win(w, h, d, x, y, z, ry){ return this.put('w', new THREE.BoxGeometry(w, h, d), null, x, y, z, ry); }
  glow(g, x, y, z, ry){ return this.put('l', g, null, x, y, z, ry); }
  glass(w, h, d, x, y, z, ry){ return this.put('g', new THREE.BoxGeometry(w, h, d), null, x, y, z, ry); }
  build(x = 0, z = 0, ry = 0, y){
    const g = new THREE.Group(); g.position.set(x, y ?? dioH(x, z), z); g.rotation.y = ry;
    const mk = (list, mat, cast) => { if(!list.length) return; const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); };
    mk(this.L.p, vcMat, true); mk(this.L.w, winMat, false); mk(this.L.l, lampMat, false); mk(this.L.g, glassMat, false);
    if(!this.noContact && g.children[0]){ const gg = g.children[0].geometry; gg.computeBoundingBox(); const bb = gg.boundingBox, sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
      if(sx > 0.8 && sz > 0.8 && sx < 30 && sz < 30 && bb.min.y > -1) g.add(contactShadow(sx, sz, (bb.min.x + bb.max.x)/2, (bb.min.z + bb.max.z)/2)); }
    dio.add(g); return g;
  }
}
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
// a pitched roof over a W×D box whose top is at y0: gable infill, two slabs, optional tile/thatch rows, ridge
function gable(k, W, D, y0, pitch, over, roofCol, wallCol, o = {}){
  const half = D/2 + over, rise = (D/2)*Math.tan(pitch), slabL = half/Math.cos(pitch), t = o.t ?? 0.2, ow = o.side ?? 0.4, cp = Math.cos(pitch), sp = Math.sin(pitch);
  if(wallCol){ const r = D/Math.sqrt(3), sy = rise/(1.5*r); k.geo(prism(r, W).scale(1, sy, 1), wallCol, 0, y0 + 0.5*r*sy, 0); }
  for(const s of [1, -1]){
    k.box(W + 2*ow, t, slabL, roofCol, 0, y0 + rise - (half/2)*Math.tan(pitch) + t/(2*cp), s*half/2, 0, s*pitch);
    if(o.rows){ const R = o.rows; let j = 0;
      for(let d = R.step; d < slabL - 0.05; d += R.step, j++)
        k.box(W + 2*ow + 0.03, R.h, R.w, j % 2 && R.col2 ? R.col2 : R.col, 0, y0 + rise - d*sp*cp/cp + t/cp - R.h*0.3, s*d*cp, 0, s*pitch); }
  }
  k.box(W + 2*ow + 0.08, o.ridgeH ?? 0.18, o.ridgeW ?? 0.32, o.ridge ?? shade(roofCol, 0.75), 0, y0 + rise + t/cp - 0.02, 0);
  return y0 + rise;
}
// a framed window with mullions, sill, optional shutters and a flower box; (x, y, z) is the wall point, ry the wall's facing
function win1(k, x, y, z, ry, frame, shut, o = {}){
  const c = Math.cos(ry), s = Math.sin(ry), P = (ox, oy, oz) => [x + ox*c + oz*s, y + oy, z - ox*s + oz*c];
  const w = o.w ?? 0.85, h = o.h ?? 0.95;
  k.box(w + 0.2, h + 0.2, 0.08, frame, ...P(0, 0, 0.02), ry);
  k.win(w, h, 0.1, ...P(0, 0, 0.04), ry);
  k.box(0.06, h, 0.13, frame, ...P(0, 0, 0.05), ry);
  k.box(w, 0.06, 0.13, frame, ...P(0, 0.08, 0.05), ry);
  k.box(w + 0.32, 0.09, 0.24, frame, ...P(0, -h/2 - 0.12, 0.1), ry);
  if(shut) for(const sx of [-1, 1]){ k.box(0.36, h + 0.12, 0.06, shut, ...P(sx*(w/2 + 0.3), 0, 0.05), ry);
    for(let j=0;j<4;j++) k.box(0.3, 0.035, 0.08, shade(shut, 0.8), ...P(sx*(w/2 + 0.3), -h/2 + 0.15 + j*(h - 0.3)/3, 0.07), ry); }
  if(o.flowers){ k.box(w + 0.12, 0.22, 0.3, '#7a5a3c', ...P(0, -h/2 - 0.3, 0.2), ry);
    for(let i=0;i<5;i++) k.ball(0.12, i % 2 ? '#5d9a3a' : o.flowers[i % o.flowers.length], ...P(-w/2 + 0.1 + i*(w - 0.2)/4, -h/2 - 0.12, 0.22)); }
}
const TONE = ['#f2d6a2', '#9fd3c7', '#f4a698', '#c7d8f0', '#f7e3b5', '#b9e2a8', '#f0c0d0', '#e9e4d8'];
const TILE = ['#c2593a', '#b9744a', '#4c7aa0', '#c9a24a', '#9b4a3b', '#5f8f6e'];
const FLOW = [['#ff6b8a', '#ffd166'], ['#ff8c42', '#e05a9c'], ['#ffffff', '#ff6b8a'], ['#ffd166', '#7b5ea7']];
// a house's look: the town's age picks the style, the owner's upgrades add floors
const HSTYLE = [[0, 1, 2], [1, 2, 3], [3, 4, 5]];
// tier 0: a stilt hut of boards and thatch
function hutKit(i){
  const k = new Kit(), R = mulberry32(300 + i);
  const W = 3.3 + R()*0.6, D = 2.9, H = 2.0, lift = 0.75, fl = lift + 0.07;
  const wall = ['#a07a52', '#94704b', '#ab8559', '#8f6f4c'][i % 4], dark = '#5e4630', plank = '#7d5d3e';
  const thatch = ['#cdb06e', '#c2a061', '#d4b97c'][i % 3];
  for(const sx of [-1, 1]) for(const z of [-(D/2 - 0.15), D/2 - 0.15, D/2 + 1.05]) k.cyl(0.1, 0.13, lift + 0.05, 5, dark, sx*(W/2 - 0.12), lift/2, z);
  k.box(W + 0.3, 0.14, D + 1.3, plank, 0, lift, 0.55);
  for(let j=1;j<6;j++) k.box(0.03, 0.15, D + 1.3, shade(plank, 0.7), -W/2 - 0.15 + j*(W + 0.3)/6, lift + 0.005, 0.55);
  k.box(W, H, D, wall, 0, fl + H/2, 0);
  for(let j=0;j<=8;j++) k.box(0.06, H, 0.05, shade(wall, 0.72), -W/2 + j*W/8, fl + H/2, D/2 + 0.02);
  for(const sx of [-1, 1]) for(let j=0;j<=5;j++) k.box(0.05, H, 0.06, shade(wall, 0.72), sx*(W/2 + 0.02), fl + H/2, -D/2 + j*D/5);
  k.box(W + 0.08, 0.12, D + 0.08, dark, 0, fl + 0.06, 0);
  k.box(0.82, 1.45, 0.06, '#3b2a1c', 0.75, fl + 0.73, D/2 + 0.05);
  k.win(0.72, 0.55, 0.06, -0.75, fl + 1.3, D/2 + 0.05);
  k.box(0.84, 0.05, 0.55, plank, -0.75, fl + 1.66, D/2 + 0.26, 0, -0.55);
  for(const sx of [-1, 1]) k.box(0.06, 0.06, 1.2, dark, sx*(W/2 + 0.1), fl + 0.55, D/2 + 0.62);
  for(const sx of [-1, 1]) for(const z of [D/2 + 0.1, D/2 + 1.15]) k.box(0.06, 0.6, 0.06, dark, sx*(W/2 + 0.1), fl + 0.3, z);
  k.box(1.0, 0.3, 0.45, plank, 0.75, 0.62, D/2 + 1.42); k.box(1.0, 0.3, 0.45, plank, 0.75, 0.3, D/2 + 1.85); k.box(1.0, 0.3, 0.45, plank, 0.75, 0.0, D/2 + 2.25);
  gable(k, W, D, fl + H, 0.72, 0.6, thatch, wall, { t: 0.3, side: 0.42, ridge: shade(thatch, 0.7), ridgeH: 0.3, ridgeW: 0.45,
    rows: { step: 0.3, h: 0.12, w: 0.24, col: shade(thatch, 0.86), col2: shade(thatch, 1.06) } });
  // fish drying on a line, a barrel, a pile of nets, a lantern on the porch
  const fx = W/2 + 0.95;
  for(const dz of [-0.85, 0.85]) k.cyl(0.04, 0.05, 1.8, 4, dark, fx, 0.9, D/2 + dz);
  k.cyl(0.018, 0.018, 1.7, 3, '#d8c39a', fx, 1.72, D/2, 0, Math.PI/2);
  for(let j=0;j<5;j++) k.geo(new THREE.ConeGeometry(0.09, 0.42, 4), j % 2 ? '#b9c4c8' : '#9fb0b8', fx, 1.45, D/2 - 0.6 + j*0.3, 0, Math.PI);
  k.cyl(0.27, 0.3, 0.62, 8, '#6b4a2e', -W/2 - 0.5, 0.31, D/2 + 0.7); k.cyl(0.31, 0.31, 0.06, 8, '#3b2a1c', -W/2 - 0.5, 0.45, D/2 + 0.7);
  k.geo(new THREE.IcosahedronGeometry(0.55, 1).scale(1.2, 0.45, 1), '#3f6b5a', -W/2 - 0.55, 0.2, -0.2);
  k.glow(new THREE.BoxGeometry(0.17, 0.24, 0.17), W/2 - 0.05, fl + 1.65, D/2 + 1.12);
  k.box(0.04, 0.3, 0.04, dark, W/2 - 0.05, fl + 1.92, D/2 + 1.12);
  if(i % 3 === 0){ for(let j=0;j<6;j++) k.cyl(0.08, 0.08, 1.1, 5, '#8a6440', -W/2 - 0.35, 0.1 + (j % 3)*0.16 + Math.floor(j/3)*0.16, -1.0 + (j % 3)*0.17, 0, Math.PI/2); }
  return k;
}
// tier 1: a plastered cottage under a tiled roof
function cottageKit(i, two = i % 3 === 1){
  const k = new Kit(), H = two ? 4.6 : 2.8, W = two ? 4.4 : 4.2, D = 3.6, base = 0.45;
  const wall = TONE[i % TONE.length], roof = TILE[i % TILE.length], trim = '#f5f0e6', wood = '#7a5a3c', stone = '#a69d8f';
  k.box(W + 0.35, base, D + 0.35, stone, 0, base/2, 0);
  for(let j=0;j<7;j++) k.box(0.5, 0.18, 0.05, shade(stone, 0.85 + (j % 3)*0.07), -W/2 + 0.3 + j*(W - 0.6)/6, base*0.55, D/2 + 0.19);
  k.box(W, H, D, wall, 0, base + H/2, 0);
  const tr = [];
  for(const sx of [-1, 1]) for(const sz of [-1, 1]) k.box(0.2, H, 0.2, trim, sx*W/2, base + H/2, sz*D/2);
  if(two) k.box(W + 0.12, 0.2, D + 0.12, trim, 0, base + H*0.5, 0);
  k.box(W + 0.14, 0.22, D + 0.14, trim, 0, base + H, 0);
  gable(k, W, D, base + H + 0.1, 0.58, 0.55, roof, wall, { t: 0.2, side: 0.45, rows: { step: 0.34, h: 0.07, w: 0.1, col: shade(roof, 0.7) }, ridge: shade(roof, 0.6), ridgeH: 0.2 });
  k.box(0.55, 1.7, 0.55, '#9c5a44', W*0.28, base + H + 1.0, -D*0.18); k.box(0.72, 0.12, 0.72, '#7a4434', W*0.28, base + H + 1.86, -D*0.18);
  k.box(1.15, 1.98, 0.1, trim, 0.9, base + 0.99, D/2 + 0.03); k.box(0.9, 1.78, 0.12, '#6b4a30', 0.9, base + 0.89, D/2 + 0.05);
  for(let j=0;j<3;j++) k.box(0.7, 0.04, 0.13, '#5a3c26', 0.9, base + 0.4 + j*0.5, D/2 + 0.06);
  k.ball(0.05, '#e8c25a', 1.2, base + 0.9, D/2 + 0.14);
  k.box(1.45, 0.07, 0.75, roof, 0.9, base + 2.18, D/2 + 0.33, 0, 0.35);
  for(const sx of [-0.6, 0.6]) k.box(0.06, 0.06, 0.6, wood, 0.9 + sx, base + 2.0, D/2 + 0.3, 0, -0.6);
  k.box(1.5, 0.2, 0.65, stone, 0.9, 0.1, D/2 + 0.48);
  win1(k, -1.0, base + 1.45, D/2 + 0.02, 0, trim, roof, { flowers: FLOW[i % 4] });
  win1(k, W/2 + 0.02, base + 1.45, 0, Math.PI/2, trim, roof); win1(k, -W/2 - 0.02, base + 1.45, 0, -Math.PI/2, trim, roof);
  if(two){ win1(k, -1.0, base + H*0.77, D/2 + 0.02, 0, trim, roof, { flowers: FLOW[(i + 1) % 4] }); win1(k, 1.0, base + H*0.77, D/2 + 0.02, 0, trim, roof); }
  k.glow(new THREE.BoxGeometry(0.16, 0.24, 0.16), 1.68, base + 1.95, D/2 + 0.16);
  k.cyl(0.06, 0.06, H, 5, '#8a8f93', W/2 + 0.12, base + H/2, D/2 + 0.12);
  // a little front garden
  for(let j=0;j<6;j++) k.box(0.07, 0.5, 0.07, trim, -W/2 + 0.15 + j*0.36, 0.25, D/2 + 1.25);
  k.box(1.9, 0.05, 0.05, trim, -W/2 + 1.05, 0.38, D/2 + 1.25);
  for(let j=0;j<3;j++) k.ball(0.26, j % 2 ? '#6fa847' : '#5a9238', -W/2 + 0.45 + j*0.6, 0.22, D/2 + 0.75, 1);
  k.ball(0.1, FLOW[i % 4][0], -W/2 + 0.75, 0.48, D/2 + 0.8); k.ball(0.1, FLOW[i % 4][1], -W/2 + 1.3, 0.46, D/2 + 0.7);
  if(i % 2){ k.box(1.3, 0.08, 0.38, wood, W/2 + 0.55, 0.45, 0.2, Math.PI/2); for(const dz of [-0.5, 0.5]) k.box(0.3, 0.45, 0.08, wood, W/2 + 0.55, 0.22, 0.2 + dz, Math.PI/2); }
  return k;
}
// tier 2: a modern guesthouse with balconies, a café front and solar on the roof
function modernKit(i, F = i % 3 === 1 ? 3 : 2){
  const k = new Kit(), fh = 1.85, W = 4.8, D = 4.2, b0 = 0.3;
  const wall = ['#f3e2c6', '#d6ebe6', '#f4d6cb', '#e0e6f2', '#efe2b6'][i % 5], accent = TILE[i % TILE.length], slab = '#fbfaf6', steel = '#5b6266';
  k.box(W + 0.4, b0, D + 0.4, '#c9c4b8', 0, b0/2, 0);
  k.box(W, F*fh, D, wall, 0, b0 + F*fh/2, 0);
  k.box(1.25, F*fh, 0.06, '#b9875a', W/2 - 0.62, b0 + F*fh/2, D/2 + 0.03);
  for(let j=0;j<6;j++) k.box(0.035, F*fh, 0.09, '#8f6440', W/2 - 1.18 + j*0.22, b0 + F*fh/2, D/2 + 0.04);
  // ground floor café
  k.win(W - 1.7, 1.35, 0.08, -0.62, b0 + 0.85, D/2 + 0.02);
  for(let j=0;j<4;j++) k.box(0.07, 1.4, 0.12, steel, -0.62 - (W - 1.7)/2 + j*(W - 1.7)/3, b0 + 0.85, D/2 + 0.05);
  k.box(W - 1.6, 0.08, 0.12, steel, -0.62, b0 + 1.55, D/2 + 0.05);
  k.box(0.9, 1.75, 0.12, '#33403f', W/2 - 0.62, b0 + 0.88, D/2 + 0.07);
  for(let j=0;j<6;j++) k.box((W - 1.5)/6, 0.05, 0.95, j % 2 ? accent : '#ffffff', -0.62 - (W - 1.5)/2 + (j + 0.5)*(W - 1.5)/6, b0 + 1.72, D/2 + 0.45, 0, 0.28);
  for(const tx of [-1.85, -0.35]){ k.cyl(0.32, 0.32, 0.05, 10, '#ffffff', tx, 0.76, D/2 + 1.5); k.cyl(0.04, 0.05, 0.74, 5, steel, tx, 0.38, D/2 + 1.5);
    for(const s of [-1, 1]){ k.box(0.3, 0.05, 0.3, accent, tx + s*0.5, 0.45, D/2 + 1.5); k.box(0.3, 0.4, 0.05, accent, tx + s*0.64, 0.65, D/2 + 1.5, Math.PI/2); } }
  // upper floors: wide windows and glass balconies
  for(let f=1; f<F; f++){ const y = b0 + f*fh;
    k.box(W + 0.25, 0.14, D + 0.25, slab, 0, y, 0);
    k.box(W - 0.5, 0.12, 1.0, slab, -0.25, y, D/2 + 0.5);
    k.glass(W - 0.5, 0.75, 0.04, -0.25, y + 0.45, D/2 + 0.98);
    k.box(W - 0.5, 0.05, 0.07, steel, -0.25, y + 0.84, D/2 + 0.98);
    for(const sx of [-1, 1]){ k.glass(0.04, 0.75, 0.98, -0.25 + sx*(W/2 - 0.25), y + 0.45, D/2 + 0.5); k.box(0.05, 0.05, 1.0, steel, -0.25 + sx*(W/2 - 0.25), y + 0.84, D/2 + 0.5); }
    k.win(1.6, 1.4, 0.08, -1.15, y + 0.85, D/2 + 0.02); k.box(0.06, 1.4, 0.11, steel, -1.15, y + 0.85, D/2 + 0.05);
    k.win(0.9, 1.4, 0.08, 0.55, y + 0.85, D/2 + 0.02);
    for(const sx of [-1, 1]) for(const z of [-1.0, 0.75]) win1(k, sx*(W/2 + 0.01), y + 0.95, z, sx*Math.PI/2, slab, null, { w: 0.8, h: 1.05 });
    for(const x of [-1.2, 1.2]) win1(k, x, y + 0.95, -D/2 - 0.01, Math.PI, slab, null, { w: 0.9, h: 1.05 });
    k.cyl(0.18, 0.14, 0.3, 6, '#c8734a', -W/2 + 0.65, y + 0.21, D/2 + 0.68); k.ball(0.3, '#4f9a3c', -W/2 + 0.65, y + 0.56, D/2 + 0.68, 1);
    if(f === 1 || i % 2){ k.box(0.45, 0.05, 0.45, '#ffffff', 0.9, y + 0.45, D/2 + 0.5); k.box(0.45, 0.4, 0.05, '#ffffff', 0.9, y + 0.65, D/2 + 0.3); }
  }
  for(const sx of [-1, 1]) win1(k, sx*(W/2 + 0.01), b0 + 1.0, -0.6, sx*Math.PI/2, slab, null, { w: 1.1, h: 1.0 });
  // a painted band at every floor and a coloured cap on the parapet, so the sides read as storeys, not a blank box
  for(let f=1; f<F; f++) for(const sx of [-1, 1]) k.box(0.05, 0.16, D + 0.02, shade(wall, 0.82), sx*(W/2 + 0.03), b0 + f*fh + 0.1, 0);
  k.box(W + 0.02, 0.16, 0.05, shade(wall, 0.82), 0, b0 + fh + 0.1, -D/2 - 0.03);
  k.box(W + 0.04, b0 + 0.12, D + 0.04, shade(wall, 0.78), 0, (b0 + 0.12)/2, 0);
  // roof: parapet, solar panels, a heat-pump, sometimes a terrace umbrella
  const top = b0 + F*fh;
  k.box(W + 0.25, 0.14, D + 0.25, slab, 0, top, 0);
  for(const s of [-1, 1]){ k.box(W + 0.25, 0.42, 0.12, slab, 0, top + 0.2, s*(D/2 + 0.06)); k.box(0.12, 0.42, D + 0.25, slab, s*(W/2 + 0.06), top + 0.2, 0);
    k.box(W + 0.31, 0.08, 0.18, accent, 0, top + 0.44, s*(D/2 + 0.06)); k.box(0.18, 0.08, D + 0.31, accent, s*(W/2 + 0.06), top + 0.44, 0); }
  for(let j=0;j<3;j++){ k.box(1.1, 0.06, 0.85, '#24406b', -1.35 + j*1.2, top + 0.42, -0.95, 0, -0.38);
    k.box(1.12, 0.07, 0.03, '#cfd6dc', -1.35 + j*1.2, top + 0.43, -0.95, 0, -0.38); k.box(0.03, 0.07, 0.86, '#cfd6dc', -1.35 + j*1.2, top + 0.43, -0.95, 0, -0.38); }
  k.box(0.75, 0.5, 0.5, '#d9dcde', 1.55, top + 0.32, 0.6); k.cyl(0.17, 0.17, 0.03, 10, '#5b6266', 1.55, top + 0.33, 0.86, 0, Math.PI/2);
  if(i % 2 === 0){ k.cyl(0.035, 0.035, 1.7, 4, steel, -1.0, top + 0.85, 1.0); k.geo(new THREE.ConeGeometry(0.95, 0.35, 8), accent, -1.0, top + 1.75, 1.0);
    k.cyl(0.33, 0.33, 0.05, 8, '#ffffff', -1.0, top + 0.62, 1.0); }
  else k.cyl(0.3, 0.3, 1.1, 10, '#e6e6e6', -1.4, top + 0.45, 1.0, 0, 0, Math.PI/2);
  return k;
}
// dive shops in three ages
function shopKit(t, j, lv = 1){
  const k = new Kit(), dark = '#5e4630';
  if(t === 0){
    for(const sx of [-1, 1]) for(const sz of [-1, 1]) k.cyl(0.08, 0.1, 2.3, 5, dark, sx*1.4, 1.15, sz*1.05);
    k.box(3.0, 0.85, 0.5, '#9a7650', 0, 0.43, 0.9); k.box(3.1, 0.07, 0.6, '#7d5d3e', 0, 0.88, 0.9);
    gable(k, 3.0, 2.3, 2.3, 0.62, 0.4, '#cdb06e', null, { t: 0.26, rows: { step: 0.28, h: 0.1, w: 0.22, col: '#b8975c' }, ridgeH: 0.26 });
    for(let q=0;q<4;q++) k.cyl(0.13, 0.13, 0.75, 8, q % 2 ? '#e65a4a' : '#f2c14e', -1.1 + q*0.32, 0.38, -0.55);
    k.box(0.35, 0.05, 0.5, '#2b2b2b', -0.7, 0.93, 0.9); k.box(0.35, 0.05, 0.5, '#e8d04a', -0.2, 0.93, 0.9); k.ball(0.14, '#4fc3d9', 0.5, 1.0, 0.9);
    k.cyl(0.03, 0.03, 3.2, 4, dark, 1.85, 1.6, 1.2); k.box(0.03, 0.45, 0.75, '#1f8fd6', 1.85, 2.95, 1.58);
    k.geo(new THREE.SphereGeometry(1, 10, 6).scale(0.2, 0.12, 1.3), '#e86f4a', -2.2, 0.15, 1.2, 0.3);
  } else if(t === 1){
    k.box(3.4, 2.4, 3, '#bfe8ee', 0, 1.2, 0);
    for(let q=1;q<7;q++) k.box(3.43, 0.035, 3.03, '#9ccbd3', 0, q*0.34, 0);
    gable(k, 3.4, 3, 2.4, 0.5, 0.42, '#2c7fa8', '#bfe8ee', { rows: { step: 0.32, h: 0.06, w: 0.1, col: '#246a8d' } });
    win1(k, -0.7, 1.4, 1.5, 0, '#ffffff', null, { w: 1.1, h: 1.0 });
    k.box(0.9, 1.75, 0.1, '#ffffff', 0.9, 0.88, 1.52); k.box(0.72, 1.62, 0.12, '#2c7fa8', 0.9, 0.81, 1.54);
    k.box(0.08, 3.4, 0.08, '#444444', 1.95, 1.7, 1.4); k.box(1.2, 0.7, 0.06, '#1f8fd6', 2.55, 3.0, 1.4); k.box(0.9, 0.1, 0.07, '#ffffff', 2.55, 3.05, 1.42);
    k.box(1.8, 0.08, 0.42, '#7a5a3c', -0.9, 0.5, 2.05); for(let q=0;q<4;q++) k.cyl(0.15, 0.15, 0.85, 8, q % 2 ? '#e65a4a' : '#f2c14e', -1.55 + q*0.42, 0.95, 2.05);
    for(let q=0;q<2;q++){ k.box(0.42, 0.95, 0.05, '#222831', 1.75, 1.25, -0.4 + q*0.6, Math.PI/2); k.box(0.42, 0.06, 0.06, '#7a5a3c', 1.75, 1.75, -0.4 + q*0.6, Math.PI/2); }
  } else {
    k.box(4.2, 0.25, 3.5, '#c9c4b8', 0, 0.12, 0);
    k.box(3.9, 2.7, 3.2, '#e4f3f1', 0, 1.6, 0);
    // timber cladding on the sides, side windows, a roof deck with a rail and a dive flag
    for(const sx of [-1, 1]){ k.box(0.05, 2.7, 3.22, '#b9875a', sx*1.96, 1.6, 0); for(let q=0;q<9;q++) k.box(0.08, 2.7, 0.04, '#8f6440', sx*1.97, 1.6, -1.5 + q*0.375);
      win1(k, sx*1.99, 1.7, -0.4, sx*Math.PI/2, '#ffffff', null, { w: 1.2, h: 0.9 }); }
    win1(k, -0.9, 1.7, -1.61, Math.PI, '#ffffff', null, { w: 1.1, h: 0.9 }); win1(k, 0.9, 1.7, -1.61, Math.PI, '#ffffff', null, { w: 1.1, h: 0.9 });
    for(const sz of [-1, 1]) k.box(4.6, 0.05, 0.06, '#5b6266', 0, 3.75, 0.35 + sz*2.1); for(const sx of [-1, 1]) k.box(0.06, 0.05, 4.2, '#5b6266', sx*2.3, 3.75, 0.35);
    for(let q=0;q<8;q++) for(const sz of [-1, 1]) k.box(0.04, 0.6, 0.04, '#5b6266', -2.25 + q*0.64, 3.45, 0.35 + sz*2.1);
    k.cyl(0.03, 0.03, 2.0, 4, '#5b6266', 1.9, 4.1, -1.4); k.box(0.03, 0.5, 0.75, '#d83a3a', 1.9, 4.8, -1.0); k.box(0.035, 0.09, 0.8, '#ffffff', 1.9, 4.8, -1.0, 0, 0.55);
    k.win(3.0, 1.95, 0.05, -0.25, 1.3, 1.58); k.glass(3.05, 2.0, 0.04, -0.25, 1.3, 1.63);
    for(let q=0;q<4;q++) k.box(0.07, 2.0, 0.1, '#4d5559', -1.75 + q*1.0, 1.3, 1.64);
    k.box(4.7, 0.18, 4.3, '#ffffff', 0, 3.05, 0.35);
    k.box(2.7, 0.55, 0.12, '#1f8fd6', -0.2, 3.45, 1.85); k.box(1.9, 0.11, 0.13, '#ffffff', -0.2, 3.47, 1.87); k.ball(0.15, '#ffd166', 0.9, 3.47, 1.9);
    k.box(0.12, 0.9, 2.4, '#8a9298', 2.3, 0.7, 0.2); k.box(0.7, 0.12, 2.4, '#8a9298', 2.6, 0.55, 0.2); k.box(0.7, 0.12, 2.4, '#8a9298', 2.6, 1.05, 0.2);
    k.geo(new THREE.SphereGeometry(1, 10, 6).scale(0.24, 0.13, 1.25), '#ff7a59', 2.6, 0.72, 0.2); k.geo(new THREE.SphereGeometry(1, 10, 6).scale(0.24, 0.13, 1.25), '#ffd166', 2.6, 1.22, 0.2);
    for(let q=0;q<5;q++) k.cyl(0.14, 0.14, 0.8, 8, q % 2 ? '#2f78c4' : '#f2c14e', -1.9 + q*0.34, 0.65, 2.15);
    k.glow(new THREE.BoxGeometry(2.6, 0.05, 0.1), -0.25, 2.92, 1.75);
  }
  // upgrades: a gear deck with tanks and a boat on its trailer, then a training pool under flags
  const wood = ['#8a6a48', '#9a7a58', '#c9c4b8'][t], acc = ['#e65a4a', '#2c7fa8', '#1f8fd6'][t];
  if(lv >= 2){ k.box(1.7, 0.2, 3.0, wood, -2.95, 0.25, 0.1); for(let q=0;q<4;q++) k.cyl(0.12, 0.12, 0.7, 8, q % 2 ? acc : '#f2c14e', -3.5 + q*0.34, 0.7, -0.9);
    k.geo(hullGeo(2.4, 0.8, 0.5), '#f2f2ee', -2.95, 0.72, 0.6); k.box(1.0, 0.06, 0.06, '#555', -2.95, 0.35, 1.8);
    k.cyl(0.04, 0.04, 2.4, 4, '#555', -3.6, 1.45, 1.4); k.box(0.03, 0.4, 0.7, acc, -3.6, 2.45, 1.75); }
  if(lv >= 3){ k.box(3.6, 0.5, 2.6, '#d9dcde', 0, 0.25, -3.1); k.box(3.2, 0.08, 2.2, '#4fc3e4', 0, 0.52, -3.1);
    for(const fx of [-1.6, 0, 1.6]){ k.cyl(0.03, 0.03, 2.8, 4, '#666', fx, 1.4, -4.5); k.box(0.03, 0.45, 0.75, fx ? acc : '#ffd166', fx, 2.55, -4.15); }
    k.box(1.2, 1.6, 1.2, shade(acc, 1.4), 2.6, 0.8, -3.1); }
  return k;
}
function lampKit(t){
  const k = new Kit();
  if(t === 0){ k.cyl(0.07, 0.09, 2.2, 5, '#5e4630', 0, 1.1, 0); k.box(0.75, 0.07, 0.07, '#5e4630', 0.32, 2.1, 0);
    k.box(0.02, 0.2, 0.02, '#3b2a1c', 0.58, 1.98, 0); k.glow(new THREE.BoxGeometry(0.2, 0.28, 0.2), 0.58, 1.75, 0); k.box(0.27, 0.05, 0.27, '#3b2a1c', 0.58, 1.9, 0); }
  else if(t === 1){ k.cyl(0.055, 0.09, 2.6, 8, '#2e3236', 0, 1.3, 0); k.cyl(0.17, 0.21, 0.28, 8, '#2e3236', 0, 0.14, 0);
    k.cyl(0.1, 0.06, 0.12, 6, '#2e3236', 0, 2.62, 0); k.glow(new THREE.CylinderGeometry(0.17, 0.12, 0.4, 6), 0, 2.88, 0); k.geo(new THREE.ConeGeometry(0.28, 0.22, 6), '#2e3236', 0, 3.18, 0); }
  else { k.cyl(0.055, 0.085, 4.2, 8, '#a7b0b5', 0, 2.1, 0); k.box(1.15, 0.07, 0.1, '#a7b0b5', 0.52, 4.15, 0); k.box(0.55, 0.1, 0.24, '#a7b0b5', 1.05, 4.12, 0);
    k.glow(new THREE.BoxGeometry(0.45, 0.04, 0.17), 1.05, 4.06, 0); }
  return k;
}
// ---- where things go
const HOUSE_SLOTS = [[-18, -8], [-9, -9], [-1, -6.5], [17, -7.5], [25, -5.5], [-27, -18], [-16, -20], [-5, -19], [6, -23], [15, -19.5], [25, -21], [35, -14],
  [-20, -50], [-4, -48], [20, -46], [-31, -52], [-19, -68], [5, -68], [18, -70], [-10, -80]];
const SHOP_AT = [[-12, -1.5], [-19, -1.5], [-26, -1.5], [-18, -42], [3, -44]];
const BIG = [[-31, -34, 9, 5], [-42, -18, 3.5, 4.5], [34, -4, 3.5, 3.5], [25, -11, 3, 2.5], [-42, -4, 3, 2.5], [-2, -29, 4, 3], [-30, -8, 4.5, 3.5], [45.5, -9, 2.5, 2.5],
  [3.5, -3.2, 2.6, 2], [13, -3.4, 2.6, 2], [8, 0, 2.2, 3.5], [15, 0.5, 2, 1.5], [20, 1.2, 2, 1.5], ...SHOP_AT.map(([x, z]) => [x, z, 2.8, 2.8]),
  [30, -52, 9, 4.5], [-36, -62, 10, 4], [-42, -80, 3, 3], [26, -78, 8, 5]];
const LAMP_AT = [[4, -10], [-6, -13], [-16, -12], [10, -18], [22, -11], [-13, -22], [-24, -11.5], [30, -7.5], [-10, -45], [-7, -64], [12, -48], [-16, -58], [4, -57], [17, -60]];
function blocked(x, z, r = 0){
  if(Math.abs(x) > 46.5 || z < -86 || z > -1) return true;
  if(HOUSE_SLOTS.some(([hx, hz]) => Math.abs(x - hx) < 4.0 + r && Math.abs(z - hz) < 4.4 + r)) return true;
  if(BIG.some(([bx, bz, hw, hd]) => Math.abs(x - bx) < hw + r && Math.abs(z - bz) < hd + r)) return true;
  return LAMP_AT.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 1.2 + r);
}
function samplePath(pl, step){
  const out = [];
  for(let i=0;i<pl.length-1;i++){ const [ax, az] = pl[i], [bx, bz] = pl[i + 1], L = Math.hypot(bx - ax, bz - az), dx = (bx - ax)/L, dz = (bz - az)/L;
    for(let d = 0; d < L; d += step) out.push({ x: ax + dx*d, z: az + dz*d, dx, dz }); }
  const l = pl[pl.length - 1], p = out[out.length - 1]; out.push({ x: l[0], z: l[1], dx: p.dx, dz: p.dz });
  return out;
}
const ALL_PATH = PATHS.flatMap(pl => samplePath(pl, 0.8));
function pathSpots(n, off, gap, r, R = mulberry32(77 + n)){
  const out = []; let tries = 0;
  while(out.length < n && tries++ < 600){
    const s = ALL_PATH[(R()*ALL_PATH.length)|0], side = R() < 0.5 ? -1 : 1, x = s.x - s.dz*off*side, z = s.z + s.dx*off*side;
    if(blocked(x, z, r) || pathDist(x, z) < off - 0.25 || out.some(o => Math.hypot(o.x - x, o.z - z) < gap) || SPOTS_USED.some(o => Math.hypot(o[0] - x, o[1] - z) < 2.2)) continue;
    out.push({ x, z, face: Math.atan2(side*s.dz, -side*s.dx), along: Math.atan2(s.dx, s.dz) }); SPOTS_USED.push([x, z]); }
  return out;
}
const SPOTS_USED = [];
function shoreZ(x){ let a = -6, b = 20; for(let it=0;it<22;it++){ const m = (a + b)/2; if(dioH(x, m) > 0.05) a = m; else b = m; } return a; }
// ---- every tiered thing: variants per development stage, swapped with a puff of dust when the village grows
const TIERED = [];
function tiered(vars, when, x, z, order, swap = false, big = 14){ TIERED.push({ vars, uniq: [...new Set(vars.filter(Boolean))], when, x, z, order, swap, big, shown: -1, wait: -1 }); }
{
  VB.houseVars = HOUSE_SLOTS.map(([x, z], i) => {
    const R = mulberry32(900 + i), ry = (R() - 0.5)*0.3;
    const vars = [hutKit(i), cottageKit(i, false), cottageKit(i, true), modernKit(i, 2), modernKit(i, 3), modernKit(i, 4)].map(k => k.build(x, z, ry));
    vars.forEach(g => { g.scale.setScalar(0.001); g.visible = false; });
    return { vars, x, z, i, cur: -1 };
  });
  VB.houses = VB.houseVars.map(h => h.vars[1]);
  VB.shopVars = SHOP_AT.map(([x, z], j) => { const vars = [];
    for(let t=0;t<3;t++) for(let lv=1;lv<=3;lv++){ const g = shopKit(t, j, lv).build(x, z, 0); g.scale.setScalar(0.001); g.visible = false; vars.push(g); }
    return { vars, x, z, cur: -1 }; });
  VB.shops = VB.shopVars.map(s => s.vars[4]);
  // street lights face the road
  LAMP_AT.forEach(([x, z], i) => {
    let best = null, bd = 1e9; for(const s of ALL_PATH){ const d = Math.hypot(s.x - x, s.z - z); if(d < bd){ bd = d; best = s; } }
    const ry = Math.atan2(-(best.z - z), best.x - x);
    const vars = [lampKit(0).build(x, z, ry), lampKit(1).build(x, z, ry), lampKit(2).build(x, z, ry)];
    vars.forEach(g => { g.scale.setScalar(0.001); g.visible = false; });
    tiered(vars, () => true, x, z, 1 + i, false, 5);
  });
  // the dock: planks and posts, later a concrete pier with rails and street lights
  const dockW = new THREE.Group(); dio.add(dockW);
  { const planks = [];
    for(let z = -1.5; z <= 23.2; z += 0.62) planks.push(new THREE.BoxGeometry(2.8, 0.14, 0.52).translate(8 + (rng() - .5)*0.08, 0.84, z));
    merged(planks, SM('#ad8257'), dockW);
    const posts = [];
    for(let z = -1; z <= 23; z += 3) for(const sx of [-1.35, 1.35]){ const fh = dioH(8 + sx, z), h = 1.7 - fh; posts.push(new THREE.CylinderGeometry(0.15, 0.17, h, 6).translate(8 + sx, fh + h/2, z)); }
    merged(posts, SM('#6b5034'), dockW);
    for(const sx of [-1.35, 1.35]) dm(new THREE.CylinderGeometry(0.04, 0.04, 24, 4).rotateX(Math.PI/2), SM('#d8c39a'), 8 + sx, 1.55, 11, dockW);
    for(let k=0;k<4;k++) dm(new THREE.BoxGeometry(0.8, 0.7, 0.8), SM('#a0784e'), 7.2 + (k % 2)*0.9, 1.26, 20 + Math.floor(k/2)*0.9, dockW);
    for(let k=0;k<3;k++) dm(new THREE.CylinderGeometry(0.35, 0.35, 0.85, 10), SM('#7a4e2e'), 8.8, 1.33, 2 + k*0.8, dockW);
    dm(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), SM('#333'), 9.2, 2.1, 23, dockW); dm(new THREE.SphereGeometry(0.25, 10, 8), lampMat, 9.2, 3.35, 23, dockW); }
  const pier = new Kit();
  pier.box(3.4, 0.45, 25, '#c9c5bb', 8, 0.72, 10.8);
  pier.box(3.5, 0.08, 25.1, '#b3afa5', 8, 0.5, 10.8);
  for(const sx of [-1, 1]) pier.box(0.1, 0.02, 25, '#e8c25a', 8 + sx*1.5, 0.955, 10.8);
  for(let z = 0; z <= 22; z += 3.6) for(const sx of [-1.25, 1.25]){ const fh = dioH(8 + sx, z), h = 0.55 - fh; pier.cyl(0.28, 0.3, h, 8, '#a9a59c', 8 + sx, fh + h/2, z); }
  for(let z = -1.4; z <= 23.2; z += 1.55) for(const sx of [-1.62, 1.62]) pier.box(0.06, 0.9, 0.06, '#8d969b', 8 + sx, 1.4, z);
  for(const sx of [-1.62, 1.62]){ pier.box(0.07, 0.07, 24.8, '#8d969b', 8 + sx, 1.85, 10.9); pier.box(0.04, 0.04, 24.8, '#8d969b', 8 + sx, 1.4, 10.9); }
  for(const z of [3, 11, 19]){ pier.cyl(0.13, 0.17, 0.32, 8, '#33383b', 6.55, 1.11, z + 1.6); pier.cyl(0.13, 0.17, 0.32, 8, '#33383b', 9.45, 1.11, z + 1.6); }
  for(const z of [1, 9, 17]){ pier.cyl(0.05, 0.07, 3.2, 6, '#a7b0b5', 9.55, 2.55, z); pier.box(0.9, 0.06, 0.08, '#a7b0b5', 9.15, 4.1, z); pier.glow(new THREE.BoxGeometry(0.4, 0.04, 0.16), 8.85, 4.06, z); }
  pier.box(1.3, 0.8, 0.9, '#2f78c4', 7.5, 1.35, 22.4); pier.box(0.9, 0.5, 0.6, '#f2f0e6', 7.5, 1.95, 22.4);
  const pierG = pier.build(0, 0, 0, 0);
  tiered([dockW, dockW, pierG], () => true, 8, 10, 0, true, 26);
  // roads: dirt, then cobbles, then asphalt with kerbs
  const cobs = [], CR = mulberry32(5);
  for(const pl of PATHS) for(const s of samplePath(pl, 0.42)) for(let a=-2.5;a<=2.5;a++){ const off = a*0.4 + (CR() - .5)*0.1, x = s.x - s.dz*off, z = s.z + s.dx*off; if(dioH(x, z) > 0.9) cobs.push([x, z]); }
  const cobIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 6), new THREE.MeshStandardMaterial({ roughness: 0.92, flatShading: true }), cobs.length);
  const cc = ['#cfc5b2', '#b8ad9a', '#d9cfbc', '#a99f8e', '#c4b8a2'].map(h => new THREE.Color(h));
  cobs.forEach(([x, z], i) => { dummy.position.set(x, dioH(x, z) + 0.02, z); dummy.rotation.set(0, CR()*3, 0); dummy.scale.set(0.9 + CR()*0.3, 1, 0.9 + CR()*0.3); dummy.updateMatrix(); cobIM.setMatrixAt(i, dummy.matrix); cobIM.setColorAt(i, cc[(CR()*cc.length)|0]); });
  dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
  cobIM.receiveShadow = true; cobIM.visible = false; dio.add(cobIM);
  const road = new Kit();
  const ribbon = (pl, o0, o1, y, step = 0.6) => { const S = samplePath(pl, step), pos = [];
    const pt = (s, o) => { const x = s.x - s.dz*o, z = s.z + s.dx*o; return [x, dioH(x, z) + y, z]; };
    for(let i=0;i<S.length-1;i++){ const a = S[i], b = S[i + 1], A = pt(a, o0), B = pt(a, o1), C = pt(b, o1), D = pt(b, o0); pos.push(...A, ...C, ...D, ...A, ...B, ...C); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
  for(const pl of PATHS){
    road.geo(ribbon(pl, -1.35, 1.35, 0.1), '#55595c');
    road.geo(ribbon(pl, -1.6, -1.35, 0.2), '#d9d6cf'); road.geo(ribbon(pl, 1.35, 1.6, 0.2), '#d9d6cf');
    road.geo(ribbon(pl, -2.3, -1.6, 0.16), '#c7c1b5'); road.geo(ribbon(pl, 1.6, 2.3, 0.16), '#c7c1b5');
    for(const s of samplePath(pl, 1.7)) road.box(0.12, 0.02, 0.75, '#f2f0e6', s.x, dioH(s.x, s.z) + 0.115, s.z, Math.atan2(s.dx, s.dz));
  }
  const roadG = road.build(0, 0, 0, 0);
  tiered([null, cobIM, roadG], () => true, 0, -13, 2, true, 0);
  // ---- props of the hamlet: canoes, a campfire, net racks
  const racks = new Kit();
  for(const [x, z] of [[15, 0.5], [20, 1.2]]){ const y = dioH(x, z);
    for(const sx of [-1.4, 1.4]) racks.cyl(0.07, 0.08, 2.2, 5, '#6b5034', x + sx, y + 1.1, z);
    racks.cyl(0.05, 0.05, 3, 4, '#6b5034', x, y + 2.1, z, 0, 0, Math.PI/2); }
  const racksG = racks.build(0, 0, 0, 0);
  for(const [x, z] of [[15, 0.5], [20, 1.2]]) dm(new THREE.PlaneGeometry(2.7, 1.6, 6, 4), new THREE.MeshStandardMaterial({ color: '#2f6b5a', wireframe: true }), x, dioH(x, z) + 1.3, z, racksG);
  tiered([racksG, racksG, null], () => true, 17, 1, 4);
  const camp = new Kit();
  for(let j=0;j<8;j++){ const a = j/8*Math.PI*2; camp.ball(0.22, j % 2 ? '#8f8a80' : '#a39d92', Math.cos(a)*0.65, 0.1, Math.sin(a)*0.65); }
  for(let j=0;j<4;j++) camp.cyl(0.08, 0.08, 0.9, 5, '#5e4630', 0, 0.2, 0, j*0.8, 0, Math.PI/2 - 0.35);
  camp.glow(new THREE.ConeGeometry(0.3, 0.75, 6), 0, 0.5, 0); camp.glow(new THREE.ConeGeometry(0.18, 0.5, 5), 0.15, 0.45, 0.1);
  for(const a of [0.4, 2.3, 4.1]) camp.cyl(0.18, 0.18, 1.3, 6, '#7d5d3e', Math.cos(a)*1.5, 0.18, Math.sin(a)*1.5, -a + Math.PI/2, 0, Math.PI/2);
  const cs = pathSpots(1, 3.6, 0, 1.6)[0]; if(cs){ const g = camp.build(cs.x, cs.z, 0); tiered([g, null, null], () => true, cs.x, cs.z, 5); }
  const canoeKit = c => { const k = new Kit(); k.geo(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI*2, Math.PI/2, Math.PI/2).scale(0.38, 0.32, 1.7), c, 0, 0.32, 0);
    k.geo(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI/2).scale(0.34, 1, 1.62), '#5e4630', 0, 0.3, 0); k.geo(new THREE.TorusGeometry(1, 0.06, 4, 16).rotateX(Math.PI/2).scale(0.38, 1, 1.7), shade(c, 0.7), 0, 0.32, 0); k.box(0.62, 0.05, 0.18, '#7d5d3e', 0, 0.3, 0.2);
    k.box(0.07, 0.03, 1.5, '#9a7650', 0.55, 0.06, 0, 0.4); k.box(0.2, 0.02, 0.4, '#9a7650', 0.85, 0.06, 0.7, 0.4); return k; };
  [[29, '#b4552f'], [32.5, '#2f6b9a'], [36, '#e0b04a']].forEach(([x, c], j) => { const z = Math.max(0.6, shoreZ(x) - 1.6); const g = canoeKit(c).build(x, z, 0.3 + j*0.25); tiered([g, null, null], () => true, x, z, 6 + j); });
  // ---- the town: market stalls, a lighthouse, benches and planters
  const stallKit = (awn, goods) => { const k = new Kit();
    for(const sx of [-1, 1]) for(const sz of [-1, 1]) k.box(0.1, 2.2, 0.1, '#6b5034', sx*1.25, 1.1, sz*0.8);
    k.box(2.5, 0.85, 0.75, '#9a7650', 0, 0.43, 0.55); k.box(2.6, 0.06, 0.85, '#7d5d3e', 0, 0.88, 0.55);
    for(let j=0;j<7;j++) k.box(2.7/7, 0.05, 2.0, j % 2 ? awn : '#ffffff', -1.35 + (j + 0.5)*2.7/7, 2.25, 0.15, 0, 0.2);
    for(let j=0;j<7;j++) k.box(2.7/7, 0.22, 0.04, j % 2 ? awn : '#ffffff', -1.35 + (j + 0.5)*2.7/7, 2.0, 1.12);
    for(let j=0;j<3;j++){ k.box(0.62, 0.22, 0.5, '#b08a5a', -0.85 + j*0.85, 1.0, 0.55);
      for(let q=0;q<5;q++) goods === 'fish' ? k.geo(new THREE.ConeGeometry(0.07, 0.38, 4), q % 2 ? '#b9c4c8' : '#e3a07a', -1.05 + j*0.85 + q*0.1, 1.15, 0.55, 0, 0, Math.PI/2)
        : k.ball(0.09, ['#ff8c42', '#ffd166', '#7bd389', '#e65a4a'][(q + j) % 4], -1.05 + j*0.85 + q*0.1, 1.15, 0.5 + (q % 2)*0.1); }
    k.box(1.0, 0.3, 0.04, '#2c3e50', 0, 1.82, 1.14); k.box(0.7, 0.06, 0.05, '#f2f0e6', 0, 1.82, 1.16);
    k.box(0.5, 0.45, 0.5, '#8a6a48', 1.6, 0.23, 0.9); return k; };
  [[3.5, -3.2, '#e65a4a', 'fish'], [13, -3.4, '#2f78c4', 'fruit']].forEach(([x, z, c, g], j) => { const G = stallKit(c, g).build(x, z, 0); G.scale.setScalar(0.001); G.visible = false; tiered([null, G, G], () => true, x, z, 4 + j); });
  { const k = new Kit(), bands = 6, Ht = 9.5;
    k.cyl(1.9, 2.1, 0.8, 10, '#a39d92', 0, 0.4, 0); k.box(1.2, 1.6, 0.9, '#efe9dc', 0, 1.3, 1.6); k.box(0.6, 1.1, 0.1, '#6b4a30', 0, 1.1, 2.06);
    for(let j=0;j<bands;j++){ const y0 = 0.8 + j*Ht/bands, r0 = 1.45 - j*0.07, r1 = 1.45 - (j + 1)*0.07; k.cyl(r1, r0, Ht/bands, 12, j % 2 ? '#d64a3a' : '#f6f2ea', 0, y0 + Ht/bands/2, 0); }
    for(const y of [3.2, 6.0]) k.win(0.36, 0.55, 0.1, 0, y, 1.38 - (y - 0.8)/Ht*0.4);
    const top = 0.8 + Ht; k.cyl(1.45, 1.45, 0.18, 12, '#3a3f42', 0, top + 0.09, 0);
    for(let j=0;j<16;j++){ const a = j/16*Math.PI*2; k.box(0.05, 0.6, 0.05, '#3a3f42', Math.cos(a)*1.35, top + 0.45, Math.sin(a)*1.35); }
    k.cyl(1.36, 1.36, 0.05, 16, '#3a3f42', 0, top + 0.75, 0);
    k.cyl(0.7, 0.7, 1.3, 10, '#3a3f42', 0, top + 0.22, 0); k.glass(1.05, 1.0, 1.05, 0, top + 0.8, 0); k.glow(new THREE.SphereGeometry(0.42, 12, 8), 0, top + 0.8, 0);
    k.geo(new THREE.ConeGeometry(0.95, 0.9, 12), '#d64a3a', 0, top + 1.75, 0); k.ball(0.14, '#3a3f42', 0, top + 2.28, 0);
    const g = k.build(45.5, -9, -0.6); VB.lighthouse = g; g.scale.setScalar(0.001); g.visible = false; tiered([null, g, g], () => true, 45.5, -9, 8, false, 18); }
  const benchKit = () => { const k = new Kit(); k.box(1.5, 0.07, 0.42, '#9a6a3e', 0, 0.46, 0); k.box(1.5, 0.35, 0.06, '#9a6a3e', 0, 0.75, -0.2, 0, -0.15);
    for(const sx of [-0.65, 0.65]){ k.box(0.07, 0.46, 0.4, '#2e3236', sx, 0.23, 0); k.box(0.07, 0.42, 0.06, '#2e3236', sx, 0.7, -0.2); } return k; };
  const planterKit = (c) => { const k = new Kit(); k.box(1.4, 0.45, 0.6, '#c9c4b8', 0, 0.22, 0); k.box(1.3, 0.06, 0.5, '#6b4a2e', 0, 0.45, 0);
    for(let j=0;j<5;j++) k.ball(0.17, j % 2 ? c : '#5d9a3a', -0.5 + j*0.25, 0.58, (j % 2)*0.1 - 0.05, 1); return k; };
  pathSpots(5, 2.25, 6, 0.6).forEach((s, j) => { const g = benchKit().build(s.x, s.z, s.face); g.scale.setScalar(0.001); g.visible = false; tiered([null, g, g], () => true, s.x, s.z, 6 + j, false, 4); });
  pathSpots(5, 2.1, 6, 0.6).forEach((s, j) => { const g = planterKit(FLOW[j % 4][0]).build(s.x, s.z, s.along); g.scale.setScalar(0.001); g.visible = false; tiered([null, g, g], () => true, s.x, s.z, 8 + j, false, 4); });
  // ---- the seaside town: beach umbrellas and parked cars
  const umbKit = (c) => { const k = new Kit(); k.cyl(0.035, 0.035, 2.3, 4, '#d9d6cf', 0, 1.15, 0);
    const cone = new THREE.ConeGeometry(1.25, 0.45, 10); k.geo(cone, c, 0, 2.3, 0); k.geo(new THREE.ConeGeometry(1.27, 0.12, 10, 1, true), '#ffffff', 0, 2.08, 0);
    for(const sx of [-0.8, 0.8]){ k.box(0.62, 0.06, 1.6, '#ffffff', sx, 0.3, 0.35); k.box(0.62, 0.06, 0.6, '#ffffff', sx, 0.48, -0.55, 0, 0.6); k.box(0.58, 0.02, 1.5, c, sx, 0.34, 0.38); }
    k.box(1.0, 0.03, 1.8, ['#ff9fc2', '#ffd166', '#7fd6d0'][Math.floor(Math.abs(KC.set(c).r*9)) % 3], 0, 0.02, 1.9);
    return k; };
  [[27.5, '#e65a4a'], [33.5, '#2f9fb8'], [39.5, '#f2a93b'], [44, '#e65a4a'], [-36, '#2f9fb8'], [-42, '#f2a93b']].forEach(([x, c], j) => { const z = Math.max(1.2, shoreZ(x) - 3.0);
    const g = umbKit(c).build(x, z, 0.2*(j % 2 ? 1 : -1)); g.scale.setScalar(0.001); g.visible = false; tiered([null, null, g], () => true, x, z, 3 + j, false, 6); });
  const carKit = (c) => { const k = new Kit(); k.box(1.45, 0.55, 2.8, c, 0, 0.55, 0); k.box(1.3, 0.5, 1.45, c, 0, 1.05, -0.15);
    k.win(1.32, 0.38, 1.3, 0, 1.07, -0.15); k.box(1.46, 0.12, 2.82, shade(c, 0.7), 0, 0.36, 0);
    for(const sx of [-0.7, 0.7]) for(const sz of [-0.9, 0.9]){ k.cyl(0.3, 0.3, 0.22, 10, '#22262a', sx, 0.3, sz, 0, 0, Math.PI/2); k.cyl(0.15, 0.15, 0.23, 8, '#c9cfd3', sx, 0.3, sz, 0, 0, Math.PI/2); }
    for(const sx of [-0.5, 0.5]){ k.glow(new THREE.BoxGeometry(0.25, 0.12, 0.05), sx, 0.62, 1.41); k.box(0.25, 0.12, 0.05, '#c0392b', sx, 0.62, -1.41); }
    return k; };
  pathSpots(4, 2.15, 9, 0.4).forEach((s, j) => { const g = carKit(['#e65a4a', '#f2f0e6', '#2f78c4', '#3aa57a'][j]).build(s.x, s.z, s.along); g.scale.setScalar(0.001); g.visible = false; tiered([null, null, g], () => true, s.x, s.z, 9 + j, false, 6); });
}
// ---- the sewer: manholes over a buried pipe, a concrete outfall at the waterline
{
  // the pipe comes out of the beach through a low headwall and ends just above the water on a pile of rubble
  const ox = -22.5, oz = shoreZ(ox), k = new Kit(), R = mulberry32(919);
  portalU.uSrc.value.set(ox, oz + 1.6);
  const gy = z => dioH(ox, oz + z);                           // beach height along the pipe (local z; negative is inland)
  const wz = -0.9, wTop = Math.max(gy(wz) + 0.35, 0.92);
  k.box(2.4, wTop + 1.2, 0.34, '#a29e94', 0, (wTop - 1.2)/2, wz);   // headwall, footing well under the sand
  k.box(2.56, 0.12, 0.46, '#b8b4aa', 0, wTop + 0.06, wz);
  k.cyl(0.35, 0.35, 3.4, 14, '#6d6f6e', 0, 0.3, -0.8, 0, Math.PI/2);       // pipe, buried inland, out through the wall
  k.cyl(0.41, 0.41, 0.14, 14, '#7f817f', 0, 0.3, 0.86, 0, Math.PI/2);      // collar
  k.cyl(0.27, 0.27, 0.16, 14, '#151819', 0, 0.3, 0.9, 0, Math.PI/2);       // dark inside
  for(let j=0;j<4;j++) k.box(0.03, 0.5, 0.03, '#5a4632', -0.2 + j*0.133, 0.3, 0.96);
  for(let j=0;j<24;j++){ const z = R()*1.7, w = 1.25 - z*0.35, x = (R()*2 - 1)*w, rr = 0.2 + R()*0.24;
    const y = Math.min(Math.max(gy(z), -0.4) + rr*0.35, -0.16 - rr*0.4 + (Math.abs(x) > 0.5 ? 0.12 : 0));
    k.geo(new THREE.IcosahedronGeometry(rr, 0).scale(1, 0.72, 1), ['#8b887f', '#7c7970', '#97938a'][j % 3], x, y, z, R()*6, R(), R()); }
  k.cyl(0.04, 0.04, 1.8, 4, '#4d5559', 1.7, gy(-2.6) + 0.9, -2.6); k.box(0.7, 0.5, 0.04, '#e8c25a', 1.7, gy(-2.6) + 1.7, -2.58); k.box(0.5, 0.08, 0.05, '#c0392b', 1.7, gy(-2.6) + 1.75, -2.56);
  VB.outfall = k.build(ox, oz, 0, 0);
  const mh = new Kit();
  for(let z = -4; z > -30; z -= 6.5){ const x = ox + (z + 4)*0.02; mh.cyl(0.42, 0.42, 0.05, 12, '#4a4d50', x, dioH(x, z) + 0.04, z); mh.cyl(0.3, 0.3, 0.06, 12, '#5d6164', x, dioH(x, z) + 0.05, z); }
  mh.build(0, 0, 0, 0);
}
// ---- the town grows up the hill and out to the harbour: new buildings, and what every upgrade adds on the ground
const UPG = [];   // pieces that appear with a level or a tier: { g, on, x, z }
const hideG = g => { g.scale.setScalar(0.001); g.visible = false; return g; };
function upgPiece(k, x, z, ry, on, y, px = x, pz = z){ const g = hideG(k.build(x, z, ry, y)); UPG.push({ g, on, x: px, z: pz }); return g; }
const lvAt = (k, i) => (V[KEY[k]] || 0) > i ? lvOf(V, k, i) : 0;
const annexRoof = (k, W, D, x, y, z, roof) => { k.box(W + 0.5, 0.18, D + 0.5, roof, x, y, z); k.box(W + 0.7, 0.12, 0.25, shade(roof, 0.75), x, y + 0.12, z + D/2 + 0.2); };
// cold store: a second chamber and a refrigerated truck; then a cold-chain hall with roof units
{ const x = 25, z = -11;
  let k = new Kit(); k.box(3.2, 2.4, 3.4, '#dfe7ea', 3.9, 1.2, 0); annexRoof(k, 3.2, 3.4, 3.9, 2.45, 0, '#8aa4ad');
  k.box(1.6, 1.1, 2.8, '#f2f2ee', 3.6, 0.85, 3.1); k.box(1.5, 0.9, 1.0, '#c0392b', 3.6, 0.75, 4.9); k.win(1.3, 0.4, 0.05, 3.6, 1.0, 5.42);
  for(const dz of [2.2, 4.0]) for(const sx of [-1, 1]) k.cyl(0.32, 0.32, 0.25, 10, '#222', 3.6 + sx*0.75, 0.32, dz, 0, 0, Math.PI/2);
  upgPiece(k, x, z, 0, () => lvAt('cold', 0) >= 2); }
// treatment plant: more clarifier tanks, then a reed bed polishing the water
{ const x = -42, z = -18;
  let k = new Kit(); for(const dx of [-1.4, 1.6]){ k.cyl(1.2, 1.2, 1.6, 16, '#cfd4d6', dx, 0.8, -3.6); k.cyl(1.05, 1.05, 0.1, 16, '#7fa7a0', dx, 1.62, -3.6); }
  k.box(1.0, 0.5, 4.0, '#8a9196', 3.4, 0.25, -1.2);
  upgPiece(k, x, z, 0, () => lvAt('plant', 0) >= 2);
  k = new Kit(); k.box(6.5, 0.35, 4.2, '#6b5a3c', 0, 0.18, 7.4); for(let i=0;i<40;i++) k.cyl(0.04, 0.05, 0.9 + (i % 3)*0.25, 3, i % 2 ? '#7fae4a' : '#9cc45c', -2.9 + (i % 8)*0.82, 0.7, 5.8 + Math.floor(i/8)*0.8);
  k.box(0.8, 1.4, 0.8, '#a4a9ad', 3.6, 0.7, 7.4); k.glow(new THREE.BoxGeometry(0.2, 0.2, 0.05), 3.6, 1.2, 7.82);
  upgPiece(k, x, z, 0, () => lvAt('plant', 0) >= 3); }
// net recycling: a regranulating shed and bales of clean nylon
{ const x = 34, z = -4;
  const k = new Kit(); k.box(3.6, 2.4, 3.2, '#c9b182', -4.6, 1.2, -0.4); annexRoof(k, 3.6, 3.2, -4.6, 2.45, -0.4, '#6d4a32');
  for(let i=0;i<6;i++) k.box(0.9, 0.7, 0.9, ['#2f8f9d', '#e0a43a', '#3e8a66'][i % 3], -6.3 + (i % 3)*1.0, 0.35 + Math.floor(i/3)*0.72, 2.0);
  k.cyl(0.18, 0.18, 2.2, 6, '#7d8387', -3.3, 3.4, -1.2);
  upgPiece(k, x, z, 0, () => lvAt('recycle', 0) >= 2); }
// coral nursery: a greenhouse of tanks, then a gene-bank lab and more frames in the bay
{ const x = -42, z = -4;
  let k = new Kit(); k.box(4.2, 0.3, 3.0, '#c8c3b6', 0.4, 0.15, -3.6); k.glass(4.0, 2.0, 2.8, 0.4, 1.3, -3.6);
  for(let i=0;i<3;i++){ k.box(1.0, 0.5, 2.2, '#3a7ca5', -1.0 + i*1.35, 0.55, -3.6); k.box(0.9, 0.06, 2.0, '#6fd3e0', -1.0 + i*1.35, 0.82, -3.6); }
  upgPiece(k, x, z, 0, () => lvAt('nursery', 0) >= 2);
  k = new Kit(); k.box(2.4, 2.3, 4.2, '#f4f6f5', 4.2, 1.15, -1.0); k.box(2.6, 0.15, 4.4, '#3fb6a8', 4.2, 2.35, -1.0); k.win(0.08, 0.9, 2.6, 5.42, 1.4, -1.0);
  k.cyl(0.05, 0.05, 1.6, 4, '#555', 4.2, 3.2, -2.4); k.cyl(0.45, 0.2, 0.25, 10, '#e9ecee', 4.2, 4.0, -2.4, 0, 0.5);
  upgPiece(k, x, z, 0, () => lvAt('nursery', 0) >= 3); }
// fishermen's school: a new classroom wing, then an observatory hall
{ const x = -2, z = -29;
  let k = new Kit(); k.box(4.2, 2.6, 3.6, '#efe0c4', 5.2, 1.3, 0.2); annexRoof(k, 4.2, 3.6, 5.2, 2.65, 0.2, '#3f6e9a');
  for(const dx of [4.2, 6.2]) k.win(0.8, 0.8, 0.06, dx, 1.5, 2.04);
  upgPiece(k, x, z, 0, () => lvAt('school', 0) >= 2);
  k = new Kit(); k.box(5.0, 3.4, 4.4, '#f6f2ea', -5.6, 1.7, 0.4); k.geo(new THREE.SphereGeometry(1.8, 16, 8, 0, Math.PI*2, 0, Math.PI/2), '#dfe6ea', -5.6, 3.4, 0.4);
  k.box(0.5, 2.2, 0.2, '#4d5559', -5.6, 4.2, 0.4, 0, 0.6); k.glass(4.2, 1.6, 0.05, -5.6, 1.6, 2.62);
  upgPiece(k, x, z, 0, () => lvAt('school', 0) >= 3); }
// resorts: the first one's wing and eco-roof; a second resort on the hill
// the resort: three storeys of rooms with balconies, a set-back penthouse floor, a lobby canopy and a pool deck in front
// (massing kept as before, so the wing and eco-roof upgrades still sit where they should)
function resortKit(){
  const k = new Kit(), wall = '#f5efe4', acc = '#d9825b', teal = '#3aa6a8', slab = '#fbfaf6', steel = '#5b6266', fh = 2.17, W = 16, D = 7;
  k.box(W + 0.6, 0.3, D + 0.6, '#c9c4b8', 0, 0.15, 0);
  k.box(W, 3*fh, D, wall, 0, 0.3 + 1.5*fh, 0);
  // ground floor: lobby glass in the middle, a canopy on two posts
  k.win(5.0, 1.7, 0.08, 0, 1.25, D/2 + 0.02); for(let j=0;j<6;j++) k.box(0.07, 1.75, 0.12, steel, -2.5 + j, 1.25, D/2 + 0.05);
  k.box(6.2, 0.16, 2.4, slab, 0, 2.35, D/2 + 1.15); k.box(6.3, 0.1, 0.12, teal, 0, 2.47, D/2 + 2.33); for(const sx of [-1, 1]) k.cyl(0.08, 0.08, 2.1, 6, steel, sx*2.8, 1.3, D/2 + 2.1);
  for(const sx of [-1, 1]) for(let r=0;r<2;r++) win1(k, sx*(4.6 + r*2.3), 1.35, D/2 + 0.02, 0, slab, null, { w: 1.3, h: 1.1 });
  // rooms: each bay a pastel pilaster, a window-door and a balcony with a glass rail
  for(let f=1; f<3; f++){ const y = 0.3 + f*fh;
    k.box(W + 0.3, 0.16, D + 0.3, slab, 0, y, 0);
    for(let b=0;b<6;b++){ const x = -W/2 + 1.33 + b*2.67;
      k.win(1.5, 1.55, 0.08, x, y + 0.95, D/2 + 0.02);
      k.box(2.2, 0.12, 1.0, slab, x, y + 0.06, D/2 + 0.5);
      k.glass(2.2, 0.7, 0.04, x, y + 0.45, D/2 + 0.98); k.box(2.2, 0.05, 0.08, steel, x, y + 0.82, D/2 + 0.98);
      if((b + f) % 3 === 0){ k.box(0.4, 0.05, 0.4, '#ffffff', x - 0.5, y + 0.42, D/2 + 0.55); k.cyl(0.18, 0.14, 0.3, 6, '#c8734a', x + 0.75, y + 0.27, D/2 + 0.7); k.ball(0.28, '#4f9a3c', x + 0.75, y + 0.6, D/2 + 0.7, 1); } }
    for(let b=0;b<=6;b++) k.box(0.32, fh - 0.16, 0.12, b % 2 ? acc : teal, -W/2 + b*2.67, y + fh/2, D/2 + 0.05); }
  // sides and back: rows of windows and a band at each floor
  for(let f=0; f<3; f++){ const y = 0.3 + f*fh + 1.05;
    for(const sx of [-1, 1]) for(const z of [-2.0, 0, 2.0]) win1(k, sx*(W/2 + 0.01), y, z, sx*Math.PI/2, slab, null, { w: 0.9, h: 1.0 });
    for(let b=0;b<6;b++) win1(k, -W/2 + 1.33 + b*2.67, y, -D/2 - 0.01, Math.PI, slab, null, { w: 1.0, h: 1.0 });
    if(f) for(const sx of [-1, 1]) k.box(0.05, 0.16, D + 0.02, shade(wall, 0.84), sx*(W/2 + 0.03), 0.3 + f*fh + 0.1, 0); }
  // roof of the main block: parapet with a terracotta cap, a pergola on the front terrace
  const top = 0.3 + 3*fh;
  k.box(W + 0.3, 0.16, D + 0.3, slab, 0, top, 0);
  for(const s of [-1, 1]){ k.box(W + 0.3, 0.5, 0.12, slab, 0, top + 0.25, s*(D/2 + 0.09)); k.box(0.12, 0.5, D + 0.3, slab, s*(W/2 + 0.09), top + 0.25, 0);
    k.box(W + 0.36, 0.08, 0.2, acc, 0, top + 0.52, s*(D/2 + 0.09)); k.box(0.2, 0.08, D + 0.36, acc, s*(W/2 + 0.09), top + 0.52, 0); }
  for(let j=0;j<5;j++) k.box(0.1, 0.1, 2.4, '#8f6440', 4.0 + j*0.8, top + 2.2, 1.9); for(const px of [4.0, 7.2]) for(const pz of [0.9, 3.0]) k.box(0.12, 2.1, 0.12, '#8f6440', px, top + 1.1, pz);
  // penthouse floor, set back, with a long window band and its own cap
  k.box(10, 3.4, 6, wall, -2, top + 1.7, -0.3);
  k.win(9.2, 1.6, 0.08, -2, top + 1.6, 2.72); for(let j=0;j<7;j++) k.box(0.07, 1.65, 0.12, steel, -6.6 + j*1.53, top + 1.6, 2.75);
  for(const sx of [-1, 1]) win1(k, -2 + sx*5.01, top + 1.6, -0.3, sx*Math.PI/2, slab, null, { w: 1.6, h: 1.2 });
  k.box(10.4, 0.2, 6.4, slab, -2, top + 3.45, -0.3); k.box(10.5, 0.1, 6.5, teal, -2, top + 3.6, -0.3);
  // pool deck in front: white deck, blue pool with a lighter rim, loungers and umbrellas, palms in planters
  k.box(9, 0.22, 4.6, '#efe9dc', 2, 0.11, 6.6); k.box(7, 0.08, 3.4, '#4fcfe0', 2, 0.24, 6.6); k.box(7.2, 0.1, 0.12, '#ffffff', 2, 0.26, 4.85); k.box(7.2, 0.1, 0.12, '#ffffff', 2, 0.26, 8.35);
  for(let j=0;j<4;j++){ const lx = -1.6 + j*1.25; k.box(0.55, 0.12, 1.4, '#ffffff', lx, 0.42, 9.4, 0); k.box(0.55, 0.5, 0.1, '#ffffff', lx, 0.62, 10.05, 0, -0.5); }
  for(const [px, c] of [[-3, '#ff7a59'], [-1, '#ffd166'], [6.4, '#4fc3d9']]){ k.cyl(0.05, 0.05, 2.2, 4, '#555555', px, 1.1, 6.6); k.geo(new THREE.ConeGeometry(1.1, 0.5, 8), c, px, 2.3, 6.6); k.geo(new THREE.ConeGeometry(1.12, 0.12, 8), '#ffffff', px, 2.08, 6.6); }
  for(const px of [-5.6, 5.6]){ k.box(1.0, 0.6, 1.0, '#c9c4b8', px, 0.3, D/2 + 2.6); k.ball(0.55, '#4f9a3c', px, 0.95, D/2 + 2.6, 1); }
  return k;
}
{ const old = VB.resort; if(old){ dio.remove(old); const g = resortKit().build(-31, -34, 0); VB.resort = hideG(g); } }
VB.resort2 = hideG(VB.resort.clone()); VB.resort2.position.set(30, dioH(30, -52), -52); VB.resort2.rotation.y = -0.15; dio.add(VB.resort2);
for(const [ri, x, z, ry] of [[0, -31, -34, 0], [1, 30, -52, -0.15]]){
  let k = new Kit(); k.box(7, 5, 6, '#f5efe4', -11.5, 2.5, 0.5); for(const y of [1.2, 3.4]) k.win(6.6, 0.9, 6.1, -11.5, y, 0.5);
  for(let b=0;b<=3;b++) k.box(0.3, 4.6, 0.12, b % 2 ? '#d9825b' : '#3aa6a8', -14.8 + b*2.2, 2.6, 3.55); k.box(7.3, 0.1, 6.3, '#3aa6a8', -11.5, 5.18, 0.5);
  k.box(7.4, 0.25, 6.4, '#9fb0b8', -11.5, 5.0, 0.5); k.box(4.5, 0.25, 3, '#5fd6e4', -11.5, 0.15, 5.6);
  upgPiece(k, x, z, ry, () => lvAt('resort', ri) >= 2);
  k = new Kit(); for(let i=0;i<10;i++) k.ball(0.6, i % 2 ? '#5f9a3c' : '#76b04a', -4 + (i % 5)*1.6 - 2, 10.4, -1.5 + Math.floor(i/5)*2.4, 1);
  for(let j=0;j<4;j++) k.box(1.6, 0.06, 1.1, '#24406b', -6 + j*1.8, 7.2, -2.6, 0, -0.35);
  k.cyl(0.08, 0.1, 6, 6, '#e9ecee', 7.4, 3, -3); for(let b=0;b<3;b++) k.box(0.18, 2.4, 0.06, '#f6f6f6', 7.4 + Math.cos(b*2.09)*1.1, 6.0 + Math.sin(b*2.09)*1.1, -2.9, 0, 0, b*2.09);
  upgPiece(k, x, z, ry, () => lvAt('resort', ri) >= 3); }
// marine research station on the hill: labs, a dish, then an observatory dome and a wind turbine
VB.research = (() => { const x = -36, z = -62, k = new Kit();
  k.box(9, 3.2, 5, '#f4f6f5', 0, 1.6, 0); k.box(9.4, 0.25, 5.4, '#2f6f8f', 0, 3.3, 0);
  for(let i=0;i<5;i++) k.win(1.2, 1.1, 0.06, -3.6 + i*1.8, 1.8, 2.53);
  k.box(1.6, 2.3, 0.1, '#2f6f8f', 2.6, 1.15, 2.55); k.cyl(0.05, 0.05, 3.2, 4, '#555', -3.6, 4.9, -1.2); k.box(0.04, 0.45, 0.8, '#3fb6a8', -3.6, 6.2, -0.8);
  return hideG(k.build(x, z, 0.1)); })();
dio.add(VB.research);
{ const x = -36, z = -62;
  let k = new Kit(); k.box(5, 2.8, 4, '#eef1f0', 7.2, 1.4, 0.6); k.box(5.3, 0.22, 4.3, '#2f6f8f', 7.2, 2.9, 0.6);
  k.cyl(0.08, 0.1, 2.4, 6, '#9aa3a8', 6.0, 4.2, 0.0); k.geo(new THREE.SphereGeometry(1.2, 14, 6, 0, Math.PI*2, 0, Math.PI*0.35).rotateX(-0.9), '#e9ecee', 6.0, 5.2, 0.4);
  upgPiece(k, x, z, 0.1, () => lvAt('research', 0) >= 2);
  k = new Kit(); k.box(4.2, 2.6, 4.2, '#f4f6f5', -7.2, 1.3, 0.2); k.geo(new THREE.SphereGeometry(2.1, 18, 9, 0, Math.PI*2, 0, Math.PI/2), '#d9e2e6', -7.2, 2.6, 0.2);
  k.box(0.6, 2.4, 0.15, '#3a4a55', -7.2, 3.8, 1.6, 0, -0.4);
  k.cyl(0.14, 0.24, 9, 8, '#f2f4f5', -2, 4.5, -5); k.box(0.6, 0.6, 1.2, '#e6eaec', -2, 9.0, -4.6);
  upgPiece(k, x, z, 0.1, () => lvAt('research', 0) >= 3);
  VB.blades = new THREE.Group(); VB.blades.position.set(x - 2, dioH(x, z) + 9.0, z - 3.95);
  for(let b=0;b<3;b++){ const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 0.08).translate(0, 2.1, 0), SM('#f6f6f6')); m.rotation.z = b*2.094; VB.blades.add(m); }
  hideG(VB.blades); dio.add(VB.blades); UPG.push({ g: VB.blades, on: () => lvAt('research', 0) >= 3, x, z }); }
// the harbour: a concrete quay along the right-hand shore and a breakwater into the bay
const HARBOR = (() => { const x0 = 29, x1 = 48, sz = shoreZ(40), y = 0.55, k = new Kit();
  k.box(x1 - x0, 1.6, 4.2, '#b9b5ab', (x0 + x1)/2, y - 0.8, sz + 1.6);
  k.box(x1 - x0, 0.12, 0.25, '#e8d04a', (x0 + x1)/2, y + 0.02, sz + 3.55);
  for(let x = x0 + 1.5; x < x1; x += 3) k.cyl(0.18, 0.22, 0.45, 8, '#3a3f44', x, y + 0.22, sz + 3.3);
  k.box(2.6, 1.6, 15, '#a8a49a', 46.6, y - 0.8, sz + 10.6);
  for(let i=0;i<22;i++) k.geo(new THREE.IcosahedronGeometry(0.6 + (i % 3)*0.15, 0), ['#8b887f', '#7c7970', '#97938a'][i % 3], 46.6 + (i % 2 ? 1.6 : -1.6), -0.2, sz + 3.6 + i*0.62, i, i*0.3, 0);
  k.cyl(0.35, 0.4, 2.6, 10, '#f2f2ee', 46.6, y + 1.3, sz + 17.6); k.box(0.72, 0.6, 0.72, '#c0392b', 46.6, y + 2.9, sz + 17.6); k.glow(new THREE.BoxGeometry(0.4, 0.35, 0.4), 46.6, y + 3.35, sz + 17.6);
  const g = hideG(k.build(0, 0, 0, 0)); VB.harbor = g;
  // warehouse and a crane, then a second crane and stacked containers
  let a = new Kit(); a.box(7, 3.4, 4.5, '#d6dade', 33.5, 1.7 + dioH(33.5, sz - 4) - 0.2, sz - 3.6); a.box(7.3, 0.3, 4.8, '#5d7f99', 33.5, 3.55 + dioH(33.5, sz - 4) - 0.2, sz - 3.6);
  a.box(2.2, 2.6, 0.1, '#5d7f99', 33.5, 1.3 + dioH(33.5, sz - 4) - 0.2, sz - 1.32);
  const crane = (kk, cx) => { for(const sx of [-1, 1]) for(const sz2 of [-1, 1]) kk.box(0.25, 6.5, 0.25, '#e8a33a', cx + sx*0.9, y + 3.25, sz + 2 + sz2*0.9);
    kk.box(2.3, 0.6, 2.3, '#e8a33a', cx, y + 6.6, sz + 2); kk.box(0.5, 0.5, 9, '#e8a33a', cx, y + 7.1, sz + 4.5); kk.box(1.3, 1.0, 1.4, '#f2f2ee', cx, y + 7.2, sz + 1.0);
    kk.cyl(0.03, 0.03, 4.5, 3, '#222', cx, y + 4.8, sz + 8.4); kk.box(1.2, 0.3, 0.6, '#3a3f44', cx, y + 2.5, sz + 8.4); };
  crane(a, 40);
  upgPiece(a, 0, 0, 0, () => lvAt('harbor', 0) >= 2, 0, 38, sz);
  let c = new Kit(); crane(c, 44.5);
  for(let i=0;i<9;i++) c.box(2.6, 1.1, 1.05, ['#c0392b', '#2f78c4', '#3e8a66', '#e0a43a'][i % 4], 30.5 + (i % 3)*2.8, y + 0.55 + Math.floor(i/3)*1.12, sz + 0.6);
  upgPiece(c, 0, 0, 0, () => lvAt('harbor', 0) >= 3, 0, 42, sz);
  return { sz, y }; })();
UPG.push({ g: VB.harbor, on: () => (V.harbor || 0) > 0, x: 40, z: HARBOR.sz });
// ships at the quay: offshore trawlers along the front, white whale-watching catamarans inside the breakwater
const SHIPS = [];
function offshoreShip(color){   // a deep-sea longliner: high bow, wheelhouse aft, a mast and a line drum
  const g = new THREE.Group(), L = 7.2, W = 2.3, Hh = 1.4;
  dm(hullGeo(L, W, Hh), SM(color, { flatShading: false, roughness: 0.6 }), 0, 0.2, 0, g);
  dm(hullGeo(L*1.01, W*1.04, Hh*0.14), SM('#f2f2ee'), 0, 0.2 + Hh*0.36, 0, g);
  dm(new THREE.BoxGeometry(W*0.8, 0.1, L*0.8), SM('#9a8f80'), 0, 0.2 + Hh*0.42, -L*0.04, g);
  dm(new THREE.BoxGeometry(W*0.7, 1.6, L*0.26), SM('#f6f4ee'), 0, 1.75, -L*0.22, g);
  dm(new THREE.BoxGeometry(W*0.72, 0.3, L*0.27), winMat, 0, 2.2, -L*0.22, g);
  dm(new THREE.BoxGeometry(W*0.8, 0.12, L*0.3), SM('#2f3b44'), 0, 2.6, -L*0.22, g);
  dm(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6), SM('#d9d9d9'), 0, 3.6, -L*0.05, g);
  dm(new THREE.BoxGeometry(1.4, 0.08, 0.08), SM('#d9d9d9'), 0, 4.6, -L*0.05, g);
  dm(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 12).rotateZ(Math.PI/2), SM('#c0392b'), 0, 1.25, L*0.2, g);
  for(const sx of [-1, 1]) dm(new THREE.BoxGeometry(0.1, 0.5, L*0.35), SM('#e8a33a'), sx*W*0.42, 1.0, L*0.15, g);
  dio.add(g); g.visible = false; return g;
}
for(let i=0;i<6;i++){ const g = offshoreShip(['#2f4f6f', '#7a2e2e', '#2f5f4f'][i % 3]); g.scale.setScalar(1.0); g.rotation.y = 0;   // bows out to sea, side by side
  g.position.set(30.2 + i*2.65, 0.12, HARBOR.sz + 7.4); SHIPS.push({ g, kind: 'offshore', i, home: g.position.clone() }); }
for(let i=0;i<3;i++){ const g = makeBoat('#ffffff', 'tour'); g.scale.setScalar(1.25); g.rotation.y = Math.PI/2;
  g.position.set(39.5, 0.12, HARBOR.sz + 13.6 + i*2.6); SHIPS.push({ g, kind: 'whale', i, home: g.position.clone() }); }
// a bigger town: a boulevard and lamps up the hill (port city), then an observation tower and an aquarium (ocean city)
{ let k = new Kit();
  for(const [x, z] of [[-20, -60.5], [-14, -60.5], [-4, -60.6], [4, -61], [14, -61.3], [19, -61.5]]){ k.cyl(0.14, 0.2, 2.6, 6, '#6f4e33', x, dioH(x, z) + 1.3, z); k.ball(1.25, '#5f9a3c', x, dioH(x, z) + 3.3, z, 1); }
  upgPiece(k, 0, 0, 0, () => devTier(V) >= 3, 0, 0, -60);
  k = new Kit(); const tx = -42, tz = -80, ty = dioH(tx, tz);
  k.cyl(0.9, 1.3, 16, 10, '#eef1f0', tx, ty + 8, tz); k.cyl(2.4, 2.0, 2.2, 14, '#9fd3e6', tx, ty + 17, tz); k.cyl(2.6, 2.6, 0.3, 14, '#f6f6f6', tx, ty + 18.2, tz);
  k.cyl(0.06, 0.06, 3, 4, '#555', tx, ty + 19.8, tz); k.glow(new THREE.SphereGeometry(0.25, 8, 6), tx, ty + 21.4, tz);
  const ax = 26, az = -78, ay = dioH(ax, az);
  k.box(12, 4, 7, '#2f6f8f', ax, ay + 2, az); k.geo(new THREE.SphereGeometry(3.6, 18, 9, 0, Math.PI*2, 0, Math.PI/2).scale(1.4, 0.8, 1), '#9fd3e6', ax, ay + 4, az);
  k.glass(10, 2.6, 0.05, ax, ay + 1.6, az + 3.53); k.box(6, 1, 0.2, '#ffffff', ax, ay + 3.4, az + 3.6); k.box(3.6, 0.5, 0.25, '#ff7a59', ax, ay + 3.45, az + 3.66);
  upgPiece(k, 0, 0, 0, () => devTier(V) >= 4, 0, -8, -79); }
// the new hills start as woodland (merged into three meshes: trunks and two canopy tones that still follow the seasons)
{ const R = mulberry32(4711), trunks = [], can1 = [], can2 = [];
  for(let n=0, t=0; n < 46 && t < 900; t++){ const x = -46 + R()*92, z = -88 + R()*40;
    if(blocked(x, z, 3.6) || pathDist(x, z) < 3.4) continue; n++;
    const y = dioH(x, z), s = 0.85 + R()*0.45;
    trunks.push(new THREE.CylinderGeometry(0.26*s, 0.45*s, 4.2*s, 6).translate(x, y + 2.1*s, z));
    for(let k=0;k<6;k++){ const a = k*1.05 + R(), r = k ? 1.3*s : 0;
      (k % 2 ? can1 : can2).push(new THREE.IcosahedronGeometry((1.25 + R()*0.6)*s, 1).translate(x + Math.cos(a)*r, y + (4.6 + R()*1.2 + (k ? 0 : 1))*s, z + Math.sin(a)*r)); } }
  const m1 = SM('#5f9a3c'), m2 = SM('#76b04a'); m1.userData.v = 0.3; m2.userData.v = 0.7; canopyMats.push(m1, m2);
  for(const [list, mt] of [[trunks, SM('#6f4e33')], [can1, m1], [can2, m2]]){ const m = new THREE.Mesh(mergeGeometries(list), mt); m.castShadow = m.receiveShadow = true; dio.add(m); } }
function updateTown2(dt, running, elev){
  const T = devTier(V), style = Math.min(T, 2);
  for(const h of VB.houseVars){ const built = h.i < V.houses, lv = lvOf(V, 'house', h.i), tg = built ? HSTYLE[style][lv - 1] : -1;
    if(tg !== h.cur){ if(h.cur >= 0 && tg >= 0) puff(h.x, h.z, 14); h.cur = tg; }
    for(let j=0;j<h.vars.length;j++) popTo(h.vars[j], j === h.cur, dt); }
  VB.shopVars.forEach((s, j) => { const tg = j < V.shops ? style*3 + lvOf(V, 'shop', j) - 1 : -1;
    if(tg !== s.cur){ if(s.cur >= 0 && tg >= 0) puff(s.x, s.z, 12); s.cur = tg; }
    for(let q=0;q<s.vars.length;q++) popTo(s.vars[q], q === s.cur, dt); });
  for(const u of UPG){ const on = u.on(); if(on && !u.was && u.was !== undefined) puff(u.x, u.z, 12); u.was = on; popTo(u.g, on, dt); }
  popTo(VB.resort2, V.resort > 1, dt); popTo(VB.research, (V.research || 0) > 0, dt);
  if(VB.blades.visible) VB.blades.rotation.z += dt*(1.2 + wx.wind*3);
  const atSea = running && elev > 0.08;
  for(const s of SHIPS){ const n = s.kind === 'offshore' ? (V.offshore || 0) : (V.whale || 0), on = s.i < n && !atSea;
    s.g.visible = on; if(on){ s.g.position.y = 0.12 + Math.sin(time*1.3 + s.i)*0.06*wx.wave;
      const big = s.kind === 'offshore' ? lvOf(V, 'offshore', s.i) : lvOf(V, 'whale', s.i); s.g.scale.setScalar((s.kind === 'offshore' ? 1.0 : 1.25)*(big > 1 ? 1.12 : 1)); } }
}

// ---- out on the open water: the offshore boats on their long-lines, whale-watchers where the whale is
const dFleet = [], dWatch = [];
for(let i=0;i<6;i++){ const g = offshoreShip(['#2f4f6f', '#7a2e2e', '#2f5f4f'][i % 3]); g.scale.setScalar(0.85);
  const floats = []; for(let j=0;j<7;j++){ const f = dm(new THREE.SphereGeometry(0.28, 6, 5), SM('#ff7a1a')); f.visible = false; floats.push(f); }
  dFleet.push({ g, floats, a: i*1.05 + 0.3, r: 16 + (i % 3)*7 }); }
for(let i=0;i<3;i++){ const g = makeBoat('#ffffff', 'tour'); g.scale.setScalar(1.1); dWatch.push({ g, i }); }
const fleetTmp = new THREE.Vector3();
function updateFleet(dt, t){
  const atSea = state === 'running';
  dFleet.forEach((s, i) => { const on = i < (V.offshore || 0); s.g.visible = on; s.floats.forEach(f => f.visible = on); if(!on) return;
    s.a += dt*(atSea ? 0.08 : 0.015); const cx = 8, cz = 108, x = cx + Math.cos(s.a)*s.r*1.4, z = cz + Math.sin(s.a)*s.r*0.9;
    s.g.position.set(x, 0.12 + Math.sin(t*1.2 + i)*0.08*wx.wave, z); s.g.rotation.y = -s.a;
    s.floats.forEach((f, j) => { const b = s.a - 0.07*(j + 1); f.position.set(cx + Math.cos(b)*s.r*1.4, 0.12, cz + Math.sin(b)*s.r*0.9); }); });
  const wpos = fromOcean(whale.position, fleetTmp);
  dWatch.forEach(s => { const on = s.i < (V.whale || 0); s.g.visible = on; if(!on) return;
    const a = s.i*2.1 + t*0.03, near = whale.visible && wpos.z > 52 && wpos.z < SEA_Z - 4 && Math.abs(wpos.x) < 46;
    const cx = near ? wpos.x : -14, cz = near ? wpos.z : 96;
    s.g.position.set(clamp(cx + Math.cos(a)*8, -45, 45), 0.12 + Math.sin(t*1.4 + s.i)*0.08*wx.wave, clamp(cz + Math.sin(a)*6, 54, SEA_Z - 4)); s.g.rotation.y = a + Math.PI/2; });
}
// dead fish float up in a red tide
const DEADN = 46, deadIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.7, 4).rotateZ(Math.PI/2).scale(1, 0.45, 1), new THREE.MeshStandardMaterial({ color: '#dfe3e2', roughness: 0.4, metalness: 0.3, flatShading: true }), DEADN);
const deadP = []; { const R = mulberry32(31); for(let i=0;i<DEADN;i++) deadP.push({ x: -44 + R()*88, z: 3 + Math.pow(R(), 1.6)*30, r: R()*6.28, s: 0.8 + R()*0.5, d: R() }); }
for(let i=0;i<DEADN;i++) deadIM.setMatrixAt(i, ZERO);
deadIM.frustumCulled = false; deadIM.userData.n = 0; dio.add(deadIM);
function updateDeadFish(t){
  const n = bloomV > 0.25 ? Math.round((bloomV - 0.25)/0.75*DEADN) : 0;
  if(n === 0 && deadIM.userData.n === 0) return; deadIM.userData.n = n;
  for(let i=0;i<DEADN;i++){ const p = deadP[i];
    if(i >= n){ deadIM.setMatrixAt(i, ZERO); continue; }
    const x = ((p.x + Math.sin(t*0.05 + p.d*6)*2 + t*0.12 + 46) % 92 + 92) % 92 - 46, z = p.z + Math.cos(t*0.04 + p.d*5)*1.2;
    dummy.position.set(x, -0.02 + Math.sin(x*0.35 + t*1.4)*0.08 + Math.cos(z*0.3 + t*1.1)*0.07, z);
    dummy.rotation.set(Math.PI*0.45, p.r + Math.sin(t*0.3 + p.d*9)*0.3, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix(); deadIM.setMatrixAt(i, dummy.matrix); }
  dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); deadIM.instanceMatrix.needsUpdate = true;
}

// ---- puffs of dust when something is built or rebuilt
const PUFF_N = 120, puffs = [], puffIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 1, flatShading: true }), PUFF_N);
for(let i=0;i<PUFF_N;i++) puffIM.setMatrixAt(i, ZERO);
puffIM.frustumCulled = false; dio.add(puffIM);
let puffK = 0, puffLive = 0;
function puff(x, z, n = 14){ if(!n) return; const y = dioH(x, z), R = Math.sqrt(n)*0.5;
  for(let i=0;i<n;i++){ const a = Math.random()*6.283, r = 0.4 + Math.random()*R; puffs[puffK] = { x: x + Math.cos(a)*r, y: y + 0.3 + Math.random()*1.2, z: z + Math.sin(a)*r, vx: Math.cos(a)*1.4, vz: Math.sin(a)*1.4, vy: 0.9 + Math.random()*0.8, t: 0, life: 0.7 + Math.random()*0.6, s: 0.7 + Math.random()*1.1 }; puffK = (puffK + 1) % PUFF_N; }
  puffLive = 2.5; }
function updatePuffs(dt){
  if(puffLive <= 0) return; puffLive -= dt;
  for(let i=0;i<PUFF_N;i++){ const p = puffs[i];
    if(!p || p.t >= p.life){ puffIM.setMatrixAt(i, ZERO); continue; }
    p.t += dt; p.x += p.vx*dt; p.z += p.vz*dt; p.y += p.vy*dt; p.vx *= 0.94; p.vz *= 0.94;
    const s = Math.sin(Math.min(1, p.t/p.life)*Math.PI)*p.s; dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(Math.max(0.001, s)); dummy.updateMatrix(); puffIM.setMatrixAt(i, dummy.matrix); }
  dummy.scale.setScalar(1); puffIM.instanceMatrix.needsUpdate = true;
}
let townTier = -1;
function updateTown(dt){
  const T = devTier(V);
  if(townTier >= 0 && T !== townTier && $('village').classList.contains('on')) renderVillageUI();
  if(townTier >= 0 && T > townTier){ const t = TIERS[T]; cue(0.9, () => { toast(`村子发展成了「${t.n}」`, t.d, 7000); chime(3); }); }
  townTier = T;
  for(const e of TIERED){
    const on = e.when(), Ti = Math.min(T, e.vars.length - 1);
    if(e.shown === -1) e.shown = Ti;
    else if(e.shown !== Ti){ if(e.wait < 0) e.wait = 0.3 + e.order*0.16; e.wait -= dt;
      if(e.wait <= 0){ if(on && e.vars[e.shown] !== e.vars[Ti]) puff(e.x, e.z, e.big); e.shown = Ti; e.wait = -1; } }
    const cur = e.vars[e.shown];
    for(const g of e.uniq){ if(e.swap) g.visible = on && g === cur; else popTo(g, on && g === cur, dt); }
  }
}
// ---- villagers: legs, arms, a body, a head, hair or a straw hat; they walk the roads and swing their arms
const PV = 34, PT = 10, PA = 2, PN = PV + PT + PA;
const pMat = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
const mkIM = (geo, n) => { const m = new THREE.InstancedMesh(geo, pMat, n); m.castShadow = true; m.frustumCulled = false; for(let i=0;i<n;i++) m.setMatrixAt(i, ZERO); dio.add(m); return m; };
const P_LEG = mkIM(new THREE.BoxGeometry(0.15, 0.6, 0.17).translate(0, -0.3, 0), PN*2);
const P_ARM = mkIM(new THREE.BoxGeometry(0.1, 0.5, 0.12).translate(0, -0.23, 0), PN*2);
const P_BODY = mkIM(new THREE.CylinderGeometry(0.21, 0.17, 0.62, 7).scale(1, 1, 0.66), PN);
const P_HEAD = mkIM(new THREE.IcosahedronGeometry(0.18, 1), PN);
const P_HAIR = mkIM(new THREE.SphereGeometry(0.198, 9, 5, 0, Math.PI*2, 0, Math.PI*0.52).translate(0, 0.02, -0.015), PN);
const P_HAT = mkIM(new THREE.ConeGeometry(0.38, 0.2, 10).translate(0, 0.1, 0), PN);
const PNODES = [], PADJ = [];
{ const id = (x, z) => { let i = PNODES.findIndex(n => Math.abs(n[0] - x) < 0.01 && Math.abs(n[1] - z) < 0.01); if(i < 0){ i = PNODES.push([x, z]) - 1; PADJ.push([]); } return i; };
  for(const pl of PATHS) for(let i=0;i<pl.length-1;i++){ const a = id(...pl[i]), b = id(...pl[i + 1]); PADJ[a].push(b); PADJ[b].push(a); } }
const BEACH = []; for(let x = -44; x <= 1; x += 3) BEACH.push([x, Math.max(1.3, shoreZ(x) - 1.7)]);
const people = [];
{
  const SKIN = ['#f1caa8', '#e8b796', '#c98f6b', '#a8714f', '#8a5a3c'], HAIRC = ['#2a1d14', '#3b2a1e', '#151515', '#6b4a2f', '#b89a6a', '#d8d2c8'];
  const SHIRT_V = ['#c9483f', '#e0973a', '#3f7fa8', '#4f8f52', '#71589e', '#ece5d6', '#2f4f6f', '#b8653f', '#8a9a5b'], PANTS_V = ['#3b4a6b', '#5a4632', '#2f3b3f', '#6f6250', '#46525e'];
  const SHIRT_T = ['#ff7a59', '#4fc3d9', '#ffd166', '#ff9fc2', '#7bd389', '#ffffff', '#b28dff'], PANTS_T = ['#f3e6c8', '#8fb8d8', '#f0f0ea', '#e7b46a', '#4fb3a9'];
  const R = mulberry32(4242), pick = a => a[(R()*a.length)|0], col = new THREE.Color();
  for(let i=0;i<PN;i++){
    const kind = i < PV ? 'v' : i < PV + PT ? 't' : 'a';
    const skin = pick(SKIN), shirt = kind === 't' ? pick(SHIRT_T) : pick(SHIRT_V), pants = kind === 't' ? pick(PANTS_T) : pick(PANTS_V);
    const hat = kind === 'a' ? true : kind === 'v' ? R() < 0.35 : R() < 0.5;
    P_LEG.setColorAt(2*i, col.set(pants)); P_LEG.setColorAt(2*i + 1, col.set(pants));
    const sleeve = kind === 't' ? skin : shirt;
    P_ARM.setColorAt(2*i, col.set(sleeve)); P_ARM.setColorAt(2*i + 1, col.set(sleeve));
    P_BODY.setColorAt(i, col.set(shirt)); P_HEAD.setColorAt(i, col.set(skin)); P_HAIR.setColorAt(i, col.set(pick(HAIRC)));
    P_HAT.setColorAt(i, col.set(kind === 't' ? pick(['#f7f4ec', '#f2d16b', '#e65a4a']) : '#d9c27c'));
    const p = { kind, hat, s: 0.82 + R()*0.12, ph: R()*6, yaw: R()*6, walk: false, wait: R()*3, armA: 0, off: (R() - 0.5)*1.3, speed: 0.85 + R()*0.35, pos: new THREE.Vector3(), y: 0 };
    if(kind === 'v'){ const a = (R()*PNODES.length)|0, b = PADJ[a][(R()*PADJ[a].length)|0], f = R(); p.a = a; p.b = b; p.pos.set(PNODES[a][0] + (PNODES[b][0] - PNODES[a][0])*f, 0, PNODES[a][1] + (PNODES[b][1] - PNODES[a][1])*f); }
    else if(kind === 't'){ p.bi = R()*(BEACH.length - 1); p.dir = R() < 0.5 ? 1 : -1; p.goal = (R()*(BEACH.length - 1)); const k = Math.floor(p.bi); p.pos.set(BEACH[k][0], 0, BEACH[k][1]); }
    else { const j = i - PV - PT; p.pos.set(j ? 9.15 : 6.85, 0, j ? 19.5 : 15); p.yaw = j ? Math.PI/2 : -Math.PI/2; p.armA = -1.05; p.y = 0.93; p.wait = 0; }
    people.push(p);
  }
  [P_LEG, P_ARM, P_BODY, P_HEAD, P_HAIR, P_HAT].forEach(m => m.instanceColor.needsUpdate = true);
}
// fishing rods for the two anglers on the dock
const rods = new Kit();
for(const [x, z, s] of [[6.85, 15, -1], [9.15, 19.5, 1]]){ const L = 2.6, a = 0.75;
  rods.cyl(0.02, 0.03, L, 4, '#3b2a1c', x + s*(0.35 + Math.sin(a)*L/2), 0.93 + 0.9 + Math.cos(a)*L/2, z, 0, 0, -s*a);
  rods.cyl(0.006, 0.006, 2.3, 3, '#e8e8e8', x + s*(0.35 + Math.sin(a)*L), 0.93 + 0.9 + Math.cos(a)*L - 1.15, z); }
const rodG = rods.build(0, 0, 0, 0);
const PM = new THREE.Matrix4(), LM = new THREE.Matrix4(), PQ = new THREE.Quaternion(), LQ = new THREE.Quaternion(), PP = new THREE.Vector3(), PS = new THREE.Vector3(), AXX = new THREE.Vector3(1, 0, 0), AXY = new THREE.Vector3(0, 1, 0);
function drawPerson(i, p, vis){
  if(!vis){ P_LEG.setMatrixAt(2*i, ZERO); P_LEG.setMatrixAt(2*i + 1, ZERO); P_ARM.setMatrixAt(2*i, ZERO); P_ARM.setMatrixAt(2*i + 1, ZERO);
    P_BODY.setMatrixAt(i, ZERO); P_HEAD.setMatrixAt(i, ZERO); P_HAIR.setMatrixAt(i, ZERO); P_HAT.setMatrixAt(i, ZERO); return; }
  const sw = p.walk ? Math.sin(p.ph)*0.62 : 0, bob = p.walk ? Math.abs(Math.cos(p.ph))*0.05 : Math.sin(time*2 + i)*0.008;
  PM.compose(PP.set(p.pos.x, p.y, p.pos.z), PQ.setFromAxisAngle(AXY, p.yaw), PS.setScalar(p.s));
  const part = (im, idx, x, y, z, rx) => { LQ.setFromAxisAngle(AXX, rx); LM.compose(KV.set(x, y + bob, z), LQ, K1); LM.premultiply(PM); im.setMatrixAt(idx, LM); };
  part(P_LEG, 2*i, -0.09, 0.6, 0, sw); part(P_LEG, 2*i + 1, 0.09, 0.6, 0, -sw);
  part(P_ARM, 2*i, -0.27, 1.15, 0, -sw*0.85 + p.armA); part(P_ARM, 2*i + 1, 0.27, 1.15, 0, sw*0.85 + p.armA);
  part(P_BODY, i, 0, 0.9, 0, 0); part(P_HEAD, i, 0, 1.39, 0, 0);
  if(p.hat){ part(P_HAT, i, 0, 1.47, 0, 0); P_HAIR.setMatrixAt(i, ZERO); } else { part(P_HAIR, i, 0, 1.4, 0, 0); P_HAT.setMatrixAt(i, ZERO); }
}
function walkTo(p, tx, tz, sp, dt){
  const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
  if(d < 0.12){ p.walk = false; return true; }
  const st = Math.min(d, sp*dt); p.pos.x += dx/d*st; p.pos.z += dz/d*st; p.walk = true; p.ph += st*5.2;
  const h = Math.atan2(dx, dz); p.yaw += Math.atan2(Math.sin(h - p.yaw), Math.cos(h - p.yaw))*Math.min(1, dt*8);
  return false;
}
function updatePeople(dt, running, night){
  const hide = running && night > 0.6, sp = (running ? 7 : 1.6)*(1 + wx.rain*0.8), outK = clamp(1 - 0.7*wx.rain - 0.8*smooth(0.3, 0.85, night), 0.12, 1);
  const nV = Math.min(PV, Math.round(V.pop*0.7*outK));
  const tourOn = V.pol.tour !== 'closed' && V.shops + V.resort > 0;
  const nT = tourOn ? Math.min(PT, Math.round((V.shops*2 + V.resort*5)*(V.pol.tour === 'limited' ? 0.6 : 1)*(1 - wx.rain)*(1 - smooth(0.3, 0.8, night)))) : 0;
  const anglers = V.boats > 0 && V.pol.fish !== 'ban' && !hide && !running && wx.rain < 0.35 && night < 0.6;
  rodG.visible = anglers;
  people.forEach((p, i) => {
    const vis = !hide && (p.kind === 'v' ? i < nV : p.kind === 't' ? i - PV < nT : anglers);
    if(vis && p.kind !== 'a'){
      if(p.wait > 0){ p.wait -= dt*(running ? 4 : 1); p.walk = false; }
      else if(p.kind === 'v'){
        const A = PNODES[p.a], B = PNODES[p.b], ex = B[0] - A[0], ez = B[1] - A[1], el = Math.hypot(ex, ez) || 1;
        if(walkTo(p, B[0] - ez/el*p.off, B[1] + ex/el*p.off, sp*p.speed, dt)){
          const nb = PADJ[p.b]; let n = nb[(Math.random()*nb.length)|0]; if(n === p.a && nb.length > 1) n = nb[(Math.random()*nb.length)|0];
          p.a = p.b; p.b = n; if(Math.random() < 0.35) p.wait = 1 + Math.random()*4; }
      } else {
        const k = Math.round(p.goal), tgt = BEACH[k];
        if(walkTo(p, tgt[0], tgt[1] + p.off*0.6, sp*p.speed*0.8, dt)){ p.goal = Math.random()*(BEACH.length - 1); p.wait = 2 + Math.random()*5; p.yaw = Math.PI*0.05; }
      }
      p.y = dioH(p.pos.x, p.pos.z);
    }
    drawPerson(i, p, vis);
  });
  [P_LEG, P_ARM, P_BODY, P_HEAD, P_HAIR, P_HAT].forEach(m => m.instanceMatrix.needsUpdate = true);
}

function popTo(g, on, dt){
  const tgt = on ? 1 : 0, s = g.userData.s ?? 0;
  const ns = s + (tgt - s)*Math.min(1, dt*4); g.userData.s = ns;
  const k = ns < 0.999 && tgt === 1 ? ns + Math.sin(ns*Math.PI)*0.18 : ns;
  g.scale.setScalar(Math.max(0.001, k)); g.visible = ns > 0.01;
}
const RUN = 9, RUN_DAYS = 4;
