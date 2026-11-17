'use strict';
// ======================================================================= the sea this season, as a diver finds it: survey spots, crown-of-thorns, rubbish, and trouble nobody ashore can see
const seaRoot = new THREE.Group(); seaRoot.visible = false; scene.add(seaRoot);
const tintBeacon = col => mat({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uCol: { value: new THREE.Color(col) } },
  vertexShader: beaconMat.vertexShader, fragmentShader: beaconMat.fragmentShader.replace('vec3(1.0, 0.48, 0.14)', 'uCol').replace('void main(){', 'uniform vec3 uCol;\nvoid main(){') });
const tintOrb = (col, size) => mat({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uCol: { value: new THREE.Color(col) }, uSize: { value: size } },
  vertexShader: orbMat.vertexShader.replace('* 4.5', '* uSize').replace('void main(){', 'uniform float uSize;\nvoid main(){'),
  fragmentShader: orbMat.fragmentShader.replace('vec3(1.0, 0.55, 0.2)', 'uCol').replace('void main(){', 'uniform vec3 uCol;\nvoid main(){') });
const SURVEY_T = 2.4;
const SURV = { coral: { name: '礁区调查点', short: '礁区', r: 10 }, fish: { name: '鱼苗调查点', short: '鱼苗', r: 11 }, pel: { name: '远洋调查点', short: '远洋', r: 16 } };
for(const k of SEA_KEYS){ const m = SURV[k];
  m.pos = new THREE.Vector3(); m.prog = 0;
  m.beacon = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 30).translate(0, 15, 0), tintBeacon('#4fd8ff')); m.beacon.renderOrder = 6; seaRoot.add(m.beacon);
  m.orb = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tintOrb('#8ff2ff', 3.4)); m.orb.renderOrder = 7; m.orb.frustumCulled = false; seaRoot.add(m.orb); }
// crown-of-thorns starfish: a fat disc, a dozen and more arms, all of it bristling with spines
const COTS = [];
{ const parts = [new THREE.CylinderGeometry(0.5, 0.62, 0.24, 16).translate(0, 0.12, 0)];
  for(let k=0;k<14;k++){ const a = k/14*Math.PI*2; parts.push(new THREE.ConeGeometry(0.17, 1.0, 5).rotateZ(-Math.PI/2).translate(0.95, 0.09, 0).rotateY(a)); }
  for(let k=0;k<40;k++){ const a = k*2.39996, r = 0.12 + (k % 8)*0.16; parts.push(new THREE.ConeGeometry(0.035, 0.24, 4).translate(Math.cos(a)*r, 0.28 - r*0.12, Math.sin(a)*r)); }
  const geo = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)), m = litMat('#9a4a6e', { belly: '#5b2b45', spec: 0.15 });
  for(let i=0;i<5;i++){ const s = new THREE.Mesh(geo, m); s.scale.setScalar(1.55); s.visible = false; seaRoot.add(s); COTS.push(s);
    const o = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tintOrb('#ff5fa8', 1.7)); o.renderOrder = 7; o.frustumCulled = false; seaRoot.add(o); s.userData.orb = o; } }
// rubbish washed out of the outfall: bags, bottles, cans
const TRASH = [];
{ const bagG = new THREE.SphereGeometry(0.6, 9, 6); { const p = bagG.attributes.position; for(let i=0;i<p.count;i++){ const y = p.getY(i); p.setXYZ(i, p.getX(i)*(1 + 0.25*Math.sin(i*1.7)), y*0.3, p.getZ(i)*(0.8 + 0.2*Math.cos(i*2.3))); } bagG.computeVertexNormals(); }
  const bottleG = mergeGeometries([new THREE.CylinderGeometry(0.2, 0.2, 0.8, 9).toNonIndexed(), new THREE.CylinderGeometry(0.08, 0.2, 0.3, 9).translate(0, 0.55, 0).toNonIndexed()]).rotateZ(Math.PI/2);
  const canG = new THREE.CylinderGeometry(0.13, 0.13, 0.42, 10).rotateZ(Math.PI/2);
  const bagMs = ['#2f5f9e', '#2a2a2c', '#d8b23a', '#e4e0d4'].map(c => litMat(c, { opacity: 0.93, spec: 0.5 })), bottleM = litMat('#4f9a5c', { opacity: 0.85, spec: 0.9 }), canM = litMat('#c0392b', { spec: 0.7 }), canM2 = litMat('#2d6fb3', { spec: 0.7 });
  const tyreG = new THREE.TorusGeometry(0.7, 0.26, 8, 18).rotateX(Math.PI/2), tyreM = litMat('#1f1f22', { spec: 0.2 }), buoyM = litMat('#ff7a1a', { spec: 0.6 });
  for(let i=0;i<4;i++){ const g = new THREE.Group();
    const bag = new THREE.Mesh(bagG, bagMs[i]); bag.position.set(0, 0.12, 0); bag.rotation.y = i*1.3; g.add(bag);
    const bt = new THREE.Mesh(bottleG, bottleM); bt.position.set(0.9, 0.18, 0.4); bt.rotation.y = i*0.9 + 0.5; g.add(bt);
    const cn = new THREE.Mesh(canG, i % 2 ? canM : canM2); cn.position.set(-0.7, 0.13, 0.6); cn.rotation.y = i*2.1; g.add(cn);
    if(i % 2 === 0){ const ty = new THREE.Mesh(tyreG, tyreM); ty.position.set(-0.6, 0.22, -0.9); ty.rotation.z = 0.25; g.add(ty); }
    else { const bu = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), buoyM); bu.position.set(-0.5, 0.2, -0.8); g.add(bu); const b2 = new THREE.Mesh(bagG, bagMs[(i + 2) % 4]); b2.scale.setScalar(0.7); b2.position.set(0.5, 0.1, -0.7); g.add(b2); }
    g.scale.setScalar(1.7); g.visible = false; seaRoot.add(g); TRASH.push(g); } }
// blast fishing: a blown-open reef, broken coral, dead fish drifting belly up
const BLAST = new THREE.Group(); BLAST.visible = false; seaRoot.add(BLAST);
const blastRubble = [], blastFish = [];
{ const rw = litMat('#ebe6da'), rg = litMat('#9a9488'), fm = litMat('#c9cdd2', { belly: '#f4f4f0', spec: 0.5 });
  for(let k=0;k<16;k++){ const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + (k % 4)*0.16, 0).scale(1, 0.6, 1), k % 3 ? rw : rg); BLAST.add(m); blastRubble.push(m); }
  for(let k=0;k<10;k++){ const m = new THREE.Mesh(fishBase, fm); m.scale.setScalar(1.0 + (k % 3)*0.2); BLAST.add(m); blastFish.push({ m, ph: k*0.77, h: 0.4 + (k % 5)*0.9, a: k*0.63, r: 1.2 + (k % 4)*1.1 }); } }
// lionfish: striped, fanned out, hovering over the reef they are emptying
const LION = new THREE.Group(); LION.visible = false; seaRoot.add(LION);
const lions = [];
{ const red = litMat('#b8452c', { belly: '#e2c3ad' }), wh = litMat('#f1e4d4'), fin = litMat('#efd9c4', { opacity: 0.78 });
  const rayG = new THREE.ConeGeometry(0.028, 1.1, 3).translate(0, 0.55, 0), spineG = new THREE.ConeGeometry(0.025, 0.85, 3).translate(0, 0.42, 0);
  for(let i=0;i<7;i++){ const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 9).scale(0.32, 0.42, 0.9), red));
    for(let k=0;k<6;k++){ const z = 0.62 - k*0.24, f = Math.sqrt(Math.max(0.05, 1 - (z/0.9)**2)); const st = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 4, 18), wh); st.scale.set(0.33*f, 0.43*f, 1); st.position.z = z; g.add(st); }
    for(const s of [-1, 1]) for(let j=0;j<7;j++){ const r = new THREE.Mesh(rayG, fin); r.position.set(s*0.26, -0.05, 0.25); r.rotation.set(-0.55, 0, -s*(0.35 + j*0.27)); g.add(r); }
    for(let j=0;j<9;j++){ const sp = new THREE.Mesh(spineG, wh); sp.position.set(0, 0.36, 0.45 - j*0.11); sp.rotation.x = -0.35; g.add(sp); }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6).scale(0.04, 0.32, 0.3), fin); tail.position.z = -1.0; g.add(tail);
    g.scale.setScalar(1.15); LION.add(g); lions.push({ g, ph: i*0.9, off: new THREE.Vector3(Math.cos(i*2.4)*(2 + i*0.5), 1.2 + (i % 3)*0.9, Math.sin(i*2.4)*(2 + i*0.5)) }); } }
// coral disease: a white band eating outward across a coral head, dead white skeleton behind it
const SICK = new THREE.Group(); SICK.visible = false; seaRoot.add(SICK);
const sickBands = [new THREE.Mesh(new THREE.TorusGeometry(1, 0.3, 6, 36).rotateX(Math.PI/2), litMat('#f6f3ea', { glow: 0.7 })), new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 6, 36).rotateX(Math.PI/2), litMat('#ddd8cc', { glow: 0.3 }))];
sickBands.forEach(b => SICK.add(b));
const sea3 = { seed: -1, evPos: new THREE.Vector3(), evPatch: -1, start: null, surveyNow: null, dustT: 0 };
const seaBleach = new Float32Array(14);
// the top of the reef where it is really is: corals, tables and all, not just the rock under them
const seaRay = new THREE.Raycaster(); let reefMeshes = null;
function coralTop(x, z){
  if(!reefMeshes) reefMeshes = scene.children.filter(o => o.isInstancedMesh);
  const base = topAt(x, z); seaRay.set(tmpQ.set(x, base + 14, z), tmp.set(0, -1, 0)); seaRay.far = 16;
  const hit = seaRay.intersectObjects(reefMeshes, false)[0];
  return hit ? Math.max(base, hit.point.y) : base;
}
window.__sea = { sea3, SURV, COTS, TRASH, BLAST, LION, SICK, get S(){ return V.sea; } };
// where everything sits this season: the same each time you dive until the season turns
function layoutSea(S){
  sea3.seed = S.seed; const R = mulberry32(S.seed);
  let wi = 0; for(let i=1;i<13;i++) if(patchLife[i] < patchLife[wi]) wi = i;
  const big = P => P.bommies.reduce((a, b) => b.ry > a.ry ? b : a);
  const onReef = (P, out) => { const b = P.bommies[Math.floor(R()*P.bommies.length)], a = R()*6.283, rr = b.rx*(0.15 + R()*0.45);
    const x = b.x + Math.cos(a)*rr, z = b.z + Math.sin(a)*rr; return out.set(x, topAt(x, z), z); };
  { const b = big(PATCHES[wi]); SURV.coral.pos.set(b.x, bommieY(b, b.x, b.z) + 3.5, b.z); }
  { let fi = (wi + 6) % 13; for(let k=0;k<13 && Math.hypot(PATCHES[fi].x - 14, PATCHES[fi].z + 70) < 70;k++) fi = (fi + 1) % 13;   // the fry count: a reef away from where dives start
    const b = big(PATCHES[fi]); SURV.fish.pos.set(b.x, bommieY(b, b.x, b.z) + 5, b.z); }
  SURV.pel.pos.set(15, SURFACE - 16, 150);   // out past the wall, where the tuna run
  COTS.forEach((c, i) => { const P = PATCHES[i < 3 ? wi : (wi + i*4) % 13];
    for(let k=0;k<12;k++){ onReef(P, c.position); if(COTS.slice(0, i).every(o => o.position.distanceTo(c.position) > 7)) break; }   // each one its own find c.position.y = coralTop(c.position.x, c.position.z) + 0.12;
    const x = c.position.x, z = c.position.z, nx = topAt(x - 0.6, z) - topAt(x + 0.6, z), nz = topAt(x, z - 0.6) - topAt(x, z + 0.6);
    c.rotation.set(clamp(-nz*0.6, -0.6, 0.6), R()*6.283, clamp(nx*0.6, -0.6, 0.6), 'XZY'); });
  const out = toOcean(tmpQ.set(portalU.uSrc.value.x, 0, portalU.uSrc.value.y), new THREE.Vector3());
  TRASH.forEach((g, i) => { let x = out.x + (R() - 0.5)*26, z = out.z + 10 + R()*22;
    for(let k=0;k<12 && heightAt(x, z) > SURFACE - 3.5;k++) z += 4;
    g.position.set(x, heightAt(x, z) + 0.1, z); g.rotation.set(0, R()*6.283, 0); });
  BLAST.visible = S.ev === 'blast'; LION.visible = S.ev === 'lion'; SICK.visible = false; sea3.evPatch = -1;   // the sick patch shows as bleaching on the reef itself (seaBleach)
  if(S.ev === 'blast'){ sea3.evPatch = (wi + 5) % 13; const b = big(PATCHES[sea3.evPatch]); const c = sea3.evPos.set(b.x + b.rx*0.3, 0, b.z); c.y = coralTop(c.x, c.z) + 0.5;
    blastRubble.forEach((m, k) => { const a = k*2.4 + R(), r = 0.6 + R()*3.2, x = c.x + Math.cos(a)*r, z = c.z + Math.sin(a)*r; m.position.set(x, coralTop(x, z) + 0.15, z); m.rotation.set(R()*3, R()*3, R()*3); }); }
  if(S.ev === 'lion'){ const P = PATCHES[(wi + 7) % 13], b = big(P); sea3.evPos.set(b.x, bommieY(b, b.x, b.z), b.z); }
  if(S.ev === 'disease'){ sea3.evPatch = (wi + 2) % 13; const b = big(PATCHES[sea3.evPatch]); sea3.evPos.set(b.x, bommieY(b, b.x, b.z), b.z);
    [0.62, 0.42].forEach((f, j) => { const band = sickBands[j], rr = b.rx*f; band.scale.set(rr, 1, rr); band.position.set(b.x, bommieY(b, b.x + rr, b.z) + 1.1, b.z); }); }
}
const seaLeft = S => ({ cots: COTS.filter((c, i) => i < S.cots && !S.gone.cots.includes(i)).length, trash: TRASH.filter((g, i) => i < S.trash && !S.gone.trash.includes(i)).length });
function seaSays(k, S){
  const x = S.t[k], up = x > 0.007, dn = x < -0.007, res = V.research ? ' 样本会交给研究站。' : '';
  if(k === 'coral'){ let m = up ? '水温正常，礁上冒出了不少新珊瑚。这一季珊瑚会自己多长一点。' : dn ? '水温偏高，有几处珊瑚开始发白。这一季珊瑚会多掉一点。' : '水温正常，珊瑚状态平稳。';
    if(S.cots) m += ` 礁上有 ${S.cots} 只长棘海星，排污带来的营养越多，它们越多。`;
    if(S.ev === 'blast' || S.ev === 'disease'){ S.evHint = true; m += ' 另一片礁上好像有异样，已经标出来了。'; }
    return m + res; }
  if(k === 'fish'){ let m = up ? '鱼苗很多，今年是个好年份。' : dn ? '鱼苗比往年少，这一季鱼群会长得慢一些。' : '鱼苗和往年差不多。';
    if(S.ev === 'lion'){ S.evHint = true; m += ' 礁上有一种没见过的鱼在吃小鱼，已经标出来了。'; }
    return m + res; }
  return (up ? '金枪鱼群洄游过来了，远洋鱼群这一季会多一些。' : dn ? '洄游的鱼群来得比往年晚，远洋鱼群这一季会少一些。' : '远洋鱼群和往年差不多。') + res;
}
const SEA_FIND = {
  blast: ['有人在炸鱼', '礁石被炸开了一片，碎珊瑚和翻着白肚的鱼散了一地。岸上没人知道。浮上去以后可以决定怎么办。'],
  lion: ['狮子鱼', '它们不是这片海的鱼，在这里没有天敌，一条一年能吃掉上万条小鱼。浮上去以后可以组织捕捞。'],
  disease: ['珊瑚病', '一圈白色的病斑正沿着珊瑚往外扩，被它扫过的地方只剩白骨。浮上去以后可以决定怎么办。'] };
function updateSea(dt, ctrl){
  const S = V.sea, on = mode === 'dive' && !!S && (state === 'freedive' || state === 'surfacing'); seaRoot.visible = on;
  for(let i=0;i<13;i++){ const want = on && i === sea3.evPatch && !(S.evFix) ? (S.ev === 'disease' ? 0.55 : S.ev === 'blast' ? 0.3 : 0) : 0; seaBleach[i] += (want - seaBleach[i])*Math.min(1, dt*2); }
  if(!on) return;
  if(sea3.seed !== S.seed) layoutSea(S);
  const P = player.pos, live = ctrl && state === 'freedive';
  sea3.surveyNow = null;
  for(const k of SEA_KEYS){ const m = SURV[k], show = !S.seen[k];
    m.beacon.visible = m.orb.visible = show; if(!show) continue;
    m.beacon.position.copy(m.pos); m.beacon.position.y -= 1; m.orb.position.copy(m.pos);
    m.beacon.rotation.y = Math.atan2(camera.position.x - m.pos.x, camera.position.z - m.pos.z);
    const inside = live && m.pos.distanceTo(P) < m.r;
    m.prog = inside ? m.prog + dt : Math.max(0, m.prog - dt*0.6);
    m.orb.material.uniforms.uSize.value = 3.4 + 3.5*m.prog/SURVEY_T + (inside ? Math.sin(time*9)*0.3 : 0);
    if(inside) sea3.surveyNow = k;
    if(m.prog >= SURVEY_T){ m.prog = 0; S.seen[k] = true; pulseAt(m.pos); emit(m.pos, 60, 4, 1, 1); chime(SEA_KEYS.filter(q => S.seen[q]).length*2 + 1);
      toast(`${m.name} · 完成`, seaSays(k, S) + ' 岸上的预测已经更新。', 8500); } }
  COTS.forEach((c, i) => { c.visible = c.userData.orb.visible = i < S.cots && !S.gone.cots.includes(i); if(!c.visible) return;
    c.userData.orb.position.copy(c.position); c.userData.orb.position.y += 1.6 + Math.sin(time*2 + i)*0.15;
    if(live && c.position.distanceTo(P) < 4.4){ S.gone.cots.push(i); c.visible = c.userData.orb.visible = false; emit(c.position, 90, 5, 1.2, 1); chime(S.gone.cots.length + 2);
      const n = seaLeft(S).cots; toast('长棘海星 · 已清除', `一只一晚上能啃掉一大片珊瑚。${n ? `还剩 ${n} 只。` : '这片礁上的清完了。'}`); } });
  TRASH.forEach((g, i) => { g.visible = i < S.trash && !S.gone.trash.includes(i); if(!g.visible) return;
    if(live && g.position.distanceTo(P) < 4.8){ S.gone.trash.push(i); g.visible = false; emit(g.position, 70, 4, 1.5, 1); chime(S.gone.trash.length + 1);
      const n = seaLeft(S).trash; toast('垃圾 · 已捡走', `顺着排污口冲出来的。海龟会把塑料袋当成水母吃下去。${n ? `还剩 ${n} 处。` : ''}`); } });
  if(S.ev){
    if(live && !S.evFound && sea3.evPos.distanceTo(P) < 20){ S.evFound = true; pulseAt(sea3.evPos); chime(5); toast(SEA_FIND[S.ev][0], SEA_FIND[S.ev][1], 9000); }
    if(S.ev === 'blast'){ blastFish.forEach(f => { const a = f.a + time*0.04, y = sea3.evPos.y + f.h + Math.sin(time*0.5 + f.ph)*0.25;
        f.m.position.set(sea3.evPos.x + Math.cos(a)*f.r, y, sea3.evPos.z + Math.sin(a)*f.r); f.m.rotation.set(Math.sin(time*0.3 + f.ph)*0.3, a + 1.2, Math.PI + Math.sin(time*0.4 + f.ph)*0.25); });
      sea3.dustT -= dt; if(sea3.dustT < 0 && sea3.evPos.distanceTo(P) < 45){ sea3.dustT = 1.4; emit(tmpQ.copy(sea3.evPos).add(tmp.set((rng() - 0.5)*4, 0.4, (rng() - 0.5)*4)), 10, 1.4, 0.5, 1.4); } }
    if(S.ev === 'lion') lions.forEach((l, i) => { const a = time*0.12 + l.ph;
      l.g.position.set(sea3.evPos.x + l.off.x + Math.sin(a)*1.2, sea3.evPos.y + l.off.y + Math.sin(time*0.7 + l.ph)*0.3, sea3.evPos.z + l.off.z + Math.cos(a)*1.2);
      l.g.rotation.set(0, a + Math.PI/2 + Math.sin(time*0.5 + i)*0.4, 0); });
  }
}
// what the pointer leads you to: the nearest thing worth doing down here
function seaTarget(){
  const P = player.pos, S = V.sea; let best = null, bd = 1e9;
  const consider = (pos, name) => { const d = pos.distanceTo(P); if(d < bd){ bd = d; best = { pos, name }; } };
  for(const d of debris) if(d.alive) consider(d.pos, '幽灵网');
  if(S && sea3.seed === S.seed){
    for(const k of SEA_KEYS) if(!S.seen[k]) consider(SURV[k].pos, SURV[k].name);
    COTS.forEach(c => { if(c.visible) consider(c.position, '长棘海星'); });
    TRASH.forEach(g => { if(g.visible) consider(g.position, '垃圾'); });
    if(S.ev && S.evHint && !S.evFound) consider(sea3.evPos, '异样');
  }
  return best;
}
function seaObjective(netsLeft){
  const S = V.sea; if(!S) return null;
  if(sea3.surveyNow){ const m = SURV[sea3.surveyNow]; return `正在调查${m.short}… ${Math.round(m.prog/SURVEY_T*100)}% · 待在这里别走`; }
  const L = seaLeft(S), nS = SEA_KEYS.filter(k => S.seen[k]).length, parts = [];
  if(nS < 3) parts.push(`调查 ${nS}/3`); if(L.cots) parts.push(`长棘海星 ${L.cots}`); if(L.trash) parts.push(`垃圾 ${L.trash}`); if(netsLeft) parts.push(`幽灵网 ${netsLeft}`);
  if(S.ev && S.evHint && !S.evFound) parts.push('去看看标出的异样');
  return parts.length ? '水下 · ' + parts.join(' · ') : '这一季水下的事都做完了。准备好了就浮上水面。';
}
function ensureSea(){ if(!V.sea || V.sea.season < V.season) V.sea = rollSea(eco, V, V.season, rng); }
function startSeaDive(){
  ensureSea(); const S = V.sea; layoutSea(S); S.dived = true;
  sea3.start = { seen: SEA_KEYS.filter(k => S.seen[k]).length, cots: S.gone.cots.length, trash: S.gone.trash.length, ev: S.evFound };
  if(!V.seaTut){ V.seaTut = true; cue(3, () => toast('水下能做的事', '游到发光的调查点停一会儿，岸上的预测就会变准。清掉长棘海星和垃圾，留意岸上看不到的问题。', 9500)); }
}
// back on land: what this dive did, and a decision if you found trouble
const SEA_EV_TXT = {
  blast: { t: '礁区有人炸鱼', x: '你在水下看到了炸开的礁石和翻白的死鱼。岸上没人知道这件事。', fixT: '报告海警，组织巡逻', fixD: e => `村库支出 ${e.fix}，炸鱼停止。`, miss: '有人在礁区炸鱼，没人发现' },
  lion: { t: '狮子鱼入侵', x: '礁上来了一群狮子鱼。它们在这里没有天敌，会把小鱼吃光。好在它们的肉很好吃。', fixT: '组织村民捕捞', fixD: e => `村库支出 ${e.fix}，卖鱼收回 ${e.gain}。`, miss: '狮子鱼在礁上安了家，没人发现' },
  disease: { t: '珊瑚病', x: '一片珊瑚得了白色综合征，病斑正在往外扩。', fixT: '让人下去切除病枝', fixD: e => `村库支出 ${e.fix}，病斑不再扩散。`, miss: '一片珊瑚得了病，没人发现' } };
const seaDmg = E => [E.coral ? `珊瑚 −${(E.coral*100).toFixed(1).replace('.0', '')}%` : '', E.fish ? `鱼群 −${(E.fish*100).toFixed(1).replace('.0', '')}%` : ''].filter(Boolean).join('，');
function seaDebrief(back){
  const S = V.sea, st = sea3.start; sea3.start = null; if(!S || !st) return;
  const a = SEA_KEYS.filter(k => S.seen[k]).length - st.seen, c = S.gone.cots.length - st.cots, t = S.gone.trash.length - st.trash, parts = [];
  if(a) parts.push(`调查了 ${a} 处`); if(c) parts.push(`清掉 ${c} 只长棘海星`); if(t) parts.push(`捡走 ${t} 处垃圾`); if(S.evFound && !st.ev) parts.push(`发现了${SEA_EV[S.ev].n}`);
  if(parts.length) setTimeout(() => toast('这次下潜', parts.join('，') + '。' + (a ? ' 预测已经按你看到的更新了。' : ''), 7000), 300);
  if(S.evFound && !S.evDone) showSeaEvent(back);
}
function showSeaEvent(back){
  const S = V.sea, E = SEA_EV[S.ev], T = SEA_EV_TXT[S.ev];
  setState('event'); $('village').classList.add('modal'); $('vReport').classList.remove('on');
  const opts = [{ t: T.fixT, d: T.fixD(E) }, { t: '不管它', d: `季末${seaDmg(E)}。` }];
  $('vEvent').innerHTML = `<div class="kicker crisis">${seasonName(S.season)} · 水下发现</div><h3>${T.t}</h3><p>${T.x}</p>
    <div class="opts">${opts.map((o, i) => `<button data-i="${i}"><b>${o.t}</b><span>${o.d}</span></button>`).join('')}</div>`;
  $('vEvent').querySelectorAll('button').forEach(b => b.onclick = () => { S.evDone = true;
    if(+b.dataset.i === 0){ S.evFix = true; V.money += E.gain - E.fix; }
    $('vEvent').classList.remove('on'); setState(back);
    if(back === 'report') $('vReport').classList.add('on'); else $('village').classList.remove('modal');
    chime(3); renderVillageUI(); });
  $('vEvent').classList.add('on'); renderVillageUI();
}
