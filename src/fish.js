'use strict';
// ======================================================================= fish (boids, CPU spatial hash)
const SCHOOLS = [];
function addSchool(o){ SCHOOLS.push({ x: 0, y0: 15, z: 0, ph: rng()*6.283, f: 0.05 + rng()*0.05, swirl: rng() < .5 ? 1 : -1, ...o }); return SCHOOLS.length - 1; }
function makePool(n, sep2, nb2){ return { n, p: new Float32Array(n*3), v: new Float32Array(n*3), seed: new Float32Array(n*4), sc: new Uint8Array(n), active: 0, sep2, nb2 }; }

const sEscort = addSchool({ kind: 'escort', species: 1, size: 0.8 });
const roamSpecies = [0, 2, 3, 4, 5, 6, 1, 2, 4, 0, 3, 6, 5];
const roamIds = roamSpecies.map((sp, k) => { const P = PATCHES[(k*5 + 2) % 13];
  return addSchool({ kind: 'roam', species: sp, size: sp === 3 ? 1.5 : 0.85 + rng()*0.3, cx: P.x, cz: P.z, r: 12 + rng()*18, y: 7 + rng()*14 }); });
const clownIds = ANEMONE_SPOTS.slice(0, 10).map(a => addSchool({ kind: 'home', species: 8, size: 0.5, hx: a.x, hy: a.y, hz: a.z }));
// clouds of little damselfish hovering over the bommies, and schools roaming the near reefs
const damselIds = EXTRA.filter((E, k) => k % 2 === 0).map(E => { const b = E.bommies[0]; return addSchool({ kind: 'home', species: 1, size: 0.42, hx: b.x, hy: b.y + b.ry*0.75 + 1.4, hz: b.z }); });
const nearIds = [0, 2, 4, 5, 6, 1].map((sp, k) => { const E = EXTRA[(k*4 + 1) % EXTRA.length];
  return addSchool({ kind: 'roam', species: sp, size: 0.8 + rng()*0.3, cx: E.x, cz: E.z, r: 8 + rng()*10, y: 4 + rng()*6 }); });
// tangs and bannerfish on the reefs, barracuda hanging by the pinnacles, snappers schooling round them, parrotfish grazing the rock
const tangIds = [addSchool({ kind: 'roam', species: 9, size: 0.75, cx: PATCHES[4].x, cz: PATCHES[4].z, r: 12, y: 8 }), addSchool({ kind: 'roam', species: 9, size: 0.75, cx: EXTRA[3].x, cz: EXTRA[3].z, r: 9, y: 5 })];
const bannerId = addSchool({ kind: 'roam', species: 10, size: 0.8, cx: PATCHES[7].x, cz: PATCHES[7].z, r: 6, y: 7 });
const barraIds = [addSchool({ kind: 'hover', species: 11, size: 1.25, cx: PINNACLES[1].x + 6, cz: PINNACLES[1].z, r: 5, y: PINNACLES[1].y + 6 }),
  addSchool({ kind: 'hover', species: 11, size: 1.25, cx: PINNACLES[3].x - 6, cz: PINNACLES[3].z, r: 6, y: PINNACLES[3].y + 6 })];
const snapIds = [addSchool({ kind: 'roam', species: 13, size: 0.7, cx: PINNACLES[0].x, cz: PINNACLES[0].z, r: 7, y: PINNACLES[0].y - 3 }), addSchool({ kind: 'roam', species: 13, size: 0.7, cx: PINNACLES[2].x, cz: PINNACLES[2].z, r: 6, y: PINNACLES[2].y - 2 })];
const sGraze = addSchool({ kind: 'graze', species: 12, size: 1.5, cx: PATCHES[2].x, cz: PATCHES[2].z, r: 16 }), grazeIds = [sGraze, addSchool({ kind: 'graze', species: 12, size: 1.5, cx: EXTRA[8].x, cz: EXTRA[8].z, r: 20 })];
// one jack school hunts: every so often it charges the sardines
const sHunt = roamIds[3]; Object.assign(SCHOOLS[sHunt], { kind: 'hunt', attack: 0, cx: 30, cz: -58, r: 12, y: 15, hp: 0 });
const tunaIds = [addSchool({ kind: 'roam', species: 14, size: 1.5, cx: 15, cz: 150, r: 36, y: 20 }), addSchool({ kind: 'roam', species: 14, size: 1.3, cx: -45, cz: 128, r: 28, y: 26 }),
  addSchool({ kind: 'roam', species: 3, size: 1.4, cx: -5, cz: 100, r: 30, y: 18 }),
  addSchool({ kind: 'hover', species: 11, size: 1.25, cx: PINNACLES[5].x + 7, cz: PINNACLES[5].z, r: 5, y: PINNACLES[5].y + 4 }),
  addSchool({ kind: 'roam', species: 13, size: 0.7, cx: PINNACLES[6].x, cz: PINNACLES[6].z, r: 7, y: PINNACLES[6].y - 2 })];
const sBait = addSchool({ kind: 'bait', species: 7, size: 0.34, ring: 5.5, swirl: 1, ox: 0, oz: 0, bx: 0, bz: 0, frozen: false });
const sFollow = addSchool({ kind: 'follow', species: 0, size: 0.5, r: 2.2 });

const NR = LOW ? 1500 : 2800, NB = LOW ? 900 : 1800;
const reg = makePool(NR, 1.7, 16), bait = makePool(NB, 0.22, 4);
{
  const bag = [];
  const push = (id, n) => { for(let k=0;k<n;k++) bag.push(id); };
  push(sEscort, Math.round(NR*0.022));
  push(sFollow, 34);
  clownIds.forEach(id => push(id, 9));
  tangIds.forEach(id => push(id, 42)); push(bannerId, 14); barraIds.forEach(id => push(id, 20)); snapIds.forEach(id => push(id, 105)); tunaIds.forEach(id => push(id, 85)); grazeIds.forEach(id => push(id, 9));
  damselIds.forEach(id => push(id, 16));
  const rest = NR - bag.length, roamAll = roamIds.concat(nearIds);
  roamAll.forEach((id, k) => push(id, Math.floor(rest/roamAll.length) + (k < rest % roamAll.length ? 1 : 0)));
  for(let i=bag.length-1;i>0;i--){ const j = (rng()*(i+1))|0; [bag[i], bag[j]] = [bag[j], bag[i]]; }
  bag.forEach((id, i) => reg.sc[i] = id);
  bait.sc.fill(sBait);
}
const fishVert = /* glsl */`
attribute vec3 aPos; attribute vec3 aDir; attribute vec4 aSeed; attribute float aFin; varying float vFin;
uniform float uTime;
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vSp; varying float vRnd;
void main(){
  float s = aSeed.z; vec3 k3 = vec3(1.0);
  if(s > 8.5 && s < 9.5) k3 = vec3(0.85, 1.3, 0.8);          // blue tang: deep oval
  else if(s > 9.5 && s < 10.5) k3 = vec3(0.72, 1.85, 0.66);  // bannerfish: tall disc
  else if(s > 10.5 && s < 11.5) k3 = vec3(0.75, 0.4, 1.8);   // barracuda: long and slim
  else if(s > 11.5 && s < 12.5) k3 = vec3(1.15, 1.18, 1.0);  // humphead parrotfish: bulky
  else if(s > 13.5) k3 = vec3(0.95, 0.92, 1.35);                // tuna: a torpedo
  vec3 p = position * k3 * aSeed.y; vL = position; vSp = aSeed.z; vRnd = aSeed.w; vFin = aFin;
  float sp = length(aDir);
  float wig = sin(aSeed.x + position.z * 2.8) * (0.035 + 0.26 * smoothstep(0.3, -1.6, position.z));
  p.x += wig * aSeed.y;
  vec3 f = aDir / max(sp, 0.001);
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f)); vec3 u = cross(f, r);
  vec3 wp = aPos + r*p.x + u*p.y + f*p.z;
  vec3 nn = normalize(normal / k3); vN = r*nn.x + u*nn.y + f*nn.z; vW = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const fishFrag = COMMON + /* glsl */`
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vSp; varying float vRnd; varying float vFin;
void main(){
  vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
  vec3 vd = normalize(cameraPosition - vW);
  float s = vSp; vec3 c; float silver = 0.0;
  if(s < 0.5) c = vec3(0.95, 0.72, 0.12);
  else if(s < 1.5) c = vec3(0.1, 0.42, 1.0);
  else if(s < 2.5) c = vec3(1.0, 0.42, 0.24);
  else if(s < 3.5){ c = vec3(0.62, 0.7, 0.78); silver = 0.75; }
  else if(s < 4.5) c = vec3(0.95, 0.32, 0.68);
  else if(s < 5.5) c = vec3(0.12, 0.78, 0.62);
  else if(s < 6.5) c = vec3(1.0, 0.88, 0.3);
  else if(s < 7.5){ c = vec3(0.6, 0.68, 0.76); silver = 1.0; }
  else if(s < 8.5) c = vec3(1.0, 0.4, 0.04);
  else if(s < 9.5) c = vec3(0.1, 0.28, 0.95);
  else if(s < 10.5) c = vec3(0.97, 0.96, 0.9);
  else if(s < 11.5){ c = vec3(0.66, 0.72, 0.78); silver = 0.9; }
  else if(s < 12.5) c = vec3(0.16, 0.66, 0.58);
  else if(s < 13.5) c = vec3(1.0, 0.82, 0.16);
  else { c = vec3(0.6, 0.66, 0.72); silver = 0.85; }
  c *= 0.85 + 0.3*vRnd;
  float back = smoothstep(0.02, 0.3, vL.y);
  if(silver > 0.0) c = mix(c, vec3(0.1, 0.22, 0.36), back * 0.9);
  if(s > 5.5 && s < 6.5) c *= 1.0 - 0.85*smoothstep(0.06, 0.02, abs(abs(vL.z - 0.1) - 0.32));
  if(s > 8.5 && s < 9.5){ float sw = smoothstep(0.07, 0.03, abs(vL.y - 0.1 - 0.12*sin(vL.z*2.6 + 0.6))) * step(-0.7, vL.z) * step(vL.z, 0.62);
    c = mix(c, vec3(0.02, 0.03, 0.08), sw); c = mix(c, vec3(1.0, 0.84, 0.1), step(vL.z, -0.88)); }
  if(s > 9.5 && s < 10.5){ float b = clamp(smoothstep(0.1, 0.06, abs(vL.z - 0.42)) + smoothstep(0.13, 0.09, abs(vL.z + 0.18)), 0.0, 1.0);
    c = mix(c, vec3(0.03), b); c = mix(c, vec3(1.0, 0.85, 0.12), step(vL.z, -0.42) * smoothstep(-0.12, 0.08, vL.y)); }
  if(s > 10.5 && s < 11.5) c *= 1.0 - 0.6 * step(0.64, fract(vL.z*4.5 + abs(vL.y)*2.5)) * smoothstep(0.0, 0.16, vL.y);
  if(s > 11.5 && s < 12.5){ c = mix(c, vec3(0.95, 0.5, 0.66), smoothstep(0.36, 0.48, abs(fract(vL.z*8.0 + vL.y*3.0) - 0.5)) * 0.5);
    c = mix(c, vec3(0.88, 0.94, 0.86), smoothstep(0.82, 0.93, vL.z)); }
  if(s > 13.5) c = mix(c, vec3(1.0, 0.85, 0.2), step(vL.z, -0.55)*step(abs(vL.y), 0.12)*0.8);
  if(s > 12.5 && s < 13.5) c = mix(c, vec3(0.35, 0.78, 1.0), (1.0 - smoothstep(0.03, 0.06, abs(fract(vL.y*6.0 + 0.5) - 0.5))) * step(-0.12, vL.y));
  if(s > 7.5 && s < 8.5){ float band = max(smoothstep(0.07, 0.03, abs(abs(vL.z - 0.1) - 0.42)), smoothstep(0.06, 0.02, abs(vL.z - 0.1)));
    c = mix(c, vec3(1.0), band); c = mix(c, vec3(0.02), smoothstep(0.02, 0.0, abs(abs(abs(vL.z - 0.1) - 0.42) - 0.065)) * 0.8); }
  if(s > 1.5 && s < 2.5) c = mix(c, vec3(1.0, 0.85, 0.35), smoothstep(0.08, 0.0, abs(vL.y + 0.02 - vL.z*0.2)) * 0.6);
  if(s > 0.5 && s < 1.5) c = mix(c, vec3(0.3, 0.9, 1.0), smoothstep(0.1, 0.3, vL.y) * 0.5);
  // fins: lighter and thinner-looking than the body, with fine rays; the body gets a gill line behind the eye
  if(vFin > 0.5){ float ray = 0.8 + 0.2*sin(atan(vL.y, vL.z + 0.85)*46.0); c = mix(c, c*1.2 + 0.06, 0.45) * ray; silver *= 0.4; }
  else c *= 1.0 - 0.3*smoothstep(0.035, 0.0, abs(vL.z - 0.5 + 0.35*vL.y*vL.y)) * step(abs(vL.y), 0.3);
  vec3 alb = mix(c, vec3(0.96), smoothstep(0.0, -0.3, vL.y) * 0.55 * (1.0 - vFin));
  float eye = smoothstep(0.075, 0.055, length(vec2(vL.z - 0.66, vL.y - 0.07)));
  alb = mix(alb, vec3(0.02), eye);
  alb *= 1.0 - silver * 0.55;
  vec3 col = shade(alb, n, vW, 1.0);
  float fres = pow(1.0 - max(dot(n, vd), 0.0), 3.0);
  vec3 R = reflect(-vd, n);
  vec3 L = sunAt(vW.y);
  vec3 env = mediumLight(R, vW.y) * 2.5 + L * (smoothstep(0.25, 0.95, R.y) * 0.55 + pow(max(dot(R, uSunDir), 0.0), 28.0) * 3.0);
  col += env * mix(0.03 + 0.25 * fres, 0.62, silver);
  col += eye * L * pow(max(dot(R, uSunDir), 0.0), 80.0) * 3.0;
  gl_FragColor = vec4(fogged(col, vW), 1.0);
}`;
const fishBase = window.reefFishGeometry;
function fishDrawGeometry(capacity){
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(fishBase.index);
  g.setAttribute('position', fishBase.attributes.position);
  g.setAttribute('normal', fishBase.attributes.normal);
  g.setAttribute('aFin', fishBase.attributes._fin);
  const data = new THREE.InstancedInterleavedBuffer(new Float32Array(capacity*10), 10).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aPos', new THREE.InterleavedBufferAttribute(data, 3, 0));
  g.setAttribute('aDir', new THREE.InterleavedBufferAttribute(data, 3, 3));
  g.setAttribute('aSeed', new THREE.InterleavedBufferAttribute(data, 4, 6));
  g.instanceCount = 0;
  return g;
}
const fishPools = [reg, bait];
fishPools.forEach(pool => {
  for(let i=0;i<pool.n;i++){ const S = SCHOOLS[pool.sc[i]];
    pool.seed.set([rng()*6.283, S.size * (0.82 + rng()*0.36), S.species, rng()], i*4);
    pool.v.set([rng()-.5, 0, rng()-.5], i*3); }
  pool.colorGeometry = fishDrawGeometry(pool.n); pool.shadowGeometry = fishDrawGeometry(pool.n);
  const m = new THREE.Mesh(pool.colorGeometry, mat({ side: THREE.DoubleSide, vertexShader: fishVert, fragmentShader: fishFrag }));
  m.frustumCulled = false; pool.mesh = m; scene.add(m); caster(m);
  // The bay camera can look through an entire school. Test its opaque silhouettes before shading the fish.
  const depth = new THREE.Mesh(pool.colorGeometry, depthMaterials.get(m.material));
  depth.frustumCulled = false; depth.layers.set(BAY_DEPTH_LAYER); depth.renderOrder = -18;
  pool.depthMesh = depth; scene.add(depth);
});

// The two passes see different fish. Keep the simulation in its original order and compact only the draw buffers.
const fishFrustum = new THREE.Frustum(), fishProjection = new THREE.Matrix4(), fishBounds = new THREE.Sphere();
fishBase.computeBoundingSphere();
// Sphere about the fish origin, expanded for the largest species stretch and the animated tail in fishVert.
const fishRadius = (fishBase.boundingSphere.center.length() + fishBase.boundingSphere.radius)*1.85 + 0.30;
function prepareFishDraws(cam, shadow){
  fishFrustum.setFromProjectionMatrix(fishProjection.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  for(const pool of fishPools){
    if(!shadow) pool.depthMesh.visible = pool.mesh.visible;
    if(!pool.mesh.visible) continue;
    const g = shadow ? pool.shadowGeometry : pool.colorGeometry;
    const data = g.attributes.aPos.data, out = data.array;
    let used = 0;
    for(let i=0;i<pool.active;i++){
      const p = i*3, s = i*4;
      fishBounds.center.fromArray(pool.p, p); fishBounds.radius = fishRadius*pool.seed[s+1];
      if(!fishFrustum.intersectsSphere(fishBounds)) continue;
      for(let k=0;k<3;k++){ out[used+k] = pool.p[p+k]; out[used+3+k] = pool.v[p+k]; }
      for(let k=0;k<4;k++) out[used+6+k] = pool.seed[s+k];
      used += 10;
    }
    g.instanceCount = used/10; pool.mesh.geometry = g;
    if(used){ data.clearUpdateRanges(); data.addUpdateRange(0, used); data.needsUpdate = true; }
  }
}
const CS = 4, GX = 96, GY = 12, GZ = 128, GO = -192, NCELL = GX*GY*GZ;
const maxFish = Math.max(NR, NB), cellSlot = new Int32Array(NCELL);
const cellCode = new Int32Array(maxFish+1), cellHead = new Int32Array(maxFish+1);
const nextFish = new Int32Array(maxFish), fishCell = new Int32Array(maxFish);
const neighbourStart = new Int32Array(maxFish+2), neighbourHeads = new Int32Array(maxFish*27);
function spawnFish(pool, i, far){
  const S = SCHOOLS[pool.sc[i]];
  let x, y, z;
  if(far){ const a = rng()*6.283, r = 90 + rng()*30; x = player.pos.x + Math.cos(a)*r; z = player.pos.z + Math.sin(a)*r; y = 10 + rng()*22; }
  else { x = S.x + gauss()*4; y = S.y0 + gauss()*2; z = S.z + gauss()*4; }
  pool.p.set([x, Math.max(y, heightAt(x, z) + 2), z], i*3);
}
function updateSchools(t){
  for(const S of SCHOOLS){
    if(S.ctrl){ S.x = player.pos.x; S.y0 = player.pos.y; S.z = player.pos.z; S.vx = player.fwd.x*player.speed; S.vy = player.fwd.y*player.speed; S.vz = player.fwd.z*player.speed; continue; }
    if(S.kind === 'escort'){ const sd = Math.sin(t*0.13)*7; S.x = player.pos.x + player.fwd.x*4 + player.fwd.z*sd; S.y0 = player.pos.y - 3.5; S.z = player.pos.z + player.fwd.z*4 - player.fwd.x*sd; }
    else if(S.kind === 'hunt'){ const B = SCHOOLS[sBait], ph = (t + S.ph*9) % 50; S.hp = ph;
      S.attack = ph < 16 && !B.ctrl && !S.ctrl && state !== 'trawl' && state !== 'diveTrawl' ? 1 : 0;
      if(S.attack){ const a = t*0.9; S.x = B.x + Math.cos(a)*3.5; S.z = B.z + Math.sin(a)*3.5; S.y0 = B.y0 + Math.sin(t*1.3)*2; }
      else { S.x = S.cx + Math.cos(t*S.f + S.ph)*S.r; S.z = S.cz + Math.sin(t*S.f*1.3 + S.ph)*S.r; S.y0 = Math.max(topAt(S.x, S.z) + 4.5, S.y + Math.sin(t*0.21 + S.ph)*4); } }
    else if(S.kind === 'graze'){ S.x = S.cx + Math.cos(t*S.f*0.5 + S.ph)*S.r; S.z = S.cz + Math.sin(t*S.f*0.7 + S.ph)*S.r*0.7; S.y0 = topAt(S.x, S.z) + 2.0; }
    else if(S.kind === 'hover'){ S.x = S.cx + Math.sin(t*0.03 + S.ph)*S.r; S.z = S.cz + Math.cos(t*0.025 + S.ph)*S.r; S.y0 = Math.max(topAt(S.x, S.z) + 5, S.y + Math.sin(t*0.1 + S.ph)*1.5); }
    else if(S.kind === 'roam'){ S.x = S.cx + Math.cos(t*S.f + S.ph)*S.r; S.z = S.cz + Math.sin(t*S.f*1.3 + S.ph)*S.r;
      S.y0 = Math.max(topAt(S.x, S.z) + 4.5, S.y + Math.sin(t*0.21 + S.ph)*4); }
    else if(S.kind === 'home'){ S.x = S.hx + Math.sin(t*0.7 + S.ph)*0.5; S.y0 = S.hy + 0.4 + Math.sin(t*1.1)*0.2; S.z = S.hz + Math.cos(t*0.6 + S.ph)*0.5; S.r = 1.2; }
    else if(S.kind === 'bait'){
      if(!S.frozen){ S.bx = Math.cos(t*0.02)*16 + 6; S.bz = Math.sin(t*0.02)*12 - 72; }
      S.x = S.bx + S.ox; S.z = S.bz + S.oz;
      if(!S.ctrl){ const H = SCHOOLS[sHunt]; S.ring += ((H.attack && H.hp > 4 ? 3.7 : 5.5) - S.ring)*0.02; }
      const rr = Math.hypot(S.x, S.z); if(rr > 112){ S.ox -= S.x/rr*(rr - 112); S.oz -= S.z/rr*(rr - 112); S.x = S.bx + S.ox; S.z = S.bz + S.oz; }
      S.y0 = S.frozen ? Math.max(topAt(S.x, S.z) + 7.5, 14) : Math.max(topAt(S.x, S.z) + 10, 19 + Math.sin(t*0.13)*3); }
    else if(S.kind === 'follow'){ S.x = turtle.position.x; S.y0 = turtle.position.y + 0.9; S.z = turtle.position.z; }
  }
}
function updateFish(pool, dt){
  const n = pool.active; if(!n) return;
  const P = pool.p, V = pool.v, SC = pool.sc, SD = pool.seed;
  let cells = 0;
  // Reverse insertion keeps neighbours in ascending fish order, including the twelve-neighbour cutoff.
  for(let i=n-1;i>=0;i--){
    const cx = clamp(((P[i*3] - GO)/CS) | 0, 0, GX-1), cy = clamp((P[i*3+1]/CS) | 0, 0, GY-1), cz = clamp(((P[i*3+2] - GO)/CS) | 0, 0, GZ-1);
    const c = (cy*GZ + cz)*GX + cx;
    let slot = cellSlot[c];
    if(!slot){ slot = ++cells; cellSlot[c] = slot; cellCode[slot] = c; cellHead[slot] = 0; }
    fishCell[i] = slot; nextFish[i] = cellHead[slot]; cellHead[slot] = i + 1;
  }
  // All fish in a cell visit the same occupied neighbour cells, in y/z/x order.
  let used = 0;
  for(let slot=1;slot<=cells;slot++){
    const c = cellCode[slot], x = c % GX, z = Math.floor(c/GX) % GZ, y = Math.floor(c/(GX*GZ));
    neighbourStart[slot] = used;
    for(let yy=Math.max(0,y-1);yy<=Math.min(GY-1,y+1);yy++){
      for(let zz=Math.max(0,z-1);zz<=Math.min(GZ-1,z+1);zz++){
        const row = (yy*GZ+zz)*GX;
        for(let xx=Math.max(0,x-1);xx<=Math.min(GX-1,x+1);xx++){
          const other = cellSlot[row+xx]; if(other) neighbourHeads[used++] = cellHead[other];
        }
      }
    }
  }
  neighbourStart[cells+1] = used;
  const sep2 = pool.sep2, nb2 = pool.nb2, NPRED = PRED.length;
  for(let i=0;i<n;i++){
    const i3 = i*3, x = P[i3], y = P[i3+1], z = P[i3+2]; let vx = V[i3], vy = V[i3+1], vz = V[i3+2];
    const sc = SC[i], S = SCHOOLS[sc];
    let sx=0, sy=0, sz=0, ax=0, ay=0, az=0, cx=0, cy=0, cz=0, ns=0, seen=0;
    const slot = fishCell[i];
    scan: for(let k=neighbourStart[slot];k<neighbourStart[slot+1];k++){
      for(let link=neighbourHeads[k];link;link=nextFish[link-1]){
        const j = link-1; if(j === i) continue;
        const j3 = j*3, ex = x - P[j3], ey = y - P[j3+1], ez = z - P[j3+2], d2 = ex*ex + ey*ey + ez*ez;
        if(d2 > nb2 || d2 < 1e-6) continue;
        if(d2 < sep2){ const w = 1/d2; sx += ex*w; sy += ey*w; sz += ez*w; }
        if(SC[j] === sc){ ax += V[j3]; ay += V[j3+1]; az += V[j3+2]; cx += P[j3]; cy += P[j3+1]; cz += P[j3+2]; ns++; }
        if(++seen >= 12) break scan;
      }
    }
    const sepK = sep2 < 1 ? 0.9 : 3.2;
    let fx = sx*sepK, fy = sy*sepK, fz = sz*sepK;
    if(ns){ const inv = 1/ns; fx += (ax*inv - vx)*1.3 + (cx*inv - x)*0.7; fy += (ay*inv - vy)*1.3 + (cy*inv - y)*0.7; fz += (az*inv - vz)*1.3 + (cz*inv - z)*0.7; }
    let od;
    if(S.ring){
      // bait ball: a rotating ring-shaped column around the school centre
      const lay = ((i * 0.6180339) % 1) - 0.5, yo = lay * S.ring * 1.7;
      const ringR = S.ring * Math.sqrt(Math.max(0.08, 1 - (2*lay)*(2*lay))) + 0.6;
      const hx = x - S.x, hz = z - S.z, rh = Math.hypot(hx, hz) + 1e-4;
      const rad = (ringR - rh)*1.6;
      const sw = S.swirl * (3.2 + 1.5*Math.sin(time*0.3 + lay*4));
      fx += hx/rh*rad + (-hz/rh)*sw; fz += hz/rh*rad + (hx/rh)*sw;
      fy += (S.y0 + yo - y)*1.1;
      od = Math.max(0, rh - ringR) + Math.abs(S.y0 + yo - y)*0.5;
    } else {
      const ox = S.x - x, oy = S.y0 - y, oz = S.z - z; od = Math.sqrt(ox*ox + oy*oy + oz*oz) + 1e-4;
      if(S.ctrl){
        // the school you are: every fish matches your velocity and stays close, milling around you when you stop
        const spring = od > 7 ? 0.9 : 0.3;
        fx += ox*spring + (S.vx - vx)*1.4; fy += oy*spring*1.3 + (S.vy - vy)*1.4; fz += oz*spring + (S.vz - vz)*1.4;
        if(Math.hypot(S.vx, S.vz) < 2.5){ fx += (-oz/od)*S.swirl*1.8; fz += (ox/od)*S.swirl*1.8; }
      } else {
        const pull = Math.min(od/(S.r ? 3 : 7), S.kind === 'hunt' ? 8 : 3.5);
        const sw = S.kind === 'home' ? 0.6 : S.kind === 'hover' ? 0.12 : S.kind === 'graze' ? 0.5 : S.kind === 'hunt' ? 0.5 : 1.6;
        fx += ox/od*pull + (-oz/od)*S.swirl*sw; fy += oy/od*pull*1.2; fz += oz/od*pull + (ox/od)*S.swirl*sw;
      }
    }
    for(let q=0;q<NPRED;q++){ const pr = PRED[q]; if(pr.sc === sc) continue;
      const qx = x - pr.x, qy = y - pr.y, qz = z - pr.z, qd2 = qx*qx + qy*qy + qz*qz;
      if(qd2 < pr.r*pr.r){ const qd = Math.sqrt(qd2) + 1e-4, w = (pr.r - qd)*pr.k/qd; fx += qx*w; fy += qy*w; fz += qz*w; } }
    const gy = topAt(x, z), h = gy + (S.kind === 'home' ? 0.5 : 1.8); if(y < h) fy += (h - y)*9;   // the seabed, wherever it is: in the shallows it is far above the deep reef
    if(y > SURFACE - 3) fy -= (y - SURFACE + 3)*9;
    vx += fx*dt; vy += fy*dt; vz += fz*dt; vy *= 1 - dt*0.8;
    const base = S.ctrl ? 0.8 : S.kind === 'home' ? 1.2 : S.kind === 'hover' ? 0.6 : S.kind === 'graze' ? 1.3 : S.attack ? 6 : 3.2;
    const sp = Math.sqrt(vx*vx + vy*vy + vz*vz) + 1e-5, maxS = S.ctrl ? 4 + Math.hypot(S.vx, S.vy, S.vz) + od*1.2 : base + 2.3 + clamp((od - 9)*0.6, 0, 17), tgt = clamp(sp, base, maxS), k = lerp(1, tgt/sp, Math.min(1, dt*6));
    vx *= k; vy *= k; vz *= k;
    V[i3] = vx; V[i3+1] = vy; V[i3+2] = vz;
    { const i4 = i3/3*4; SD[i4] = (SD[i4] + dt*(5 + sp*k*1.2)/Math.sqrt(SD[i4 + 1])) % 6283.1853; }   // tail-beat phase: speeds up and slows down smoothly
    P[i3] = x + vx*dt; P[i3+1] = Math.min(Math.max(y + vy*dt, gy + 0.25), SURFACE - 0.6); P[i3+2] = z + vz*dt;   // never through the sand, never out of the water
  }
  for(let slot=1;slot<=cells;slot++) cellSlot[cellCode[slot]] = 0;
}
