'use strict';
// ======================================================================= the clock and the weather: looks only, the simulation never reads any of this
const WX = ['clear', 'cloudy', 'rain', 'storm', 'fog'];
const WX_NAME = { clear: '晴', cloudy: '多云', rain: '小雨', storm: '雷雨', fog: '海雾' };
const WX_ICON = { clear: 'sun', cloudy: 'cloud', rain: 'rain', storm: 'storm', fog: 'fog' };
//            sun   cloud rain  fog   wind  grey  wave
const WX_P = { clear: [1, 0.15, 0, 0, 0.15, 0, 1], cloudy: [0.62, 0.68, 0, 0.05, 0.4, 0.14, 1.15], rain: [0.32, 0.85, 0.6, 0.3, 0.5, 0.65, 1.5],
  storm: [0.2, 1, 1, 0.25, 1, 0.85, 2.6], fog: [0.45, 0.3, 0, 1, 0.05, 0.5, 0.8] };
const WX_ODDS = [{ clear: 4, cloudy: 3, rain: 1.6, fog: 1.4 }, { clear: 5, cloudy: 2, rain: 1, storm: 2 }, { clear: 4, cloudy: 3, rain: 2, storm: 1 }, { clear: 3, cloudy: 3.5, rain: 2, fog: 1.5 }];
const wx = { cur: 'clear', w: { clear: 1, cloudy: 0, rain: 0, storm: 0, fog: 0 }, sun: 1, cloud: 0.15, rain: 0, fog: 0, wind: 0.15, grey: 0, wave: 1, hold: 0, flash: 0, nextFlash: 3, wet: 0 };
const DAY_LEN = 200;
let clockF = 0.3, clockRun = true, runF0 = 0.28, wasRunning = false;
function rollWeather(){
  if(wx.hold > 0) return;
  if(state === 'running' && V.mods && (V.mods.storm || V.mods.stormCoral)){ wx.cur = 'storm'; return; }
  if(state === 'running' && V.mods && V.mods.heat){ wx.cur = 'clear'; return; }
  const o = WX_ODDS[V.season % 4]; let tot = 0; for(const k in o) tot += o[k]; let x = Math.random()*tot;
  for(const k in o){ x -= o[k]; if(x <= 0){ wx.cur = k; break; } }
}
const dioGround = dio.userData.groundMat;
dio.fog = new THREE.Fog('#d5dbdb', 1500, 5000);
Object.assign(portalU, { uFogC: { value: new THREE.Color('#d5dbdb') }, uFogN: { value: 1500 }, uFogF: { value: 5000 }, uRain: { value: 0 }, uGrey: { value: 0 }, uCloudS: { value: 0 } });
// a sea of soft clouds the island floats over: painted puffs on billboards, more and greyer as the weather turns
function cloudTex(seed){
  const R = mulberry32(seed), W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const n = 12 + ((R()*6)|0);
  for(let i=0;i<n;i++){ const u = i/(n - 1), dome = Math.sin(u*Math.PI), r = H*(0.13 + 0.22*dome*(0.55 + R()*0.55));
    const px = W*(0.13 + 0.74*u + (R() - 0.5)*0.05), py = H*0.7 - dome*H*0.22*(0.6 + R()*0.6) + (R() - 0.5)*H*0.05;
    const gr = x.createRadialGradient(px - r*0.2, py - r*0.25, r*0.05, px, py, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  for(let i=0;i<8;i++){ const px = W*(0.08 + R()*0.84), py = H*(0.7 + R()*0.06), r = H*(0.07 + R()*0.08);
    const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.beginPath(); x.ellipse(px, py, r*1.8, r, 0, 0, 7); x.fill(); }
  x.globalCompositeOperation = 'source-atop';
  const sh = x.createLinearGradient(0, H*0.2, 0, H*0.82); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.55, 'rgba(196,208,222,0.35)'); sh.addColorStop(1, 'rgba(128,146,170,0.75)');
  x.fillStyle = sh; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'destination-in';
  const fb = x.createLinearGradient(0, 0, 0, H); fb.addColorStop(0, 'rgba(0,0,0,1)'); fb.addColorStop(0.74, 'rgba(0,0,0,1)'); fb.addColorStop(0.9, 'rgba(0,0,0,0)');
  x.fillStyle = fb; x.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const CLOUD_TEX = [11, 23, 37, 41, 58].map(cloudTex), cloudCol = new THREE.Color(), C_CDUSK = new THREE.Color('#ffc69e'), C_CGREY = new THREE.Color('#77828b'), C_CNIGHT = new THREE.Color('#33425c');
const skyClouds = [];
{ const R = mulberry32(808), N = 44;
  for(let i=0;i<N;i++){ const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: CLOUD_TEX[i % 5], transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity: 0 }));
    const far = R();
    m.userData = { a: i/N*Math.PI*2 + R()*0.3, r: 120 + far*260, y: -80 + R()*62 + far*24, sp: 0.5 + R()*0.7, w: 55 + far*85 + R()*40, k: R(), bob: R()*6 };
    m.renderOrder = -3; m.visible = false; dio.add(m); skyClouds.push(m); } }
// rain: streaks that fall over the model, drawn on the GPU
const RAIN_N = 5000, rainGeo = new THREE.BufferGeometry();
{ const p = new Float32Array(RAIN_N*6), e = new Float32Array(RAIN_N*2), R = mulberry32(99);
  for(let i=0;i<RAIN_N;i++){ const x = -50 + R()*100, y = R()*60, z = -90 + R()*230; p.set([x, y, z, x, y, z], i*6); e[i*2] = 1; e[i*2 + 1] = 0; }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(e, 1)); }
const rainMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uA: { value: 0 }, uWind: { value: 0 } },
  vertexShader: `attribute float aEnd; uniform float uT; uniform float uWind; varying float vE;
    void main(){ vec3 p = position; float sp = 36.0 + fract(p.x*13.7 + p.z*3.1)*12.0;
      p.y = mod(p.y - uT*sp, 60.0) - 1.0; p.x += uWind*p.y*0.22; p.y += aEnd*1.5; p.x += aEnd*uWind*0.33;
      vE = aEnd; gl_Position = projectionMatrix*modelViewMatrix*vec4(p, 1.0); }`,
  fragmentShader: `uniform float uA; varying float vE; void main(){ gl_FragColor = vec4(0.84, 0.9, 0.96, uA*(0.75 - 0.5*vE)); }` });
const rainLines = new THREE.LineSegments(rainGeo, rainMat); rainLines.frustumCulled = false; rainLines.renderOrder = 4; rainLines.visible = false; dio.add(rainLines);
// stars and a moon behind the island at night
const dStarGeo = new THREE.BufferGeometry();
{ const p = [], R = mulberry32(1234); while(p.length < 1500){ const v = new THREE.Vector3(R()*2 - 1, R(), R()*2 - 1); if(v.length() > 1 || v.y < 0.08) continue; v.normalize().multiplyScalar(1400); p.push(v.x, v.y, v.z); }
  dStarGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const stars = new THREE.Points(dStarGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
stars.renderOrder = -4; dio.add(stars);
const moon = new THREE.Mesh(new THREE.SphereGeometry(38, 20, 14), new THREE.MeshBasicMaterial({ color: '#f4f1e2', transparent: true, opacity: 0, depthWrite: false, fog: false }));
moon.renderOrder = -4; dio.add(moon);
// the lighthouse sweeps the bay at night
const beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uOp: { value: 0 } },
  vertexShader: 'varying float vV; void main(){ vV = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
  fragmentShader: 'uniform float uOp; varying float vV; void main(){ gl_FragColor = vec4(vec3(1.0, 0.93, 0.74)*uOp*pow(vV, 2.2), 1.0); }' });
beamMat.opacity = 0;
const beam = new THREE.Mesh(new THREE.ConeGeometry(3.2, 34, 18, 1, true).translate(0, -17, 0).rotateZ(Math.PI/2), beamMat);
if(VB.lighthouse){ beam.position.set(0, 11.1, 0); VB.lighthouse.add(beam); }
// rain and thunder you can hear (through the master gain, so muting silences them)
let rainSnd = null;
function noiseBuf(sec){ const b = AC.createBuffer(1, AC.sampleRate*sec, AC.sampleRate), d = b.getChannelData(0); for(let i=0;i<d.length;i++) d[i] = Math.random()*2 - 1; return b; }
function rainSound(k){
  if(!AC || !master) return;
  if(!rainSnd){ const src = AC.createBufferSource(); src.buffer = noiseBuf(2); src.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.6;
    const g = AC.createGain(); g.gain.value = 0; src.connect(bp).connect(g).connect(master); src.start(); rainSnd = g; }
  rainSnd.gain.setTargetAtTime(k*0.09, AC.currentTime, 0.5);
}
function thunder(){
  if(!AC || !master) return;
  const src = AC.createBufferSource(); src.buffer = noiseBuf(3);
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; const g = AC.createGain(), t0 = AC.currentTime;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.5, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.8);
  src.connect(lp).connect(g).connect(master); src.start();
}
const C_GREY_D = new THREE.Color('#7f8a92'), C_GREY_L = new THREE.Color('#c9d6dc'), C_W = new THREE.Color('#ffffff'), wxCol = new THREE.Color(), wxCol2 = new THREE.Color();
function advanceClock(dt, running){
  if(running && !wasRunning) runF0 = clockF;
  wasRunning = running;
  const prev = clockF;
  if(running) clockF = (runF0 + stateT/RUN*RUN_DAYS) % 1;
  else if(clockRun && state !== 'intro') clockF = (clockF + dt/DAY_LEN) % 1;
  const crossed = x => prev < x ? clockF >= x || clockF < prev : clockF >= x && clockF < prev;
  if(clockF !== prev && (crossed(0.25) || crossed(0.75))) rollWeather();
  wx.hold = Math.max(0, wx.hold - dt);
  return clockF;
}
function applyWeather(dt, t, running, dayW, duskW, nightW){
  const rate = Math.min(1, dt*(running ? 1.6 : 0.4));
  let p = [0, 0, 0, 0, 0, 0, 0];
  for(const k of WX){ wx.w[k] += ((k === wx.cur ? 1 : 0) - wx.w[k])*rate; const P = WX_P[k]; for(let i=0;i<7;i++) p[i] += P[i]*wx.w[k]; }
  [wx.sun, wx.cloud, wx.rain, wx.fog, wx.wind, wx.grey, wx.wave] = p;
  const g = wx.grey, bright = dayW + duskW*0.6 + nightW*0.12;
  // light
  const ts = t*(running ? 3 : 1), brk = smooth(0.4, 0.62, 0.5 + 0.3*Math.sin(ts*0.21) + 0.2*Math.sin(ts*0.57 + 1.7));
  wx.brk = brk; sunL.intensity *= wx.sun + wx.w.cloudy*(brk*0.5 - 0.22); sunL.color.lerp(C_W, g*0.6);
  hemiL.intensity *= 1 - 0.15*g; hemiL.color.lerp(wxCol.set('#c9d0d4'), g*0.6);
  // lightning
  if(wx.w.storm > 0.5){ wx.nextFlash -= dt; if(wx.nextFlash < 0){ wx.flash = 1; wx.nextFlash = 2.5 + Math.random()*6; setTimeout(thunder, 300 + Math.random()*900); } }
  wx.flash *= Math.exp(-dt*6); const fl = wx.flash*(0.6 + 0.4*Math.sin(t*60));
  hemiL.intensity += fl*2.6;
  // sky: greys over in bad weather, pales in fog
  wxCol.copy(C_GREY_D).lerp(C_GREY_L, clamp(wx.w.fog + wx.w.cloudy*0.6, 0, 1)).multiplyScalar(bright);
  bgMat.uniforms.top.value.lerp(wxCol, g*0.85).addScalar(fl*0.35);
  bgMat.uniforms.bot.value.lerp(wxCol2.copy(wxCol).multiplyScalar(0.85), g*0.85).addScalar(fl*0.25);
  // fog
  const fk = wx.fog; dio.fog.color.copy(bgMat.uniforms.bot.value).lerp(bgMat.uniforms.top.value, 0.4);
  dio.fog.near = lerp(1500, 150, fk); dio.fog.far = lerp(5000, 560, fk);
  portalU.uFogC.value.copy(dio.fog.color); portalU.uFogN.value = dio.fog.near; portalU.uFogF.value = dio.fog.far;
  portalU.uDay.value *= 1 - 0.35*g; portalU.uRain.value = wx.rain; portalU.uGrey.value = g;
  // lamps and windows come on under a dark sky
  winMat.emissiveIntensity += g*0.6*dayW; lampMat.emissiveIntensity += g*0.9*dayW;
  // clouds: the shadow casters swell, the island's clouds thicken and darken
  clouds.forEach((c, i) => { c.g.scale.setScalar(0.6 + wx.cloud*1.2); c.g.visible = i < 3 + wx.cloud*10; });
  portalU.uCloudS.value = smooth(0.25, 0.7, wx.cloud)*(dayW + duskW*0.6)*(1 - 0.5*wx.fog);
  cloudCol.copy(C_W).lerp(C_CDUSK, duskW*0.6).lerp(C_CGREY, g*0.85).lerp(C_CNIGHT, nightW*0.7).multiplyScalar(0.35 + 0.65*bright).addScalar(fl*0.3);
  const cover = 0.12 + 0.88*wx.cloud, cx = dioCam.position.x - controls.target.x, cz = dioCam.position.z - controls.target.z, cl = Math.hypot(cx, cz) || 1;
  for(const m of skyClouds){ const u = m.userData; u.a += dt*(running ? 0.22 : 0.01)*(0.4 + wx.wind)*u.sp;
    const dx = Math.cos(u.a), dz = Math.sin(u.a), facing = (dx*cx + dz*cz)/cl;
    const o = smooth(u.k, u.k + 0.12, cover)*(1 - smooth(0.05, 0.45, facing))*(0.75 + 0.25*wx.cloud);
    m.visible = o > 0.01; if(!m.visible) continue;
    m.material.opacity = o; m.material.color.copy(cloudCol);
    const w = u.w*(0.8 + 0.45*wx.cloud); m.scale.set(w, w*0.5, 1);
    m.position.set(dx*u.r, u.y + Math.sin(t*0.2 + u.bob)*1.2, dz*u.r - 10); }
  // rain
  rainLines.visible = wx.rain > 0.02; rainMat.uniforms.uT.value = t; rainMat.uniforms.uA.value = 0.25 + 0.45*wx.rain; rainMat.uniforms.uWind.value = wx.wind*1.2;
  rainGeo.setDrawRange(0, Math.round(wx.rain*RAIN_N)*2);
  rainSound(mode === 'village' ? wx.rain : 0);
  // everything gets wet, and dries slowly
  wx.wet += ((wx.rain > 0.3 ? 1 : 0) - wx.wet)*Math.min(1, dt*(wx.rain > 0.3 ? 0.25 : 0.06));
  vcMat.color.setScalar(1 - 0.2*wx.wet); vcMat.roughness = 0.82 - 0.4*wx.wet;
  if(dioGround){ dioGround.color.setScalar(1 - 0.22*wx.wet); dioGround.roughness = 0.95 - 0.4*wx.wet; }
  // wind in the trees
  const sw = 0.15 + wx.wind*1.4;
  for(const s of SWAY){ s.g.rotation.z = Math.sin(t*(1.1 + wx.wind) + s.ph)*0.022*s.k*sw; s.g.rotation.x = Math.cos(t*0.9 + s.ph*1.3)*0.014*s.k*sw; }
  // night sky
  const clearSky = 1 - g;
  stars.material.opacity = nightW*clearSky*0.9;
  moon.position.copy(moonL.position).normalize().multiplyScalar(1300); moon.material.opacity = nightW*clearSky;
  beamMat.uniforms.uOp.value = smooth(0.2, 0.7, nightW + g*0.4)*(0.22 + 0.3*fk); beam.rotation.y = t*0.7;
  renderClock();
}
let clockTxt = '';
function renderClock(){
  const h = Math.floor(clockF*24), m = Math.floor((clockF*24 - h)*60);
  const night = clockF < 0.23 || clockF > 0.79, icon = night && (wx.cur === 'clear' || wx.cur === 'cloudy') ? 'moon' : WX_ICON[wx.cur];
  const txt = `${String(h).padStart(2, '0')}:${String(m - m % 5).padStart(2, '0')}|${wx.cur}|${icon}|${clockRun}`;
  if(txt === clockTxt) return; clockTxt = txt;
  $('clockT').textContent = `${String(h).padStart(2, '0')}:${String(m - m % 5).padStart(2, '0')}`;
  $('wxName').textContent = WX_NAME[wx.cur];
  $('wxBtn').querySelector('use').setAttribute('href', '#i-' + icon);
  $('clockBtn').querySelector('use').setAttribute('href', clockRun ? '#i-pause' : '#i-play');
}
$('wxBtn').addEventListener('click', () => { wx.cur = WX[(WX.indexOf(wx.cur) + 1) % WX.length]; wx.hold = 120; chime(1); });
$('clockBtn').addEventListener('click', () => { clockRun = !clockRun; chime(1); });

const C_DUSK = new THREE.Color('#ffb070'), C_NIGHT = new THREE.Color('#5a6f9a'), tmpCol = new THREE.Color();
let plumeV = 0, bloomV = 0, dayF = 0.42, dioNight = 0;
function updateDiorama(dt){
  const t = time, running = state === 'running';
  // --- time of day: a fixed late morning while planning, three fast days while the season runs
  const prevF = dayF;
  dayF = advanceClock(dt, running);
  const elev = Math.sin(2*Math.PI*(dayF - 0.25));
  const dayW = smooth(-0.02, 0.32, elev), nightW = smooth(0.02, -0.22, elev), duskW = Math.max(0, 1 - dayW - nightW);
  sunL.position.set(-Math.cos(2*Math.PI*(dayF - 0.25))*150, Math.max(elev, 0.03)*150 + 10, 70);
  sunL.intensity = 2.7*dayW + 1.5*duskW; sunL.color.set('#fff0dc').lerp(C_DUSK, duskW);
  hemiL.intensity = 0.5 + 0.65*dayW + 0.3*duskW; hemiL.color.set('#fff6e8').lerp(C_NIGHT, nightW);
  moonL.intensity = 1.1*nightW;
  bgMat.uniforms.top.value.copy(SKY.day[0]).multiplyScalar(dayW).add(tmpCol.copy(SKY.dusk[0]).multiplyScalar(duskW)).add(tmpCol.copy(SKY.night[0]).multiplyScalar(nightW));
  bgMat.uniforms.bot.value.copy(SKY.day[1]).multiplyScalar(dayW).add(tmpCol.copy(SKY.dusk[1]).multiplyScalar(duskW)).add(tmpCol.copy(SKY.night[1]).multiplyScalar(nightW));
  winMat.emissiveIntensity = nightW*2.0 + duskW*0.7; lampMat.emissiveIntensity = nightW*2.0 + duskW*0.7 + (V.pol.work === 'festival' ? 1.2 : 0);
  dioNight = nightW; portalU.uDay.value = dayW + duskW*0.7;
  applyWeather(dt, t, running, dayW, duskW, nightW);
  // --- the season colours the trees
  const si = V.season % 4, sk = Math.min(1, dt*(running ? 0.8 : 3));
  for(const m of canopyMats){ const alt = m.userData.v < (si === 2 ? 0.45 : 0.3); tmpCol.copy(alt ? SEASON_ALT[si] : SEASON_COL[si]).offsetHSL((m.userData.v - 0.5)*0.04, 0, (m.userData.v - 0.5)*0.08); m.color.lerp(tmpCol, sk); }
  grassTint.value.lerp(GRASS_TINT[si], sk);
  // --- clouds race across during the time-lapse
  for(const c of clouds){ c.g.position.x += dt*(running ? 34 : 1.2 + wx.wind*5)*c.sp; if(c.g.position.x > 120) c.g.position.x = -120; }
  controls.autoRotate = (running || state === 'intro') && !zoom; controls.autoRotateSpeed = state === 'intro' ? 0.6 : 1.4;
  $('village').classList.toggle('running', running);
  if(running){
    $('montage').classList.add('on');
    $('montage').querySelector('.ms').textContent = seasonName(V.season);
    $('montage').querySelector('.md').textContent = `第 ${Math.min(90, Math.floor(stateT/RUN*90) + 1)} 天`;
    $('montage').querySelector('.mb i').style.width = `${Math.min(100, stateT/RUN*100)}%`;
    if(prevF < 0.74 && dayF >= 0.74){
      if(V.pol.fish !== 'ban' && V.boats + V.trawlers > 0) coin('◎', new THREE.Vector3(8, 3, 6));
      if(V.pol.tour !== 'closed' && V.shops + V.resort > 0) coin('◎', new THREE.Vector3(-18, 4, -1), '#1f8a8a');
    }
  } else $('montage').classList.remove('on');
  // --- ocean in miniature
  const wp = wTopGeo.attributes.position;
  for(let i=0;i<wp.count;i++){ const x = wBase[i*3], z = wBase[i*3 + 2]; wp.setY(i, wBase[i*3 + 1] + (Math.sin(x*0.35 + t*(1.4 + wx.wind*0.8))*0.08 + Math.cos(z*0.3 + t*1.1)*0.07)*wx.wave); }
  wp.needsUpdate = true; wTopGeo.computeVertexNormals();
  foamMat.opacity = (0.4 + 0.2*Math.sin(t*1.8))*(0.25 + 0.75*(dayW + duskW))*(1 + wx.wind*0.5);
  // --- village
  updateTown(dt); updateTown2(dt, running, elev); updateFleet(dt, t); updatePuffs(dt);
  popTo(VB.resort, V.resort > 0, dt); popTo(VB.plant, V.plant > 0, dt); popTo(VB.recycle, V.recycle > 0, dt);
  { const wideK = V.pol.zone === 'wide' ? 1.45 : 1;
    VB.buoys.forEach(g => { const a = g.userData.a, x = -1 + Math.cos(a)*33*wideK, z = 34 + Math.sin(a)*13.5*wideK;
      const inWater = z > 13 && z < 49.3 && Math.abs(x) < 49 && dioH(x, z) < -1;
      popTo(g, V.pol.zone !== 'none' && inWater, dt); g.position.set(x, 0.2 + Math.sin(t*1.5 + x)*0.12, z); }); }
  plumeV += (clamp((eco.nutr || 0)*1.8, 0, 1) - plumeV)*Math.min(1, dt*0.5);
  portalU.uPlume.value = plumeV; portalU.uBloom.value = bloomV; portalU.uT.value = t;
  VB.outfall.visible = V.pol.waste !== 'full' || plumeV > 0.05;
  updateDeadFish(t);
  popTo(VB.cold, V.cold > 0, dt); popTo(VB.nursery, V.nursery > 0, dt); popTo(VB.school, V.school > 0, dt);
  VB.frames.forEach(f => { f.visible = V.nursery > 0; });
  // --- boats: out at first light, home at dusk, every day of the montage
  const out = running && elev > 0.08;
  for(const b of dBoats){
    const n = b.role === 'line' ? V.boats : b.role === 'trawl' ? V.trawlers : V.shops + V.resort;
    const active = b.idx < n; b.g.visible = active;
    if(!active) continue;
    if(out && b.away){ if(b.path){ if(b.pos.distanceTo(b.path[b.path.k]) < 0.8) b.path.k ^= 1; b.tgt.copy(b.path[b.path.k]); } else b.tgt.copy(b.away); }
    else b.tgt.copy(b.home);
    const dx = b.tgt.x - b.pos.x, dz = b.tgt.z - b.pos.z, d = Math.hypot(dx, dz);
    if(d > 0.3){ const st = Math.min(d, (running ? (b.path && out ? 22 : 40) : 16)*dt); b.pos.x += dx/d*st; b.pos.z += dz/d*st;
      const h = Math.atan2(dx, dz); b.head += Math.atan2(Math.sin(h - b.head), Math.cos(h - b.head))*Math.min(1, dt*6); }
    else if(!out) b.head += Math.atan2(Math.sin(-b.head), Math.cos(-b.head))*Math.min(1, dt*3);
    b.g.position.set(b.pos.x, 0.12 + Math.sin(t*1.6 + b.ph)*0.1*wx.wave, b.pos.z);
    b.g.rotation.set(Math.sin(t*1.1 + b.ph)*0.04*wx.wave, b.head, Math.sin(t*1.3 + b.ph)*0.05*wx.wave, 'YXZ');
    if(b.g.userData.net) b.g.userData.net.visible = out && !!b.path && V.pol.fish === 'industrial' && V.pol.zone !== 'wide';
  }
  updatePeople(dt, running, nightW);
  // --- floating money
  coins.forEach(c => { c.t += dt; tmp.copy(c.p); tmp.y += c.t*3; tmp.project(dioCam);
    c.el.style.transform = `translate(${(tmp.x*0.5 + 0.5)*innerWidth - 20}px, ${(-tmp.y*0.5 + 0.5)*innerHeight}px)`;
    c.el.style.opacity = c.t > 2 ? 0 : 1; if(c.t > 2.6){ c.el.remove(); c.dead = true; } });
  for(let i=coins.length-1;i>=0;i--) if(coins[i].dead) coins.splice(i, 1);
}
const coins = [];
function coin(text, p, color = '#a8631c'){
  if($('village').classList.contains('modal')) return;
  const el = document.createElement('div'); el.className = 'coin'; el.textContent = text; el.style.color = color; document.body.appendChild(el);
  coins.push({ el, p: p.clone(), t: 0 });
}
function sendBoatsOut(){
  const P = V.pol, fishing = P.fish !== 'ban', protect = P.zone !== 'none';
  for(const b of dBoats){
    b.path = null; b.away = null;
    if(b.role === 'tour'){
      if(P.tour === 'closed' || (P.tour === 'limited' && b.idx % 2)) continue;
      const R = DREEF[(b.idx*2 + 1) % DREEF.length]; b.away = new THREE.Vector3(R[0] + 4, 0, R[1] - 3); continue;
    }
    if(!fishing) continue;
    if(b.role === 'trawl'){
      if(P.fish === 'line') continue;
      if(P.fish === 'industrial' && P.zone !== 'wide'){
        const z = protect ? (b.idx % 2 ? 17 : 47) : 27 + b.idx*7;
        b.path = [new THREE.Vector3(-42, 0, z), new THREE.Vector3(42, 0, z)]; b.path.k = 0; b.away = b.path[0]; continue;
      }
    }
    if(P.fish === 'quota' && b.role === 'line' && b.idx % 3 === 2) continue;
    if(protect){ const side = b.idx % 2 ? 1 : -1; b.away = new THREE.Vector3(side*(42 + rng()*5), 0, 16 + rng()*30); }
    else { const R = DREEF[b.idx % DREEF.length]; b.away = new THREE.Vector3(R[0] + (rng() - .5)*8, 0, R[1] + (rng() - .5)*6); }
  }
}

// ======================================================================= audio extras
let engine = null;
function startEngine(){
  if(!AC) return;
  const o1 = AC.createOscillator(), o2 = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain();
  o1.type = 'sawtooth'; o1.frequency.value = 46; o2.type = 'square'; o2.frequency.value = 92.7;
  lp.type = 'lowpass'; lp.frequency.value = 170; g.gain.value = 0;
  o1.connect(lp); o2.connect(lp); lp.connect(g).connect(master); o1.start(); o2.start(); engine = { o1, o2, g };
}
function stopEngine(){
  if(!engine) return; const e = engine; engine = null;
  e.g.gain.setTargetAtTime(0, AC.currentTime, 0.8); setTimeout(() => { e.o1.stop(); e.o2.stop(); }, 5000);
}
