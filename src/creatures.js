'use strict';
// ======================================================================= generic lit material
function litMat(color, o = {}){
  return mat({
    transparent: (o.opacity ?? 1) < 1, depthWrite: (o.opacity ?? 1) >= 1, side: THREE.DoubleSide, wireframe: !!o.wireframe,
    uniforms: { uColor: { value: new THREE.Color(color) }, uColor2: { value: new THREE.Color(o.belly ?? color) },
      uOpacity: { value: o.opacity ?? 1 }, uGlow: { value: o.glow ?? 0 }, uSpec: { value: o.spec ?? 0.3 } },
    vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vL; void main(){ vL = position; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: COMMON + /* glsl */`
    uniform vec3 uColor; uniform vec3 uColor2; uniform float uOpacity; uniform float uGlow; uniform float uSpec;
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){
      vec3 n = normalize(vN);
      vec3 alb = mix(uColor2, uColor, smoothstep(-0.5, 0.25, n.y));
      if(!gl_FrontFacing) n = -n;
      vec3 vd = normalize(cameraPosition - vW);
      vec3 col = shade(alb, n, vW, 1.0) + alb * uGlow * sunAt(vW.y) * 0.3;
      vec3 R = reflect(-vd, n);
      col += sunAt(vW.y) * pow(max(dot(R, uSunDir), 0.0), 40.0) * uSpec * 2.0;
      gl_FragColor = vec4(fogged(col, vW), uOpacity);
    }`,
  });
}

// ======================================================================= player: manta ray
let player = { pos: new THREE.Vector3(8, 0, 78), yaw: Math.PI, pitch: 0, roll: 0, speed: 8, fwd: new THREE.Vector3(0, 0, -1), flap: 0, yawV: 0, pitchV: 0,
  v: new THREE.Vector3(), air: 1, idle: 0, burst: -1, axis: new THREE.Vector3(0, 1, 0), cool: 0, pulseT: 9, ang: 0 };
player.pos.y = heightAt(player.pos.x, player.pos.z) + 9;
const manta = new THREE.Group(); scene.add(manta);
const mantaU = { uFlap: { value: 0 }, uAmp: { value: 0.4 } };
{
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 72, 28), mat({
    side: THREE.DoubleSide, uniforms: mantaU,
    vertexShader: /* glsl */`
    uniform float uFlap; uniform float uAmp; varying vec3 vN; varying vec3 vW; varying vec2 vUv;
    vec3 mp(vec2 uv){
      float u = clamp(uv.x*2.0 - 1.0, -1.0, 1.0), au = abs(u), v = clamp(uv.y, 0.0, 1.0);
      float zl = 0.72 - 0.95*pow(au, 1.5);
      zl += 0.30 * smoothstep(0.25, 0.13, au) * smoothstep(0.015, 0.09, au);
      float zt = -0.9 + 0.8*pow(au, 0.8);
      float z = mix(zl, zt, v);
      float body = smoothstep(0.4, 0.0, au) * sin(3.14159 * pow(v, 0.7));
      float y = 0.16 * body;
      y += sin(uFlap - au*2.3 - v*0.9) * pow(au, 1.45) * uAmp - 0.08*au*au;
      return vec3(u*1.7, y, z);
    }
    void main(){
      vec3 p = mp(uv); float e = 0.01;
      vec3 du = mp(uv + vec2(e, 0.0)) - mp(uv - vec2(e, 0.0)), dv = mp(uv + vec2(0.0, e)) - mp(uv - vec2(0.0, e));
      vN = normalize(mat3(modelMatrix) * cross(du, dv)); vUv = uv;
      vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
    fragmentShader: COMMON + /* glsl */`
    varying vec3 vN; varying vec3 vW; varying vec2 vUv;
    void main(){
      vec3 n = normalize(vN); vec3 vd = normalize(cameraPosition - vW);
      float top = step(0.0, dot(n, vd)); if(top < 0.5) n = -n;
      float au = abs(vUv.x*2.0 - 1.0), v = vUv.y;
      vec3 topC = vec3(0.03, 0.045, 0.06);
      float chev = abs(v - (0.04 + au*0.8));
      float shoulder = smoothstep(0.12, 0.05, chev) * smoothstep(0.08, 0.17, au) * smoothstep(0.6, 0.38, au);
      topC = mix(topC, vec3(0.62, 0.65, 0.66), shoulder * 0.9);
      topC += vec3(0.03, 0.05, 0.07) * smoothstep(0.3, 0.0, au);
      vec3 botC = vec3(0.9, 0.92, 0.93);
      float gills = step(0.55, fract(v*24.0)) * smoothstep(0.06, 0.03, abs(au - 0.2)) * step(0.12, v) * step(v, 0.33);
      botC *= 1.0 - gills*0.55;
      botC = mix(botC, vec3(0.06), smoothstep(0.74, 0.8, vnoise(vec2(au*16.0, v*13.0))) * smoothstep(0.38, 0.12, au));
      botC = mix(botC, vec3(0.08, 0.1, 0.13), smoothstep(0.7, 0.95, au) + smoothstep(0.75, 0.95, v)*0.6);
      vec3 alb = mix(botC, topC, top);
      vec3 col = shade(alb, n, vW, 1.0);
      vec3 R = reflect(-vd, n);
      col += sunAt(vW.y) * pow(max(dot(R, uSunDir), 0.0), 30.0) * 0.6 * top;
      col += mediumLight(R, vW.y) * pow(1.0 - abs(dot(n, vd)), 3.0) * 1.5;
      gl_FragColor = vec4(fogged(col, vW), 1.0);
    }`,
  }));
  m.frustumCulled = false; manta.add(m); caster(m);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.003, 1.4, 5).rotateX(Math.PI/2).translate(0, 0.02, -1.6), litMat('#0a1018'));
  manta.add(tail); manta.scale.setScalar(2.3);
}

// ======================================================================= ghost nets (only appear if the village sinks its old nets)
const debris = [];
const beaconMat = mat({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: COMMON + /* glsl */`
  varying vec2 vUv; varying vec3 vW;
  void main(){
    float e = 1.0 - abs(vUv.x*2.0 - 1.0);
    float a = pow(e, 4.0) * pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.03, vUv.y);
    a *= 0.6 + 0.4*sin(uTime*2.2 - vUv.y*9.0);
    clipPortal(vW);
    gl_FragColor = vec4(vec3(1.0, 0.48, 0.14) * a * 1.6 * pow(transmit(waterPath(vW)), vec3(0.45)), 1.0);
  }`,
});
const orbMat = mat({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0,0.0,0.0,1.0); mv.xy += position.xy * 4.5; vW = (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: COMMON + `varying vec2 vUv; varying vec3 vW; void main(){ float r = length(vUv - 0.5) * 2.0; float a = exp(-r*r*9.0) * (0.75 + 0.25*sin(uTime*2.5)) * 0.6;
    clipPortal(vW); gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * a * 0.9 * pow(transmit(waterPath(vW)), vec3(0.45)), 1.0); }`,
});
{
  const netGeo = new THREE.PlaneGeometry(8, 8, 16, 16).rotateX(-Math.PI/2); { const p = netGeo.attributes.position;
    for(let i=0;i<p.count;i++){ const x=p.getX(i), z=p.getZ(i); p.setY(i, -0.07*(x*x+z*z) + 0.5*Math.sin(x*1.3)*Math.cos(z*1.1)); } }
  [1, 4, 8, 11].forEach(pi => {
    const P = PATCHES[pi], b = P.bommies[0], g = new THREE.Group();
    const x = b.x + gauss()*1.5, z = b.z + gauss()*1.5, y = reefTopRaw(x, z) + 2.6;
    g.add(new THREE.Mesh(netGeo, litMat('#5fd8a8', { wireframe: true, glow: 0.8 })));
    for(let k=0;k<4;k++){ const f = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), litMat('#ff8a2a', { glow: 0.5 })); const a = k*1.57 + 0.5;
      f.position.set(Math.cos(a)*3.2, -0.5, Math.sin(a)*3.2); g.add(f); }
    g.position.set(x, y, z); g.rotation.z = 0.25; scene.add(g);
    const beacon = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 36).translate(0, 18, 0), beaconMat);
    beacon.position.set(x, y, z); beacon.renderOrder = 6; scene.add(beacon);
    const orb = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), orbMat); orb.position.set(x, y, z); orb.renderOrder = 7; orb.frustumCulled = false; scene.add(orb);
    g.visible = beacon.visible = orb.visible = false;
    debris.push({ type: 'net', patch: pi, g, beacon, orb, pos: g.position, y0: y, alive: false, die: 0, ph: rng()*6 });
  });
}
function deployNets(n){
  debris.forEach((d, i) => { const on = i < n; d.alive = on; d.die = 0; d.g.visible = d.beacon.visible = d.orb.visible = on;
    d.g.scale.setScalar(1); d.beacon.scale.set(1, 1, 1); d.orb.scale.setScalar(1); });
}

// ======================================================================= green turtle (with its cleaner fish)
const turtle = new THREE.Group(); scene.add(turtle);
const turtleFlip = [];
{
  const vert = `varying vec3 vN; varying vec3 vW; varying vec3 vL; void main(){ vL = position; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const shellMat = mat({ side: THREE.DoubleSide, vertexShader: vert, fragmentShader: COMMON + /* glsl */`
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
    vec2 h22(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
    void main(){
      vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
      vec2 p = vL.xz * vec2(1.9, 1.6) + 0.5; vec2 ip = floor(p), fp = fract(p);
      float d1 = 8.0, d2 = 8.0, id = 0.0;
      for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
        vec2 g = vec2(float(i), float(j)); vec2 h = h22(ip + g); vec2 o = h*0.7 + 0.15; float d = length(g + o - fp);
        if(d < d1){ d2 = d1; d1 = d; id = h.x; } else if(d < d2) d2 = d; }
      float edge = smoothstep(0.03, 0.15, d2 - d1);
      vec3 base = mix(vec3(0.34, 0.22, 0.09), vec3(0.62, 0.46, 0.2), id);
      base *= 0.65 + 0.5*smoothstep(0.6, 0.0, d1) + 0.1*sin(atan(fp.y - 0.5, fp.x - 0.5)*9.0);
      vec3 alb = mix(vec3(0.1, 0.07, 0.04), base, edge);
      vec3 col = shade(alb, n, vW, 1.0);
      vec3 vd = normalize(cameraPosition - vW);
      col += sunAt(vW.y) * pow(max(dot(reflect(-vd, n), uSunDir), 0.0), 28.0) * 0.5;
      gl_FragColor = vec4(fogged(col, vW), 1.0);
    }` });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI*2, 0, Math.PI/2).scale(1.15, 0.5, 1.45), shellMat);
  const skin = litMat('#7d8b5e', { belly: '#d4cca2', spec: 0.4 });
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 8, 0, Math.PI*2, Math.PI/2, Math.PI/2).scale(1.1, 0.16, 1.38), litMat('#d8c99c'));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12).scale(0.85, 0.75, 1.25).translate(0, 0.05, 1.7), skin);
  [shell, belly, head].forEach(m => { turtle.add(m); caster(m); });
  for(const [x, z, len, w] of [[0.85, 0.75, 1.25, 0.34], [-0.85, 0.75, 1.25, 0.34], [0.7, -1.05, 0.6, 0.25], [-0.7, -1.05, 0.6, 0.25]]){
    const pivot = new THREE.Group(); pivot.position.set(x, -0.02, z);
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8).scale(len, 0.07, w).translate(Math.sign(x)*len*0.9, 0, -w*0.6), skin);
    pivot.add(f); turtle.add(pivot); caster(f); turtleFlip.push({ pivot, front: z > 0, side: Math.sign(x) });
  }
  turtle.scale.setScalar(1.7);
}
let turtleA = 0;
const TURTLE_HOME = PATCHES.reduce((b, P) => Math.hypot(P.x + 30, P.z + 60) < Math.hypot(b.x + 30, b.z + 60) ? P : b, PATCHES[0]);
function updateTurtle(){ /* driven by updateCreatures */ }

// ======================================================================= life on the bottom: garden eels in the sand channel, morays in the rocks, blue-spotted rays
const benthU = { uPlayer: { value: new THREE.Vector3(0, -999, 0) } };
const EEL_COLONIES = [];
{
  const R = mulberry32(4242), E = [];
  for(const zz of [-78, -52, -24, 6, 28]){ const x = chanX(zz), z = zz + 0.0006*x*x; EEL_COLONIES.push(new THREE.Vector3(x, heightAt(x, z), z));
    for(let k=0, n=0; n < 46 && k < 300; k++){ const ex = x + (R() + R() + R() - 1.5)*5, ez = z + (R() + R() + R() - 1.5)*5, h = heightAt(ex, ez);
      if(topAt(ex, ez) - h > 0.05) continue; n++; E.push(ex, h - 0.03, ez, R()*6.283); } }
  const geo = new THREE.InstancedBufferGeometry().copy(mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.085, 1, 6, 12, true).translate(0, 0.5, 0), new THREE.SphereGeometry(0.092, 8, 6).translate(0, 1.0, 0.012)]));
  geo.setAttribute('aE', new THREE.InstancedBufferAttribute(new Float32Array(E), 4)); geo.instanceCount = E.length/4;
  const m = new THREE.Mesh(geo, mat({ side: THREE.DoubleSide, uniforms: benthU,
    vertexShader: `attribute vec4 aE; uniform float uTime; uniform vec3 uPlayer; varying vec3 vN; varying vec3 vW; varying float vH; varying float vA;
    void main(){
      float d = distance(aE.xyz, uPlayer);
      float L = (1.1 + 0.9*fract(aE.w*7.31)) * smoothstep(6.0, 12.0, d);
      float y = position.y, b = y*y;
      vec3 w = vec3(position.x, y*L, position.z);
      float sway = sin(uTime*0.8 + aE.w)*0.5 + 0.5;
      w.x += (0.22 + 0.16*sway)*b*L; w.z += sin(uTime*0.6 + aE.w*2.3)*0.07*b*L; w.y -= 0.14*b*b*L*L;
      vH = y; vA = aE.w; vN = normal; vW = aE.xyz + w;
      gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
    }`,
    fragmentShader: COMMON + `varying vec3 vN; varying vec3 vW; varying float vH; varying float vA;
    void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
      float sp = step(0.8, hash12(floor(vec2(vH*24.0, (atan(vN.z, vN.x) + vA)*1.7))));
      vec3 alb = mix(vec3(0.95, 0.92, 0.8), vec3(0.12, 0.1, 0.08), sp);
      alb = mix(alb, vec3(0.03), smoothstep(0.06, 0.03, length(vec2(vH - 1.0, abs(vN.x) - 0.6)))*step(0.95, vH));
      gl_FragColor = vec4(fogged(shade(alb, n, vW, 0.9), vW), 1.0); }`,
  }));
  m.frustumCulled = false; scene.add(m);
}
// moray eels: a head and a length of body out of a crack in the rock, ducking back in when you swim close
const MORAYS = [];
{
  const body = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.1, -0.9), new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 0.45, 0.45), new THREE.Vector3(0, 0.9, 0.62)]), 24, 0.2, 8);
  const head = new THREE.SphereGeometry(0.24, 12, 8).scale(0.8, 0.95, 1.45).translate(0, 0.98, 0.78);
  const jaw = new THREE.SphereGeometry(0.16, 10, 6).scale(0.8, 0.5, 1.4).translate(0, 0.84, 0.82);
  const geo = mergeGeometries([body.toNonIndexed(), head.toNonIndexed(), jaw.toNonIndexed()]);
  const mm = litMat('#6f7030', { belly: '#a8a052', spec: 0.6 });
  const R = mulberry32(77), reefs = EXTRA.filter((E, k) => k % 3 === 1);
  for(let k=0;k<Math.min(9, reefs.length);k++){ const b = reefs[k].bommies[0], a = R()*6.283;
    const x = b.x + Math.cos(a)*b.rx*0.86, z = b.z + Math.sin(a)*b.rx*0.86;
    const g = new THREE.Mesh(geo, mm); g.scale.setScalar(1.15 + R()*0.5);
    const base = Math.atan2(Math.cos(a), Math.sin(a)), p0 = new THREE.Vector3(x, Math.max(bommieY(b, x, z), heightAt(x, z)) - 0.35, z);
    g.position.copy(p0); g.rotation.y = base; scene.add(g);
    MORAYS.push({ g, base, p0, out: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), k: 1, ph: R()*6 }); }
}
// blue-spotted ribbontail rays: glide over the sand, settle for a while, bolt when you come too close
const RAYS = [];
{
  const disc = new THREE.RingGeometry(0.02, 1, 30, 6).rotateX(-Math.PI/2).scale(1.0, 1, 1.15);
  const tail = new THREE.ConeGeometry(0.06, 1.9, 5).rotateX(-Math.PI/2).translate(0, 0.02, -2.0);
  const geo = mergeGeometries([disc.toNonIndexed(), tail.toNonIndexed()]);
  const VS = `uniform float uFlap; uniform float uAmp; varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){ vec3 p = position; float r = length(p.xz), isT = step(p.z, -1.18);
      p.y += (1.0 - isT)*(sin(uFlap - p.z*3.0)*uAmp*smoothstep(0.25, 1.0, abs(p.x)) + (1.0 - smoothstep(0.0, 1.0, r))*0.2);
      p.x += isT*sin(uFlap*0.5 + p.z*2.0)*0.12*(-p.z - 1.18);
      vL = position; vec4 wp = modelMatrix*vec4(p, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix)*normal);
      gl_Position = projectionMatrix*viewMatrix*wp; }`;
  const FS = COMMON + `varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){ vec3 n = normalize(vN); bool top = gl_FrontFacing; if(!top) n = -n;
      vec2 q = vL.xz*5.5; float sp = smoothstep(0.3, 0.18, length(fract(q) - 0.5))*step(0.42, hash12(floor(q)));
      vec3 alb = mix(vec3(0.5, 0.4, 0.27), vec3(0.62, 0.5, 0.34), smoothstep(1.0, 0.2, length(vL.xz)));
      alb = mix(alb, vec3(0.08, 0.5, 1.0), sp);
      if(vL.z < -1.18) alb = mix(vec3(0.1, 0.45, 0.95), vec3(0.05), step(0.5, fract(vL.z*3.0)));
      if(!top) alb = vec3(0.92, 0.9, 0.86);
      vec3 col = shade(alb, n, vW, 1.0) + vec3(0.05, 0.25, 0.6)*sp*sunAt(vW.y)*0.12;
      gl_FragColor = vec4(fogged(col, vW), 1.0); }`;
  const R = mulberry32(515);
  for(let k=0;k<4;k++){ const zz = -70 + k*28, x = chanX(zz), z = zz + 0.0006*x*x;
    const m = new THREE.Mesh(geo, mat({ side: THREE.DoubleSide, uniforms: { uFlap: { value: 0 }, uAmp: { value: 0.15 } }, vertexShader: VS, fragmentShader: FS }));
    m.scale.setScalar(0.85 + R()*0.35); scene.add(m);
    const st = mkState(new THREE.Vector3(x, heightAt(x, z) + 0.6, z), R()*6.283); st.speed = 1.5;
    RAYS.push({ m, st, tx: x, tz: z, rest: R()*6, flee: 0, R }); }
}
function rayTarget(r, awayFrom){
  if(awayFrom){ const a = Math.atan2(r.st.pos.x - awayFrom.x, r.st.pos.z - awayFrom.z); r.tx = r.st.pos.x + Math.sin(a)*22; r.tz = r.st.pos.z + Math.cos(a)*22; return; }
  const zz = -88 + r.R()*120, x = chanX(zz) + (r.R() - 0.5)*14; r.tx = x; r.tz = zz + 0.0006*x*x;
}
// things worth a word when you first come across them on your own
const DISCOVER = [
  { pos: () => EEL_COLONIES.reduce((b, c) => c.distanceTo(player.pos) < b.distanceTo(player.pos) ? c : b), r: 16, kicker: '花园鳗', text: '半截身子埋在沙里，等洋流把浮游生物送到嘴边。你一靠近，它们就全缩回去了。' },
  { pos: () => PINNACLES.reduce((b, c) => c.distanceTo(player.pos) < b.distanceTo(player.pos) ? c : b), r: 18, kicker: '海底尖礁', text: '从深水里拔起的礁柱。金梭鱼喜欢在它旁边悬停，几乎一动不动。' },
  { pos: () => RAYS.reduce((b, c) => c.st.pos.distanceTo(player.pos) < b.st.pos.distanceTo(player.pos) ? c : b).st.pos, r: 10, kicker: '蓝点魟', text: '贴着沙底滑行，累了就趴下，用沙子盖住半个身子。' },
  { pos: () => MORAYS.reduce((b, c) => c.p0.distanceTo(player.pos) < b.p0.distanceTo(player.pos) ? c : b).p0, r: 9, kicker: '裸胸鳝', text: '它一张一合不是在威胁你，只是在呼吸。' },
  { pos: () => tmpQ.set(SCHOOLS[sBait].x, SCHOOLS[sBait].y0, SCHOOLS[sBait].z), r: 22, when: () => SCHOOLS[sHunt].attack, kicker: '围猎', text: '鲹鱼冲进了沙丁鱼群。鱼群缩成更紧的一团，一起转向，这是它们唯一的防身办法。' },
  { pos: () => tmpQ.set(SCHOOLS[sGraze].x, SCHOOLS[sGraze].y0, SCHOOLS[sGraze].z), r: 12, kicker: '大鹦嘴鱼', text: '它们啃食礁石上的藻类，嚼碎的珊瑚骨排出来，就是这片海里的白沙。' },
  { pos: () => tmpQ.set(player.pos.x, player.pos.y, player.pos.z), r: 1, when: () => player.pos.z - 0.0006*player.pos.x*player.pos.x > 44, kicker: '礁墙', text: '海底在这里突然断开，下面是更深的蓝。' },
  { pos: () => tmpQ.set(player.pos.x, player.pos.y, player.pos.z), r: 1, when: () => inOpen(player.pos), kicker: '远洋', text: '礁墙外的深蓝。金枪鱼、鲸鲨和海豚在这里巡游，渔港的远洋渔船捕的就是它们。' },
  { pos: () => wShark.position, r: 26, when: () => wShark.visible, kicker: '鲸鲨', text: '世界上最大的鱼，只吃浮游生物。它慢得像一座会游的岛。' },
  { pos: () => DOLPH[0].m.position, r: 24, when: () => DOLPH[0].m.visible, kicker: '海豚', text: '一群海豚跟着你游了一段，又跃出水面走了。远洋鱼群够多，它们才会来。' },
  { pos: () => whale.position, r: 40, when: () => whaleCruise, kicker: '座头鲸', text: '远洋足够丰饶的时候，它才会经过这里。观鲸船的游客就是为它而来。' },
  { pos: () => FLEET[0].g.position, r: 30, when: () => FLEET[0].g.visible, kicker: '远洋渔船', text: '头顶是渔港的远洋渔船，延绳钓的浮标一直拖到看不见的地方。' },
];
const tmpQ = new THREE.Vector3(); let discoverT = 0;
function updateBenthos(dt){
  const t = time, P = player.pos;
  benthU.uPlayer.value.copy(mode === 'dive' ? P : tmpQ.set(0, -999, 0));
  for(const M of MORAYS){ const d = M.p0.distanceTo(P), want = mode === 'dive' && d < 7 ? 0.25 : 1; M.k += (want - M.k)*Math.min(1, dt*(want < M.k ? 4 : 0.5));
    M.g.position.copy(M.p0).addScaledVector(M.out, -(1 - M.k)*1.1); M.g.position.y -= (1 - M.k)*0.5;
    M.g.rotation.set(Math.sin(t*0.9 + M.ph)*0.06, M.base + Math.sin(t*0.4 + M.ph)*0.3, 0); }
  for(const r of RAYS){ const st = r.st, d = st.pos.distanceTo(P);
    if(mode === 'dive' && d < 6 && r.flee <= 0){ r.flee = 4; r.rest = 0; rayTarget(r, P); }
    r.flee -= dt;
    if(r.rest > 0){ r.rest -= dt; st.speed *= 1 - Math.min(1, dt*1.5); st.pos.y += (heightAt(st.pos.x, st.pos.z) + 0.12 - st.pos.y)*Math.min(1, dt*1.2); st.pitch *= 0.95; }
    else { seek(st, r.tx, heightAt(r.tx, r.tz) + 0.7, r.tz, dt, r.flee > 0 ? 1.6 : 0.5, r.flee > 0 ? 6 : 2.2);
      st.pos.y = Math.max(st.pos.y, topAt(st.pos.x, st.pos.z) + 0.35);
      if(Math.hypot(r.tx - st.pos.x, r.tz - st.pos.z) < 3){ if(r.R() < 0.45) r.rest = 6 + r.R()*10; rayTarget(r); } }
    st.flap += dt*(0.6 + st.speed*0.9); st.roll += (st.yawV*0.4 - st.roll)*Math.min(1, dt*2);
    r.m.material.uniforms.uFlap.value = st.flap; r.m.material.uniforms.uAmp.value = 0.03 + Math.min(0.2, st.speed*0.05);
    r.m.position.copy(st.pos); r.m.rotation.set(-st.pitch, st.yaw, st.roll, 'YXZ'); }
  // first encounters
  discoverT -= dt;
  if(mode === 'dive' && (state === 'freedive' || state === 'explore') && discoverT < 0){
    for(const D of DISCOVER){ if(D.found || (D.when && !D.when())) continue;
      if(D.pos().distanceTo(P) < D.r){ D.found = true; discoverT = 14; toast(D.kicker, D.text, 6500); break; } } }
}

// ======================================================================= the open sea past the reef wall: a whale shark, a dolphin pod, the humpback when the sea is rich, and the offshore fleet overhead
const OPEN_C = new THREE.Vector3(0, 0, 175);
const inOpen = p => p.z - 0.0006*p.x*p.x > 105;
// whale shark: a wide flat head, a spotted back, a tall tail beating slowly
const wShark = new THREE.Group(); scene.add(wShark);
const wSharkU = { uSwim: { value: 0 } };
{
  const skin = mat({ side: THREE.DoubleSide, uniforms: wSharkU,
    vertexShader: `uniform float uSwim; varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){ vec3 p = position; float b = smoothstep(2.0, -9.0, p.z); p.x += sin(uSwim - p.z*0.22)*0.9*b*b; vL = position;
      vec4 wp = modelMatrix*vec4(p, 1.0); vN = normalize(mat3(modelMatrix)*normal); vW = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: COMMON + `varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
      float belly = smoothstep(0.05, -0.5, vL.y/max(length(vL.xy), 0.01));
      vec3 alb = mix(vec3(0.07, 0.11, 0.16), vec3(0.72, 0.74, 0.72), belly);
      vec2 q = vec2(vL.z*2.2, atan(vL.y, vL.x)*5.0); float sp = smoothstep(0.2, 0.1, length(fract(q) - 0.5))*step(0.45, hash12(floor(q)))*(1.0 - belly);
      float stripe = smoothstep(0.05, 0.0, abs(fract(vL.z*0.5) - 0.5) - 0.46)*(1.0 - belly)*0.35;
      alb = mix(alb, vec3(0.78, 0.82, 0.8), max(sp, stripe));
      gl_FragColor = vec4(fogged(shade(alb, n, vW, 1.0), vW), 1.0); }` });
  const prof = [[0, -10], [0.5, -9.4], [1.1, -7], [1.9, -3], [2.4, 1], [2.6, 4.2], [2.4, 6.4], [1.6, 7.6], [0.4, 8.0], [0, 8.05]].map(a => new THREE.Vector2(a[0], a[1]));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28).rotateX(Math.PI/2).scale(1.35, 0.72, 1), skin); wShark.add(body); caster(body);
  const tail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -9.4), new THREE.Vector3(0, 4.6, -12.8), new THREE.Vector3(0, 0.4, -10.8),
    new THREE.Vector3(0, 0, -9.4), new THREE.Vector3(0, 0.3, -10.8), new THREE.Vector3(0, -2.6, -11.8)]), skin); tail.geometry.computeVertexNormals(); wShark.add(tail);
  const dors = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 4).scale(0.25, 1, 1.4), skin); dors.position.set(0, 2.2, -1.5); dors.rotation.x = -0.35; wShark.add(dors);
  for(const s of [-1, 1]){ const pf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6).scale(2.4, 0.12, 0.9), skin); pf.position.set(s*3.0, -0.9, 3.0); pf.rotation.set(0, s*0.5, s*-0.35); wShark.add(pf); }
  wShark.scale.setScalar(1.15); wShark.visible = false;
}
// a dolphin pod that rides near the surface and leaps
const DOLPH = [];
{ const skin = litMat('#6b7c89', { belly: '#dfe5e8', spec: 0.7 });
  const prof = [[0, -1.7], [0.18, -1.5], [0.42, -0.8], [0.55, 0.1], [0.5, 0.8], [0.32, 1.35], [0.12, 1.75], [0.06, 2.05], [0, 2.1]].map(a => new THREE.Vector2(a[0], a[1]));
  const geo = mergeGeometries([new THREE.LatheGeometry(prof, 14).rotateX(Math.PI/2), new THREE.ConeGeometry(0.28, 0.75, 4).scale(0.25, 1, 1.3).rotateX(-0.5).translate(0, 0.72, -0.1),
    new THREE.SphereGeometry(1, 10, 6).scale(0.75, 0.06, 0.3).translate(0, 0, -1.75), new THREE.SphereGeometry(1, 8, 6).scale(0.45, 0.05, 0.22).rotateZ(0.4).translate(0.42, -0.25, 0.6),
    new THREE.SphereGeometry(1, 8, 6).scale(0.45, 0.05, 0.22).rotateZ(-0.4).translate(-0.42, -0.25, 0.6)].map(g => g.index ? g.toNonIndexed() : g));
  for(let i=0;i<6;i++){ const m = new THREE.Mesh(geo, skin); m.visible = false; scene.add(m); DOLPH.push({ m, ph: i*1.05, off: new THREE.Vector3((i % 3 - 1)*3.2, -(i % 2)*1.5, -Math.floor(i/3)*4) }); } }
// the offshore fleet overhead: hulls breaking the surface and long-line floats trailing behind
const FLEET = [];
{ const hullM = litMat('#2b3540', { belly: '#1c232a' }), floatM = litMat('#ff7a1a'), lineM = new THREE.LineBasicMaterial({ color: '#c9c3b5', transparent: true, opacity: 0.6 }), dropM = new THREE.LineBasicMaterial({ color: '#b8c4c8', transparent: true, opacity: 0.22 });
  for(let i=0;i<6;i++){ const g = new THREE.Group(); const hull = new THREE.Mesh(hullGeo(15, 3.6, 2.6), hullM); g.add(hull);
    const pts = []; for(let j=0;j<14;j++){ const f = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), floatM); f.position.set(Math.sin(j*0.7)*2.5, 0.3, -9 - j*5.5); g.add(f); pts.push(f.position.clone()); }
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineM); g.add(ln);
    for(let j=2;j<14;j+=4){ const d = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[j], pts[j].clone().add(new THREE.Vector3(0.6, -7, 0.8))]), dropM); g.add(d); }
    g.visible = false; scene.add(g); FLEET.push({ g, a: i*1.05, r: 55 + (i % 3)*18 }); } }
let wsT = 0, dolT = 0, humpT = 0, whaleCruise = false; window.__pel = { wShark, DOLPH, FLEET };
function updatePelagic(dt){
  const pel = eco.pelagic ?? 1, near = mode === 'village' || Math.hypot(player.pos.x - OPEN_C.x, player.pos.z - OPEN_C.z) < 260;
  // whale shark: a slow loop round the seamount
  wShark.visible = pel > 0.35 && near; wsT += dt;
  if(wShark.visible){ const a = wsT*0.022, x = -25 + Math.cos(a)*45, z = 140 + Math.sin(a)*24, y = 16 + Math.sin(wsT*0.15)*4;
    const nx = -25 + Math.cos(a + 0.02)*45, nz = 140 + Math.sin(a + 0.02)*24;
    wShark.position.set(x, y, z); wShark.lookAt(nx, y, nz); wSharkU.uSwim.value = wsT*1.1; }
  // dolphins: a pod that circles and porpoises, now and then clearing the water
  const nD = pel > 0.5 ? Math.min(6, Math.round((pel - 0.4)*10)) : 0; dolT += dt;
  DOLPH.forEach((d, i) => { const on = i < nD && near; d.m.visible = on; if(!on) return;
    const a = dolT*0.09 + 0.6, cx = 25 + Math.cos(a)*45, cz = 128 + Math.sin(a*1.3)*22, hx = -Math.sin(a)*45, hz = Math.cos(a*1.3)*28.6, L = Math.hypot(hx, hz) || 1;
    const fx = hx/L, fz = hz/L, px = cx + fx*d.off.z + fz*d.off.x, pz = cz + fz*d.off.z - fx*d.off.x;
    const leap = Math.max(0, Math.sin(dolT*0.9 + d.ph)), y = SURFACE - 2.6 + d.off.y + Math.pow(leap, 6)*5.5 + Math.sin(dolT*2.4 + d.ph)*0.5;
    const pitch = Math.cos(dolT*0.9 + d.ph)*Math.pow(leap, 5)*1.2 + Math.cos(dolT*2.4 + d.ph)*0.12;
    d.m.position.set(px, y, pz); d.m.rotation.set(-pitch, Math.atan2(fx, fz), 0, 'YXZ'); });
  // the humpback cruises the open sea when it is rich; the finale's whale takes over at the end
  const wantCruise = pel > 0.6 && near && state !== 'ending';
  if(wantCruise){ whaleCruise = true; whale.visible = true; humpT += dt;
    const a = humpT*0.018 + 2.2, x = 5 + Math.sin(a)*62, z = 150 + Math.cos(a)*20, y = 22 + Math.sin(humpT*0.2)*3;
    whalePrev.copy(whale.position); whale.position.set(x, y, z); tmp.set(5 + Math.sin(a + 0.01)*62, y, 150 + Math.cos(a + 0.01)*20); whale.lookAt(tmp);
    fluke.rotation.x = Math.sin(humpT*1.0)*0.3; }
  else if(whaleCruise){ whaleCruise = false; if(state !== 'ending') whale.visible = false; }
  // the offshore fleet: as many hulls as the harbour has offshore boats, drifting on their long-lines
  FLEET.forEach((f, i) => { const on = i < (V.offshore || 0) && near && mode === 'dive'; f.g.visible = on; if(!on) return;
    f.a += dt*0.006; f.g.position.set(10 + Math.cos(f.a)*f.r, SURFACE - 0.35 + Math.sin(time*0.8 + i)*0.12, 190 + Math.sin(f.a)*f.r*0.6); f.g.rotation.y = -f.a; });
}

// ======================================================================= trawler + net
const boat = new THREE.Group(); boat.visible = false; scene.add(boat);
const netG = new THREE.Group(); netG.visible = false; scene.add(netG);
let catchBlob, cableGeo;
{
  const hullGeo = new THREE.BoxGeometry(5, 2.4, 17, 6, 3, 14), hp = hullGeo.attributes.position;
  for(let i=0;i<hp.count;i++){ let x = hp.getX(i); const y = hp.getY(i), z = hp.getZ(i);
    if(z > 3.5) x *= 1 - (z - 3.5)/5*0.9; if(y < 0) x *= 0.72; hp.setX(i, x); }
  hullGeo.computeVertexNormals();
  const hullMat = litMat('#10151a', { belly: '#1b252d', spec: 0.2 });
  const hull = new THREE.Mesh(hullGeo, hullMat); boat.add(hull); caster(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3, 5).translate(0, 2.7, -3), hullMat); boat.add(cabin);
  const netMat = mat({ side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vW; varying vec3 vN; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: COMMON + /* glsl */`
    varying vec2 vUv; varying vec3 vW; varying vec3 vN;
    void main(){
      vec2 g = fract(vUv * vec2(64.0, 30.0));
      if(max(step(0.8, g.x), step(0.8, g.y)) < 0.5) discard;
      vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
      vec3 col = shade(vec3(0.24, 0.28, 0.24), n, vW, 1.0) + vec3(0.015);
      gl_FragColor = vec4(fogged(col, vW), 1.0);
    }` });
  netG.add(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 7.0, 20, 36, 14, true).rotateX(-Math.PI/2).translate(0, 0, -10), netMat));
  const floatMat = litMat('#ff7a22', { glow: 0.4 });
  for(let k=0;k<11;k++){ const a = 0.15 + k/10*(Math.PI - 0.3); const f = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), floatMat); f.position.set(Math.cos(a)*7, Math.sin(a)*7, 0); netG.add(f); }
  catchBlob = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14).scale(1, 0.9, 1.4), litMat('#a8bccb', { belly: '#dfe8ee', spec: 1.4 }));
  catchBlob.position.set(0, 0, -20); netG.add(catchBlob);
  cableGeo = new THREE.BufferGeometry(); cableGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  const cables = new THREE.LineSegments(cableGeo, mat({
    vertexShader: `varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: COMMON + `varying vec3 vW; void main(){ gl_FragColor = vec4(fogged(vec3(0.02), vW), 1.0); }` }));
  cables.frustumCulled = false; netG.userData.cables = cables; scene.add(cables); cables.visible = false;
  netG.scale.setScalar(1.35);
}
const trawl = { t: 0, dir: new THREE.Vector3(1, 0, 0), start: new THREE.Vector3(), c: new THREE.Vector3(), boatPos: new THREE.Vector3(),
  netPos: new THREE.Vector3(), speed: 4.6, haul: 0, ny: 0, caughtBait: 0, caughtReg: 0, baitStart: 1 };
