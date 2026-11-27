'use strict';
// ======================================================================= creatures you can become
// Each one moves the way the real animal does. Whoever you are not, carries on with its own life.
const SPECIES_INFO = {
  manta:  { name: '蝠鲼', bio: '胸鳍像翅膀一样上下扇动，大部分时间都在滑翔。', keys: 'W/S 加速减速 · A/D 转向 · 往哪看就往哪游 · 空格：用力扇动冲刺', cam: [11, 5.2], floor: 2.4 },
  shark:  { name: '黑鳍礁鲨', bio: '没有鱼鳔，一停下就会往下沉，所以一刻不停地游。别的鱼都会躲开你。', keys: 'W/S 加速减速，但慢不下来 · A/D 转向 · 空格：冲刺', cam: [14, 4.6], floor: 2.0 },
  jelly:  { name: '海月水母', bio: '没有大脑，也几乎不会游泳。伞一收一放喷出水流，其余时间随水漂。', keys: 'W 或空格：收缩喷水 · S：放松下沉 · A/D 转向 · 看哪儿伞就往哪儿倾', cam: [10, 1.8], floor: 2.5 },
  turtle: { name: '绿海龟', bio: '用前鳍划水，像在水里飞。它用肺呼吸，隔一阵就得浮上水面换气。', keys: 'W/S 加速减速 · A/D 转向 · 空格：用力划水 · 往上看游到水面换气', cam: [10, 3.6], floor: 2.2 },
  school: { name: '鱼群', bio: '没有领头的鱼，每条鱼只看身边的几条。停下时聚成一团，游起来拉成长队。', keys: 'W/S 加速减速，减到最慢会原地盘旋 · A/D 转向 · 空格：受惊急转冲刺', cam: [19, 6.5], floor: 3.0 },
};
const UPV = new THREE.Vector3(0, 1, 0);
function mkState(pos, yaw){ return { pos: pos.clone(), yaw, pitch: 0, roll: 0, speed: 5, fwd: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
  yawV: 0, pitchV: 0, flap: 0, v: new THREE.Vector3(), air: 1, idle: 0, burst: -1, axis: new THREE.Vector3(0, 1, 0), cool: 0, pulseT: 9, ang: 0 }; }

// ---- blacktip reef shark: fusiform body, side-to-side tail beat that grows toward the tail, heterocercal caudal fin
const shark = new THREE.Group(); scene.add(shark);
const sharkU = { uSwim: { value: 0 }, uAmp: { value: 0.3 } };
{
  const sharkMat = mat({ side: THREE.DoubleSide, uniforms: sharkU,
    vertexShader: /* glsl */`
    uniform float uSwim; uniform float uAmp; varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){
      vec3 p = position; vL = position;
      float k = smoothstep(1.5, -5.5, p.z);
      p.x += sin(uSwim - p.z*0.75) * uAmp * k * k * 2.2;
      vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
    fragmentShader: COMMON + /* glsl */`
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){
      vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
      float r = max(length(vL.xy), 0.001);
      float belly = smoothstep(0.15, -0.55, vL.y / max(r, 0.6));
      vec3 alb = mix(vec3(0.42, 0.44, 0.43), vec3(0.88, 0.88, 0.86), belly);
      float tips = max(max(smoothstep(1.85, 2.2, vL.y), smoothstep(2.2, 2.6, abs(vL.x))), max(smoothstep(-5.4, -5.9, vL.z)*step(0.4, vL.y), smoothstep(-0.75, -1.05, vL.y)*step(vL.z, -4.9)));
      alb = mix(alb, vec3(0.05), tips);
      alb = mix(alb, vec3(0.02), smoothstep(0.11, 0.07, length(vec2(abs(vL.x) - 0.42, vL.y - 0.18) + vec2(0.0, 0.0)) ) * smoothstep(3.0, 3.25, vL.z) * smoothstep(3.6, 3.35, vL.z));
      vec3 col = shade(alb, n, vW, 1.0);
      vec3 vd = normalize(cameraPosition - vW);
      col += sunAt(vW.y) * pow(max(dot(reflect(-vd, n), uSunDir), 0.0), 24.0) * 0.35;
      gl_FragColor = vec4(fogged(col, vW), 1.0);
    }` });
  const prof = [[0, -4.6], [0.12, -4.4], [0.2, -4.0], [0.42, -2.8], [0.78, -1.2], [0.98, 0.3], [1.0, 1.2], [0.86, 2.4], [0.6, 3.3], [0.3, 4.1], [0.08, 4.6], [0, 4.7]].map(a => new THREE.Vector2(a[0], a[1]));
  const body = new THREE.LatheGeometry(prof, 26).rotateX(Math.PI/2).scale(0.82, 0.92, 1);
  const tri = pts => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.computeVertexNormals(); return g; };
  const parts = [body,
    tri([[0, 0.8, 1.2], [0, 2.3, -0.5], [0, 0.85, -0.9]]),                                     // first dorsal
    tri([[0, 0.35, -2.6], [0, 0.85, -3.1], [0, 0.3, -3.2]]),                                    // second dorsal
    tri([[0.6, -0.45, 1.8], [2.45, -1.1, -0.5], [0.65, -0.5, 0.5]]), tri([[-0.6, -0.45, 1.8], [-2.45, -1.1, -0.5], [-0.65, -0.5, 0.5]]),   // pectorals
    tri([[0.3, -0.5, -1.6], [0.8, -0.9, -2.3], [0.25, -0.45, -2.3]]), tri([[-0.3, -0.5, -1.6], [-0.8, -0.9, -2.3], [-0.25, -0.45, -2.3]]),   // pelvics
    tri([[0, 0.22, -4.3], [0, 2.0, -5.95], [0, 0.12, -5.0]]), tri([[0, -0.18, -4.3], [0, 0.12, -5.0], [0, -1.05, -5.35]]), tri([[0, 0.22, -4.3], [0, 0.12, -5.0], [0, -0.18, -4.3]]),   // caudal
  ];
  for(const g of parts){ const m = new THREE.Mesh(g, sharkMat); m.frustumCulled = false; shark.add(m); caster(m); }
  shark.scale.setScalar(1.15);
}

// ---- a moon jelly you can become: jet propulsion by bell contraction, four purple gonad rings
const heroJelly = new THREE.Group(); scene.add(heroJelly);
const heroJellyU = { uC: { value: 0 } };
{
  const parts = [new THREE.SphereGeometry(1, 32, 12, 0, Math.PI*2, 0, Math.PI/2).scale(1, 0.55, 1)];
  for(let i=0;i<24;i++){ const a = i/24*Math.PI*2; const r = new THREE.PlaneGeometry(0.03, 2.6, 1, 14).translate(0, -1.3, 0);
    r.rotateY(a); r.translate(Math.cos(a)*0.97, 0, Math.sin(a)*0.97); parts.push(r); }
  for(let i=0;i<4;i++){ const a = i/4*Math.PI*2 + 0.4; const r = new THREE.PlaneGeometry(0.28, 1.6, 1, 10).translate(0, -0.8, 0);
    r.rotateY(a); r.translate(Math.cos(a)*0.12, 0, Math.sin(a)*0.12); parts.push(r); }
  const m = new THREE.Mesh(mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)), mat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: heroJellyU,
    vertexShader: /* glsl */`
    uniform float uC; uniform float uTime; varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){
      vec3 p = position; vL = position;
      if(p.y >= -0.001){ p.xz *= 1.0 - 0.3*uC*(1.0 - p.y*0.8); p.y *= 1.0 + 0.25*uC; }
      else { float d = -p.y; p.xz *= 1.0 - 0.22*uC; p.x += sin(uTime*1.3 + d*1.8 + p.z*3.0)*0.14*d; p.z += cos(uTime*1.1 + d*1.6 + p.x*3.0)*0.14*d; p.y -= uC*0.2*d; }
      vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
    fragmentShader: COMMON + /* glsl */`
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){
      clipPortal(vW);
      vec3 vd = cameraPosition - vW; float d = length(vd); vd /= d;
      float fr = 1.0 - abs(dot(normalize(vN), vd));
      vec3 c = vec3(0.75, 0.82, 0.95); float a;
      if(vL.y >= -0.001){
        float ang = atan(vL.z, vL.x), rr = length(vL.xz);
        float gon = smoothstep(0.09, 0.0, abs(length(vec2(rr - 0.38, (fract(ang/1.5708) - 0.5)*0.55)) - 0.14));
        a = 0.05 + pow(fr, 2.2)*0.9 + 0.05*(0.5 + 0.5*sin(ang*32.0));
        c = mix(c, vec3(0.75, 0.45, 1.0), gon); a += gon*0.7;
      } else { a = 0.32*(1.0 + vL.y/2.6); c = vec3(0.9, 0.8, 1.0); }
      vec3 lit = sunAt(vW.y)*0.28 + 0.12;
      gl_FragColor = vec4(c * lit * a * transmit(waterPath(vW)), 1.0);
    }`,
  }));
  m.frustumCulled = false; heroJelly.add(m); heroJelly.scale.setScalar(2.1);
}

const ENT = {
  manta: { st: player },
  shark: { st: mkState(new THREE.Vector3(-50, 15, -70), 1.2) },
  jelly: { st: mkState(new THREE.Vector3(22, 26, -95), 0) },
  turtle: { st: mkState(new THREE.Vector3(TURTLE_HOME.x + 15, 12, TURTLE_HOME.z), 0) },
};
ENT.jelly.st.pitch = 1.2; ENT.jelly.st.cool = 1;
let avatar = { kind: 'manta', st: player, info: SPECIES_INFO.manta };
const PRED = [];

function steer(st, dt, ix, iy, turn, pitch, resp){
  st.yawV += (ix*turn - st.yawV)*Math.min(1, dt*resp);
  st.pitchV += (iy*pitch - st.pitchV)*Math.min(1, dt*resp);
  st.yaw -= st.yawV*dt; st.pitch = clamp(st.pitch + st.pitchV*dt, -1.0, 1.0);
}
function advance(st, dt){ const cp = Math.cos(st.pitch); st.fwd.set(Math.sin(st.yaw)*cp, Math.sin(st.pitch), Math.cos(st.yaw)*cp); st.pos.addScaledVector(st.fwd, st.speed*dt); }
function seek(st, tx, ty, tz, dt, turn, speed){
  const dx = tx - st.pos.x, dy = ty - st.pos.y, dz = tz - st.pos.z;
  const d = Math.atan2(Math.sin(Math.atan2(dx, dz) - st.yaw), Math.cos(Math.atan2(dx, dz) - st.yaw));
  const yr = clamp(d*1.2, -turn, turn); st.yaw += yr*dt; st.yawV = -yr;
  st.pitch += (clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.45, 0.45) - st.pitch)*Math.min(1, dt*1.2);
  st.speed += (speed - st.speed)*Math.min(1, dt*0.8);
  advance(st, dt);
}
function jellyPulse(st){ st.v.addScaledVector(st.axis, 5.2); st.pulseT = 0; }
function jellyPhysics(st, dt){
  const cp = Math.cos(st.pitch); st.axis.set(Math.sin(st.yaw)*cp, Math.sin(st.pitch), Math.cos(st.yaw)*cp);
  st.v.multiplyScalar(Math.exp(-dt*1.35));
  st.v.y -= 0.3*dt;                                      // almost neutrally buoyant, drifts slowly down between pulses
  st.v.x += Math.sin(time*0.11)*0.12*dt; st.v.z += Math.cos(time*0.09)*0.12*dt;   // carried by the current
  st.pos.addScaledVector(st.v, dt); st.speed = st.v.length();
  st.fwd.copy(st.axis);
}
const pulseCurve = t => t < 0.22 ? Math.sin(t/0.22*Math.PI/2) : Math.max(0, 1 - (t - 0.22)/0.7);
function keepIn(st, info){
  const fy = topAt(st.pos.x, st.pos.z) + info.floor;
  if(st.pos.y < fy){ st.pos.y = lerp(st.pos.y, fy, 0.25); if(st.pitch < 0) st.pitch *= 0.9; if(st.v) st.v.y = Math.max(st.v.y, 0); }
  if(st.pos.y > SURFACE - 2.5){ st.pos.y = SURFACE - 2.5; if(st.pitch > 0 && avatarKindOf(st) !== 'jelly') st.pitch *= 0.85; if(st.v) st.v.y = Math.min(st.v.y, 0); }
}
const avatarKindOf = st => st === ENT.jelly.st ? 'jelly' : '';

// ---- you
let prevBoost = false;
// throttle: W raises the target speed, S lowers it, and it stays where you leave it
const SPEED = { manta: [3, 19, 9, 8.5], shark: [4.2, 17, 6, 7.5], turtle: [0.6, 8.5, 4, 4], school: [0.5, 9, 8, 4] };
function throttle(st, k, th, dt){
  const [lo, hi, acc, start] = SPEED[k];
  if(st.tgt === undefined || st.tgtKind !== k){ st.tgt = clamp(st.speed || start, lo, hi); st.tgtKind = k; }
  st.tgt = clamp(st.tgt + th*acc*dt, lo, hi);
  return st.tgt;
}
function controlAvatar(dt, ix, iy, th, act, pulse){
  const st = player, k = avatar.kind;
  if(k === 'manta'){
    steer(st, dt, ix, iy, 1.25, 1.0, 3.5);
    const tg = act ? 19 : throttle(st, k, th, dt);
    st.speed += (tg - st.speed)*Math.min(1, dt*2); advance(st, dt);
    st.roll += (st.yawV*0.55 - st.roll)*Math.min(1, dt*4);
    if(act && rng() < 0.5){ tmp.copy(st.pos).addScaledVector(st.fwd, -3); emit(tmp, 1, 1.2, 1.5, 0.5); }
  } else if(k === 'shark'){
    steer(st, dt, ix, iy, 0.8, 0.55, 2.0);
    const tg = act ? 17 : throttle(st, k, th, dt);
    st.speed += (tg - st.speed)*Math.min(1, dt*(act ? 1.6 : 0.8)); st.speed = Math.max(st.speed, 4.2);
    advance(st, dt); st.pos.y -= (1 - clamp(st.speed/8, 0, 1))*1.1*dt;
    st.roll += (st.yawV*0.4 - st.roll)*Math.min(1, dt*3);
  } else if(k === 'turtle'){
    steer(st, dt, ix, iy, 1.0, 0.8, 2.5);
    const low = st.air < 0.15, tg = low ? Math.min(2.2, throttle(st, k, th, dt)) : act ? 8.5 : throttle(st, k, th, dt);
    st.speed += (tg - st.speed)*Math.min(1, dt*(act ? 1.4 : 0.8)); advance(st, dt);
    st.roll += (st.yawV*0.4 - st.roll)*Math.min(1, dt*3);
    if(st.pos.y > SURFACE - 4.6){ if(st.air < 0.9 && !st.breathing){ st.breathing = true; toast('换气', '海龟在水面换了一口气。', 2500); emit(st.pos, 30, 2, 2, 0.8); } st.air = Math.min(1, st.air + dt/2.5); }
    else { st.breathing = false; st.air = Math.max(0, st.air - dt/55); }
  } else if(k === 'school'){
    steer(st, dt, ix, iy, 2.4, 1.4, 6);
    if(pulse && st.burst < -0.6) st.burst = 0.55; st.burst -= dt;
    const tg = st.burst > 0 ? 17 : throttle(st, k, th, dt);
    st.speed += (tg - st.speed)*Math.min(1, dt*(st.burst > 0 ? 7 : 1.8)); advance(st, dt);
    st.roll *= 0.9;
    const S = SCHOOLS[avatar.sc]; if(S.kind === 'bait') S.ring = st.speed < 2.6 ? 5.5 : 0;
  } else if(k === 'jelly'){
    // W (or Space) keeps the bell pulsing; S lets it relax and sink; the bell tilts toward where you look
    st.yaw -= ix*0.8*dt; st.pitch = clamp(st.pitch + iy*0.7*dt, -0.4, 1.45);
    st.cool -= dt; if((th > 0 || act) && st.cool <= 0){ jellyPulse(st); st.cool = 0.6; }
    if(th < 0) st.v.y -= 0.6*dt;
    jellyPhysics(st, dt);
  }
  keepIn(st, avatar.info);
}
// ---- everyone else
function updateCreatures(dt){
  const ctl = mode === 'dive' ? avatar.kind : null;
  const m = ENT.manta.st, sh = ENT.shark.st, je = ENT.jelly.st, tu = ENT.turtle.st;
  if(ctl !== 'manta'){ const a = time*0.05; seek(m, Math.cos(a)*55, 18 + Math.sin(time*0.2)*4, Math.sin(a)*40 - 45, dt, 0.5, 6.5); m.roll += (m.yawV*0.55 - m.roll)*Math.min(1, dt*2); keepIn(m, SPECIES_INFO.manta); }
  if(ctl !== 'shark'){ const a = -time*0.04 + 1.3; seek(sh, Math.cos(a)*80, 13 + Math.sin(time*0.3)*3, Math.sin(a)*55 - 60, dt, 0.45, 6.5); sh.roll += (sh.yawV*0.4 - sh.roll)*Math.min(1, dt*2); keepIn(sh, SPECIES_INFO.shark); }
  if(ctl !== 'turtle'){ tu.ang += dt*0.045;
    const shift = ['boats','tide','outfall'].includes(V.bay?.station) ? 5 : 0;
    const x = TURTLE_HOME.x + shift + Math.cos(tu.ang)*15, z = TURTLE_HOME.z + Math.sin(tu.ang)*15;
    seek(tu, x, Math.max(topAt(x, z) + 4.2, 9) + Math.sin(time*0.4)*0.7, z, dt, 0.9, 3.4); keepIn(tu, SPECIES_INFO.turtle); tu.air = 1; }
  if(ctl !== 'jelly'){ je.cool -= dt; if(je.cool < 0){ je.cool = 1.4 + rng()*0.9; jellyPulse(je); }
    je.yaw += Math.sin(time*0.17)*0.15*dt; je.pitch = lerp(je.pitch, je.pos.y > SURFACE - 8 ? -0.2 : 1.15, dt*0.4);
    const r = Math.hypot(je.pos.x, je.pos.z + 80); if(r > 40){ je.yaw = lerp(je.yaw, Math.atan2(-je.pos.x, -80 - je.pos.z), dt*0.3); }
    jellyPhysics(je, dt); keepIn(je, SPECIES_INFO.jelly); }
  // meshes follow their animals
  manta.position.copy(m.pos); manta.rotation.set(-m.pitch, m.yaw, m.roll, 'YXZ');
  m.flap += dt*(1.9 + m.speed*0.19); mantaU.uFlap.value = m.flap; mantaU.uAmp.value = 0.34 + m.speed*0.011;
  shark.position.copy(sh.pos); shark.rotation.set(-sh.pitch, sh.yaw, sh.roll, 'YXZ');
  sh.flap += dt*(2.0 + sh.speed*0.55); sharkU.uSwim.value = sh.flap; sharkU.uAmp.value = 0.1 + sh.speed*0.02;
  heroJelly.position.copy(je.pos); heroJelly.quaternion.setFromUnitVectors(UPV, je.axis); je.pulseT += dt; heroJellyU.uC.value = pulseCurve(je.pulseT);
  turtle.position.copy(tu.pos); turtle.rotation.set(-tu.pitch, tu.yaw, tu.roll, 'YXZ');
  tu.flap += dt*(1.0 + tu.speed*0.4);
  for(const f of turtleFlip){ const s = Math.sin(tu.flap + (f.front ? 0 : 1.2));
    f.pivot.rotation.z = f.side * s * (f.front ? 0.6 : 0.25); f.pivot.rotation.y = f.side * (f.front ? 0.3 + s*0.25 : -0.3); }
  // who the fish are afraid of
  PRED.length = 0;
  if(mode === 'dive' && avatar.kind === 'school') PRED.push({ x: 0, y: -999, z: 0, r: 0, k: 0, sc: avatar.sc });
  else PRED.push({ x: m.pos.x, y: m.pos.y, z: m.pos.z, r: 6.5, k: 7, sc: -1 });
  PRED.push({ x: sh.pos.x, y: sh.pos.y, z: sh.pos.z, r: 14, k: 10, sc: -1 });
  PRED.push({ x: tu.pos.x, y: tu.pos.y, z: tu.pos.z, r: 4.5, k: 6, sc: -1 });
  { const H = SCHOOLS[sHunt]; if(H.attack) PRED.push({ x: H.x, y: H.y0, z: H.z, r: 6.5, k: 9, sc: sHunt }); }
  if(mode === 'dive' && avatar.kind === 'jelly') PRED.push({ x: je.pos.x, y: je.pos.y, z: je.pos.z, r: 3.5, k: 5, sc: -1 });
}
function setAvatarCard(){
  const i = avatar.info;
  $('avatarCard').querySelector('.an').textContent = gameText(i.name); $('avatarCard').querySelector('.ab').textContent = gameText(i.bio); $('avatarCard').querySelector('.ak').textContent = gameText(i.keys);
  $('avatarCard').querySelector('.air').style.display = avatar.kind === 'turtle' ? 'block' : 'none';
}
function releaseSchool(){
  if(avatar.kind !== 'school') return;
  const S = SCHOOLS[avatar.sc]; S.ctrl = false;
  if(S.kind === 'bait'){ S.frozen = true; S.bx = S.x; S.bz = S.z; S.ox = S.oz = 0; S.ring = 5.5; }
  else if(S.kind === 'roam' || S.kind === 'hunt'){ S.cx = S.x - Math.cos(time*S.f + S.ph)*S.r; S.cz = S.z - Math.sin(time*S.f*1.3 + S.ph)*S.r; S.y = S.y0; }
  else if(S.cx !== undefined){ S.cx = S.x; S.cz = S.z; S.y = S.y0; }
}
function becomeAvatar(av, silent){
  releaseSchool();
  if(av.kind === 'school'){
    const S = SCHOOLS[av.sc]; S.ctrl = true;
    // start where the fish actually are, not where their roaming anchor happens to be
    const c = new THREE.Vector3(); let n = 0;
    for(const pool of [reg, bait]) for(let k=0;k<pool.active;k++) if(pool.sc[k] === av.sc){ c.x += pool.p[k*3]; c.y += pool.p[k*3+1]; c.z += pool.p[k*3+2]; n++; }
    if(n) c.divideScalar(n); else c.set(S.x, S.y0, S.z);
    const st = mkState(c, player.yaw); st.speed = 3;
    avatar = { kind: 'school', sc: av.sc, st, info: { ...SPECIES_INFO.school, name: av.name || '鱼群' } };
  } else avatar = { kind: av.kind, st: ENT[av.kind].st, info: SPECIES_INFO[av.kind] };
  player = avatar.st; player.yawV = player.pitchV = 0; camYawOff = 0; aimYaw = player.yaw; swapT = 0;
  camPitch = avatar.kind === 'jelly' ? clamp((player.pitch - 0.65)/1.2, -0.9, 0.6) : clamp(player.pitch, -0.45, 0.45);
  setAvatarCard();
  if(!silent) toast(avatar.info.name, avatar.info.bio, 6000);
}
// what you could become next: whatever you are looking at, close enough
function swapCandidates(){
  const list = [];
  for(const k of ['manta', 'shark', 'jelly', 'turtle']) if(avatar.kind !== k) list.push({ av: { kind: k }, name: SPECIES_INFO[k].name, pos: ENT[k].st.pos });
  SCHOOLS.forEach((S, i) => { if((S.kind === 'bait' || ['roam', 'hunt', 'hover', 'graze'].includes(S.kind)) && !(avatar.kind === 'school' && avatar.sc === i)){
    const name = S.kind === 'bait' ? '沙丁鱼群' : SPECIES_NAME[S.species] + '群';
    list.push({ av: { kind: 'school', sc: i, name }, name, pos: new THREE.Vector3(S.x, S.y0, S.z) }); } });
  return list;
}
let swapCand = null;
function updateSwap(){
  swapCand = null;
  if(mode !== 'dive' || !['freedive', 'trawl', 'diveTrawl', 'aftermath', 'ending'].includes(state)){ $('swap').classList.remove('on'); return; }
  camera.getWorldDirection(camDir);
  let best = 0.93;
  for(const c of swapCandidates()){
    const d = tmp.copy(c.pos).sub(camera.position), dist = d.length(); if(dist > 60 || dist < 3) continue;
    const dot = d.divideScalar(dist).dot(camDir); if(dot > best){ best = dot; swapCand = c; }
  }
  if(swapCand){
    const p = tmp.copy(swapCand.pos).project(camera);
    $('swap').style.transform = `translate(${(p.x*0.5 + 0.5)*innerWidth + 26}px, ${(-p.y*0.5 + 0.5)*innerHeight - 8}px)`;
    $('swap').querySelector('span').textContent = gameText(`化身为 ${swapCand.name}`); $('swap').classList.add('on');
  } else $('swap').classList.remove('on');
}
addEventListener('keydown', e => { if(e.code === 'KeyF' && mode === 'dive' && !baySession && swapCand){ becomeAvatar(swapCand.av); } });
setAvatarCard();

// ======================================================================= coral spawning (good ending)
const spawnU = { uSpawn: { value: 0 } };
{
  const N = LOW ? 5000 : 14000, pos = new Float32Array(N*3), rr = new Float32Array(N*2);
  for(let i=0;i<N;i++){ const P = PATCHES[(rng()*13)|0], b = P.bommies[(rng()*P.bommies.length)|0]; const a = rng()*6.283, r = Math.sqrt(rng())*0.9;
    const x = b.x + Math.cos(a)*r*b.rx, z = b.z + Math.sin(a)*r*b.rx; pos.set([x, bommieY(b, x, z) + 0.3, z], i*3); rr.set([rng(), rng()], i*2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.BufferAttribute(rr, 2));
  const pts = new THREE.Points(g, mat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: spawnU,
    vertexShader: /* glsl */`
    attribute vec2 aR; uniform float uSpawn; varying float vA; varying float vD; varying float vC;
    void main(){
      float t = uSpawn - aR.x * 10.0; vC = aR.y;
      float on = step(0.0001, uSpawn) * step(0.0, t);
      float tt = max(t, 0.0), w = min(tt, 4.0) * 0.25;
      vec3 p = position + vec3(sin(tt*0.6 + aR.y*40.0)*w, tt*(0.45 + aR.y*0.5), cos(tt*0.5 + aR.y*31.0)*w);
      vec4 mv = viewMatrix * vec4(p, 1.0); vD = -mv.z;
      vA = on * smoothstep(0.0, 1.5, tt) * smoothstep(41.0, 30.0, p.y);
      gl_PointSize = on * min((200.0 + 140.0 * aR.y) / max(vD, 1.0), 26.0);
      gl_Position = projectionMatrix * mv;
    }`,
    fragmentShader: COMMON + /* glsl */`
    varying float vA; varying float vD; varying float vC;
    void main(){
      float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r);
      vec3 c = mix(vec3(1.0, 0.42, 0.55), vec3(1.0, 0.82, 0.45), vC);
      gl_FragColor = vec4(c * (a * a + smoothstep(0.5, 0.2, r) * 0.25) * vA * 3.2 * transmit(vD), 1.0);
    }`,
  }));
  pts.frustumCulled = false; scene.add(pts);
}

// ======================================================================= sparkle bursts + bubbles
const BN = 800, bpos = new Float32Array(BN*3), bvel = new Float32Array(BN*3), blife = new Float32Array(BN); let bnext = 0;
const burstGeo = new THREE.BufferGeometry();
burstGeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3).setUsage(THREE.DynamicDrawUsage));
burstGeo.setAttribute('aLife', new THREE.BufferAttribute(blife, 1).setUsage(THREE.DynamicDrawUsage));
{
  const pts = new THREE.Points(burstGeo, mat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aLife; varying float vA; void main(){ vec4 mv = viewMatrix * vec4(position,1.0); vA = aLife; gl_PointSize = (0.3 + aLife) * 150.0 / max(-mv.z, 1.0) * step(0.001, aLife); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); float ring = smoothstep(0.5, 0.4, r) * smoothstep(0.25, 0.42, r);
      gl_FragColor = vec4(vec3(0.5, 1.0, 0.95) * (a * a + ring * 0.6) * vA * 1.8, 1.0); }`,
  }));
  pts.frustumCulled = false; scene.add(pts);
}
function emit(p, n, speed, up = 0, life = 1){
  for(let k=0;k<n;k++){ const i = bnext = (bnext + 1) % BN; const a = rng()*6.283, b = Math.acos(rng()*2 - 1), s = speed*(0.3 + rng());
    bpos.set([p.x, p.y, p.z], i*3); bvel.set([Math.sin(b)*Math.cos(a)*s, Math.cos(b)*s + up, Math.sin(b)*Math.sin(a)*s], i*3); blife[i] = life*(0.5 + rng()*0.5); }
}
function updateBursts(dt){
  for(let i=0;i<BN;i++){ if(blife[i] <= 0) continue; blife[i] = Math.max(0, blife[i] - dt*0.4); const i3 = i*3, d = 1 - dt*1.5;
    bvel[i3] *= d; bvel[i3+1] = bvel[i3+1]*d + dt*1.2; bvel[i3+2] *= d;
    bpos[i3] += bvel[i3]*dt; bpos[i3+1] += bvel[i3+1]*dt; bpos[i3+2] += bvel[i3+2]*dt; }
  burstGeo.attributes.position.needsUpdate = true; burstGeo.attributes.aLife.needsUpdate = true;
}

// ======================================================================= humpback whale (finale)
const whale = new THREE.Group(); whale.visible = false; scene.add(whale);
const fluke = new THREE.Group();
{
  const skin = mat({
    side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vL; void main(){ vL = position; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: COMMON + /* glsl */`
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){
      vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
      float belly = smoothstep(0.1, -0.7, vL.y / max(length(vL.xy), 0.01));
      vec3 alb = mix(vec3(0.07, 0.09, 0.12), vec3(0.78, 0.8, 0.8), belly);
      float ang = atan(vL.y, vL.x);
      float grooves = smoothstep(0.55, 0.9, abs(sin(ang * 44.0))) * belly * smoothstep(1.0, 4.0, vL.z) * smoothstep(13.0, 9.0, vL.z);
      alb *= 1.0 - grooves * 0.45;
      alb *= 0.85 + 0.3 * vnoise(vL.xz * 1.3 + vL.y);
      vec3 col = shade(alb, n, vW, 1.0);
      gl_FragColor = vec4(fogged(col, vW), 1.0);
    }`,
  });
  const fin = litMat('#cfd6d8', { belly: '#e8eeee' });
  const prof = [[0,-13],[0.45,-12.6],[0.9,-10.5],[1.8,-5],[2.6,1],[2.9,5.5],[2.6,9.5],[1.6,12.2],[0.4,13.1],[0,13.2]].map(a => new THREE.Vector2(a[0], a[1]));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32).rotateX(Math.PI/2), skin); body.scale.set(1, 0.9, 1); whale.add(body); caster(body);
  for(const s of [-1, 1]){
    const fl = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10).scale(0.7, 0.14, 4.4).translate(0, 0, -3.8), fin);
    fl.position.set(s*2.6, -1.6, 6.5); fl.rotation.set(0.35, s*0.95, s*-0.5); whale.add(fl); caster(fl);
    const fk = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8).scale(2.7, 0.13, 1.1), skin);
    fk.position.set(s*2.2, 0, -1.0); fk.rotation.y = s*-0.45; fluke.add(fk); caster(fk);
  }
  fluke.position.set(0, 0, -12.6); whale.add(fluke); whale.scale.setScalar(1.25);
}
let whaleT = 0, whaleTh = 0; const whaleC = new THREE.Vector3(), whalePrev = new THREE.Vector3();
