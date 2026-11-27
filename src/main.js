'use strict';
// ======================================================================= frame
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3(), camDir = new THREE.Vector3();
const MED = { dA: [0.036, 0.032, 0.046], dS: [0.052, 0.056, 0.044], aA: [0.024, 0.0068, 0.0042], aS: [0.0014, 0.0026, 0.0038] }; // healthy water is clear: little scattering, so the reef reads crisply; murk comes from the degraded end (dA, dS)
updateTurtle(0, 0);
updateSchools(0);
for(const pool of [reg, bait]) for(let i=0;i<pool.n;i++) spawnFish(pool, i, false);
camPos.copy(player.pos).add(new THREE.Vector3(0, 3, 11)); camLook.copy(player.pos); camera.position.copy(camPos);
const clock = new THREE.Clock();
let forcedDt = 0;
const perf = { ms: 0, fishMs: 0 };
window.__g = { renderer, composer, compositePass, whale, player, debris, perf, eco, V, trawl, SCHOOLS, sBait, POIS, turtle,
  get state(){ return state; }, get mode(){ return mode; }, get audio(){ return { muted: userMuted, gain: master ? master.gain.value : null, ctx: AC ? AC.state : null }; }, get fish(){ return reg.active + bait.active; },
  get zoom(){ return zoom; }, get avatar(){ return avatar; },
  schoolStats(i){ let n = 0, d = 0; const c = player.pos; for(const pool of [reg, bait]) for(let k=0;k<pool.active;k++) if(pool.sc[k] === i){ n++; d += Math.hypot(pool.p[k*3] - c.x, pool.p[k*3+1] - c.y, pool.p[k*3+2] - c.z); } return { n, meanDist: n ? +(d/n).toFixed(1) : null }; },
  get cur(){ return player; },
  schoolCentroid(i){ let n = 0, x = 0, y = 0, z = 0, sp = 0; for(const pool of [reg, bait]) for(let k=0;k<pool.active;k++) if(pool.sc[k] === i){ n++; x += pool.p[k*3]; y += pool.p[k*3+1]; z += pool.p[k*3+2]; sp += Math.hypot(pool.v[k*3], pool.v[k*3+1], pool.v[k*3+2]); } return n ? [x/n|0, y/n|0, z/n|0, +(sp/n).toFixed(1)] : null; }, becomeAvatar: (...a) => becomeAvatar(...a), ENT, swapCandidates: () => swapCandidates(), get MARKS(){ return MARKS; }, get portal(){ return portal; }, diveInto: (...a) => diveInto(...a), start, enterVillage, enterDive, runSeason, beginRun, build, nextSeason, endGame, surfaceUp, startTrawl,
  step(n, dt = 1/30){ forcedDt = dt; for(let i=0;i<n;i++) frame(); forcedDt = 0; clock.getDelta(); } };

function setW(id, v){
  const el = $(id), w = (clamp(v, 0, 1)*100).toFixed(0) + '%'; if(el.style.width === w) return;
  el.style.width = w; el.className = v < 0.33 ? 'low' : v < 0.55 ? 'mid' : '';
  const n = $('n' + id.slice(1)); if(n) n.textContent = w;
}

// ======================================================================= the live window and the seamless dive
const portal = { pos: new THREE.Vector3(0, 24, 80), look: new THREE.Vector3(0, 13, 0) };
const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), drawSize = new THREE.Vector2(), ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let zoom = null, savedDioCam = null;
function portalTarget(outPos, outLook){
  const off = pA.copy(dioCam.position).sub(controls.target);
  const az = Math.atan2(off.x, off.z), el = Math.atan2(off.y, Math.hypot(off.x, off.z));
  const k = clamp((off.length() - 120)/340, 0, 1), R = lerp(48, 100, k);
  outLook.set(2, 13, -2);
  outPos.set(Math.sin(az)*R, 0, Math.cos(az)*R);
  outPos.y = clamp(Math.max(topAt(outPos.x, outPos.z) + 6, 12 + Math.sin(el)*R*0.4), 10, SURFACE - 4);
}
const SPECIES_NAME = ['黄刺尾鲷', '蓝光鳃鱼', '金拟花鮨', '鲹鱼', '粉拟花鮨', '鹦嘴鱼', '蝴蝶鱼', '沙丁鱼', '小丑鱼', '蓝倒吊', '马夫鱼', '金梭鱼', '大鹦嘴鱼', '四线笛鲷', '金枪鱼'];
const baitMark = { name: '沙丁鱼群', pos: () => pC.set(SCHOOLS[sBait].x, SCHOOLS[sBait].y0, SCHOOLS[sBait].z), av: { kind: 'school', sc: sBait, name: '沙丁鱼群' } };
const diveMark = { name: '蝠鲼', pos: baitMark.pos, av: null };
const MARKS = [baitMark, { name: '绿海龟', pos: () => pC.copy(ENT.turtle.st.pos), av: { kind: 'turtle' } }, { name: '黑鳍礁鲨', pos: () => pC.copy(ENT.shark.st.pos), av: { kind: 'shark' } },
  { name: '海月水母', pos: () => pC.copy(ENT.jelly.st.pos), av: { kind: 'jelly' } }, { name: '蝠鲼', pos: () => pC.copy(ENT.manta.st.pos), av: { kind: 'manta' } }];
SCHOOLS.forEach((S, i) => { if(['roam', 'hunt', 'hover', 'graze'].includes(S.kind)) MARKS.push({ name: SPECIES_NAME[S.species] + '群', pos: () => pC.set(S.x, S.y0, S.z), av: { kind: 'school', sc: i, name: SPECIES_NAME[S.species] + '群' } }); });
MARKS.forEach(m => { const el = document.createElement('div'); el.className = 'mk'; setGameHTML(el, `<span>点击化身 · ${m.name}</span>`); $('marks').appendChild(el); m.el = el; m.sx = 0; m.sy = 0; m.vis = false; });
document.addEventListener('ocean-language-changed', () => {
  for(const mark of MARKS) mark.el.querySelector('span').textContent=gameText('点击化身 · '+mark.name);
});
let mouseVX = -1e4, mouseVY = -1e4, downX = 0, downY = 0, hotMark = null;
renderer.domElement.addEventListener('pointermove', e => { mouseVX = e.clientX; mouseVY = e.clientY; });
renderer.domElement.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', e => {
  if(mode !== 'village' || zoom || Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
  if(hotMark && ['plan', 'report', 'over'].includes(state)){ if(focusOn) exitFocus(); diveInto(hotMark, 'free'); return; }
  if(['plan', 'report', 'over'].includes(state) && !$('village').classList.contains('modal')){ const pk = pickBuilding(e.clientX, e.clientY); if(pk) openFocus(pk); else if(focusOn) exitFocus(); }
});
// is the sea showing at this pixel? The water is a box (top and three glass sides), so a ray-box test answers it
// without raycasting the dense water meshes (that cost ~0.4 ms a call, ~12 ms a frame for all the markers)
const portalBox = new THREE.Box3(new THREE.Vector3(-49.85, -40, 0.9), new THREE.Vector3(49.85, -0.05, SEA_Z - 0.15)), portalHit = new THREE.Vector3();
function portalVisibleAt(x, y){
  ndc.set(x/innerWidth*2 - 1, -(y/innerHeight)*2 + 1);
  raycaster.setFromCamera(ndc, dioCam);
  const p = raycaster.ray.intersectBox(portalBox, portalHit);
  if(!p || p.z < 1.0) return null;                 // the shore side of the box is land, not glass
  return { point: p.clone(), distance: p.distanceTo(raycaster.ray.origin) };
}
// ======================================================================= focus on one building: the camera flies to it, a card shows what it does and what an upgrade would add
const PICK = [];   // { groups: () => [..], k, i, pos }
{
  VB.houseVars.forEach(h => PICK.push({ k: 'house', i: h.i, groups: () => h.vars, pos: new THREE.Vector3(h.x, dioH(h.x, h.z), h.z) }));
  VB.shopVars.forEach((s, j) => PICK.push({ k: 'shop', i: j, groups: () => s.vars, pos: new THREE.Vector3(s.x, dioH(s.x, s.z), s.z) }));
  const one = (k, g, x, z, i = 0) => PICK.push({ k, i, groups: () => [g].concat(UPG.filter(u => Math.hypot(u.x - x, u.z - z) < 1 && u.g !== g).map(u => u.g)), pos: new THREE.Vector3(x, dioH(x, z), z) });
  one('resort', VB.resort, -31, -34, 0); one('resort', VB.resort2, 30, -52, 1);
  one('plant', VB.plant, -42, -18); one('recycle', VB.recycle, 34, -4); one('cold', VB.cold, 25, -11); one('nursery', VB.nursery, -42, -4); one('school', VB.school, -2, -29);
  one('research', VB.research, -36, -62);
  PICK.push({ k: 'harbor', i: 0, groups: () => [VB.harbor], pos: new THREE.Vector3(40, 0.6, HARBOR.sz + 2) });
  SHIPS.forEach(s => PICK.push({ k: s.kind, i: s.i, groups: () => [s.g], pos: s.home, ship: true }));
  dBoats.filter(b => b.role !== 'tour').forEach(b => PICK.push({ k: b.role === 'line' ? 'boat' : 'trawler', i: b.idx, groups: () => [b.g], pos: b.home, ship: true }));
}
const pickOwner = new Map(); for(const p of PICK) for(const g of p.groups()) if(!pickOwner.has(g)) pickOwner.set(g, p);
raycaster.layers.enable(BOAT_PICK_LAYER);
function pickBuilding(x, y){
  ndc.set(x/innerWidth*2 - 1, -(y/innerHeight)*2 + 1); raycaster.setFromCamera(ndc, dioCam);
  const live = []; for(const [g] of pickOwner) if(g.visible && g.scale.x > 0.5) live.push(g);
  const hit = raycaster.intersectObjects(live, true)[0]; if(!hit) return null;
  const water = raycaster.intersectObjects(portalMeshes, false)[0]; if(water && water.distance < hit.distance - 1) return null;
  let o = hit.object; while(o && !pickOwner.has(o)) o = o.parent;
  const p = o && pickOwner.get(o); if(!p) return null;
  if((V[KEY[p.k]] || 0) <= p.i) return null;
  return p;
}
let focusOn = null, focusAnim = null, focusSaved = null, hoverPick = null, hoverT = 0;
const FOC_DIST = { house: 26, shop: 24, resort: 46, plant: 30, recycle: 28, cold: 28, nursery: 30, school: 32, research: 40, harbor: 46, offshore: 30, whale: 28, boat: 22, trawler: 26 };
function openFocus(p){
  if(!focusSaved) focusSaved = { pos: dioCam.position.clone(), tgt: controls.target.clone(), min: controls.minDistance, max: controls.maxDistance };
  focusOn = p; window.__focusOn = p;
  const tgt = p.pos.clone(); tgt.y += p.ship ? 1 : 2.2;
  const dir = dioCam.position.clone().sub(controls.target).normalize(); dir.y = Math.max(dir.y, 0.45); dir.normalize();
  focusAnim = { t: 0, p0: dioCam.position.clone(), t0: controls.target.clone(), p1: tgt.clone().addScaledVector(dir, FOC_DIST[p.k] || 30), t1: tgt, fov0: dioCam.fov, back: false };
  controls.minDistance = 8; controls.maxDistance = 140;
  $('village').classList.add('focus'); renderFocus(); chime(1);
}
function exitFocus(){
  if(!focusOn) return; focusOn = null; window.__focusOn = null;
  focusAnim = { t: 0, p0: dioCam.position.clone(), t0: controls.target.clone(), p1: focusSaved.pos, t1: focusSaved.tgt, back: true };
  $('bInfo').classList.remove('on'); $('village').classList.remove('focus'); renderForecast();
}
function updateFocus(dt){
  const a = focusAnim; a.t = Math.min(1, a.t + dt/0.9); const e = a.t*a.t*(3 - 2*a.t);
  controls.target.lerpVectors(a.t0, a.t1, e); dioCam.position.lerpVectors(a.p0, a.p1, e); dioCam.lookAt(controls.target);
  if(a.t >= 1){ focusAnim = null; if(a.back){ controls.minDistance = focusSaved.min; controls.maxDistance = focusSaved.max; focusSaved = null; } }
  controls.update();
}
function renderFocus(){
  const p = focusOn; if(!p) return;
  const b = BUILD.find(x => x.k === p.k), lv = lvOf(V, p.k, p.i), mx = LVMAX[p.k], info = BUILD_INFO[p.k], plan = state === 'plan';
  const c = lv < mx ? upCost(p.k, lv) : 0, ups = (V.ups || []).some(u => u.k === p.k && u.i === p.i);
  const why = lv >= mx ? '已经是最高级' : !plan ? '季度进行中，回到规划阶段再升级' : V.money < c ? `村库还差 ${Math.ceil(c - V.money)}` : '';
  const multi = (b.max > 1 || p.k === 'offshore' || p.k === 'whale');
  const extra = { house: `全村能住 ${W(V, 'house', [4, 6, 8])} 人，现在住着 ${V.pop} 人。`, offshore: `远洋鱼群 ${Math.round((eco.pelagic ?? 1)*100)}%。`, whale: `远洋鱼群 ${Math.round((eco.pelagic ?? 1)*100)}%，越健康游客越多。`,
    harbor: `现在停着 ${V.offshore || 0} 条远洋渔船、${V.whale || 0} 条观鲸船。`, nursery: `珊瑚 ${Math.round(eco.coral*100)}%。`, shop: `本季潜水客由所有潜水店一起接待。` }[p.k] || '';
  setGameHTML($('bInfo'), `<button class="bx" aria-label="关闭">✕</button>
    <div class="bh">${ic(info.icon)}<b>${b.name}${multi ? ` <small>#${p.i + 1}</small>` : ''}</b><span class="lvp">${Array.from({ length: mx }, (_, j) => `<i class="${j < lv ? 'on' : ''}"></i>`).join('')}</span><span class="lvn">Lv ${lv}</span></div>
    <div class="bnow">${LV_TXT[p.k][lv - 1]}</div>
    ${lv < mx ? `<div class="bnext">${ic('up')}<span>升到 Lv ${lv + 1}：${LV_TXT[p.k][lv]}</span></div>` : ''}
    ${extra ? `<div class="bextra">${extra}</div>` : ''}
    <div class="bbtns">${lv < mx ? `<button class="sb primary" id="bUp" ${why ? 'disabled' : ''}>${ic('up')}升级 · ${ic('coin')}${c}</button>` : ''}${ups ? `<button class="sb ghost" id="bUndo">撤销本季升级</button>` : ''}</div>
    ${why && lv < mx ? `<div class="bwhy">${why}</div>` : ''}`);
  $('bInfo').classList.add('on');
  $('bInfo').querySelector('.bx').onclick = exitFocus;
  const up = $('bUp');
  if(up){ up.onclick = () => { if(upgradeBld(p.k, p.i)){ const g = p.groups()[0]; puff(p.pos.x, p.pos.z, p.ship ? 8 : 14); renderFocus(); } };
    up.onmouseenter = () => { if(up.disabled) return; renderForecast(v => { v.lv = JSON.parse(JSON.stringify(v.lv || {})); const arr = v.lv[p.k] = v.lv[p.k] || []; while(arr.length <= p.i) arr.push(1); arr[p.i] = lv + 1; v.money -= c; }, `如果把这座${b.name}升到 Lv ${lv + 1}`); };
    up.onmouseleave = () => renderForecast(); }
  const un = $('bUndo'); if(un) un.onclick = () => { undoUpgrade(p.k, p.i); renderFocus(); };
}
function updateHoverPick(){
  if(mode !== 'village' || zoom || unzoom || hotMark || !['plan', 'report', 'over'].includes(state) || $('village').classList.contains('modal')){ if(hoverPick){ hoverPick = null; $('bTag').classList.remove('on'); } return; }
  const p = underUI(mouseVX, mouseVY) ? null : pickBuilding(mouseVX, mouseVY);
  const key = p ? p.k + p.i + ':' + lvOf(V, p.k, p.i) : '';
  if(p !== hoverPick || key !== hoverT){ hoverPick = p; hoverT = key;
    if(p){ const b = BUILD.find(x => x.k === p.k); setGameHTML($('bTag'), `${b.name} · Lv ${lvOf(V, p.k, p.i)}<small>${focusOn === p ? '在左下角的卡片里升级' : '点击查看、升级'}</small>`); $('bTag').classList.add('on'); }
    else $('bTag').classList.remove('on'); }
  if(p){ const tag=$('bTag'); tag.style.transform=`translate(${Math.min(mouseVX+16,innerWidth-tag.offsetWidth-6)}px, ${Math.min(mouseVY+14,innerHeight-tag.offsetHeight-6)}px)`; }
  renderer.domElement.style.cursor = p ? 'pointer' : '';
}

// screen rectangles covered by the interface: world markers never show (or take the hover) underneath them
let uiRects = [], uiRectT = 0;
const UI_IDS = ['hud', 'vTop', 'vSide', 'vClock', 'vBottom', 'shorePanels', 'vEvent', 'vPrompt', 'vReport', 'montage', 'bInfo', 'sysBtn', 'coach', 'toast'];
function underUI(x, y){
  if(time - uiRectT > 0.25){ uiRectT = time; uiRects = [];
    for(const id of UI_IDS){ const el = $(id); if(!el) continue; const cs = getComputedStyle(el); if(cs.display === 'none' || +cs.opacity < 0.1 || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if(r.width > 0 && r.height > 0) uiRects.push([r.left - 12, r.top - 12, r.right + 12, r.bottom + 12]); } }
  for(const r of uiRects) if(x > r[0] && x < r[2] && y > r[1] && y < r[3]) return true;
  return false;
}
let pulseSet = null;
function updateMarks(){
  const canClick = ['plan', 'report', 'over'].includes(state) && !zoom && document.body.classList.contains('started') && !sysOpen;
  let best = null, bd = 46;
  for(const m of MARKS){
    m.vis = false;
    if(canClick){
      const p = pB.copy(m.pos()).project(camera);
      if(p.z < 1 && Math.abs(p.x) < 0.97 && Math.abs(p.y) < 0.97){
        m.sx = (p.x*0.5 + 0.5)*innerWidth; m.sy = (-p.y*0.5 + 0.5)*innerHeight;
        m.vis = !underUI(m.sx, m.sy) && !!portalVisibleAt(m.sx, m.sy);
      }
    }
    if(m.vis && !underUI(mouseVX, mouseVY)){ const d = Math.hypot(m.sx - mouseVX, m.sy - mouseVY); if(d < bd){ bd = d; best = m; } }
  }
  if(seaMk.hover) best = null; // pointing at an underwater-job pin: don't also light up a creature behind it
  hotMark = best;
  // first season hint: now and then a few creatures (at most 4, spread out, away from the job pins) flash their ring, so it's clear they can be clicked
  const pulse = V.season <= 1 && state === 'plan' && (time % 7) < 1.4;
  if(pulse && !pulseSet){ pulseSet = new Set(); const pins = seaMk.list.filter(it => it.ok);
    for(const m of MARKS.filter(m => m.vis).sort((a, b) => Math.hypot(a.sx - innerWidth/2, a.sy - innerHeight/2) - Math.hypot(b.sx - innerWidth/2, b.sy - innerHeight/2))){
      if(pulseSet.size >= 4) break;
      if(pins.some(it => Math.hypot(it.sx - m.sx, it.sy - m.sy) < 80)) continue;
      if([...pulseSet].some(q => Math.hypot(q.sx - m.sx, q.sy - m.sy) < 140)) continue;
      pulseSet.add(m); } }
  if(!pulse) pulseSet = null;
  for(const m of MARKS){ m.el.classList.toggle('on', m.vis && (m === best || (pulseSet && pulseSet.has(m)))); m.el.classList.toggle('hot', m === best);
    if(m.vis){ m.el.style.left = m.sx + 'px'; m.el.style.top = m.sy + 'px'; } }
  renderer.domElement.style.cursor = mode === 'village' ? (best ? 'pointer' : 'grab') : 'crosshair';
}
function diveInto(m, kind){
  if(zoom || mode !== 'village') return;
  if($('coach').classList.contains('on') && COACH[coachI]?.sel === '#vDive') showCoach(coachI + 1);
  const sp = pB.copy(m.pos()).project(camera);
  const hit = portalVisibleAt((sp.x*0.5 + 0.5)*innerWidth, (-sp.y*0.5 + 0.5)*innerHeight);
  const hp = hit ? hit.point.clone() : new THREE.Vector3(0, 0, 30);
  returnTo = state === 'report' ? 'report' : state === 'over' ? 'over' : 'plan';
  $('vReport').classList.remove('on'); $('ending').classList.remove('on'); $('vPrompt').classList.remove('on');
  $('village').classList.add('zooming');
  zoom = { t: 0, kind, mark: m, cam0: dioCam.position.clone(), tgt0: controls.target.clone(), hit: hp };
  controls.enabled = false; controls.autoRotate = false;
  if(kind === 'bay') queueBayPrograms();
}
function updateZoom(dt){
  zoom.t = Math.min(1, zoom.t + dt/2.2);
  const z = zoom, e = z.t*z.t*(3 - 2*z.t);
  const dir = pA.copy(z.cam0).sub(z.hit).normalize();
  dioCam.position.lerpVectors(z.cam0, pB.copy(z.hit).addScaledVector(dir, 0.35), e);
  dioCam.fov = lerp(26, 52, smooth(0.35, 1, z.t));
  applyDioOffset(1 - e);
  dioCam.lookAt(pA.lerpVectors(z.tgt0, z.hit, Math.min(1, e*1.4)));
  portalU.uFx.value = 1 - smooth(0.6, 1, z.t);
  if(z.t >= 1){ zoom = null; enterDiveSeamless(z); }
}
function syncPortalCamera(){
  toOcean(dioCam.position, camera.position); camera.quaternion.copy(dioCam.quaternion);
  camera.fov = dioCam.fov; camera.aspect = dioCam.aspect;
  if(dioCam.view && dioCam.view.enabled){ const v = dioCam.view; camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height); }
  else camera.clearViewOffset();
  const bmin = U.uBoxMin.value, bmax = U.uBoxMax.value, cp2 = camera.position;
  const dx = Math.max(bmin.x - cp2.x, 0, cp2.x - bmax.x), dy = Math.max(bmin.y - cp2.y, 0, cp2.y - bmax.y), dz = Math.max(bmin.z - cp2.z, 0, cp2.z - bmax.z);
  const boxDist = Math.hypot(dx, dy, dz);
  camera.near = clamp(boxDist*0.7, 0.3, 30); camera.far = boxDist + 700;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  sky.position.copy(camera.position);
}
toOcean(new THREE.Vector3(-49.85, -60, 0.9), U.uBoxMin.value); toOcean(new THREE.Vector3(49.85, 0, SEA_Z - 0.15), U.uBoxMax.value);
function enterDiveSeamless(z){
  savedDioCam = { pos: z.cam0, tgt: z.tgt0 };
  mode = 'dive'; controls.enabled = false; document.body.classList.remove('vmode');
  $('village').classList.remove('on', 'zooming'); $('keys').classList.add('on'); $('hud').classList.add('on');
  for(const m of MARKS) m.el.classList.remove('on', 'hot');
  portalU.uFx.value = 1;
  // the camera is now at the glass, inside the real ocean; the manta waits by the school you clicked
  const camAt = toOcean(dioCam.position, pA.clone()); camAt.y = Math.min(camAt.y, SURFACE - 0.8);
  const fwdC = new THREE.Vector3(0, 0, -1).applyQuaternion(dioCam.quaternion);
  camPos.copy(camAt); camLook.copy(camAt).addScaledVector(fwdC, 20);
  camera.fov = dioCam.fov;
  const S = z.mark.pos().clone();
  if(z.mark.av){
    // you become the animal you clicked, wherever it is right now
    const toS = pB.copy(S).sub(camAt); const yaw0 = Math.atan2(toS.x, toS.z);
    becomeAvatar(z.mark.av, false);
    if(avatar.kind === 'school'){ player.yaw = yaw0; player.speed = 3; }
  } else {
    becomeAvatar({ kind: 'manta' }, true);
    const toCam = pB.copy(camAt).sub(S); toCam.y = 0; toCam.normalize();
    player.pos.copy(S).addScaledVector(toCam, 13); player.pos.y = Math.max(S.y + 1.5, topAt(player.pos.x, player.pos.z) + 2.5);
    const f = pC.copy(S).sub(player.pos).normalize();
    player.yaw = Math.atan2(f.x, f.z); player.pitch = clamp(Math.asin(f.y), -0.4, 0.3); player.speed = 8.5;
  }
  player.yawV = player.pitchV = 0;
  const cp = Math.cos(player.pitch); player.fwd.set(Math.sin(player.yaw)*cp, Math.sin(player.pitch), Math.cos(player.yaw)*cp);
  $('avatarCard').classList.add('on'); showKeys();
  const want = Math.round(clamp(eco.ghost/0.25, 0, 4)); if(debris.filter(d => d.alive).length !== want) deployNets(want);
  if(z.kind === 'trawl'){ setState('diveTrawl'); cue(1.5, startTrawl); } else { setState('freedive'); startSeaDive(z.kind==='bay'); }
  if(z.kind === 'bay') startBayEncounter();
  diveIntroT = 0;
}
let wakeT = 0, diveIntroT = 99, camYawOff = 0, camPitch = -0.05, aimYaw = 0, swapT = 9;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

// ---- the ocean's look follows the ecosystem (and, from the shore, the diorama's clock)
function oceanLook(dt, fromShore){
  const fast = 0.6;
  murk = state === 'trawl' && !trawl.haul ? Math.min(1, murk + dt*0.22) : Math.max(0, murk - dt*0.035);
  vis.clar += (eco.clar*(1 - 0.42*murk) - vis.clar) * Math.min(1, dt*fast);
  H = vis.clar;
  let coralSum = 0;
  const pRate = state === 'trawl' ? 1.0 : fast*0.6;
  for(let i=0;i<13;i++){ const tg = clamp(eco.coral + patchVar[i]*(1 - eco.coral) - scar[i] - seaBleach[i], 0.02, 1);
    patchLife[i] += (tg - patchLife[i]) * Math.min(1, dt*pRate); coralSum += patchLife[i]; }
  patchLife[13] = coralSum / 13;
  U.uRise.value += (riseT - U.uRise.value) * Math.min(1, dt*2);
  if(fromShore) night = dioNight; else night += (nightT - night) * Math.min(1, dt*0.18);
  U.uNight.value = night;
  const e = 1 - Math.pow(1 - H, 1.6);
  U.uTime.value = time; U.uHealth.value = e;
  const ge = (a, b) => Math.exp(lerp(Math.log(a), Math.log(b), e));
  U.uAbs.value.set(ge(MED.dA[0], MED.aA[0]), ge(MED.dA[1], MED.aA[1]), ge(MED.dA[2], MED.aA[2]));
  U.uSca.value.set(ge(MED.dS[0], MED.aS[0]), ge(MED.dS[1], MED.aS[1]), ge(MED.dS[2], MED.aS[2]));
  { const bt = Math.max(V.mods && V.mods.bloom ? 1 : 0, clamp(((eco.nutr || 0) - 0.42)*2.0, 0, 0.35));
    bloomV += (bt - bloomV)*Math.min(1, dt*0.5);
    if(bloomV > 0.005){ const b = bloomV; U.uSca.value.x += b*0.028; U.uSca.value.y += b*0.008; U.uSca.value.z += b*0.0015; U.uAbs.value.y += b*0.012; U.uAbs.value.z += b*0.032; } }
  U.uSunCol.value.set(lerp(3.3, 0.2, night), lerp(3.15, 0.28, night), lerp(2.9, 0.5, night));
  if(fromShore) U.uSunCol.value.multiplyScalar(lerp(1, 0.42, wx.grey));
  finalPass.uniforms.uExposure.value = lerp(1.45, fromShore ? 0.82 : 0.68, e) * lerp(1, fromShore || state === 'ending' ? 2.8 : 2.0, night) * (fromShore ? 0.9*lerp(1, 0.78, wx.grey) : 1);
  volMat.uniforms.uVolGain.value = lerp(0.3, 1.25, e);
  bloom.strength = lerp(0.3, 0.5, e) + night*0.25;
  if(spawnU.uSpawn.value > 0) spawnU.uSpawn.value += dt;
  if(padGain) padGain.gain.value = 0.35 + e*0.65; // a sick sea sounds thinner
  setAudioScene(!fromShore);
  pulseT += dt; U.uPulse.value.w = pulseT*30; U.uPulseFade.value = Math.max(0, 1 - pulseT/3.6);
}
// ---- everything alive down there, whether or not you are
function simulateOcean(dt, ctrl){
  if(!bayWorld && (V.bay?.route || V.bay?.racks?.length || V.bay?.outpost)) bayWorld=createBayWorld();
  syncBayLandmarks();
  updateCreatures(dt); updateBenthos(dt); updatePelagic(dt);
  const t0 = performance.now();
  if(!noRespawn){
    const wantR = Math.round(clamp(eco.fish, 0.05, 1) * reg.n), wantB = Math.round(clamp(eco.bait, 0, 1) * bait.n);
    while(reg.active < wantR){ spawnFish(reg, reg.active, time > 1); reg.active++; }
    while(bait.active < wantB){ spawnFish(bait, bait.active, time > 1); bait.active++; }
    for(let k=0; k<25 && reg.active > wantR; k++) reg.active--;
    for(let k=0; k<25 && bait.active > wantB; k++) bait.active--;
  }
  bait.mesh.visible = true;
  updateSchools(time); updateFish(reg, dt); updateFish(bait, dt);
  perf.fishMs = lerp(perf.fishMs, performance.now() - t0, 0.1);
  updateSea(dt, ctrl);
  for(const d of debris){
    if(d.alive){
      d.g.position.y = d.y0 + Math.sin(time*0.7 + d.ph)*0.4; d.g.rotation.y += dt*0.1;
      d.orb.position.copy(d.g.position);
      d.beacon.rotation.y = Math.atan2(camera.position.x - d.pos.x, camera.position.z - d.pos.z);
      if(ctrl && d.pos.distanceTo(player.pos) < 5.5) cutNet(d);
    } else if(d.die > 0){
      d.die = Math.max(0, d.die - dt*1.4); d.g.scale.setScalar(d.die); d.g.position.y += dt*5; d.beacon.scale.set(d.die, 1, 1); d.orb.scale.setScalar(d.die);
      d.orb.position.copy(d.g.position);
      if(d.die === 0){ d.g.visible = false; d.beacon.visible = false; d.orb.visible = false; }
    }
  }
  if(whale.visible && !whaleCruise){
    whaleT += dt; const R = Math.max(46, 210 - whaleT*10), th = whaleTh + whaleT*0.055;
    whalePrev.copy(whale.position);
    whale.position.set(whaleC.x + Math.sin(th)*R, clamp(whaleC.y + 6 + Math.sin(whaleT*0.25)*4, 20, 33), whaleC.z + Math.cos(th)*R);
    if(whaleT > dt*2){ tmp.copy(whale.position).sub(whalePrev).add(whale.position); whale.lookAt(tmp); }
    fluke.rotation.x = Math.sin(whaleT*1.1)*0.3; whale.rotateX(Math.sin(whaleT*1.1 + 1)*0.04);
  }
  updateBursts(dt);
}
function placeOceanCamera(){
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  sky.position.copy(camera.position); surface.position.x = camera.position.x; surface.position.z = camera.position.z;
}

function updateDiveObservations(){
  let closest = 0, distance = Infinity;
  for(let i = 0; i < PATCHES.length; i++){
    const dx = player.pos.x - PATCHES[i].x, dz = player.pos.z - PATCHES[i].z;
    const squared = dx*dx + dz*dz;
    if(squared < distance){ closest = i; distance = squared; }
  }
  const reef = Math.round(patchLife[closest]*100) + '%';
  const fish = Math.round(100*(reg.active + bait.active)/(NR + NB)) + '%';
  if($('localReef').textContent !== reef) $('localReef').textContent = reef;
  if($('localFish').textContent !== fish) $('localFish').textContent = fish;
}
function frame(){
  const f0 = performance.now();
  const rawDt = forcedDt || clock.getDelta();
  if(paused && !worldNeedsRedraw){ perf.ms = 0; perf.fishMs = 0; return; }
  const dt = paused ? 0 : (forcedDt || Math.min(rawDt, 0.05)); time += dt; stateT += dt;
  storyUpdate(dt);
  setW('mCoral', eco.coral); setW('mFish', eco.fish); setW('mWater', eco.clar); setW('mPel', eco.pelagic ?? 1);

  if(mode === 'village'){
    updateDiorama(dt);
    if(zoom) updateZoom(dt); else if(unzoom) updateUnzoom(dt); else if(focusAnim) updateFocus(dt); else controls.update();
    if((window.__hpN = (window.__hpN || 0) + 1) % 3 === 0) updateHoverPick();
    if(mode === 'village'){
      oceanLook(dt, true);
      surface.visible = false; if(window.snowPts) snowPts.visible = false;
      U.uPortal.value = 1; volMat.uniforms.uVolGain.value = 0;
      syncPortalCamera();
      simulateOcean(dt, false);
      setShadowExtent(132); updateShadowCam(pB.set(0, 20, -87));
      composer.renderToScreen = false; renderFrame(true);
      portalU.tPortal.value = composer.readBuffer.texture;
      renderer.getDrawingBufferSize(drawSize); portalU.uRes.value.copy(drawSize);
      syncFleetInstances();
      renderer.setRenderTarget(null); renderer.render(dio, dioCam);
      updateMarks(); updateSeaMarks();
      worldNeedsRedraw = false;
      perf.ms = lerp(perf.ms, performance.now() - f0, 0.1);
      return;
    }
  }
  manta.visible = true; composer.renderToScreen = true; surface.visible = true; if(window.snowPts) snowPts.visible = true;
  U.uPortal.value = 0; camera.near = 0.3; camera.far = 900; camera.clearViewOffset(); setShadowExtent(62); diveIntroT += dt;
  for(const m of MARKS) if(m.vis){ m.vis = false; m.el.classList.remove('on', 'hot'); }
  oceanLook(dt, false);
  updateDiveObservations();
  if(baySession && state === 'freedive'){
    updateBayFrame(dt);
    worldNeedsRedraw = false;
    return;
  }
  updateBayInvite();

  // --- you, whatever you are right now: the mouse steers (left/right turns, up/down climbs and dives), W/S throttle, A/D also turn
  const ctrl = state !== 'intro' && state !== 'surfacing';
  window.__diving = ctrl;
  let ix = 0, iy = 0, th = 0, act = false;
  aimYaw -= lookDX*0.0034; camPitch = clamp(camPitch - lookDY*0.0028, -1.0, 0.9); lookDX = lookDY = 0; lookIdle += dt; swapT += dt;
  if(ctrl){
    aimYaw -= ((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0))*1.6*dt;
    const lead = avatar.kind === 'shark' ? 0.75 : avatar.kind === 'jelly' ? 0.9 : 1.1;
    aimYaw = player.yaw + clamp(wrapA(aimYaw - player.yaw), -lead, lead);
    ix = clamp(-wrapA(aimYaw - player.yaw)*2.4, -1, 1);
    th = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    act = keys.Space || keys.ShiftLeft;
    const wantPitch = avatar.kind === 'jelly' ? clamp(0.65 + camPitch*1.2, -0.4, 1.45) : clamp(camPitch*0.95, -0.95, 0.95);
    iy = clamp((wantPitch - player.pitch)*2.2, -1, 1);
  } else aimYaw = player.yaw;
  const pulse = act && !prevBoost; prevBoost = act;
  const rad = Math.hypot(player.pos.x/150, (player.pos.z - 70)/205);
  if(rad > 1){
    const want = Math.atan2(-player.pos.x, 70 - player.pos.z); let dy = want - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    aimYaw += wrapA(want - aimYaw)*Math.min(1, dt*1.5); ix = clamp(-wrapA(aimYaw - player.yaw)*2.4, -1, 1);
    if(ctrl && time - edgeWarned > 20){ edgeWarned = time; toast('开阔水域', '洋流把你带回礁区。', 3500); }
  }
  controlAvatar(dt, ix, iy, th, act, pulse);
  if(avatar.kind === 'turtle'){ const air = $('avatarCard').querySelector('.air'); air.querySelector('b').style.width = (player.air*100).toFixed(0) + '%'; air.classList.toggle('low', player.air < 0.25); }
  if(!(avatar.kind === 'school' && avatar.sc === sBait)){ const B = SCHOOLS[sBait], hx = B.x - player.pos.x, hz = B.z - player.pos.z, hd = Math.hypot(hx, hz) + 1e-3, R = B.ring + 10;
    if(hd < R && Math.abs(B.y0 - player.pos.y) < 14){ const push = (1 - hd/R) * 7.5 * dt; B.ox += hx/hd*push; B.oz += hz/hd*push; }
    if(!B.frozen){ B.ox *= 1 - dt*0.05; B.oz *= 1 - dt*0.05; } }

  // --- camera: orbits the animal by the mouse, stays behind it by default
  const [cd, ch] = avatar.info.cam;
  camYawOff = wrapA(aimYaw - player.yaw)*0.7;
  const yC = player.yaw + camYawOff, pC = (avatar.kind === 'jelly' ? camPitch*0.6 : camPitch*0.7 + player.pitch*0.3) - 0.22;
  const vdir = pA.set(Math.sin(yC)*Math.cos(pC), Math.sin(pC), Math.cos(yC)*Math.cos(pC));
  const focus = pB.copy(player.pos); focus.y += ch*0.35;
  // stay in the water: over the shallows or the beach, come in closer rather than rise out through the surface
  // stay in the water: over the shallows or the beach, swing round toward deeper water, and only then come in closer
  const back0 = cd + player.speed*0.12, wet = () => topAt(tmp.x, tmp.z) + 2.2 < SURFACE - 0.8;
  tmp.copy(focus).addScaledVector(vdir, -back0);
  if(!wet()){ let ok = false;
    for(const dy of [0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0]){ const y2 = yC + dy;
      tmp.set(focus.x - Math.sin(y2)*Math.cos(pC)*back0, focus.y - Math.sin(pC)*back0, focus.z - Math.cos(y2)*Math.cos(pC)*back0); if(wet()){ ok = true; break; } }
    for(let back = back0*0.8; !ok && back > 3; back *= 0.8){ tmp.copy(focus).addScaledVector(vdir, -back); ok = wet(); } }
  tmp.y = Math.min(Math.max(tmp.y, topAt(tmp.x, tmp.z) + 1.2), SURFACE - 0.8);
  const glide = swapT < 1.4 ? 1.4 + swapT*3.4 : 6;
  camPos.lerp(tmp, 1 - Math.exp(-dt*(diveIntroT < 2.5 ? 1.2 + diveIntroT : glide)));
  tmp2.copy(focus).sub(tmp).normalize().multiplyScalar(8).add(focus);   // look past the animal from wherever the camera ended up (the same as vdir unless it swung away from the shore)
  camLook.lerp(tmp2, 1 - Math.exp(-dt*(diveIntroT < 2.5 ? 1.0 + diveIntroT : glide*1.3)));
  camPos.y = Math.min(Math.max(camPos.y, topAt(camPos.x, camPos.z) + 0.6), SURFACE - 0.8);   // the eased camera can cut a corner: never out of the water or into the sand
  camera.position.copy(camPos); camera.lookAt(camLook);
  camera.fov += ((60 + (player.speed - 8.5)*1.1*(avatar.kind === 'school' ? 0.5 : 1)) - camera.fov) * Math.min(1, dt*3);
  if(window.__camOv){ camera.position.copy(window.__camOv.p); camera.lookAt(window.__camOv.t); }   // debug: frame a shot by hand
  placeOceanCamera();

  simulateOcean(dt, ctrl);
  if(night > 0.35 && ctrl && player.speed > 2.5){ wakeT -= dt; if(wakeT < 0){ wakeT = 0.05; emit(tmp.copy(player.pos).addScaledVector(player.fwd, -1.4).add(pA.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(1.6)), 3, 1.1, -1.1, 0.45*night); } }   // stirred plankton glows in your wake

  // --- where to go next
  let tgt = null, tgtName = '', poi = false;
  if(state === 'explore'){ let best = 1e9; poi = true;
    for(const p of POIS){ if(p.found) continue; const q = p.pos(), d = q.distanceTo(player.pos); if(d < best){ best = d; tgt = tmp3.copy(q); tgtName = p.name; } } }
  else if(state === 'trawl' && !trawl.haul && !(avatar.kind === 'school' && avatar.sc === sBait)){ const B = SCHOOLS[sBait]; tgt = tmp3.set(B.x, B.y0, B.z); tgtName = '鱼群'; }
  else if(state === 'freedive'){ const T = seaTarget(); if(T){ tgt = tmp3.copy(T.pos); tgtName = T.name; } }
  const ptr = $('ptr');
  if(ctrl && tgt){
    const nd = tgt.distanceTo(player.pos);
    tmp.copy(tgt).project(camera);
    camera.getWorldDirection(camDir);
    const behind = tmp2.copy(tgt).sub(camera.position).dot(camDir) < 0;
    const on = !behind && Math.abs(tmp.x) < 0.9 && Math.abs(tmp.y) < 0.86;
    let sx = tmp.x, sy = tmp.y;
    if(!on){ if(behind){ sx = -sx; sy = -sy; } const l = Math.hypot(sx, sy) || 1; sx = sx/l*0.82; sy = sy/l*0.78; }
    ptr.style.transform = `translate(${(sx*0.5 + 0.5)*innerWidth}px, ${(-sy*0.5 + 0.5)*innerHeight}px)`;
    $('ptrArrow').style.display = on ? 'none' : 'block'; $('ptrRing').style.display = on ? 'block' : 'none';
    $('ptrArrow').style.transform = `rotate(${Math.atan2(sx*innerWidth, sy*innerHeight)}rad)`;
    $('ptrDist').textContent = gameText(`${tgtName} · ${Math.round(nd)} m`);
    ptr.classList.toggle('poi', poi); ptr.classList.add('on');
  } else ptr.classList.remove('on');

  renderer.domElement.style.cursor = 'crosshair';
  if(rising) updateRising(dt); else updateSwap();
  tmp.copy(player.pos).addScaledVector(camDir.set(player.fwd.x, 0, player.fwd.z).normalize(), 22);
  updateShadowCam(tmp);
  renderFrame(false);
  worldNeedsRedraw = false;
  perf.ms = lerp(perf.ms, performance.now() - f0, 0.1);
}
showVillageBackdrop();
if(params.get('auto') || params.get('village')) start();
// Queue the reef and island shaders together before the first draw asks the driver for each program.
renderer.setRenderTarget(sceneRT);
renderer.compile(scene, camera);
renderer.setRenderTarget(null);
renderer.compile(dio, dioCam);
renderer.setAnimationLoop(frame);
