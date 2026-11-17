'use strict';
// ======================================================================= flow
let mode = 'dive', state = 'intro', stateT = 0, time = 0, H = 1, toastTimer = 0, edgeWarned = 0, pulseT = 99;
let murk = 0, night = 0, nightT = 0, riseT = 1, noRespawn = false, exploreDone = false, cues = [], returnTo = 'plan', firstVillage = true;
let regStart = 1, endingKind = null;
patchLife.fill(1);
const tmpP = new THREE.Vector3();
const POIS = [
  { name: '鱼群', pos: () => tmpP.set(SCHOOLS[sBait].x, SCHOOLS[sBait].y0, SCHOOLS[sBait].z),
    kicker: '饵球', text: '两千条鱼，像一个生命一样游动。' },
  { name: '海龟', pos: () => turtle.position,
    kicker: '绿海龟', text: '黄刺尾鲷在替它清理背甲。这里的每个生命都在为别人工作。' },
  { name: '海葵', pos: () => tmpP.set(ANEMONE_SPOTS[0].x, ANEMONE_SPOTS[0].y, ANEMONE_SPOTS[0].z),
    kicker: '海葵', text: '小丑鱼从不离开它。这是它们一生唯一的家。' },
];
function setState(s){ state = s; stateT = 0; cues = []; }
function cue(at, fn){ cues.push({ at, fn, done: false }); }
function toast(kicker, text, ms = 5200){
  $('toast').innerHTML = `<small>${kicker}</small>${text}`; $('toast').classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('on'), ms);
}
function objective(t){ if($('objective').textContent !== t) $('objective').textContent = t; }
function pulseAt(p){ U.uPulse.value.set(p.x, p.y, p.z, 0); pulseT = 0; }
function fade(fn){ const f = $('fade'); f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 150); }, 650); }

// the game opens on the village; the reef is reached by diving from it
function showVillageBackdrop(){
  mode = 'village'; controls.enabled = false; document.body.classList.add('vmode');
  $('keys').classList.remove('on'); $('ptr').classList.remove('on');
}
function start(loaded){
  if(state !== 'intro') return; document.body.classList.add('started');
  POIS.forEach(p => p.found = true); exploreDone = true;
  $('intro').classList.add('off'); $('hud').classList.add('on');
  initAudio();
  enterVillage(() => setState('plan'));
  if(loaded) cue(0.8, () => toast('读取存档', `${seasonName(V.season)} · ${TIERS[devTier(V)].n}。接着上次的地方继续。`, 5000));
  else cue(1.0, () => toast('岸上', '这个渔村靠门前的珊瑚礁过活。由你来经营它。', 5000));
  cue(2.2, () => { if(!coachDone && !params.get('nocoach') && (!loaded || V.season === 0)) showCoach(0); });
}
// ---- switching between the two halves
function enterVillage(next, keepCam){
  mode = 'village'; controls.enabled = true; document.body.classList.add('vmode'); $('village').classList.remove('zooming');
  window.__diving = false; if(document.pointerLockElement) document.exitPointerLock();
  becomeAvatar({ kind: 'manta' }, true); $('avatarCard').classList.remove('on'); $('swap').classList.remove('on');
  if(!keepCam){
    if(savedDioCam){ dioCam.position.copy(savedDioCam.pos); controls.target.copy(savedDioCam.tgt); savedDioCam = null; }
    dioCam.fov = 26; applyDioOffset(1); controls.update();
  }
  $('village').classList.add('on'); $('keys').classList.remove('on'); $('surfaceBtn').classList.remove('on'); $('ptr').classList.remove('on');
  objective(''); stopEngine(); next(); renderVillageUI();
}
function goVillage(next){ if(mode === 'dive' && !rising) startSurfacing(next); else if(!rising) fade(() => enterVillage(next)); }
function enterDive(kind){
  mode = 'dive'; controls.enabled = false; document.body.classList.remove('vmode');
  $('village').classList.remove('on'); $('vPrompt').classList.remove('on'); $('vReport').classList.remove('on');
  $('keys').classList.add('on'); $('hud').classList.add('on');
  becomeAvatar({ kind: 'manta' }, true); $('avatarCard').classList.add('on'); showKeys();
  player.pos.set(14, 22, -70); player.yaw = Math.PI; player.pitch = -0.05; player.yawV = player.pitchV = 0;
  camPos.copy(player.pos).add(tmp.set(0, 5, 12)); camLook.copy(player.pos);
  const want = Math.round(clamp(eco.ghost/0.25, 0, 4)); if(debris.filter(d => d.alive).length !== want) deployNets(want);
  if(kind === 'trawl'){ setState('diveTrawl'); cue(1.5, startTrawl); }
  else if(kind === 'ending'){ setState('ending');
    if(endingKind === 'good'){ nightT = 1; cue(5, () => { spawnU.uSpawn.value = 0.001; chime(0); }); cue(8, () => chime(4)); cue(9, summonWhale); }
    else if(endingKind === 'mid') cue(4, summonWhale);
    cue(2, () => toast(endingKind === 'good' ? '今夜' : '珊瑚礁', endingKind === 'good' ? '礁区上，有什么事就要发生了。' : endingKind === 'mid' ? '还在。少了很多，但还在。' : '听听，这里有多安静。', 6000));
    $('surfaceBtn').classList.add('on'); }
  else { setState('freedive'); startSeaDive(); }
}
function goDive(kind){ fade(() => enterDive(kind)); }

// ---- village UI
const fmt = x => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x));
// change arrows, the same everywhere: green up, red down; one to three arrows for small, clear, large; ? where it is not known
const arrows = (d, unsure) => { const m = Math.abs(d), n = m < 0.004 ? 0 : m < 0.015 ? 1 : m < 0.04 ? 2 : 3;
  return (n ? `<span class="${d > 0 ? 'up' : 'dn'}">${(d > 0 ? '▲' : '▼').repeat(n)}</span>` : '<span class="eq">–</span>') + (unsure ? '<span class="q">?</span>' : ''); };
// after the fact (the report): measured, so arrows and the exact change
const trend = (a, b) => `<span class="tr">${arrows(b - a)}</span><small>${Math.abs(b - a) < 0.0005 ? '' : (b > a ? '+' : '−') + (Math.abs(b - a)*100).toFixed(1)}</small>`;
const ic = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
const POL_ICON = { fish: 'fish', tour: 'mask', zone: 'shield', waste: 'drop', work: 'clock', tax: 'coin' };
const BUILD_INFO = {
  boat: { icon: 'boat', crew: 2, up: '村民 3' }, trawler: { icon: 'trawler', crew: 3, up: '村民 6–12' }, house: { icon: 'house', crew: 0, up: '—' },
  shop: { icon: 'mask', crew: '2–3', up: '村民 2–4' }, resort: { icon: 'hotel', crew: '5–8', up: '村民 6–12' }, cold: { icon: 'snow', crew: 1, up: '村库 2' },
  plant: { icon: 'drop', crew: 1, up: '村库 3' }, recycle: { icon: 'recycle', crew: 1, up: '村库 2' }, nursery: { icon: 'sprout', crew: 2, up: '村库 2' }, school: { icon: 'book', crew: 1, up: '村库 3' }, harbor: { icon: 'anchor', crew: 2, up: '村库 3' }, offshore: { icon: 'ship', crew: 3, up: '村民 6' }, whale: { icon: 'whale', crew: 2, up: '村民 3' }, research: { icon: 'flask', crew: 2, up: '村库 3' } };
V.built = []; V.buildSpent = 0;
function setDelta(id, d, fmtFn){
  const el = $(id); const r = Math.round(d*10)/10;
  el.className = 'dl ' + (Math.abs(r) < 0.5 ? 'eq' : r > 0 ? 'up' : 'dn'); el.textContent = Math.abs(r) < 0.5 ? '' : (fmtFn ? fmtFn(r) : fmt(r));
}
function renderVillageUI(){
  queueAutosave();
  const s = V.season, over = state === 'over';
  $('vSeason').textContent = over ? '四年之后' : seasonName(s);
  $('vTurn').textContent = over ? `${SEASONS_PER_GAME} / ${SEASONS_PER_GAME}` : `${s + 1} / ${SEASONS_PER_GAME}`;
  $('vPips').innerHTML = Array.from({ length: SEASONS_PER_GAME }, (_, i) => `${i && i % 4 === 0 ? '<i class="gap"></i>' : ''}<i class="${i < s || over ? 'done' : i === s ? 'now' : ''}" title="${seasonName(i)}"></i>`).join('');
  $('vMoney').textContent = Math.round(V.money); $('vMoney').style.color = V.money < 0 ? 'var(--coral-d)' : '';
  $('vFood').innerHTML = `${V.food.toFixed(1)}<small> 吨</small>`;
  { const cl = V.cold ? lvOf(V, 'cold', 0) : 0, need = V.pop*0.12, keep = cl ? need : need*0.3, price = 13*SEASON_FX[V.season % 4].price*[1, 1.1, 1.18][cl];
    $('vFood').parentElement.dataset.tip = `存鱼 ${V.food.toFixed(1)} 吨。每季村民吃 ${need.toFixed(1)} 吨（${V.pop} 人 × 0.12），最多留 ${keep.toFixed(1)} 吨过季，其余按 ${price.toFixed(0)}/吨 卖出。留下的鱼每季坏 ${[35, 5, 3][cl]}%${cl ? '' : '（建冷库降到 5%）'}。不够吃时村库按 ${REC.food}/吨 进口。`; }
  $('vPop').innerHTML = `${V.pop}<small> / ${W(V, 'house', [4, 6, 8])}</small>`;
  $('vMorale').textContent = Math.round(V.morale); $('vMorale').style.color = V.morale < 30 ? 'var(--coral-d)' : '';
  $('vMoraleBar').style.width = V.morale + '%';
  $('vRep').textContent = Math.round(V.rep*100);
  { const sc = devScore(V), T = devTier(V), nx = TIERS[T + 1];
    $('vTier').textContent = TIERS[T].n; $('vTierBar').style.width = (nx ? clamp((sc - TIERS[T].at)/(nx.at - TIERS[T].at), 0, 1)*100 : 100) + '%';
    $('vTierNext').textContent = nx ? `→ ${nx.n}` : '最高';
    document.body.style.setProperty('--hudTop', ($('vTop').offsetTop + $('vTop').offsetHeight + 12) + 'px'); }
  const plan = state === 'plan';
  $('vTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === vTab));
  $('vPol').style.display = vTab === 'pol' ? '' : 'none'; $('vBuild').classList.toggle('show', vTab === 'build');
  $('vSide').classList.toggle('inactive', !plan && !over);
  // policies, grouped: the sea first, then the village
  const row = pl => { const cur = V.pol[pl.k], lock = V.locks[pl.k], o = pl.opts.find(x => x.v === cur);
    const spring = pl.k === 'fish' && s % 4 === 0 && !over;
    return `<div class="prow${lock ? ' locked' : ''}" data-k="${pl.k}"><div class="ph">${ic(POL_ICON[pl.k])}<b>${pl.name}</b>
      ${lock ? `<span class="tag">${ic('lock')}锁定 ${lock} 季</span>` : spring ? '<span class="tag">产卵季</span>' : ''}</div>
      <div class="pseg">${pl.opts.map(x => `<button data-k="${pl.k}" data-v="${x.v}" class="${x.v === cur ? 'on' : ''}" ${!plan || lock ? 'disabled' : ''}>${x.n}</button>`).join('')}</div>
      <div class="pd">${pl.opts.map(x => `<span data-v="${x.v}" class="${x.v === cur ? 'show' : ''}">${typeof x.d === 'function' ? x.d(V) : x.d}${pl.k === 'fish' && V.prevPol && FISH_RANK[x.v] < FISH_RANK[V.prevPol.fish] ? ' <span class="warn">· 渔民会不满</span>' : ''}</span>`).join('')}</div></div>`; };
  $('vPol').innerHTML = `<div class="pg">${ic('wave')}海</div>${POLICIES.filter(p => ['fish', 'zone', 'waste', 'tour'].includes(p.k)).map(row).join('')}
    <div class="pg v">${ic('house')}村</div>${POLICIES.filter(p => ['work', 'tax'].includes(p.k)).map(row).join('')}`;
  $('vPol').querySelectorAll('.pseg button').forEach(b => {
    b.onclick = () => { if(state !== 'plan' || V.locks[b.dataset.k]) return; V.pol[b.dataset.k] = b.dataset.v; renderVillageUI(); chime(1); };
    b.onmouseenter = () => {
      const pl = POLICIES.find(p => p.k === b.dataset.k), o = pl.opts.find(x => x.v === b.dataset.v);
      showDesc(b, b.dataset.v, b.dataset.v !== V.pol[pl.k]);
      if(plan && !b.disabled && b.dataset.v !== V.pol[b.dataset.k]) renderForecast(v => { v.pol[b.dataset.k] = b.dataset.v; }, `如果改成「${o.n}」`);
    };
    b.onmouseleave = () => { showDesc(b, V.pol[b.dataset.k], false); renderForecast(); };
  });
  // buildings as cards that say why they can't be built
  const builtNow = (V.ups || []).map(u => `<button data-u="${u.k}:${u.i}" title="撤销升级，退还 ${u.c}">升级${BUILD.find(b => b.k === u.k).name} ✕</button>`).join('') + V.built.map((k, i) => `<button data-i="${i}" title="撤销，退还 ${BUILD.find(b => b.k === k).cost}">${BUILD.find(b => b.k === k).name} ✕</button>`).join('');
  $('vBuild').innerHTML = `<div id="vBuilt">${builtNow ? '本季已建：' + builtNow : ''}</div>` + BUILD.map(b => { const have = V[KEY[b.k]] || 0, mx = maxOf(V, b.k), full = have >= mx, info = BUILD_INFO[b.k], locked = b.need && !V[KEY[b.need]];
    const why = !plan ? (state === 'event' ? '先处理事件' : '本季进行中') : locked ? `需要先建${BUILD.find(x => x.k === b.need).name}` : full ? (b.need ? '升级渔港能停更多' : '已达上限') : V.money < b.cost ? `还差 ${Math.ceil(b.cost - V.money)}` : '';
    return `<button class="bc" data-k="${b.k}" ${why ? 'disabled' : ''}><div class="bt">${ic(info.icon)}${b.name}<span class="cnt">${b.max > 1 ? have + '/' + mx : have ? '已建' : ''}</span></div>
      <div class="chips"><span class="chip cost">${ic('coin')}${b.cost}</span>${info.crew ? `<span class="chip" title="需要的人手">${ic('people')}${info.crew}</span>` : ''}</div>
      <div class="bd">${b.desc}</div><div class="why">${why}</div></button>`; }).join('');
  $('vBuild').querySelectorAll('button.bc').forEach(el => {
    el.onclick = () => build(el.dataset.k);
    el.onmouseenter = () => { if(!el.disabled){ const b = BUILD.find(x => x.k === el.dataset.k); renderForecast(v => { v[KEY[b.k]] = (v[KEY[b.k]] || 0) + 1; v.money -= b.cost; }, `如果建「${b.name}」`); } };
    el.onmouseleave = () => renderForecast();
  });
  $('vBuilt') && $('vBuilt').querySelectorAll('button').forEach(el => el.onclick = () => el.dataset.u ? undoUpgrade(el.dataset.u.split(':')[0], +el.dataset.u.split(':')[1]) : unbuild(+el.dataset.i));
  renderForecast();
  const runLabel = state === 'event' ? '先处理突发事件' : state === 'running' ? '本季进行中…' : state === 'prompt' ? '等待你的决定' : (state === 'report' || state === 'tally') ? '看完报告再继续' : '开始本季';
  $('vRun').querySelector('span').textContent = runLabel;
  $('vRun').disabled = !plan; $('vDive').disabled = !(plan || state === 'report' || state === 'over');
  { const S = V.sea, fresh = plan && S && S.season === V.season && (!S.dived || SEA_KEYS.some(k => !S.seen[k])); $('vDive').classList.toggle('ping', !!fresh);
    if(fresh) $('vDive').dataset.tip = S.dived ? '还有调查点没去。调查过的数字，预测才准。' : '这一季还没人下去看过：调查能让预测变准，还能清理海星和垃圾。'; else delete $('vDive').dataset.tip; }
  if(window.__focusOn) renderFocus();
}
function showDesc(b, v, hover){ b.closest('.prow').querySelectorAll('.pd > span').forEach(sp => { sp.classList.toggle('show', sp.dataset.v === v); sp.classList.toggle('hv', hover && sp.dataset.v === v); }); }
// the forecast, optionally for a hypothetical change (hovering an option or a building)
function renderForecast(mutate, label){
  if(state === 'over'){ $('vPredict').innerHTML = ''; return; }
  ensureSea();
  const SV = (v, b) => ({ ...v, sea: seaView(v.sea, b) });
  const base = simulateSeason(eco, SV(V, 0), 0);
  let cur = base, vv = V;
  if(mutate){ const v2 = { ...V, pol: { ...V.pol } }; mutate(v2); vv = v2; cur = simulateSeason(eco, SV(v2, 0), 0); if(devTier(v2) > devTier(V)) label = (label || '') + ` · 村子将升级为「${TIERS[devTier(v2)].n}」`; }
  const lo = simulateSeason(eco, SV(vv, -1), 0).e, hi = simulateSeason(eco, SV(vv, 1), 0).e, SS = V.sea;
  const { e, v, r } = cur, b = base.r;
  const selfFed = r.foodNeed ? Math.round(Math.min(r.catchT, 99)/r.foodNeed*100) : 100;
  const hl = (a, c) => mutate && Math.abs(a - c) > 0.05 ? ' class="hl"' : '';
  const warns = [];
  if(r.moneyDelta < -1.5){ const top = r.pub.slice().sort((a, b) => b[1] - a[1])[0];
    warns.push(`村库每季 ${fmt(r.moneyDelta)}${top ? `，最大开支是「${top[0]}」${fmt(-top[1])}` : ''}${r.sold < 0.3 && r.tourInc < 1 ? '。渔获全被村民吃掉，没有卖出的鱼就没有税' : ''}。`); }
  if(r.degraded > 0.15 && r.protect === 0) warns.push(V.pol.fish === 'industrial' ? '礁区受损。停止大规模捕捞并设保护区，才有保护资助和修复工作。' : '礁区受损。设保护区就有保护资助，闲置村民可以去修复。');
  if(V.pol.fish === 'industrial' && V.trawlers > 0 && V.pol.zone !== 'wide' && eco.bait > 0.12 && !mutate) warns.push('拖网船会撞上礁区鱼群。可以潜下去把鱼群赶开。');
  if(r.spring && v.pol.fish !== 'ban' && r.spawnHit < 0.85) warns.push(`产卵季捕鱼：鱼群繁殖 −${Math.round((1 - r.spawnHit)*100)}%。`);
  if(r.staff < 1) warns.push(`人手 ${Math.round(r.staff*100)}%：船和店按这个比例开工。`);
  if(r.shortage > 0.05) warns.push(r.hungry ? `缺粮 ${r.shortage.toFixed(1)} 吨，村库买不起：村民挨饿，民心 −16。` : `缺粮 ${r.shortage.toFixed(1)} 吨，村库进口要花 ${Math.round(r.shortage*REC.food)}。`);
  if(v.money < -60) warns.push('村库低于 −100 就破产。');
  if(v.morale < 30) warns.push('民心低于 30：每季走 3 人。');
  const why = (r.grant > 0.5 ? `<div><span>村库 · 海洋保护资助</span><b class="pos">${fmt(r.grant - r.wages)}</b></div><div><span>村民 · 修复礁区的工资</span><b class="pos">${fmt(r.wages)}</b></div>` : '') + r.morale.map(([l, x]) => `<div><span>${l}</span><b class="${x < 0 ? 'negc' : 'pos'}">${fmt(x)}</b></div>`).join('') + r.pub.map(([l, x]) => `<div><span>村库 · ${l}</span><b class="negc">${fmt(-x)}</b></div>`).join('');
  const whyOpen = !!$('vPredict').querySelector('details[open]');
  $('vPredict').classList.toggle('preview', !!mutate);
  $('vPredict').innerHTML = `<div class="pt">${ic('info')}本季预测<span class="pv">${label || ''}</span></div>
    <div class="big"><div${hl(v.money, base.v.money)}><small>${ic('coin')}村库</small><b>${Math.round(V.money)} → ${Math.round(v.money)}</b></div>
      <div${hl(r.dMor, b.dMor)}><small>${ic('heart')}民心</small><b>${Math.round(V.morale)} → ${Math.round(v.morale)}</b></div></div>
    <div class="sm"><div${hl(r.catchT, b.catchT)}><span>渔获</span><b>${r.catchT.toFixed(1)} 吨</b></div>
      <div${hl(r.visitors, b.visitors)}><span>游客</span><b>${Math.round(r.visitors + r.whaleVis)}</b></div><div${hl(r.tourInc, b.tourInc)}><span>旅游收入</span><b>${Math.round(r.tourInc)}</b></div><div${hl(r.perCap, b.perCap)}><span>人均生活</span><b>${r.perCap.toFixed(1)}</b></div>
      <div${hl(r.staff, b.staff)}><span>人手</span><b class="${r.staff < 1 ? 'negc' : ''}">${Math.round(r.staff*100)}%</b></div><div${hl(v.pop, base.v.pop)}><span>村民</span><b>${V.pop} → ${v.pop}</b></div></div>
    <div class="fl" data-tip="每季先给村民吃（每人 0.12 吨），再留一部分过季（没有冷库留三成口粮，有冷库留一整季），其余按鱼价卖出。留下的鱼没有冷库会坏 35%。">${ic('fish')}<span>鱼货</span><b>存 ${r.stock0.toFixed(1)} + 捕 ${r.catchT.toFixed(1)}</b><i>→</i><span>吃 ${r.eat.toFixed(1)}</span><span>卖 ${r.sold.toFixed(1)}×${r.fishPrice.toFixed(0)}=<b class="pos">${Math.round(r.sold*r.fishPrice)}</b></span><span>留 ${r.food.toFixed(1)}${r.spoiled > 0.05 ? `<em class="negc"> 坏 ${r.spoiled.toFixed(1)}</em>` : ''}</span></div>
    <div class="warns${warns.length ? '' : ' ok'}"${warns.length > 2 ? ` title="${warns.join(' / ')}"` : ''}>${warns.length ? warns.slice(0, 2).map(w => `<div>${ic('warn')}<span>${w}</span></div>`).join('') : `<div>${ic('good')}<span>暂时没有明显风险。</span></div>`}</div>
    ${seaRow(cur.e, lo, hi, SS)}
    <details${whyOpen ? ' open' : ''}><summary>为什么？ ▾</summary>${why || '<div>平平淡淡</div>'}</details>`;
  // left column: deltas from the forecast; ocean card: hatched ghost of where it is heading
  if(!mutate){
    setDelta('dMoney', v.money - V.money); setDelta('dFood', v.food - V.food); setDelta('dPop', v.pop - V.pop); setDelta('dMorale', v.morale - V.morale); setDelta('dRep', (v.rep - V.rep)*100);
  }
  // the sea is only ever shown as arrows: its luck this season is unknown until someone dives and surveys
  const pv = !!mutate; setTrend('tCoral', eco.coral, lo.coral, hi.coral, pv); setTrend('tWater', eco.clar, e.clar, e.clar, pv); setTrend('tFish', eco.fish, lo.fish, hi.fish, pv); setTrend('tPel', eco.pelagic ?? 1, lo.pelagic ?? 1, hi.pelagic ?? 1, pv);
}
// what the village knows about the sea this season: the jobs waiting down there and the trouble it was told about
function seaRow(e, lo, hi, S){
  if(!S) return '';
  const L = seaLeft(S), nS = SEA_KEYS.filter(k => S.seen[k]).length, notes = [];
  if(nS < 3) notes.push(`<small>${S.dived ? `调查 ${nS}/3` : '还没潜下去调查'} · 海洋箭头带 ? 的看不准</small>`);
  if(S.dived && (L.cots || L.trash)) notes.push(`<small class="warn">${[L.cots ? `长棘海星 ${L.cots} 只` : '', L.trash ? `垃圾 ${L.trash} 处` : ''].filter(Boolean).join(' · ')} 没清理</small>`);
  if(S.ev && S.evFound && S.evDone && !S.evFix) notes.push(`<small class="warn">${SEA_EV[S.ev].n}没处理：季末${seaDmg(SEA_EV[S.ev])}</small>`);
  if(S.ev && S.evFix) notes.push(`<small>${SEA_EV[S.ev].n}已处理</small>`);
  return notes.length ? `<div class="sea">${ic('mask')}${notes.join('<i>·</i>')}</div>` : '';
}
// the ocean card's arrow for one meter; lo/hi are the two ends of what the village can know
function setTrend(id, a, lo, hi, preview){
  const el = $(id); if(!el) return; if(mode !== 'village'){ el.innerHTML = ''; return; }
  const dl = lo - a, dh = hi - a, unsure = Math.abs(dh - dl) > 0.003;
  el.innerHTML = unsure && Math.sign(dl) !== Math.sign(dh) && Math.max(Math.abs(dl), Math.abs(dh)) > 0.004 ? '<span class="eq">?</span>' : arrows((dl + dh)/2, unsure);
  el.classList.toggle('pv', preview);
}
$('vTabs').addEventListener('click', e => { const bt = e.target.closest('button'); if(bt && bt.dataset.t){ vTab = bt.dataset.t; renderVillageUI(); } });
function build(k){
  const b = BUILD.find(x => x.k === k); if(state !== 'plan' || V.money < b.cost || (V[KEY[k]] || 0) >= maxOf(V, k) || (b.need && !V[KEY[b.need]])) return;
  V.money -= b.cost; V[KEY[k]] = (V[KEY[k]] || 0) + 1; V.built.push(k); V.buildSpent += b.cost;
  const at = { house: VB.houses[V.houses - 1], shop: VB.shops[V.shops - 1], resort: V.resort > 1 ? VB.resort2 : VB.resort, plant: VB.plant, recycle: VB.recycle, cold: VB.cold, nursery: VB.nursery, school: VB.school, harbor: { position: new THREE.Vector3(40, 0, HARBOR.sz) }, research: VB.research, offshore: { position: new THREE.Vector3(38, 0, HARBOR.sz + 5) }, whale: { position: new THREE.Vector3(43.6, 0, HARBOR.sz + 9) } }[k];
  coin(`−${b.cost}`, at ? at.position.clone().add(tmp.set(0, 6, 0)) : new THREE.Vector3(8, 4, 10), '#b8452f');
  if(at) puff(at.position.x, at.position.z, 10);
  chime(2); renderVillageUI();
}
function unbuild(i){
  if(state !== 'plan') return; const k = V.built[i], b = BUILD.find(x => x.k === k);
  if(V[KEY[k]] <= 0) return;
  V[KEY[k]]--; V.money += b.cost; V.buildSpent -= b.cost; V.built.splice(i, 1);
  if(V.lv && V.lv[k] && V.lv[k].length > V[KEY[k]]) V.lv[k].length = V[KEY[k]];
  renderVillageUI();
}
// one building, one step up; undoable until the season starts
function canUpgrade(k, i){ const lv = lvOf(V, k, i); return state === 'plan' && lv < LVMAX[k] && V.money >= upCost(k, lv); }
function upgradeBld(k, i){
  const lv = lvOf(V, k, i); if(!canUpgrade(k, i)) return false;
  const c = upCost(k, lv); V.lv = V.lv || {}; const arr = V.lv[k] = V.lv[k] || [];
  while(arr.length < (V[KEY[k]] || 0)) arr.push(1);
  arr[i] = lv + 1; V.money -= c; V.buildSpent += c; (V.ups = V.ups || []).push({ k, i, c });
  chime(3); renderVillageUI(); return true;
}
function undoUpgrade(k, i){
  const j = (V.ups || []).map(u => u.k + ':' + u.i).lastIndexOf(k + ':' + i); if(j < 0 || state !== 'plan') return false;
  const u = V.ups.splice(j, 1)[0]; V.lv[k][i]--; V.money += u.c; V.buildSpent -= u.c; renderVillageUI(); return true;
}
// tooltips for anything with data-tip
document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if(t){ $('tip').textContent = t.dataset.tip; $('tip').classList.add('on'); } });
document.addEventListener('mouseout', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if(t && !t.contains(e.relatedTarget)) $('tip').classList.remove('on'); });
document.addEventListener('mousemove', e => { if($('tip').classList.contains('on')){ const w = $('tip').offsetWidth; $('tip').style.transform = `translate(${Math.min(e.clientX + 14, innerWidth - w - 10)}px, ${e.clientY + 16}px)`; } });
// first-season coach
const COACH = [
  { sel: '#hud', side: 'l', t: '这是门前的海', x: '珊瑚、鱼群、水质。四年后，珊瑚和鱼群都要守在细竖线（55%）以上。' },
  { sel: '#vTop', side: 'l', t: '这是你的渔村', x: '村库、存鱼、村民、民心、声誉，右边的小标签是本季预计的变化。建设越多，村子会从木屋小渔村长成渔镇、海滨小城。' },
  { sel: '#vSide', side: 'r', t: '定政策、看预测', x: '每一行选一项。把鼠标移到选项或建筑上，下面的预测会告诉你会发生什么。' },
  { sel: '#vRun', side: 'b', t: '准备好了就开始本季', x: '一共 16 季、四年。每一季结束，海和村子都会给你回应。' },
];
let coachI = -1, coachDone = false;
function showCoach(i){
  coachI = i; const c = COACH[i]; if(!c){ $('coach').classList.remove('on'); $('ring').classList.remove('on'); coachDone = true; return; }
  const el = document.querySelector(c.sel), rc = el.getBoundingClientRect(), co = $('coach');
  co.querySelector('b').textContent = c.t; co.querySelector('.ctext').textContent = c.x; co.querySelector('.cstep').textContent = `${i + 1} / ${COACH.length}`;
  co.querySelector('button').textContent = i === COACH.length - 1 ? '知道了' : '下一步';
  co.className = 'on ' + c.side;
  const w = 250;
  if(c.side === 'l'){ co.style.left = (rc.right + 14) + 'px'; co.style.top = (rc.top + 6) + 'px'; }
  else if(c.side === 'r'){ co.style.left = (rc.left - w - 18) + 'px'; co.style.top = (rc.top + 60) + 'px'; }
  else { co.style.left = (rc.right - w - 10) + 'px'; co.style.top = (rc.top - co.offsetHeight - 16) + 'px'; }
  const ring = $('ring'); Object.assign(ring.style, { left: (rc.left - 4) + 'px', top: (rc.top - 4) + 'px', width: (rc.width + 8) + 'px', height: (rc.height + 8) + 'px' }); ring.classList.add('on');
}
$('coach').querySelector('button').addEventListener('click', () => showCoach(coachI + 1));
$('vRun').addEventListener('click', runSeason);
$('vDive').addEventListener('click', () => { if(mode !== 'village') return; diveInto(diveMark, 'free'); });
$('pDive').addEventListener('click', () => { $('vPrompt').classList.remove('on'); $('village').classList.remove('modal'); diveInto(baitMark, 'trawl'); });
$('pStay').addEventListener('click', () => { $('vPrompt').classList.remove('on'); $('village').classList.remove('modal'); autoTrawl(); beginRun(); });

function runSeason(){
  if(state !== 'plan') return;
  const trawlEvent = V.pol.fish === 'industrial' && V.trawlers > 0 && V.pol.zone !== 'wide' && eco.bait > 0.12;
  if(trawlEvent){ setState('prompt'); $('vPrompt').classList.add('on'); $('village').classList.add('modal'); renderVillageUI(); }
  else beginRun();
}
function beginRun(){ if(focusOn) exitFocus(); setState('running'); sendBoatsOut(); renderVillageUI(); }
function autoTrawl(){
  const takenB = Math.round(eco.bait*NB*0.85), takenR = Math.round(140 + 60*eco.fish);
  pendingHaul += takenB*0.04 + takenR*0.03;
  eco.bait *= 0.15; eco.fish *= 0.94; scar[(rng()*13)|0] = 0.6; scar[(rng()*13)|0] = 0.6;
}
function showReport(r){
  const notes = [];   // [severity, text]
  if(r.haul > 0) notes.push(['bad', `礁区拖网一网：收入 +${Math.round(r.haul)}。`]);
  if(r.spring && V.pol.fish !== 'ban' && r.spawnHit < 0.85) notes.push(['bad', `产卵季捕鱼：鱼群繁殖 −${Math.round((1 - r.spawnHit)*100)}%。`]);
  if(V.prevPol && V.prevPol.fish === 'ban') notes.push(['good', '休渔一季：鱼群没有捕捞损失。']);
  if(r.staff < 1) notes.push(['bad', `人手 ${Math.round(r.staff*100)}%：船和店没有满员。`]);
  if(r.spoiled > 0.5) notes.push(['bad', `${r.spoiled.toFixed(1)} 吨鱼货放坏${V.cold ? '' : '（冷库能把损耗从 35% 降到 5%）'}。`]);
  if(r.shortage > 0.05) notes.push(['bad', r.hungry ? `缺粮 ${r.shortage.toFixed(1)} 吨，村库买不起：村民挨饿。` : `进口粮食 ${r.shortage.toFixed(1)} 吨，村库 −${Math.round(r.shortage*REC.food)}。`]);
  if(eco.ghost > 0.3) notes.push(['bad', `幽灵网 ${Math.round(clamp(eco.ghost/0.25, 0, 4))} 张缠在礁上，每季鱼群 −${(5*eco.ghost).toFixed(1)}%。潜下去割掉。`]);
  if(r.sea && r.seaS){ const sea = r.sea, SS = r.seaS;
    if(SS.gone.cots.length) notes.push(['good', `清掉长棘海星 ${SS.gone.cots.length} 只。`]);
    if(sea.cl) notes.push(['bad', `长棘海星 ${sea.cl} 只没清理：珊瑚 −${(sea.cl*SEA.cotsK*100).toFixed(1)}%。`]);
    if(SS.gone.trash.length) notes.push(['good', `捡走垃圾 ${SS.gone.trash.length} 处。`]);
    if(sea.tl) notes.push(['bad', `垃圾 ${sea.tl} 处没捡：鱼群 −${(sea.tl*SEA.trashK*100).toFixed(1)}%，声誉 −${(sea.tl*0.4).toFixed(1)}。`]);
    if(SS.ev){ const E = SEA_EV[SS.ev];
      if(SS.evFix) notes.push(['good', `${E.n}已处理，没有损失。`]);
      else if(SS.evFound) notes.push(['bad', `${E.n}没处理：${seaDmg(E)}。`]);
      else notes.push(['bad', `${SEA_EV_TXT[SS.ev].miss}：${seaDmg(E)}。`]); }
    if(sea.samples && V.research) notes.push(['good', `调查样本：研究经费 +${Math.round(sea.samples*SEA.sample)}。`]); }
  if(r.nutr > 0.3) notes.push(['bad', `排污口外藻类增多：入海污染 ${Math.round(r.nutr*100)}%。`]);
  if(V.pol.zone !== 'none' && V.mpaSeasons === 4 && eco.fish > 0.5) notes.push(['good', '保护区满 4 季：鱼开始外溢，渔获回升。']);
  if(eco.coral < r.coralBefore - 0.005){ const worst = (r.coralWhy || []).filter(x => x[1] < 0).sort((a, b) => a[1] - b[1])[0];
    notes.push(['bad', `珊瑚少了 ${((r.coralBefore - eco.coral)*100).toFixed(1)}%${worst ? `，主要是「${worst[0]}」` : ''}。`]); }
  if(eco.coral > r.coralBefore + 0.01) notes.push(['good', `珊瑚 +${((eco.coral - r.coralBefore)*100).toFixed(1)}%。`]);
  if(r.pop1 < r.pop0) notes.push(['bad', `村民 −${r.pop0 - r.pop1}。`]);
  if(r.grant > 0.5) notes.push(['good', `保护资助 ${Math.round(r.grant)}：村库 ${Math.round(r.grant - r.wages)}，修复工资 ${Math.round(r.wages)}。礁区越好，资助越少。`]);
  if(r.pop1 > r.pop0 && r.pop1 >= r.cap) notes.push(['good', `村民 +${r.pop1 - r.pop0}，住满了（${r.cap} 人）。再建民居才会长人。`]);
  if(eco.fish < 0.3) notes.push(['bad', `鱼群只剩 ${Math.round(eco.fish*100)}%。`]);
  if((eco.pelagic ?? 1) < 0.5 && (r.pelBefore ?? 1) > (eco.pelagic ?? 1)) notes.push(['bad', `远洋鱼群只剩 ${Math.round((eco.pelagic ?? 1)*100)}%：远洋渔获和观鲸收入都在下降。`]);
  const over = isGameOver(), pct = x => Math.round(x*100) + '%';
  const icoN = { bad: 'warn', good: 'good', info: 'info' };
  $('village').classList.add('modal'); coins.forEach(c => c.t = Math.max(c.t, 2));
  $('vReport').innerHTML = `<div class="kicker">${seasonName(V.season)} · 季度报告</div>
    <h3>${r.moneyDelta >= 0 && r.dMor >= 0 ? '不错的一季' : r.moneyDelta < 0 && r.dMor < 0 ? '艰难的一季' : '有得有失的一季'}</h3>
    <div class="tiles">
      <div><small>${ic('coin')}村库</small><b>${Math.round(V.money)}</b><em class="${r.moneyDelta < 0 ? 'negc' : 'pos'}">${fmt(r.moneyDelta)}</em></div>
      <div><small>${ic('heart')}民心</small><b>${Math.round(V.morale)}</b><em class="${r.dMor < 0 ? 'negc' : 'pos'}">${fmt(r.dMor)}</em></div>
      <div><small>${ic('wave')}海洋</small><div class="oc"><span>珊瑚</span>${trend(r.coralBefore, eco.coral)}<b>${pct(eco.coral)}</b></div><div class="oc"><span>鱼群</span>${trend(r.fishBefore, eco.fish)}<b>${pct(eco.fish)}</b></div><div class="oc"><span>水质</span>${trend(r.clarBefore, eco.clar)}<b>${pct(eco.clar)}</b></div>${V.harbor || (eco.pelagic ?? 1) < 0.98 ? `<div class="oc"><span>远洋</span>${trend(r.pelBefore ?? 1, eco.pelagic ?? 1)}<b>${pct(eco.pelagic ?? 1)}</b></div>` : ''}</div>
    </div>
    <div class="vledger">${ic('coin')} 村库本季 <b class="${r.moneyDelta < 0 ? 'negc' : 'pos'}">${fmt(r.moneyDelta)}</b> ＝ 税 <b class="pos">+${Math.round(r.tax)}</b>${r.fee > 0.5 ? ` · 门票 <b class="pos">+${Math.round(r.fee)}</b>` : ''}${r.grant > 0.5 ? ` · 保护资助 <b class="pos">+${Math.round(r.grant - r.wages)}</b>` : ''}${r.pub.map(([l, x]) => ` · ${l} <b class="negc">−${Math.round(x)}</b>`).join('')}${r.sold < 0.3 && r.tourInc < 1 ? '<br><small>渔获几乎都被村民吃掉了。税只对卖出去的鱼和旅游收入抽成。</small>' : ''}</div>
    ${notes.length ? '<ul class="notes">' + notes.map(([k, n]) => `<li class="${k}">${ic(icoN[k])}<span>${n}</span></li>`).join('') + '</ul>' : ''}
    <details><summary>收支明细 ▾</summary>
    <div class="sec">村民收入</div>
    <table class="tight"><tr><td>卖鱼 ${r.sold.toFixed(1)} 吨 × ${r.fishPrice.toFixed(0)}${r.haul > 0 ? ' · 含拖网' : ''}</td><td class="pos">${fmt(r.fishInc)}</td></tr>
    <tr><td>旅游 · ${Math.round(r.visitors)} 位潜水客${r.whaleVis > 0.5 ? ` · ${Math.round(r.whaleVis)} 位观鲸客` : ''}</td><td class="pos">${fmt(r.tourInc)}</td></tr>
    ${r.offCatch > 0.05 ? `<tr><td>其中远洋渔获 ${r.offCatch.toFixed(1)} 吨</td><td></td></tr>` : ''}
    ${r.resInc > 0.5 ? '' : ''}
    <tr><td>上交村库 · ${Math.round(TAX[V.pol.tax]*100)}%</td><td class="negc">${fmt(-r.tax)}</td></tr>
    ${r.wages > 0.5 ? `<tr><td>修复礁区的工资</td><td class="pos">${fmt(r.wages)}</td></tr>` : ''}
    <tr><td>船和店的成本</td><td class="negc">${fmt(-r.privCost)}</td></tr>
    <tr class="tot"><td>村民到手 · 人均生活 ${r.perCap.toFixed(1)}</td><td>${fmt(r.earn)}</td></tr></table>
    <div class="sec">村库</div>
    <table class="tight"><tr><td>税收 · ${Math.round(TAX[V.pol.tax]*100)}%</td><td class="pos">${fmt(r.tax)}</td></tr>
    ${r.fee > 0.5 ? `<tr><td>游客门票</td><td class="pos">${fmt(r.fee)}</td></tr>` : ''}
    ${r.grant > 0.5 ? `<tr><td>海洋保护资助（扣除发给村民的工资）</td><td class="pos">${fmt(r.grant - r.wages)}</td></tr>` : ''}
    ${r.resInc > 0.5 ? `<tr><td>研究站科研经费</td><td class="pos">${fmt(r.resInc)}</td></tr>` : ''}
    ${r.pub.map(([l, x]) => `<tr><td>${l}</td><td class="negc">${fmt(-x)}</td></tr>`).join('')}
    ${r.buildSpent ? `<tr><td>本季建设（开季前已付）</td><td class="negc">${fmt(-r.buildSpent)}</td></tr>` : ''}
    <tr class="tot"><td>村库余额</td><td>${Math.round(V.money)}</td></tr></table>
    ${r.coralWhy && r.coralWhy.length ? `<div class="sec">珊瑚变化的原因</div><table class="tight">${r.coralWhy.map(([l, x]) => `<tr><td>${l}</td><td class="${x < 0 ? 'negc' : 'pos'}">${x < 0 ? '−' : '+'}${Math.abs(x*100).toFixed(1)}%</td></tr>`).join('')}</table>` : ''}
    <div class="sec">民心变化的原因</div>
    <table class="tight">${r.morale.map(([l, x]) => `<tr><td>${l}</td><td class="${x < 0 ? 'negc' : 'pos'}">${fmt(x)}</td></tr>`).join('') || '<tr><td>平平淡淡</td><td>0</td></tr>'}</table>
    </details>
    <div class="btns"><button id="rDive">${ic('mask')}潜下去看看</button><button id="rNext" class="primary">${over ? '看看结局' : '下一季 ▸'}</button></div>`;
  $('vReport').classList.add('on');
  $('rDive').onclick = () => { $('village').classList.remove('modal'); diveInto(diveMark, 'free'); };
  $('rNext').onclick = nextSeason;
  renderVillageUI();
}
const isGameOver = () => V.season + 1 >= SEASONS_PER_GAME || V.money < -100 || V.morale <= 5 || V.pop <= 6;
function nextSeason(){
  $('vReport').classList.remove('on'); $('village').classList.remove('modal');
  if(isGameOver()) return endGame();
  V.season++; V.planStart = V.money; setState('plan');
  const note = () => toast(seasonName(V.season), SEASON_FX[V.season % 4].note, 6000);
  const ev = rollEvent();
  if(ev) showEvent(ev, note); else { renderVillageUI(); note(); }
  if(V.season === 1 && !V.diveHinted){ V.diveHinted = true; setTimeout(() => toast('试试看', '把鼠标移到水下发光的生物上，点一下就能化身潜下去。', 7000), 6500); }
}
function chartSVG(rows){
  const W = 520, Hc = 120, n = rows.length, bw = W/n;
  const max = Math.max(40, ...rows.map(r => Math.max(r.fishing + r.tour, r.cost)));
  let s = `<svg viewBox="0 0 ${W} ${Hc + 20}" width="100%" role="img" aria-label="渔村每季收入">`;
  rows.forEach((r, i) => {
    const x = i*bw + bw*0.22, w = bw*0.56, hf = r.fishing/max*Hc, ht = r.tour/max*Hc, hc = r.cost/max*Hc;
    s += `<rect x="${x.toFixed(1)}" y="${(Hc - hf).toFixed(1)}" width="${w.toFixed(1)}" height="${hf.toFixed(1)}" fill="#7ff3e4" rx="2"/>`;
    s += `<rect x="${x.toFixed(1)}" y="${(Hc - hf - ht).toFixed(1)}" width="${w.toFixed(1)}" height="${ht.toFixed(1)}" fill="#ffc48a" rx="2"/>`;
    s += `<line x1="${(x - 4).toFixed(1)}" x2="${(x + w + 4).toFixed(1)}" y1="${(Hc - hc).toFixed(1)}" y2="${(Hc - hc).toFixed(1)}" stroke="#ff8a7a" stroke-width="2"/>`;
    s += `<text x="${(x + w/2).toFixed(1)}" y="${Hc + 15}" fill="#cfeff2" font-size="10" text-anchor="middle" font-family="Inter,Noto Sans SC,sans-serif">${['春', '夏', '秋', '冬'][i % 4]}${Math.floor(i/4) + 1}</text>`;
  });
  return s + '</svg>';
}
function endGame(){
  setState('over');
  const oceanOK = eco.fish > 0.55 && eco.coral > 0.55 && (eco.pelagic ?? 1) > OFF.okLine, grew = devTier(V) >= 1 && V.pop >= 20, villageOK = V.morale >= 50 && V.money >= 0 && grew;
  endingKind = oceanOK ? 'good' : eco.fish > 0.33 ? 'mid' : 'bad';
  const T = V.morale <= 5 ? ['村民散了。', '没有人愿意再为这个村子出力。海还在，人心先空了。']
    : V.money < -100 ? ['村子破产了。', '村库空了，公共的事再没人管得动。']
    : V.pop <= 6 ? ['村子空了。', '一户接一户搬走，最后只剩下几盏灯。']
    : oceanOK && villageOK ? ['两边都撑过来了。', `村子长成了${TIERS[devTier(V)].n}，门前的珊瑚礁也还活着。这需要克制，也需要胆量。`]
    : oceanOK && !grew && V.morale >= 50 && V.money >= 0 ? ['海还是那片海，村子也还是那个村子。', '四年里什么都没有坏掉，也什么都没有长起来。年轻人开始往城里走了。']
    : oceanOK ? ['珊瑚礁活下来了，村子却勉强度日。', '健康的海洋还不能自己付账单。至少现在还不能。']
    : villageOK ? ['村子富了。只富了一次。', '钱是从礁区里捞出来的，每一季都比上一季少一点。']
    : ['珊瑚礁安静了。', '没有人选择这个结局。它是被一个又一个「合理」的季节决定的。'];
  $('endTitle').textContent = T[0]; archiveRun(T[0]);
  $('endText').innerHTML = `${T[1]}<br><small style="font-style:normal;opacity:.75">村库 ${Math.round(V.money)} · 民心 ${Math.round(V.morale)} · 村民 ${V.pop} · 鱼群 ${Math.round(eco.fish*100)}% · 珊瑚 ${Math.round(eco.coral*100)}%</small>`;
  $('chart').innerHTML = chartSVG(V.history);
  $('chartCap').innerHTML = '每一季村民的收入：<b class="cf">渔获</b>与<b class="ct">旅游</b>。红线是船、店和公共开支的总和。';
  $('swimOn').textContent = '去看看海底';
  $('ending').classList.add('on'); $('village').classList.add('over'); renderVillageUI();
}
$('swimOn').addEventListener('click', () => { $('ending').classList.remove('on'); goDive('ending'); });
$('again').addEventListener('click', () => location.reload());

// ---- the ocean side
function startTrawl(){
  setState('trawl');
  const B = SCHOOLS[sBait];
  B.frozen = true; B.bx = B.x; B.bz = B.z; B.ox = 0; B.oz = 0;
  trawl.c.set(B.x, 0, B.z);
  const a = Math.atan2(player.pos.z - B.z, player.pos.x - B.x) + Math.PI*0.5;
  trawl.dir.set(Math.cos(a), 0, Math.sin(a));
  trawl.start.copy(trawl.c).addScaledVector(trawl.dir, -150);
  trawl.t = 0; trawl.haul = 0; trawl.caughtBait = 0; trawl.caughtReg = 0; trawl.baitStart = Math.max(1, bait.active); regStart = Math.max(1, reg.active);
  tmpP.copy(trawl.start).addScaledVector(trawl.dir, -34); trawl.ny = topAt(tmpP.x, tmpP.z) + 8.5;
  catchBlob.scale.setScalar(0.35);
  boat.visible = netG.visible = netG.userData.cables.visible = true; noRespawn = true; riseT = 0;
  startEngine(); objective('');
  cue(1, () => toast('你的拖网船', '它正从礁区上方驶过，网已经放下去了。', 4500));
  const asSchool = avatar.kind === 'school' && avatar.sc === sBait;
  cue(6, () => { if(asSchool){ toast('网口正对着你们', '你就是这群沙丁鱼。往两边游，离开网的路线。', 7500); objective('带着鱼群逃出拖网的路径'); }
    else { toast('鱼群就在它的航线上', '把它们赶开。朝它们游过去，它们就会躲开你。', 7500); objective('把鱼群赶出拖网的路径'); } });
}
function removeFish(pool, i){
  const j = --pool.active;
  if(i !== j){ pool.p.copyWithin(i*3, j*3, j*3 + 3); pool.v.copyWithin(i*3, j*3, j*3 + 3); pool.seed.copyWithin(i*4, j*4, j*4 + 4); pool.sc[i] = pool.sc[j]; }
}
function netCatch(pool){
  const P = pool.p, np = trawl.netPos, dx = trawl.dir.x, dz = trawl.dir.z; let n = 0;
  for(let i=pool.active-1;i>=0;i--){
    const rx = P[i*3] - np.x, ry = P[i*3+1] - np.y, rz = P[i*3+2] - np.z;
    const along = -(rx*dx + rz*dz);
    if(along < -0.8 || along > 27) continue;
    const allowed = lerp(9.45, 1.35, Math.max(0, along)/27), lx = rx + dx*along, lz = rz + dz*along;
    if(lx*lx + ry*ry + lz*lz < allowed*allowed){ removeFish(pool, i); n++; }
  }
  if(n) pool.geo.attributes.aSeed.needsUpdate = true;
  return n;
}
function updateTrawl(dt){
  trawl.t += dt;
  trawl.boatPos.copy(trawl.start).addScaledVector(trawl.dir, trawl.t*trawl.speed); trawl.boatPos.y = SURFACE - 0.6;
  boat.position.copy(trawl.boatPos); boat.lookAt(tmpP.copy(trawl.boatPos).add(trawl.dir));
  const np = trawl.netPos.copy(trawl.boatPos).addScaledVector(trawl.dir, -34);
  if(trawl.haul > 0){ trawl.haul += dt; trawl.ny += dt*(2 + trawl.haul*1.5); }
  else trawl.ny = lerp(trawl.ny, topAt(np.x, np.z) + 8.5, Math.min(1, dt*1.5));
  np.y = trawl.ny;
  netG.position.copy(np); netG.lookAt(tmpP.copy(np).add(trawl.dir));
  const cp = cableGeo.attributes.position, sx = trawl.boatPos.x - trawl.dir.x*7, sz = trawl.boatPos.z - trawl.dir.z*7;
  const px = -trawl.dir.z*8.8, pz = trawl.dir.x*8.8;
  cp.setXYZ(0, sx, SURFACE - 1, sz); cp.setXYZ(1, np.x + px, np.y + 4, np.z + pz);
  cp.setXYZ(2, sx, SURFACE - 1, sz); cp.setXYZ(3, np.x - px, np.y + 4, np.z - pz); cp.needsUpdate = true;
  if(engine) engine.g.gain.value = 0.24 * clamp(1 - boat.position.distanceTo(player.pos)/170, 0, 1);
  if(!trawl.haul){
    trawl.caughtBait += netCatch(bait); trawl.caughtReg += netCatch(reg);
    catchBlob.scale.setScalar(0.35 + Math.sqrt(trawl.caughtBait + trawl.caughtReg)*0.055);
    PATCHES.forEach((P, i) => { if(Math.hypot(P.x - np.x, P.z - np.z) < P.R*0.8 + 5) scar[i] = Math.max(scar[i], 0.6); });
    const along = (np.x - trawl.c.x)*trawl.dir.x + (np.z - trawl.c.z)*trawl.dir.z;
    if(along > 55) trawl.haul = 0.001;
  } else if(trawl.haul > 7) finishTrawl();
}
function finishTrawl(){
  boat.visible = netG.visible = netG.userData.cables.visible = false; stopEngine();
  eco.fish = clamp(eco.fish * reg.active/regStart, 0.02, 1); eco.bait = clamp(eco.bait * bait.active/trawl.baitStart, 0.02, 1);
  let s = 0; for(let i=0;i<13;i++) s += scar[i];
  eco.coral = clamp(eco.coral - s/13*0.25, 0.02, 1);
  noRespawn = false; objective('');
  const B = SCHOOLS[sBait];
  const took = trawl.caughtBait + trawl.caughtReg, kept = Math.round(100 * bait.active / trawl.baitStart), herded = Math.hypot(B.x - trawl.c.x, B.z - trawl.c.z) > 9;
  const haul = trawl.caughtBait*0.04 + trawl.caughtReg*0.03; pendingHaul += haul;
  setState('aftermath');
  toast('拖网离开了', trawl.caughtReg > 0 ? `它带走了 ${took} 条鱼，其中 ${trawl.caughtReg} 条根本不是它要捕的。` : `它带走了 ${took} 条鱼。`, 7000);
  cue(7.5, () => toast(kept >= 70 ? (herded ? (avatar.kind === 'school' ? '你带着它们逃开了' : '你把它们赶开了') : '有一些逃掉了') : kept >= 35 ? '鱼群少了一半' : '大部分都被捕走了',
    `鱼群还剩 ${kept}%。这一网能给你的村子带来 ${Math.round(haul)} 的收入。`, 7000));
  cue(15, () => goVillage(beginRun));
}
function cutNet(d){
  d.alive = false; d.die = 1; eco.ghost = Math.max(0, eco.ghost - 0.25);
  pulseAt(d.pos); emit(d.pos, 160, 9, 1, 1); chime(debris.filter(x => !x.alive).length + 1);
  toast('幽灵网 · 已割断', '每张幽灵网每季让鱼群 −1.25%。');
}
function summonWhale(){ whale.visible = true; whaleT = 0; whaleC.copy(player.pos); whaleTh = player.yaw + 0.5; }
function surfaceUp(){
  if(mode !== 'dive' || rising) return;
  if(state === 'freedive' || (state === 'ending' && stateT > 3)){
    const back = state === 'ending' ? 'over' : returnTo, free = state === 'freedive';
    goVillage(() => { setState(back);
      if(back === 'report') $('vReport').classList.add('on');
      if(back === 'over') $('ending').classList.add('on');
      if(free && back !== 'over') seaDebrief(back); });
  }
}
// ---- surfacing, the reverse of the dive: rise to the surface, then the same camera pulls back out of the glass
let rising = null, unzoom = null;
const DIO_HOME = { pos: new THREE.Vector3(146, 136, 178), tgt: new THREE.Vector3(-6, -3, -14) };
function fromOcean(v, out){ return out.set(v.x/MK, (v.y - SURFACE)/MK, (v.z - MZ1)/MK + MZ0); }
// surfacing: one continuous pull-back. The camera stays on the animal, backs away and rises through the surface,
// and the same move carries on above water until it settles on the village view. One path, two renderers.
const SURF_T = 4.2, surfV = new THREE.Vector3(), surfV2 = new THREE.Vector3();
function startSurfacing(next){
  const saved = savedDioCam || DIO_HOME;
  const F0 = fromOcean(player.pos, new THREE.Vector3()), C0 = fromOcean(camera.position, new THREE.Vector3());
  const d0 = C0.clone().sub(F0), D0 = clamp(d0.length(), 1.2, 30), d1 = saved.pos.clone().sub(saved.tgt), D1 = d1.length();
  rising = { t: 0, next, saved, st: player, D0, D1, yaw0: Math.atan2(d0.x, d0.z), pit0: Math.asin(clamp(d0.y/Math.max(d0.length(), 1e-3), -0.6, 0.9)),
    yaw1: Math.atan2(d1.x, d1.z), pit1: Math.asin(d1.y/D1), fov0: camera.fov, F: new THREE.Vector3(), C: new THREE.Vector3(), above: false, eSwap: 1 };
  setState('surfacing');
  $('surfaceBtn').classList.remove('on'); $('swap').classList.remove('on'); $('avatarCard').classList.remove('on'); $('ptr').classList.remove('on'); objective('');
  if(document.pointerLockElement) document.exitPointerLock();
}
function surfPose(r, dt){
  r.t = Math.min(1, r.t + dt/SURF_T);
  const t = r.t, e = t*t*t*(t*(t*6 - 15) + 10);                          // smootherstep: no jolt at either end
  r.st.speed *= 1 - Math.min(1, dt*0.8);                                 // the animal coasts to a stop below you
  const Fc = fromOcean(r.st.pos, surfV);
  r.F.lerpVectors(Fc, r.saved.tgt, smooth(0.12, 1, e));                  // keep the animal centred, then hand over to the village
  const D = r.D0*Math.pow(r.D1/r.D0, e);                                  // a constant-rate zoom: every second it doubles out the same way
  const yaw = r.yaw0 + wrapA(r.yaw1 - r.yaw0)*smooth(0, 0.85, e), pit = lerp(lerp(r.pit0, 1.2, smooth(0, 0.3, e)), r.pit1, smooth(0.35, 1, e));   // crane up over the animal first, then swing round to the village angle
  const cp = Math.cos(pit);
  r.C.set(r.F.x + Math.sin(yaw)*cp*D, r.F.y + Math.sin(pit)*D, r.F.z + Math.cos(yaw)*cp*D);
  if(t >= 1){ r.C.copy(r.saved.pos); r.F.copy(r.saved.tgt); }
  return lerp(r.fov0, 26, smooth(0.05, 0.9, e));
}
function updateRising(dt){
  const r = rising, fov = surfPose(r, dt);
  toOcean(r.C, camera.position);
  camera.position.y = Math.max(camera.position.y, topAt(camera.position.x, camera.position.z) + 1.2);
  camera.lookAt(toOcean(r.F, surfV2)); camera.fov = fov; camera.clearViewOffset();
  placeOceanCamera();
  if(r.C.y > 0.02 || r.t >= 1){ rising = null; enterVillageReverse(r); }   // broke the surface: the village renderer takes over mid-move
}
function enterVillageReverse(r){
  enterVillage(() => {}, true);
  r.eSwap = r.t; r.above = true;
  portalU.uFx.value = 0; controls.enabled = false;
  $('village').classList.add('zooming');
  unzoom = r; updateUnzoom(0);
}
function updateUnzoom(dt){
  const u = unzoom, fov = surfPose(u, dt), k = smooth(u.eSwap, 1, u.t);
  dioCam.position.copy(u.C);
  dioCam.fov = fov; applyDioOffset(k); dioCam.lookAt(u.F);
  portalU.uFx.value = smooth(0, 0.35, u.t - u.eSwap);
  if(u.t >= 1){
    unzoom = null; savedDioCam = null;
    dioCam.position.copy(u.saved.pos); controls.target.copy(u.saved.tgt); controls.enabled = true; controls.update();
    $('village').classList.remove('zooming');
    u.next(); renderVillageUI();
  }
}
function storyUpdate(dt){
  for(const c of cues.slice()){ if(!c.done && stateT >= c.at){ c.done = true; const st = state; c.fn(); if(state !== st) break; } }
  if(state === 'explore'){
    let left = 0;
    for(const p of POIS){ if(p.found) continue;
      if(p.pos().distanceTo(player.pos) < 14){ p.found = true; toast(p.kicker, p.text, 6500); chime(POIS.filter(q => q.found).length*2); pulseAt(player.pos); }
      else left++; }
    objective(left ? `认识住在这里的生命 · ${3 - left} / 3` : '再待一会儿。');
    if(!exploreDone && (!left || stateT > 240)){ exploreDone = true;
      cue(stateT + (left ? 0 : 8), () => goVillage(() => { setState('plan');
        toast('岸上', '有一个渔村，靠你刚刚游过的这片礁区过活。现在由你来经营它。', 7000);
        cue(7.5, () => toast('怎么玩', '建造、设定捕捞规则，然后开始本季。每一季，珊瑚礁都会给出回应。你随时可以潜下去看。', 9000)); })); }
  } else if(state === 'trawl') updateTrawl(dt);
  else if(state === 'running' && stateT > RUN){
    const r = seasonStep();
    if(r.fishInc > 0.5) coin(`+${Math.round(r.fishInc)}`, new THREE.Vector3(8, 4, 8));
    if(r.tourInc > 0.5) coin(`+${Math.round(r.tourInc)}`, new THREE.Vector3(-18, 5, -1), '#1f8a8a');
    coin(`村库 ${fmt(r.moneyDelta)}`, new THREE.Vector3(0, 8, -16), r.moneyDelta < 0 ? '#b8452f' : '#1d8a5a');
    setState('tally'); renderVillageUI(); cue(2.0, () => { setState('report'); showReport(r); });
  } else if(state === 'freedive'){
    const left = debris.filter(d => d.alive).length;
    objective(seaObjective(left) || (left ? `礁上缠着遗落的渔网，把它们割掉（还剩 ${left} 张）` : '游一游，看看你的村子做了什么。准备好了就浮上水面。'));
    if(stateT > 1.5) $('surfaceBtn').classList.add('on');
  }
}
