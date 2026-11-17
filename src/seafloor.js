'use strict';
// ======================================================================= seafloor
{
  const g = new THREE.PlaneGeometry(760, 760, 256, 256).rotateX(-Math.PI/2);
  const p = g.attributes.position;
  for(let i=0;i<p.count;i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const floor = new THREE.Mesh(g, mat({
    vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vW = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: COMMON + /* glsl */`
    varying vec3 vW; varying vec3 vN;
    void main(){
      float d = distance(vW, cameraPosition);
      vec2 p = vW.xz;
      float warp = fbm2(p * 0.045) * 7.0;
      float rip = sin(dot(p, vec2(0.92, 0.38)) * 1.3 + warp) * 0.5 + 0.5;
      rip = rip * rip;
      float slope = 1.0 - normalize(vN).y;
      float rk = smoothstep(0.11, 0.26, slope + (fbm2(p * 0.18) - 0.5) * 0.2);
      float strata = sin(vW.y * 2.3 + fbm2(p * 0.06) * 5.0) * 0.5 + 0.5;
      float h = mix(rip * 0.5 + fbm2(p * 0.35) * 0.45 + vnoise(p * 7.0) * 0.05, strata * 0.6 + fbm2(p * 1.3) * 0.7, rk);
      vec3 n = bump(normalize(vN), vW, h, mix(0.42, 0.9, rk) * exp(-d * 0.018));
      float pn = fbm2(p * 0.028);
      vec3 sand = mix(vec3(0.66, 0.59, 0.46), vec3(0.80, 0.75, 0.64), smoothstep(0.3, 0.7, pn));
      sand *= 0.86 + 0.18 * rip;
      float speck = step(0.94, hash12(floor(p * 13.0)));
      sand = mix(sand, sand * vec3(0.55, 0.5, 0.48), speck * 0.6);
      vec3 silt = mix(vec3(0.30, 0.31, 0.23), vec3(0.41, 0.40, 0.29), pn) * (0.9 + 0.1 * rip);
      vec3 alb = mix(silt, sand, smoothstep(0.0, 1.0, uHealth));
      vec3 rockC = mix(vec3(0.17, 0.165, 0.16), vec3(0.37, 0.33, 0.28), strata * 0.6 + fbm2(p * 0.9) * 0.4);
      vec3 crust = mix(vec3(0.66, 0.36, 0.44), vec3(0.4, 0.5, 0.28), fbm2(p * 0.4 + 3.0));
      rockC = mix(rockC, crust * 0.8, smoothstep(0.45, 0.68, fbm2(p * 0.55 - 7.0)) * 0.75 * uHealth);
      float rub = smoothstep(0.07, 0.15, slope) * (1.0 - rk) * step(0.55, hash12(floor(p * 2.6)));
      alb = mix(alb, alb * 0.68 + vec3(0.05, 0.045, 0.04), rub * 0.6);
      alb = mix(alb, rockC, rk);
      vec3 col = shade(alb, n, vW, 1.0 - 0.25 * rk);
      gl_FragColor = vec4(fogged(col, vW), 1.0);
    }`,
  }));
  scene.add(floor);
}

// ======================================================================= reef layout: patches with coral-covered bommies
const PATCHES = [];
for(let i=0;i<13;i++){ const r = 26 + i*7.4, a = i*2.39996 + 0.9; const x = Math.cos(a)*r, z = Math.sin(a)*r;
  PATCHES.push({ x, z, R: 9 + rng()*5, bommies: [] }); }
const BOMMIES = [];
PATCHES.forEach(P => {
  const n = 3 + (rng() < 0.5 ? 1 : 0);
  for(let k=0;k<n;k++){
    const x = P.x + gauss()*P.R*0.55, z = P.z + gauss()*P.R*0.55, rx = 3.2 + rng()*3.4, ry = 2.6 + rng()*3.6;
    const b = { x, z, rx, ry, y: heightAt(x, z) - ry*0.15 }; P.bommies.push(b); BOMMIES.push(b);
  }
});
// extra reefs where the village can see them: clusters along the crest, patch reefs in the lagoon and the mid-bay
const EXTRA = [], PINNACLES = [];
{
  const add = (x, z, R, nb, sz) => { const E = { x, z, R, bommies: [], id: EXTRA.length % 13 };
    for(let k=0;k<nb;k++){ const bx = x + gauss()*R*0.5, bz = z + gauss()*R*0.5, rx = sz*(0.8 + rng()*0.6), ry = sz*(0.7 + rng()*0.7);
      const b = { x: bx, z: bz, rx, ry, y: heightAt(bx, bz) - ry*0.15 }; E.bommies.push(b); BOMMIES.push(b); }
    EXTRA.push(E); };
  for(let x = -112; x <= 112; x += 19 + rng()*6) add(x + gauss()*3, -104 + 0.0006*x*x + gauss()*3, 7, 3, 3.2);   // reef crest
  for(let k=0;k<6;k++){ const x = -100 + k*40 + gauss()*8; add(x, -122 + 0.0006*x*x + gauss()*3, 5, 2, 2.4); }  // lagoon patch reefs
  for(let k=0;k<6;k++){ const x = -95 + k*38 + gauss()*8; add(x, -72 + gauss()*10, 6, 2, 3.0); }                 // mid-bay bommies
  // tiered pinnacles: stacked rock towers rising out of the deep, crusted with coral
  for(const [x, z, H] of [[-58, 18, 17], [46, 36, 21], [86, -26, 15], [-18, 56, 24], [-92, -34, 13], [26, 116, 22], [-58, 132, 18], [70, 140, 15]]){
    const E = { x, z, R: 4, bommies: [], id: EXTRA.length % 13 }, y0 = heightAt(x, z);
    for(let k=0;k<4;k++){ const rx = 6 - k*1.25 + rng()*0.8, ry = H*(0.62 - k*0.08);
      const b = { x: x + gauss()*0.9, z: z + gauss()*0.9, rx, ry, y: y0 - ry*0.25 + k*H*0.27 }; E.bommies.push(b); BOMMIES.push(b); }
    EXTRA.push(E); PINNACLES.push(new THREE.Vector3(x, y0 + H*0.6, z)); }
  // coral caps on the seamount and on rocks out in the basin
  add(55, 190, 7, 3, 2.8); add(-22, 160, 6, 3, 2.6); add(-80, 100, 5, 2, 2.4); add(85, 105, 5, 2, 2.4);
}
function bommieY(b, x, z){ const r2 = ((x-b.x)**2 + (z-b.z)**2) / (b.rx*b.rx); return r2 >= 1 ? -1e9 : b.y + b.ry*0.64*Math.sqrt(1 - r2); }
function reefTopRaw(x, z){ let h = heightAt(x, z); for(const b of BOMMIES) h = Math.max(h, bommieY(b, x, z)); return h; }
const TG = 385, TG0 = -192;
const topGrid = new Float32Array(TG*TG);
for(let j=0;j<TG;j++) for(let i=0;i<TG;i++) topGrid[j*TG + i] = reefTopRaw(TG0 + i, TG0 + j);
function topAt(x, z){
  const fx = x - TG0, fz = z - TG0;
  if(fx < 0 || fz < 0 || fx >= TG-1 || fz >= TG-1) return heightAt(x, z);
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j*TG + i;
  return lerp(lerp(topGrid[k], topGrid[k+1], u), lerp(topGrid[k+TG], topGrid[k+TG+1], u), v);
}

// ======================================================================= reef materials (instanced)
const REEF_VERT = /* glsl */`
attribute vec3 aColor; attribute float aPatch; attribute float aRnd;
uniform float uTime; uniform float uPatchLife[14];
varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vLife; varying vec3 vL; varying float vRnd;
void main(){
  vL = position; vRnd = aRnd;
  mat4 mm = modelMatrix * instanceMatrix;
  vec3 p = position;
#ifdef KELP
  p.x *= 1.0 - p.y * 0.55;
  p.z += sin(p.y * 40.0 + aRnd * 20.0) * 0.2 * abs(p.x);
#endif
  vec4 wp = mm * vec4(p, 1.0);
#ifdef KELP
  float hgt = length(mm[1].xyz);
  float k = position.y * position.y * hgt * 0.12;
  wp.x += sin(uTime*0.8 + wp.y*0.2 + aRnd*6.28) * k;
  wp.z += cos(uTime*0.6 + wp.y*0.17 + aRnd*4.0) * k * 0.8;
#endif
#ifdef SWAY
  float k2 = position.y * position.y * SWAY;
  wp.x += sin(uTime*1.1 + aRnd*6.28 + wp.z*0.4) * k2;
  wp.z += cos(uTime*0.9 + aRnd*6.28 + wp.x*0.4) * k2 * 0.6;
#endif
#ifdef ANEMONE
  float k3 = max(position.y - 0.28, 0.0) * length(mm[0].xyz);
  wp.x += sin(uTime*1.7 + aRnd*6.28 + position.x*9.0) * k3 * 0.4;
  wp.z += cos(uTime*1.4 + aRnd*6.28 + position.z*9.0) * k3 * 0.4;
#endif
  vN = normalize(mat3(mm) * normal); vW = wp.xyz; vCol = aColor;
  float pl = uPatchLife[int(aPatch + 0.5)];
  vLife = smoothstep(0.0, 1.0, pl * 1.7 - aRnd * 0.7);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const REEF_FRAG = COMMON + /* glsl */`
varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vLife; varying vec3 vL; varying float vRnd;
void main(){
  vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
  vec3 vd = normalize(vW - cameraPosition);
  float d = length(vW - cameraPosition);
  vec3 alb; vec3 emit = vec3(0.0); float ao = 1.0; vec3 trans = vec3(0.0);
#ifdef FAN
  float fa = atan(vL.y, vL.x), fr = length(vL.xy);
  if(max(step(0.55, abs(sin(fa*24.0))), step(0.66, abs(sin(fr*18.0)))) < 0.5) discard;
#endif
#if defined(ROCK)
  float h = vnoise3(vL*2.6)*0.55 + vnoise3(vL*8.0)*0.3 + vnoise3(vL*22.0)*0.15;
  n = bump(n, vW, h * 0.6, exp(-d * 0.02));
  vec3 stone = vCol * (0.7 + 0.6*h);
  float top = smoothstep(0.15, 0.7, n.y + (h - 0.5)*0.7);
  vec3 algaeLive = mix(vec3(0.62, 0.34, 0.48), vec3(0.34, 0.50, 0.26), step(0.55, fract(vRnd*7.31)));
  vec3 algaeDead = vec3(0.28, 0.27, 0.18);
  alb = mix(stone, mix(algaeDead, algaeLive, vLife) * (0.75 + 0.5*h), top * 0.85);
  ao = 0.45 + 0.55*h;
#elif defined(KELP)
  vec3 dead = vec3(0.19, 0.16, 0.10);
  vec3 live = mix(vCol * 0.3, vCol, smoothstep(0.0, 0.9, vL.y)) * (0.7 + 0.45*vRnd);
  float vein = smoothstep(0.06, 0.0, abs(vL.x)) * 0.3;
  alb = mix(dead, live * (1.0 + vein), vLife);
  trans = mix(vec3(0.04, 0.035, 0.02), vCol * 1.6, vLife);
  ao = mix(0.45, 1.0, clamp(vL.y * 2.0, 0.0, 1.0));
#else
  float tip = smoothstep(0.35, 2.3, vL.y);
  ao = mix(0.35, 1.0, smoothstep(0.0, 0.9, vL.y));
  vec3 live = mix(vCol * 0.62, mix(vCol, vec3(1.0, 0.96, 0.86), 0.38), tip);
#if defined(BRAIN)
  float gv = abs(sin((vnoise3(vL*2.2)*2.0 + vnoise3(vL*4.6)*0.7) * 13.0));
  float gr = smoothstep(0.0, 0.4, gv);
  n = bump(n, vW, gr * 0.07, exp(-d * 0.03));
  live = vCol * (0.55 + 0.5*gr); ao *= 0.6 + 0.4*gr;
#endif
#if defined(BRANCH) || defined(TABLE)
  float pol = vnoise3(vL * 26.0);
  n = bump(n, vW, pol * 0.025, exp(-d * 0.05));
  live *= 0.82 + 0.36*pol;
#endif
#if defined(TUBE)
  if(!gl_FrontFacing){ live *= 0.35; ao *= 0.5; }
  live *= 0.85 + 0.3*vnoise3(vL * 14.0);
#endif
#if defined(ANEMONE)
  float at = smoothstep(0.5, 0.82, vL.y);
  live = mix(vec3(0.95, 0.86, 0.72), vCol, at);
  emit += vCol * at * 0.35 * vLife;
  ao = mix(0.5, 1.0, smoothstep(0.1, 0.5, vL.y));
#endif
#if defined(STAR)
  live = vCol * (0.75 + 0.5*vnoise3(vL * 30.0)); ao = 1.0;
#endif
#if defined(CLAM)
  float mt = smoothstep(0.02, 0.22, vL.y);
  vec3 mantle = vCol * (0.65 + 0.7*vnoise3(vL * 9.0)) + vec3(0.15, 0.35, 0.45) * smoothstep(0.62, 0.9, vnoise3(vL * 26.0));
  live = mix(vec3(0.78, 0.74, 0.62) * (0.8 + 0.3*sin(atan(vL.z, vL.x)*12.0)), mantle, mt);
  emit += mantle * mt * 0.3 * vLife; ao = 1.0;
#endif
#if defined(URCHIN)
  live = vec3(0.11, 0.04, 0.13) * (0.75 + 0.5*vnoise3(vL * 22.0)); ao = mix(0.6, 1.0, smoothstep(0.0, 0.5, vL.y));
#endif
  vec3 bleach = vec3(0.93, 0.91, 0.86);
  vec3 algaeDead = vec3(0.40, 0.39, 0.31);
  vec3 deadC = mix(bleach, algaeDead, step(0.64, vRnd));
  alb = mix(deadC, live, vLife);
#if defined(URCHIN)
  alb = live;
#endif
  float flush = vLife * (1.0 - vLife) * 4.0;
  emit += vCol * flush * 0.9 * uRise + vCol * vLife * 0.04;
  { float fz = step(0.5, fract(vRnd*3.7));                      // at night, fluorescent proteins: half the living colonies glow
    vec3 fl = mix(mix(vec3(0.25, 1.0, 0.45), vec3(0.2, 0.85, 1.0), step(0.4, fract(vRnd*7.1))), vec3(0.95, 0.35, 1.0), step(0.8, fract(vRnd*7.1)));
    emit += fl * fz * vLife * uNight * (0.22 + 0.1*sin(uTime*0.8 + vRnd*30.0)); }
  trans = vCol * vLife * 0.3;
#endif
  vec3 col = shade(alb, n, vW, ao);
  col += trans * sunAt(vW.y) * pow(max(dot(vd, uSunDir), 0.0), 5.0) * shadowAt(vW, n);
  col += emit;
  gl_FragColor = vec4(fogged(col, vW), 1.0);
}`;
const reefMat = (defines) => mat({ defines, side: THREE.DoubleSide, vertexShader: REEF_VERT, fragmentShader: REEF_FRAG });

const dummy = new THREE.Object3D();
function put(list, x, y, z, s, color, patch, o = {}){
  const tilt = o.tilt ?? 0.3;
  dummy.position.set(x, y + (o.dy || 0) * s * (o.sy || 1), z);
  dummy.rotation.set((rng()-.5)*tilt, rng()*6.283, (rng()-.5)*tilt);
  dummy.scale.set(s*(o.sx || 1), s*(o.sy || 1), s*(o.sz ?? o.sx ?? 1));
  dummy.updateMatrix();
  list.push({ m: dummy.matrix.clone(), c: color, patch, rnd: rng() });
}
function makeInstanced(geo, material, list, cast = true){
  const g = geo.clone(), n = list.length;
  const col = new Float32Array(n*3), pa = new Float32Array(n), rn = new Float32Array(n);
  const mesh = new THREE.InstancedMesh(g, material, n);
  list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); col.set([it.c.r, it.c.g, it.c.b], i*3); pa[i] = it.patch; rn[i] = it.rnd; });
  g.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
  g.setAttribute('aPatch', new THREE.InstancedBufferAttribute(pa, 1));
  g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rn, 1));
  mesh.frustumCulled = false; scene.add(mesh); if(cast) caster(mesh); return mesh;
}

// ---------------------------------------------------------------- reef geometry
function branchCoralGeo(){
  const parts = [], M = () => new THREE.Matrix4();
  (function grow(m, len, rad, depth){
    const g = new THREE.CylinderGeometry(rad*0.66, rad, len, 6, 2); g.translate(0, len/2, 0); g.applyMatrix4(m); parts.push(g);
    const cap = new THREE.SphereGeometry(rad*0.66, 6, 4); cap.translate(0, len, 0); cap.applyMatrix4(m); parts.push(cap);
    if(depth <= 0) return;
    const n = 2 + (rng() < 0.45 ? 1 : 0);
    for(let k=0;k<n;k++){
      const c = m.clone().multiply(M().makeTranslation(0, len*(0.6+0.4*rng()), 0))
        .multiply(M().makeRotationY(rng()*6.283)).multiply(M().makeRotationZ(0.28 + rng()*0.55));
      grow(c, len*0.74, rad*0.7, depth-1);
    }
  })(M(), 0.9, 0.17, 4);
  return mergeGeometries(parts.map(g => g.toNonIndexed()));
}
function brainGeo(){
  const g = new THREE.SphereGeometry(1, 28, 18), p = g.attributes.position;
  for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const d = 1 + 0.08*Math.sin(x*5)*Math.sin(y*5+1)*Math.sin(z*5+2);
    p.setXYZ(i, x*d, Math.max(y*d*0.72, -0.15), z*d); }
  g.computeVertexNormals(); return g;
}
function tableGeo(){
  const plate = (r, y, x, z) => { const g = new THREE.CylinderGeometry(r, r*0.75, 0.12, 22, 1); g.translate(x, y, z); return g; };
  return mergeGeometries([
    new THREE.CylinderGeometry(0.15, 0.28, 0.95, 7).translate(0, 0.47, 0),
    plate(1.5, 0.98, 0, 0), plate(0.95, 1.38, 0.45, 0.3), plate(0.6, 1.7, -0.3, -0.2),
    new THREE.CylinderGeometry(0.09, 0.13, 0.42, 6).translate(0.45, 1.16, 0.3),
    new THREE.CylinderGeometry(0.07, 0.1, 0.36, 6).translate(-0.3, 1.52, -0.2),
  ].map(g => g.toNonIndexed()));
}
function tubeGeo(){
  const parts = [];
  for(let i=0;i<5;i++){ const h = 0.9 + rng()*1.4;
    const g = new THREE.CylinderGeometry(0.22 + rng()*0.1, 0.13, h, 12, 3, true).translate(0, h/2, 0);
    g.rotateZ((rng()-.5)*0.6); g.rotateY(rng()*6.283); g.translate((rng()-.5)*0.5, 0, (rng()-.5)*0.5); parts.push(g.toNonIndexed()); }
  return mergeGeometries(parts);
}
function anemoneGeo(){
  const parts = [new THREE.CylinderGeometry(0.34, 0.4, 0.3, 14).translate(0, 0.15, 0).toNonIndexed()];
  for(let i=0;i<34;i++){
    const a = rng()*6.283, r = Math.sqrt(rng())*0.32, len = 0.45 + rng()*0.25;
    const g = new THREE.CylinderGeometry(0.018, 0.04, len, 5, 4).translate(0, len/2, 0);
    g.rotateZ(r*1.6); g.rotateY(a); g.translate(Math.cos(a)*r, 0.28, -Math.sin(a)*r);
    parts.push(g.toNonIndexed());
  }
  return mergeGeometries(parts);
}
function starGeo(){
  const s = new THREE.Shape();
  for(let i=0;i<10;i++){ const a = i/10*Math.PI*2, r = i%2 ? 0.28 : 1; const x = Math.cos(a)*r, y = Math.sin(a)*r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.1, bevelSegments: 2 });
  g.rotateX(-Math.PI/2); return g;
}
function clamGeo(){
  const g = new THREE.SphereGeometry(1, 28, 10), p = g.attributes.position;
  for(let i=0;i<p.count;i++){ let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x);
    y = Math.max(y, -0.15)*0.42 + Math.max(0, 0.15 - Math.abs(y))*Math.sin(a*12)*0.35; p.setXYZ(i, x, y, z*0.55); }
  g.computeVertexNormals(); return g;
}
function urchinGeo(){
  const parts = [new THREE.SphereGeometry(0.35, 12, 8).toNonIndexed()];
  for(let k=0;k<46;k++){ const u = rng()*2 - 1, a = rng()*Math.PI*2, d = new THREE.Vector3(Math.sqrt(1 - u*u)*Math.cos(a), Math.abs(u)*0.9 + 0.1, Math.sqrt(1 - u*u)*Math.sin(a)).normalize();
    const c = new THREE.ConeGeometry(0.03, 0.9, 4).translate(0, 0.62, 0); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)); parts.push(c.toNonIndexed()); }
  return mergeGeometries(parts);
}
const fanGeo = new THREE.CircleGeometry(1.6, 18, Math.PI*0.12, Math.PI*0.76);
const kelpGeo = new THREE.PlaneGeometry(0.6, 1, 2, 20).translate(0, 0.5, 0);
function rockGeometry(seg, amp){
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg*0.7)), p = g.attributes.position;
  for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const d = 1 - amp*0.5 + amp*(vnoise(x*1.6+5, z*1.6+y*1.3+5)*0.7 + vnoise(x*4+9, z*4-y*3)*0.3); p.setXYZ(i, x*d, y*d*0.7, z*d); }
  g.computeVertexNormals(); return g;
}

const PAL = ['#ff5a74','#ff8f4a','#ffcc45','#b46bff','#3fe0c8','#ff79b9','#6aa2ff','#f25c3a','#a4f06a','#ff9fd0']
  .map(h => new THREE.Color(h));
const pick = () => PAL[Math.floor(rng()*PAL.length)];
const ANEMONE_SPOTS = [];
{
  const branch = [[], [], []], brain = [], table = [], tube = [], fan = [], rock = [], bommie = [], kelp = [], anem = [], star = [], clam = [], urchin = [];
  const stoneCol = () => { const v = 0.22 + rng()*0.1; return new THREE.Color(v*1.02, v, v*0.92); };
  const REEFS = PATCHES.map((P, i) => ({ P, i, small: false })).concat(EXTRA.map(E => ({ P: E, i: E.id, small: true })));
  REEFS.forEach(({ P, i, small }) => {
    P.bommies.forEach(b => put(bommie, b.x, b.y, b.z, 1, stoneCol(), i, { tilt: 0, sx: b.rx, sy: b.ry, sz: b.rx }));
    const spot = (onRock) => {
      if(onRock){ const b = P.bommies[(rng()*P.bommies.length)|0]; const a = rng()*6.283, r = Math.sqrt(rng())*0.9;
        const x = b.x + Math.cos(a)*r*b.rx, z = b.z + Math.sin(a)*r*b.rx; return [x, bommieY(b, x, z), z]; }
      const x = P.x + gauss()*P.R, z = P.z + gauss()*P.R; return [x, reefTopRaw(x, z), z];
    };
    const at = (n, pr, f) => { n = Math.round(n*(small ? 0.6 : 1)); for(let k=0;k<n;k++){ const [x, y, z] = spot(rng() < pr); f(x, y, z, k); } };
    at(36, 0.7, (x,y,z,k) => put(branch[k%3], x, y, z, 0.9 + rng()*1.5, pick(), i, { dy: -0.06 }));
    at(14, 0.6, (x,y,z) => put(brain, x, y, z, 0.6 + rng()*1.3, pick(), i, { tilt: 0.2, dy: -0.05 }));
    at(10, 0.75, (x,y,z) => put(table, x, y, z, 0.8 + rng()*1.3, pick(), i, { tilt: 0.25 }));
    at(12, 0.5, (x,y,z) => put(tube, x, y, z, 0.8 + rng()*1.2, pick(), i, { dy: -0.05 }));
    at(10, 0.6, (x,y,z) => put(fan, x, y, z, 0.9 + rng()*1.5, pick(), i, { tilt: 0.2, dy: -0.06 }));
    at(14, 0.3, (x,y,z) => put(rock, x, y, z, 0.5 + rng()*1.6, stoneCol(), i, { tilt: 1, dy: -0.25 }));
    at(4, 0.8, (x,y,z) => { const c = [new THREE.Color('#d14bff'), new THREE.Color('#ff4f9a'), new THREE.Color('#7dff7a')][(rng()*3)|0];
      const s = 1.1 + rng()*0.7; put(anem, x, y, z, s, c, i, { tilt: 0.2, dy: -0.05 }); ANEMONE_SPOTS.push({ x, y: y + s*0.8, z }); });
    at(5, 0, (x,y,z) => put(star, x, y, z, 0.25 + rng()*0.2, [new THREE.Color('#ff6a2a'), new THREE.Color('#3d6bff'), new THREE.Color('#e8342e')][(rng()*3)|0], i, { tilt: 0.1, dy: 0.0 }));
    at(5, 0.85, (x,y,z) => put(clam, x, y, z, 0.35 + rng()*0.35, [new THREE.Color('#2fd0ff'), new THREE.Color('#7a5cff'), new THREE.Color('#22e0b0'), new THREE.Color('#3d7bff')][(rng()*4)|0], i, { tilt: 0.3, dy: 0.05 }));
    at(7, 0.5, (x,y,z) => put(urchin, x, y, z, 0.5 + rng()*0.4, new THREE.Color(0.1, 0.04, 0.12), 13, { tilt: 0.4, dy: 0.15 }));
    const kx = P.x + gauss()*P.R*1.1, kz = P.z + gauss()*P.R*1.1;
    if(!small || rng() < 0.35) for(let k=0;k<(small ? 16 : 30);k++){ const x = kx + gauss()*3.8, z = kz + gauss()*3.8;
      put(kelp, x, heightAt(x, z), z, 1, new THREE.Color(0.46, 0.38, 0.1), i, { tilt: 0.1, sy: 8 + rng()*12, dy: -0.02 }); }
  });
  // seagrass meadows + scattered stones, governed by the global vitality slot (13)
  let placed = 0;
  for(let tries=0; placed < 3600 && tries < 30000; tries++){
    const a = rng()*6.283, r = Math.sqrt(rng())*175, x = Math.cos(a)*r, z = Math.sin(a)*r;
    if(fbm(x*0.03+3, z*0.03-7) < 0.5 || heightAt(x, z) > SURFACE - 4) continue;
    placed++;
    put(kelp, x, heightAt(x, z), z, 1, new THREE.Color(0.2, 0.42, 0.15), 13, { tilt: 0.3, sy: 0.6 + rng()*1.6, sx: 0.32, dy: -0.05 });
  }
  for(let k=0, n=0; n < 2200 && k < 9000; k++){ const x = -125 + rng()*250, z = -146 + rng()*34 + 0.0006*x*x*0.6;
    if(heightAt(x, z) > SURFACE - 3.5 || fbm(x*0.05 + 9, z*0.05) < 0.42) continue; n++;
    put(kelp, x, heightAt(x, z), z, 1, new THREE.Color(0.24, 0.5, 0.17), 13, { tilt: 0.35, sy: 0.7 + rng()*1.4, sx: 0.3, dy: -0.05 }); }
  for(let k=0;k<420;k++){ const a = rng()*6.283, r = Math.sqrt(rng())*190, x = Math.cos(a)*r, z = Math.sin(a)*r; if(heightAt(x, z) > SURFACE - 2) continue;
    put(rock, x, heightAt(x, z), z, k < 60 ? 1 + rng()*3 : 0.12 + rng()*0.3, stoneCol(), 13, { tilt: 1, dy: -0.25 }); }
  for(let k=0;k<70;k++){ const a = rng()*6.283, r = Math.sqrt(rng())*150, x = Math.cos(a)*r, z = Math.sin(a)*r; if(heightAt(x, z) > SURFACE - 2) continue;
    put(star, x, heightAt(x, z), z, 0.22 + rng()*0.2, [new THREE.Color('#ff6a2a'), new THREE.Color('#3d6bff'), new THREE.Color('#e8342e')][k%3], 13, { tilt: 0.1 }); }

  branch.forEach(l => makeInstanced(branchCoralGeo(), reefMat({ BRANCH: 1 }), l));
  makeInstanced(brainGeo(), reefMat({ BRAIN: 1 }), brain);
  makeInstanced(tableGeo(), reefMat({ TABLE: 1 }), table);
  makeInstanced(tubeGeo(), reefMat({ TUBE: 1 }), tube);
  makeInstanced(fanGeo, reefMat({ FAN: 1, SWAY: '0.035' }), fan);
  makeInstanced(anemoneGeo(), reefMat({ ANEMONE: 1 }), anem);
  makeInstanced(starGeo(), reefMat({ STAR: 1 }), star, false);
  makeInstanced(clamGeo(), reefMat({ CLAM: 1 }), clam);
  makeInstanced(urchinGeo(), reefMat({ URCHIN: 1 }), urchin);
  makeInstanced(rockGeometry(14, 0.5), reefMat({ ROCK: 1 }), rock);
  makeInstanced(rockGeometry(30, 0.22), reefMat({ ROCK: 1 }), bommie);
  makeInstanced(kelpGeo, reefMat({ KELP: 1 }), kelp);
}

// ======================================================================= marine snow (with near-camera bokeh)
{
  const N = LOW ? 2000 : 4000, pos = new Float32Array(N*3), sz = new Float32Array(N);
  for(let i=0;i<N;i++){ pos.set([rng()*80, rng()*80, rng()*80], i*3); sz[i] = 0.4 + rng()*rng()*2.6; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const pts = new THREE.Points(g, mat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
    attribute float aSize; uniform float uTime; varying float vA; varying float vBokeh; varying float vY; varying float vG;
    void main(){
      vec3 p = position + vec3(sin(uTime*0.15 + position.y)*1.5, -uTime*0.22*aSize, cos(uTime*0.12 + position.x)*1.5);
      p = mod(p - cameraPosition + 40.0, 80.0) - 40.0 + cameraPosition;
      vec4 mv = viewMatrix * vec4(p, 1.0);
      float d = -mv.z;
      vBokeh = smoothstep(3.5, 0.8, d);
      vA = smoothstep(40.0, 22.0, d) * smoothstep(0.3, 1.2, d) * (0.6 + 0.4*sin(uTime*2.0 + position.z*9.0));
      vY = p.y;
      float hsh = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719)))*43758.5453);
      vG = step(0.6, hsh) * uNight * (0.35 + 0.65*pow(0.5 + 0.5*sin(uTime*(1.5 + hsh*3.0) + hsh*60.0), 3.0)) * (1.0 + 1.5*smoothstep(10.0, 2.0, d));
      gl_PointSize = aSize * (80.0 + vBokeh * 220.0) / max(d, 0.5);
      gl_Position = projectionMatrix * mv;
    }`,
    fragmentShader: COMMON + /* glsl */`
    varying float vA; varying float vBokeh; varying float vY; varying float vG;
    void main(){
      float r = length(gl_PointCoord - 0.5);
      float core = smoothstep(0.5, 0.05, r);
      float disc = smoothstep(0.5, 0.42, r) * (0.35 + 0.65*smoothstep(0.2, 0.46, r));
      float a = mix(core, disc * 0.35, vBokeh) * vA;
      vec3 c = sunAt(vY) * mix(vec3(0.18, 0.18, 0.1), vec3(0.16, 0.24, 0.28), uHealth) + vec3(0.25, 1.0, 0.8) * vG * 2.6;
      gl_FragColor = vec4(c * a, 1.0);
    }`,
  }));
  pts.frustumCulled = false; scene.add(pts); window.snowPts = pts;
}

// ======================================================================= currents: faint ribbons meandering along the coast
{
  const N = LOW ? 400 : 900, g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1, 8, 1)), a = new Float32Array(N*4);
  for(let i=0;i<N;i++){ const near = rng() < 0.65; a.set([rng()*280, near ? 8 + rng()*24 : 6 + rng()*30, near ? -140 + rng()*110 : -40 + rng()*160, rng()], i*4); }
  g.setAttribute('aS', new THREE.InstancedBufferAttribute(a, 4)); g.instanceCount = N;
  const m = new THREE.Mesh(g, mat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
    attribute vec4 aS; uniform float uTime; varying vec2 vUv; varying vec3 vW; varying float vA;
    vec3 flowPos(float x, float sd){ return vec3(x, aS.y + sin(x*0.04 + sd*9.0)*1.6, aS.z + 0.0006*x*x*0.5 + sin(x*0.024 + sd*6.28)*7.0 + sin(x*0.07 + sd*3.0)*2.0); }
    void main(){
      float sd = aS.w, sp = 2.2 + sd*2.4, L = 10.0 + sd*10.0;
      float x0 = -140.0 + mod(aS.x + uTime*sp, 280.0);
      float x = x0 + position.x*L;
      vec3 c = flowPos(x, sd), c2 = flowPos(x + 0.5, sd);
      vec3 tang = normalize(c2 - c);
      vec3 side = normalize(cross(tang, normalize(cameraPosition - c)));
      vec3 p = c + side*position.y*(0.35 + sd*0.5)*max(1.0, distance(c, cameraPosition)/90.0);
      vUv = uv; vW = p;
      float dc = distance(p, cameraPosition);
      vA = smoothstep(-140.0, -110.0, x0) * smoothstep(140.0, 110.0, x0) * smoothstep(4.0, 14.0, dc) * (0.5 + 0.5*sd);
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    }`,
    fragmentShader: COMMON + /* glsl */`
    varying vec2 vUv; varying vec3 vW; varying float vA;
    void main(){
      clipPortal(vW);
      float across = 1.0 - abs(vUv.y*2.0 - 1.0);
      float along = sin(vUv.x*3.14159);
      float a = across*across*along*vA*0.15*mix(0.5, 1.0, uHealth);
      gl_FragColor = vec4(mix(vec3(0.7, 0.9, 1.0), sunAt(vW.y)*0.35, 0.5) * a * transmit(waterPath(vW)), 1.0);
    }`,
  }));
  m.frustumCulled = false; m.renderOrder = 4; scene.add(m);
}

// ======================================================================= jellyfish
{
  const parts = [new THREE.SphereGeometry(1, 24, 10, 0, Math.PI*2, 0, Math.PI/2)];
  for(let i=0;i<9;i++){ const a = i/9*6.283; const r = new THREE.PlaneGeometry(0.08, 3.4, 1, 14).translate(0, -1.7, 0);
    r.rotateY(a); r.translate(Math.cos(a)*0.62, 0, Math.sin(a)*0.62); parts.push(r); }
  for(let i=0;i<4;i++){ const a = i/4*6.283 + 0.4; const r = new THREE.PlaneGeometry(0.3, 2.0, 1, 10).translate(0, -1.0, 0);
    r.rotateY(a); r.translate(Math.cos(a)*0.15, 0, Math.sin(a)*0.15); parts.push(r); }
  const list = [], cols = ['#ff8ad9', '#8ad7ff', '#c2a6ff', '#9dffe0'].map(h => new THREE.Color(h));
  for(let i=0;i<34;i++){ const a = rng()*6.283, r = 20 + rng()*100, x = Math.cos(a)*r, z = Math.sin(a)*r, s = 0.6 + rng()*1.1;
    if(Math.hypot(x - 8, z - 60) < 22) continue;
    if(heightAt(x, z) > SURFACE - 16) continue;
    dummy.position.set(x, Math.min(heightAt(x, z) + 10 + rng()*18, SURFACE - 5), z); dummy.rotation.set((rng()-.5)*.4, rng()*6, (rng()-.5)*.4);
    dummy.scale.setScalar(s); dummy.updateMatrix(); list.push({ m: dummy.matrix.clone(), c: cols[i%4], patch: 13, rnd: rng() }); }
  makeInstanced(mergeGeometries(parts), mat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
    attribute vec3 aColor; attribute float aRnd; uniform float uTime;
    varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying vec3 vL;
    void main(){
      vec3 p = position; float ph = aRnd*6.28; float pulse = sin(uTime*1.7 + ph);
      vL = position;
      if(p.y >= 0.0){ p.xz *= 1.0 + 0.2*pulse*(1.0 - p.y); p.y *= 1.0 - 0.12*pulse; }
      else { p.x += sin(uTime*1.6 + p.y*2.2 + ph)*0.16*(-p.y); p.z += cos(uTime*1.3 + p.y*1.9 + ph)*0.16*(-p.y); p.xz *= 1.0 + 0.2*pulse; }
      p.y += sin(uTime*0.4 + ph)*1.5;
      mat4 mm = modelMatrix * instanceMatrix; vec4 wp = mm * vec4(p, 1.0);
      vN = normalize(mat3(mm) * normal); vW = wp.xyz; vCol = aColor;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
    fragmentShader: COMMON + /* glsl */`
    varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying vec3 vL;
    void main(){
      vec3 vd = cameraPosition - vW; float d = length(vd); vd /= d;
      float fr = 1.0 - abs(dot(normalize(vN), vd));
      float a;
      if(vL.y >= -0.01){
        float rad = 0.5 + 0.5*sin(atan(vL.z, vL.x) * 16.0);
        float gon = smoothstep(0.32, 0.12, abs(length(vL.xz) - 0.42)) * smoothstep(0.2, 0.6, vL.y);
        a = 0.03 + pow(fr, 2.4)*0.75 + rad*0.04 + gon*0.35;
      } else a = 0.3 * (1.0 + vL.y/3.4);
      vec3 lit = sunAt(vW.y) * 0.25 + 0.15;
      clipPortal(vW);
      vec3 glow = mix(vCol, vec3(0.45, 0.9, 1.0), 0.5) * uNight * (0.55 + 0.45*sin(uTime*1.7 + vW.x*0.3)) * 0.9;   // bioluminescent at night
      gl_FragColor = vec4((vCol * lit + glow) * a * transmit(waterPath(vW)) * mix(0.6, 1.0, uHealth), 1.0);
    }`,
  }), list, false);
}
