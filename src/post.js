'use strict';
// ======================================================================= post: volumetric light shafts, composite, grade
const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const volMat = new THREE.ShaderMaterial({
  defines: { STEPS: Q.steps },
  uniforms: { ...U, tDepth: { value: sceneRT.depthTexture }, uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() }, uFrame: { value: 0 }, uVolGain: { value: 1 } },
  vertexShader: FS_VERT,
  fragmentShader: COMMON + /* glsl */`
  uniform sampler2D tDepth; uniform mat4 uProjInv; uniform mat4 uViewInv; uniform vec3 uCamPos; uniform float uFrame; uniform float uVolGain;
  varying vec2 vUv;
  float shadow1(vec3 p){
    vec4 sc = uShadowMat * vec4(p, 1.0); vec3 q = sc.xyz * 0.5 + 0.5;
    if(q.x <= 0.0 || q.x >= 1.0 || q.y <= 0.0 || q.y >= 1.0) return 1.0;
    return step(q.z - 0.002, textureLod(uShadowMap, q.xy, 0.0).r);
  }
  float shaft(vec3 p){
    vec2 q = p.xz + uSunDir.xz / uSunDir.y * (SURF - p.y);
    float n = vnoise(q * 0.085 + vec2(uTime*0.05, uTime*0.02)) * 0.62 + vnoise(q * 0.21 - vec2(uTime*0.08, -uTime*0.03)) * 0.38;
    float s = smoothstep(0.48, 0.8, n);
    return mix(s * 1.6, 0.45, clamp((SURF - p.y) / 50.0, 0.0, 1.0) * 0.5);
  }
  void main(){
    float d = texture2D(tDepth, vUv).r;
    vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, min(d, 0.999) * 2.0 - 1.0, 1.0); v /= v.w;
    vec3 wp = (uViewInv * v).xyz;
    vec3 ro = uCamPos, rd = wp - ro; float dist = length(rd); rd /= dist;
    if(d >= 1.0) dist = 1e4;
    float tMax = min(dist, 80.0);
    if(rd.y > 0.0) tMax = min(tMax, (SURF - ro.y) / rd.y);
    float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy + mod(uFrame, 64.0) * vec2(5.588, 7.123), vec2(0.06711056, 0.00583715))));
    vec3 ext = uAbs + uSca; vec3 acc = vec3(0.0);
    float dt = tMax / float(STEPS);
    for(int i = 0; i < STEPS; i++){
      float t = (float(i) + j) * dt; vec3 p = ro + rd * t;
      acc += sunAt(p.y) * exp(-ext * t) * shadow1(p) * shaft(p);
    }
    acc *= dt;
    float ph = hg(dot(rd, uSunDir), 0.78);
    gl_FragColor = vec4(acc * uSca * ph * uVolGain, 1.0);
  }`,
  depthTest: false, depthWrite: false,
});
const volQuad = new FullScreenQuad(volMat);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
const compositePass = new ShaderPass(new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, tScene: { value: sceneRT.texture }, tVol: { value: volRT.texture }, uVolTexel: { value: new THREE.Vector2() }, uTime: U.uTime, uDbg: { value: +(params.get('dbg') || 0) } },
  vertexShader: FS_VERT,
  fragmentShader: /* glsl */`
  uniform sampler2D tScene; uniform sampler2D tVol; uniform vec2 uVolTexel; uniform float uTime; uniform float uDbg; varying vec2 vUv;
  void main(){
    vec2 uv = vUv + vec2(sin(vUv.y*17.0 + uTime*1.2), cos(vUv.x*13.0 + uTime*1.0)) * 0.0011;
    vec2 c = uv - 0.5; float r2 = dot(c, c);
    vec3 col = vec3(texture2D(tScene, uv + c*r2*0.014).r, texture2D(tScene, uv).g, texture2D(tScene, uv - c*r2*0.014).b);
    vec3 v = texture2D(tVol, uv).rgb * 0.36;
    v += (texture2D(tVol, uv + vec2(uVolTexel.x, 0.0)*1.5).rgb + texture2D(tVol, uv - vec2(uVolTexel.x, 0.0)*1.5).rgb
        + texture2D(tVol, uv + vec2(0.0, uVolTexel.y)*1.5).rgb + texture2D(tVol, uv - vec2(0.0, uVolTexel.y)*1.5).rgb) * 0.16;
    if(uDbg > 1.5 && uDbg < 2.5) col = v; else if(uDbg < 0.5) col += v;
    uvec3 bits = floatBitsToUint(col) & uvec3(0x7f800000u);
    bool bad = any(equal(bits, uvec3(0x7f800000u)));
    if(bad) col = uDbg > 2.5 ? vec3(50.0, 0.0, 50.0) : vec3(0.0);
    gl_FragColor = vec4(min(col, vec3(60.0)), 1.0);
  }`,
}));
composer.addPass(compositePass);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.6, 1.1);
composer.addPass(bloom);
const finalPass = new ShaderPass(new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, uExposure: { value: 1 }, uTime: U.uTime, uRes: { value: new THREE.Vector2() } },
  vertexShader: FS_VERT,
  fragmentShader: /* glsl */`
  uniform sampler2D tDiffuse; uniform float uExposure; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
  vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03)) / (x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main(){
    vec3 col = texture2D(tDiffuse, vUv).rgb * uExposure;
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, 1.14);
    col = aces(col);
    vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    col *= mix(1.0, smoothstep(1.15, 0.25, length(q)), 0.55);
    col = pow(col, vec3(1.0/2.2));
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.32);
    col += (hash(vUv * uRes + fract(uTime * 7.3) * 100.0) - 0.5) * 0.022;
    gl_FragColor = vec4(col, 1.0);
  }`,
}));
composer.addPass(finalPass);

function resize(){
  const w = innerWidth, h = innerHeight, pr = Q.pr;
  renderer.setPixelRatio(pr); renderer.setSize(w, h);
  sceneRT.setSize(Math.floor(w*pr), Math.floor(h*pr));
  volRT.setSize(Math.floor(w*pr/2), Math.floor(h*pr/2));
  composer.setPixelRatio(pr); composer.setSize(w, h);
  compositePass.uniforms.uVolTexel.value.set(1/(w*pr/2), 1/(h*pr/2));
  finalPass.uniforms.uRes.value.set(w*pr, h*pr);
  camera.aspect = w/h; camera.updateProjectionMatrix();
  if(window.dioCam){ dioCam.aspect = w/h; window.dioOff = w > 900 ? Math.min(170, w*0.11) : 0; applyDioOffset(window.dioOffK ?? 1); }
}
addEventListener('resize', resize); resize();

function applyDioOffset(k){
  window.dioOffK = k; const w = innerWidth, h = innerHeight, off = (window.dioOff || 0)*k;
  if(off > 0.5) dioCam.setViewOffset(w, h, off, -h*0.02*k, w, h); else dioCam.clearViewOffset();
  dioCam.updateProjectionMatrix();
}
let SH = 62;
const shadowCam = new THREE.OrthographicCamera(-SH, SH, SH, -SH, 1, 240);
shadowCam.layers.set(1);
const _r = new THREE.Vector3(), _u = new THREE.Vector3();
function setShadowExtent(e){
  if(SH === e) return; SH = e;
  Object.assign(shadowCam, { left: -e, right: e, top: e, bottom: -e }); shadowCam.updateProjectionMatrix(); U.uShadowTexel.value = 1/Q.shadow;
}
function updateShadowCam(center){
  shadowCam.position.copy(center).addScaledVector(U.uSunDir.value, 120); shadowCam.lookAt(center); shadowCam.updateMatrixWorld();
  const texel = 2*SH/Q.shadow;
  _r.setFromMatrixColumn(shadowCam.matrixWorld, 0); _u.setFromMatrixColumn(shadowCam.matrixWorld, 1);
  const px = shadowCam.position.dot(_r), py = shadowCam.position.dot(_u);
  shadowCam.position.addScaledVector(_r, Math.round(px/texel)*texel - px).addScaledVector(_u, Math.round(py/texel)*texel - py);
  shadowCam.updateMatrixWorld();
  U.uShadowMat.value.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
}
function renderFrame(){
  for(const c of casters) c[0].material = c[2];
  renderer.setRenderTarget(shadowRT); renderer.render(scene, shadowCam);
  for(const c of casters) c[0].material = c[1];
  renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
  volMat.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
  volMat.uniforms.uViewInv.value.copy(camera.matrixWorld);
  volMat.uniforms.uCamPos.value.copy(camera.position);
  volMat.uniforms.uFrame.value++;
  renderer.setRenderTarget(volRT); volQuad.render(renderer);
  renderer.setRenderTarget(null);
  composer.render();
}

// ======================================================================= audio (tiny procedural bed)
let AC = null, padGain = null, master = null;
// sound only plays while the page is actually in front of the player: muted when the tab is hidden or the window loses focus,
// muted outright with ?mute=1, and toggled with M
let userMuted = params.get('mute') === '1';
function applyMute(){
  if(!AC || !master) return;
  const on = !userMuted && document.visibilityState === 'visible' && document.hasFocus();
  master.gain.setTargetAtTime(on ? 0.4 : 0, AC.currentTime, 0.15);
}
document.addEventListener('visibilitychange', applyMute);
addEventListener('blur', applyMute); addEventListener('focus', applyMute);
addEventListener('keydown', e => { if(e.code === 'KeyM'){ userMuted = !userMuted; applyMute(); } });
// the bed: soft surf that swells and draws back (mid and high frequencies only, no rumble), and a slow, quiet
// pentatonic pad with now and then a bell note. Underwater the surf is muffled and the pad sits closer.
let surfLP = null, surfG = null, audioUnder = null;
function initAudio(){
  try{
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0; master.connect(AC.destination); applyMute();
    // pink-ish noise for the surf
    const buf = AC.createBuffer(1, AC.sampleRate*6, AC.sampleRate), d = buf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for(let i=0;i<d.length;i++){ const w = Math.random()*2 - 1; b0 = 0.997*b0 + 0.029591*w; b1 = 0.985*b1 + 0.032534*w; b2 = 0.95*b2 + 0.048056*w; d[i] = (b0 + b1 + b2 + w*0.18)*0.9; }
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320; hp.Q.value = 0.5;
    surfLP = AC.createBiquadFilter(); surfLP.type = 'lowpass'; surfLP.frequency.value = 2400; surfLP.Q.value = 0.4;
    surfG = AC.createGain(); surfG.gain.value = 0.0;
    src.connect(hp).connect(surfLP).connect(surfG).connect(master); src.start();
    // each wave: rises over ~2.5 s, falls away over ~4 s, a pause, the next one (8–12 s apart)
    const wave = () => { if(!AC) return; const t = AC.currentTime, peak = (audioUnder ? 0.025 : 0.06)*(0.7 + Math.random()*0.5), up = 2 + Math.random()*1.2, down = 3.5 + Math.random()*1.5;
      surfG.gain.cancelScheduledValues(t); surfG.gain.setValueAtTime(surfG.gain.value, t);
      surfG.gain.linearRampToValueAtTime(peak, t + up); surfG.gain.linearRampToValueAtTime(peak*0.18, t + up + down);
      setTimeout(wave, (up + down + 1.5 + Math.random()*3)*1000); };
    wave();
    // the pad: three soft voices per chord, chords change every ~9 s, each voice fades in and out slowly
    padGain = AC.createGain(); padGain.gain.value = 0; padGain.connect(master);
    const CH = [[293.66, 369.99, 440], [246.94, 293.66, 369.99], [329.63, 440, 493.88], [220, 293.66, 369.99], [293.66, 440, 587.33]];
    let ci = 0;
    const chord = () => { if(!AC) return; const t = AC.currentTime, notes = CH[ci++ % CH.length], len = 10;
      notes.forEach((f, n) => { const o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
        o.type = n ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5)*8;
        lp.type = 'lowpass'; lp.frequency.value = 1400;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.022, t + 3.5); g.gain.setValueAtTime(0.022, t + len - 3.5); g.gain.linearRampToValueAtTime(0, t + len + 1);
        o.connect(lp).connect(g).connect(padGain); o.start(t); o.stop(t + len + 1.2); });
      setTimeout(chord, 9000); };
    chord();
    // a bell now and then, high and quiet, from the same scale
    const BELL = [587.33, 659.25, 739.99, 880, 987.77, 1174.66];
    const bell = () => { if(!AC) return; const t = AC.currentTime, f = BELL[Math.floor(Math.random()*BELL.length)];
      for(const [m, a] of [[1, 0.03], [2.76, 0.008]]){ const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f*m;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0003, t + 3.2);
        o.connect(g).connect(padGain); o.start(t); o.stop(t + 3.3); }
      setTimeout(bell, 4000 + Math.random()*7000); };
    setTimeout(bell, 3000);
  }catch(e){ AC = null; }
}
// shore or underwater: underwater the surf is muffled and quieter
function setAudioScene(under){
  if(!AC || !surfLP || under === audioUnder) return; audioUnder = under;
  surfLP.frequency.setTargetAtTime(under ? 650 : 2400, AC.currentTime, 0.6);
}
function chime(step){
  if(!AC) return; const scale = [293.66, 369.99, 440, 587.33, 739.99, 880, 1174.66], t0 = AC.currentTime;
  [0, 2, 4].forEach((k, n) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine';
    o.frequency.value = scale[(step + k) % scale.length] * (step + k >= scale.length ? 2 : 1);
    g.gain.setValueAtTime(0, t0 + n*0.13); g.gain.linearRampToValueAtTime(0.1, t0 + n*0.13 + 0.03); g.gain.exponentialRampToValueAtTime(0.0005, t0 + n*0.13 + 2.6);
    o.connect(g).connect(master); o.start(t0 + n*0.13); o.stop(t0 + n*0.13 + 2.8); });
}

// ======================================================================= input
const keys = {}; let mouseX = 0, mouseY = 0, mouseDown = false, mouseSeen = false;
addEventListener('keydown', e => { keys[e.code] = true; if(e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('pointermove', e => { mouseX = e.clientX/innerWidth*2 - 1; mouseY = -(e.clientY/innerHeight*2 - 1); mouseSeen = true; });
addEventListener('pointerdown', () => mouseDown = true); addEventListener('pointerup', () => mouseDown = false);
// while diving, the mouse turns the view; click the picture to lock the cursor, Esc to release it
let lookDX = 0, lookDY = 0, lookIdle = 9, keysTimer = 0;
function showKeys(){ const k = document.getElementById('keys'); k.classList.add('on'); clearTimeout(keysTimer); keysTimer = setTimeout(() => k.classList.remove('on'), 12000); }
addEventListener('keydown', e => { if(e.code === 'KeyH' && window.__diving){ const k = document.getElementById('keys'); if(k.classList.contains('on')){ k.classList.remove('on'); clearTimeout(keysTimer); } else showKeys(); } });
addEventListener('mousemove', e => { if(window.__diving){ lookDX += e.movementX || 0; lookDY += e.movementY || 0; if(e.movementX || e.movementY) lookIdle = 0; } });
document.querySelector('canvas#c').addEventListener('click', () => { if(window.__diving && document.pointerLockElement !== document.querySelector('canvas#c')){ try{ document.querySelector('canvas#c').requestPointerLock(); }catch(err){} } });
addEventListener('blur', () => { mouseDown = false; for(const k in keys) keys[k] = false; });
const dead = v => { const a = Math.abs(v); return a < 0.1 ? 0 : Math.sign(v)*Math.min(1, (a - 0.1)/0.6); };
