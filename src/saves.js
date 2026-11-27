'use strict';
// ======================================================================= saves, the play log, the menus
const SAVE_KEY = 'bts.save.v1.', RUNS_KEY = 'bts.runs.v1', PEND_KEY = 'bts.pending', SET_KEY = 'bts.settings.v1';
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
  set(k, x){ try { localStorage.setItem(k, JSON.stringify(x)); return true; } catch(e){ return false; } },
  del(k){ try { localStorage.removeItem(k); } catch(e){} },
};
const SLOTS = ['auto', '1', '2', '3'], SLOT_NAME = { auto: '自动存档', 1: '存档 1', 2: '存档 2', 3: '存档 3' };
const POL_SHORT = {};
for(const P of POLICIES) for(const o of P.opts) POL_SHORT[P.k + ':' + o.v] = o.n;
const BUILD_NAME = Object.fromEntries(BUILD.map(b => [b.k, b.name]));
let paused = false, sysOpen = null, sysFrom = 'game', autoT = 0, logView = null;
const r1 = x => Math.round(x*10)/10;
const signed1 = x => { const n = r1(x); return n === 0 ? '0' : (n > 0 ? '+' : '−') + Math.abs(n); };
const logNet = e => r1(e.money[1] - e.money[0]);
function canSave(){ return mode === 'village' && state === 'plan' && !$('village').classList.contains('modal') && !zoom && !rising && !!V.runId; }
function snapshot(){ return { ver: 1, at: Date.now(), V: JSON.parse(JSON.stringify(V)), eco: { ...eco }, scar: Array.from(scar), pendingHaul, coachDone, clockF }; }
function readSlot(slot){ const s = store.get(SAVE_KEY + slot); return s && s.ver === 1 && s.V ? s : null; }
function saveSlot(slot){ return canSave() && store.set(SAVE_KEY + slot, snapshot()); }
let autoSeason = -1;
function queueAutosave(){
  if(canSave() && (autoSeason !== V.season + ':' + V.runId)){ saveSlot('auto'); autoSeason = V.season + ':' + V.runId; }
  clearTimeout(autoT); autoT = setTimeout(() => { if(canSave()) saveSlot('auto'); }, 400);
}
function newRun(){ V.runId = Date.now().toString(36); V.startedAt = Date.now(); V.log = []; V.planStart = V.money; V.planOcean = oceanSnapshot(eco); }
function applySnapshot(s){
  for(const k of Object.keys(V)) delete V[k];
  Object.assign(V, JSON.parse(JSON.stringify(s.V)));
  Object.assign(eco, {pelagic: 1}, s.eco); scar.fill(0); if(s.scar) scar.set(s.scar.slice(0, 13));
  if(!V.log) V.log = []; if(!V.runId) newRun();
  for(const k of Object.values(KEY)) if(V[k] == null) V[k] = 0; V.lv = V.lv || {}; V.ups = V.ups || [];
  const previous = V.log.at(-1);
  // Older saves can open after a paid dive from the previous report.
  V.planStart = previous?.money?.[1] ?? s.V.planStart ?? r1(V.money + (V.buildSpent || 0));
  if(!s.V.planOcean){
    V.planOcean = oceanSnapshot(eco);
    // Older planning saves postdate the red-tide choice. Recover the pre-event stock.
    if(V.mods?.bloom) V.planOcean.fish = eco.fish > 0.02 ? Math.min(1, eco.fish + 0.06) : (previous?.eco?.[1] ?? 8)/100;
  }
  pendingHaul = s.pendingHaul || 0; coachDone = !!s.coachDone;
  if(typeof s.clockF === 'number') clockF = s.clockF;
  patchLife.fill(clamp(eco.coral, 0.05, 1));
  townTier = -1; for(const e of TIERED){ e.shown = -1; e.wait = -1; }
}
// the season, written down: what you chose, what came in, what went out, and why
function logSeason(pre, r){
  if(!V.log) V.log = [];
  const evCost = -r.treasury.events;
  V.log.push({ s: pre.season, pol: pre.pol, built: pre.built, buildSpent: pre.spent, ev: pre.ev ? { ...pre.ev, cost: evCost } : (evCost ? { t: '—', c: '—', cost: evCost } : null),
    bayDive: r.bayDive, bayRoutine: r.bayRoutine,
    money: [r.treasury.start, r.treasury.end], tax: r1(r.tax), fee: r1(r.fee), grant: r1((r.grant || 0) - (r.wages || 0)), research: r1(r.resInc), wages: r1(r.wages || 0), pub: r.pub.map(([l, x]) => [l, r1(x)]), dMoney: r.treasury.operating,
    morale: [Math.round(pre.morale), Math.round(V.morale)], why: r.morale.map(([l, x]) => [l, Math.round(x)]), pop: [r.pop0, r.pop1],
    catch: r1(r.catchT), sold: r1(r.sold), eat: r1(Math.min(r.catchT + pre.food, r.foodNeed)), fishInc: r1(r.fishInc), tourInc: r1(r.tourInc), visitors: Math.round(r.visitors),
    perCap: r1(r.perCap), staff: Math.round(r.staff*100), haul: r1(r.haul || 0), eco: [Math.round(eco.coral*100), Math.round(eco.fish*100), Math.round(eco.clar*100), Math.round((eco.pelagic ?? 1)*100)], tier: devTier(V), off: r1(r.offCatch || 0), whale: Math.round(r.whaleVis || 0) });
  // what happened under the surface this season: the dive work and what nobody fixed
  if(r.sea && r.seaS){ const S = r.seaS, x = r.sea; V.log[V.log.length - 1].sea = { dived: !!S.dived, seen: x.samples, cots: [S.gone.cots.length, S.cots], trash: [S.gone.trash.length, S.trash],
    ev: S.ev ? { n: SEA_EV[S.ev].n, found: !!S.evFound, fix: !!S.evFix } : null, luck: [r1(S.t.coral*100), r1(S.t.fish*100), r1(S.t.pel*100)], dC: r1(x.dC*100), dF: r1(x.dF*100) }; }
  V.evLog = null;
  archiveRun();
}
function archiveRun(ending){
  if(!V.runId) return;
  const runs = store.get(RUNS_KEY) || [];
  const i = runs.findIndex(x => x.id === V.runId);
  const rec = { id: V.runId, startedAt: V.startedAt, updatedAt: Date.now(), season: V.season, ending: ending || (i >= 0 ? runs[i].ending : null), log: V.log };
  if(i >= 0) runs.splice(i, 1);
  runs.unshift(rec); store.set(RUNS_KEY, runs.slice(0, 12));
}
// ---- what the treasury did over a whole run
function ledger(log){
  const t = { tax: 0, fee: 0, grant: 0, research: 0, build: 0, ev: 0, net: 0, pub: {} };
  for(const e of log){
    t.tax += e.tax; t.fee += e.fee; t.grant += e.grant || 0; t.research += e.research || 0;
    t.build += e.buildSpent || 0; t.ev += e.ev?.cost || 0; t.net += logNet(e);
    for(const [l, x] of e.pub) t.pub[l] = (t.pub[l] || 0) + x;
  }
  const pubSum = Object.values(t.pub).reduce((a, x) => a + x, 0);
  return { ...t, pubSum, net: r1(t.net) };
}
// one line about the season's underwater side, for the log
const seaLine = e => { const q = e.sea; if(!q) return ''; const pm = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1) + '%';
  return `${q.dived ? `潜水 · 调查 ${q.seen}/3` : '没潜水'} · 长棘海星 清 ${q.cots[0]}/${q.cots[1]} · 垃圾 捡 ${q.trash[0]}/${q.trash[1]}${q.ev ? ` · ${q.ev.n}${q.ev.fix ? '（已处理）' : q.ev.found ? '（发现，没处理）' : '（没发现）'}` : ''} · 季末额外：珊瑚 ${pm(q.dC)} 鱼群 ${pm(q.dF)}`; };
function logText(rec){
  const L = [`海面之下 · 游玩记录`, `开始 ${saveDate(rec.startedAt || Date.now())} · 共 ${rec.log.length} 季${rec.ending ? ' · 结局：' + rec.ending : ''}`, ''];
  for(const e of rec.log){
    L.push(`【${seasonName(e.s)}】村库 ${e.money[0]} → ${e.money[1]}  民心 ${e.morale[0]} → ${e.morale[1]}  村民 ${e.pop[0]} → ${e.pop[1]}  珊瑚 ${e.eco[0]}% 鱼群 ${e.eco[1]}% 水质 ${e.eco[2]}%`);
    L.push(`  政策：${Object.entries(e.pol).map(([k, v]) => POL_SHORT[k + ':' + v]).join(' / ')}`);
    if(e.built.length) L.push(`  建设：${e.built.map(k => BUILD_NAME[k]).join('、')}（−${e.buildSpent}）`);
    if(e.ev) L.push(`  事件：${e.ev.t} → ${e.ev.c}${e.ev.cost ? `（村库 ${fmt(-e.ev.cost)}）` : ''}`);
    L.push(`  村库：税 +${e.tax}  门票 +${e.fee}  ${e.grant ? `保护资助 +${e.grant}  ` : ''}${e.pub.map(([l, x]) => `${l} −${x}`).join('  ')}  ${e.research ? `科研经费 +${e.research}  ` : ''}经营结余 ${signed1(e.dMoney)} · 村库净变化 ${signed1(logNet(e))}`);
    L.push(`  渔获 ${e.catch} 吨（吃掉 ${e.eat}，卖出 ${e.sold}）  游客 ${e.visitors}  人手 ${e.staff}%  人均生活 ${e.perCap}`);
    L.push(`  民心：${e.why.map(([l, x]) => `${l} ${fmt(x)}`).join('  ') || '无变化'}`);
    if(e.sea) L.push(`  水下：${seaLine(e)}`);
    if(e.bayDive) L.push('  海湾 '+e.bayDive.title+' · '+e.bayDive.note+' '+(BAY_JOBS[e.bayDive.job]||'沿用原安排'));
  }
  const g = ledger(rec.log);
  L.push('', `合计：税收 +${r1(g.tax)}  门票 +${r1(g.fee)}  ${Object.entries(g.pub).map(([l, x]) => `${l} −${r1(x)}`).join('  ')}  保护资助 +${r1(g.grant)}  科研经费 +${r1(g.research)}  建设 ${signed1(-g.build)}  事件 ${signed1(-g.ev)}  村库净变化 ${signed1(g.net)}`);
  return L.map(gameText).join('\n');
}
function saveDate(at){
  return new Date(at).toLocaleString(GameLocale.language,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
// ---- the menu card
function openSys(view, from){
  sysFrom = from || (state === 'intro' ? 'title' : 'game');
  if(sysFrom === 'game'){ paused = true; if(document.pointerLockElement) document.exitPointerLock(); }
  sysOpen = view; renderSys(); $('sys').inert=false; $('intro').inert=true; $('playUI').inert=true; $('sys').classList.add('on');
}
function closeSys(){ $('sys').classList.remove('on'); $('sys').inert=true; $('playUI').inert=state==='intro'; $('intro').inert=state!=='intro'; sysOpen = null; paused = false; clock.getDelta(); }
function slotMeta(s){
  if(!s) return '<span class="empty">空</span>';
  const v = s.V;
  return `<b>${seasonName(v.season)}</b> · ${TIERS[devTier(v)].n} · 村库 ${Math.round(v.money)} · 民心 ${Math.round(v.morale)} · 珊瑚 ${Math.round(s.eco.coral*100)}% · 鱼群 ${Math.round(s.eco.fish*100)}%<br><small>${saveDate(s.at)}</small>`;
}
function renderSys(){
  const el = $('sysCard'), back = `<button class="sb back" data-go="${sysFrom === 'title' ? 'close' : 'main'}">‹ 返回</button>`;
  if(sysOpen === 'main'){
    setGameHTML(el, `<div class="sk">已暂停</div><h3>菜单</h3><div class="sbtns">
      <button class="sb primary" data-go="close">${ic('play')}继续游戏</button>
      <button class="sb" data-go="saves">${ic('scroll')}保存 / 读取</button>
      <button class="sb" data-go="log">${ic('book')}游玩记录</button>
      <button class="sb" data-go="settings">${ic('hammer')}设置</button>
      <button class="sb" data-go="title">${ic('wave')}返回标题</button></div>
      <p class="sn">${canSave() ? '规划阶段会自动存档。' : mode === 'dive' ? '潜水时不能存档，回到岸上会自动存档。返回标题会回到最近的自动存档。' : '季度进行中，回到规划阶段才能存档。返回标题会回到本季开始。'}</p>`);
  } else if(sysOpen === 'saves'){
    const can = sysFrom === 'game' && canSave();
    setGameHTML(el, `${back}<h3>存档</h3>${sysFrom === 'game' && !can ? `<p class="sn warn">现在不能存档：${mode === 'dive' ? '先回到岸上。' : '回到规划阶段（没有弹窗时）再存。'}</p>` : ''}
      <div class="slots">${SLOTS.map(k => { const s = readSlot(k); return `<div class="slot"><div class="sm2"><div class="sl">${SLOT_NAME[k]}</div><div class="smeta">${slotMeta(s)}</div></div>
        <div class="sa">${k !== 'auto' && sysFrom === 'game' ? `<button class="sb sm" data-save="${k}" ${can ? '' : 'disabled'}>保存</button>` : ''}
        ${s ? `<button class="sb sm primary" data-load="${k}">读取</button>` : ''}${s && k !== 'auto' ? `<button class="sb sm ghost" data-del="${k}">删除</button>` : ''}</div></div>`; }).join('')}</div>
      <p class="sn">存档保存在这台电脑的浏览器里。换浏览器或清除网站数据会丢失。</p>`);
  } else if(sysOpen === 'log'){
    const runs = store.get(RUNS_KEY) || [];
    const cur = V.runId && V.log ? { id: V.runId, startedAt: V.startedAt, log: V.log, ending: null, current: true } : null;
    const list = cur ? [cur, ...runs.filter(x => x.id !== cur.id)] : runs;
    if(!logView || !list.find(x => x.id === logView)) logView = list[0] ? list[0].id : null;
    const rec = list.find(x => x.id === logView);
    const opt = r => `<option value="${r.id}" ${r.id === logView ? 'selected' : ''}>${r.current ? '当前这局' : saveDate(r.startedAt)} · ${r.log.length} 季${r.ending ? ' · ' + r.ending : ''}</option>`;
    let body = '<p class="sn">还没有记录。玩完一季就会有了。</p>';
    if(rec && rec.log.length){
      const g = ledger(rec.log), items = [['税收', g.tax], ['门票', g.fee], ['保护资助', g.grant], ['科研经费', g.research], ...Object.entries(g.pub).map(([l, x]) => [l, -x]), ['建设', -g.build], ['事件', -g.ev]].filter(x => Math.abs(x[1]) > 0.5);
      const worst = items.filter(x => x[1] < 0).sort((a, b) => a[1] - b[1])[0];
      const maxA = Math.max(...items.map(x => Math.abs(x[1])), 1);
      body = `<div class="lsum"><div class="lt">村库账本（${rec.log.length} 季）· 合计 <b class="${g.net < 0 ? 'negc' : 'pos'}">${signed1(g.net)}</b></div>
        ${items.map(([l, x]) => `<div class="lb"><span>${l}</span><i class="${x < 0 ? 'neg' : ''}" style="width:${(Math.abs(x)/maxA*100).toFixed(0)}%"></i><b class="${x < 0 ? 'negc' : 'pos'}">${fmt(x)}</b></div>`).join('')}
        ${worst ? `<p class="sn">最大的一笔支出是「${worst[0]}」。${g.tax < g.pubSum*0.5 ? '税收只够付不到一半的公共开支：税只对卖出去的鱼和旅游收入抽成，村民自己吃掉的鱼不交税。' : ''}</p>` : ''}</div>
        <div class="ltab"><div class="lh"><span>季度</span><span>村库</span><span>收入</span><span>支出</span><span>民心</span><span>海</span></div>
        ${rec.log.map((e, i) => `<details class="lr"><summary><span>${seasonName(e.s)}</span><span class="${logNet(e) < 0 ? 'negc' : ''}">${e.money[1]} <small>${signed1(logNet(e))}</small></span><span class="pos">+${r1(e.tax + e.fee + (e.grant || 0) + (e.research || 0) + Math.max(0, -(e.ev?.cost || 0)))}</span><span class="negc">−${r1(e.pub.reduce((a, x) => a + x[1], 0) + (e.buildSpent || 0) + Math.max(0, e.ev?.cost || 0))}</span><span>${e.morale[1]} <small>${fmt(e.morale[1] - e.morale[0])}</small></span><span>${e.eco[0]}/${e.eco[1]}</span></summary>
          <div class="ld"><div><em>政策</em>${Object.entries(e.pol).map(([k, v]) => POL_SHORT[k + ':' + v]).join(' · ')}</div>
          ${e.built.length ? `<div><em>建设</em>${e.built.map(k => BUILD_NAME[k]).join('、')} <span class="negc">−${e.buildSpent}</span></div>` : ''}
          ${e.ev ? `<div><em>事件</em>${e.ev.t} → ${e.ev.c}${e.ev.cost ? ` <span class="negc">${fmt(-e.ev.cost)}</span>` : ''}</div>` : ''}
          <div><em>村库</em>税 <span class="pos">+${e.tax}</span> · 门票 <span class="pos">+${e.fee}</span>${e.grant ? ` · 保护资助 <span class="pos">+${e.grant}</span>` : ''}${e.research ? ` · 科研经费 <span class="pos">+${e.research}</span>` : ''}${e.pub.map(([l, x]) => ` · ${l} <span class="negc">−${x}</span>`).join('')}</div>
          <div><em>渔获</em>${e.catch} 吨：村民吃掉 ${e.eat}，卖出 ${e.sold}${e.haul ? ` · 拖网 +${e.haul}` : ''} · 游客 ${e.visitors} · 人手 ${e.staff}%</div>
          <div><em>民心</em>${e.why.map(([l, x]) => `${l} <span class="${x < 0 ? 'negc' : 'pos'}">${fmt(x)}</span>`).join(' · ') || '无变化'}</div>
          ${e.sea ? `<div><em>水下</em>${seaLine(e)}</div>` : ''}
          ${bayReportHTML(e)}
          <div><em>海</em>珊瑚 ${e.eco[0]}% · 鱼群 ${e.eco[1]}% · 水质 ${e.eco[2]}% · 村民 ${e.pop[0]} → ${e.pop[1]}</div></div></details>`).join('')}</div>`;
    }
    setGameHTML(el, `${back}<h3>游玩记录</h3>${list.length ? `<select id="logSel">${list.map(opt).join('')}</select>` : ''}${body}
      <div class="sbtns row">${rec && rec.log.length ? `<button class="sb sm" data-exp="json">${ic('scroll')}导出文件</button><button class="sb sm" data-exp="text">复制为文字</button>` : ''}<button class="sb sm ghost" data-exp="import">导入记录…</button></div>`);
    const sel = $('logSel'); if(sel) sel.onchange = () => { logView = sel.value; renderSys(); };
    el._rec = rec;
  } else if(sysOpen === 'settings'){
    setGameHTML(el, `${back}<h3>设置</h3><div class="sets">
      <div class="set"><span>声音<small>也可以随时按 M 切换</small></span><button class="sb sm" data-set="mute">${userMuted ? '已关闭' : '已开启'}</button></div>
      <div class="set"><span>画质<small>切换后会重新载入，回到最近的自动存档</small></span><button class="sb sm" data-set="q">${LOW ? '流畅' : '精美'}</button></div>
      <div class="set"><span>新手引导<small>在岸上时立即重新显示</small></span><button class="sb sm" data-set="coach">重新显示</button></div>
      <div class="set"><span>清除全部存档和记录<small>不能撤销</small></span><button class="sb sm ghost" data-set="wipe">清除</button></div></div>`);
  }
}
function download(name, text){ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function loadSlot(k){
  const s = readSlot(k); if(!s) return;
  if(sysFrom === 'title'){ closeSys(); startGame(s); }
  else { try { sessionStorage.setItem(PEND_KEY, k); } catch(e){} location.reload(); }
}
$('sysCard').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b || b.disabled) return;
  const d = b.dataset;
  if(d.go === 'close') closeSys();
  else if(d.go === 'title'){ try { sessionStorage.removeItem(PEND_KEY); } catch(e){} location.reload(); }
  else if(d.go){ sysOpen = d.go; renderSys(); }
  else if(d.save){ if(saveSlot(d.save)){ chime(2); renderSys(); } }
  else if(d.load) loadSlot(d.load);
  else if(d.del){ if(b.dataset.armed){ store.del(SAVE_KEY + d.del); renderSys(); } else { b.dataset.armed = 1; b.textContent = gameText('确认删除'); } }
  else if(d.exp === 'json'){ const r = $('sysCard')._rec; download(`${gameText('海面之下-记录-')}${new Date(r.startedAt || Date.now()).toISOString().slice(0, 10)}.json`, JSON.stringify({ game: 'beneath-the-surface', ...r }, null, 1)); }
  else if(d.exp === 'text'){ const r = $('sysCard')._rec; navigator.clipboard && navigator.clipboard.writeText(logText(r)).then(() => { b.textContent = gameText('已复制'); }, () => { b.textContent = gameText('复制失败'); }); }
  else if(d.exp === 'import') $('logFile').click();
  else if(d.set === 'mute'){ userMuted = !userMuted; applyMute(); renderSys(); }
  else if(d.set === 'q'){ const u = new URL(location.href); if(LOW) u.searchParams.delete('q'); else u.searchParams.set('q', 'low'); if(readSlot('auto') && state !== 'intro'){ try { sessionStorage.setItem(PEND_KEY, 'auto'); } catch(e){} } location.href = u.toString(); }
  else if(d.set === 'coach'){ coachDone = false; if(sysFrom === 'game' && mode === 'village'){ closeSys(); showCoach(0); } else b.textContent = gameText('好的'); }
  else if(d.set === 'wipe'){ if(b.dataset.armed){ for(const k of SLOTS) store.del(SAVE_KEY + k); store.del(RUNS_KEY); b.textContent = gameText('已清除'); } else { b.dataset.armed = 1; b.textContent = gameText('再点一次确认'); } }
});
$('logFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if(!f) return;
  try { const r = JSON.parse(await f.text()); if(!Array.isArray(r.log)) throw 0;
    const runs = store.get(RUNS_KEY) || []; const id = r.id || 'imp' + Date.now().toString(36);
    runs.unshift({ id, startedAt: r.startedAt || Date.now(), updatedAt: Date.now(), season: r.season, ending: r.ending || '导入', log: r.log }); store.set(RUNS_KEY, runs.slice(0, 12));
    logView = id; renderSys();
  } catch(err){ toast('导入失败', '这个文件不是游玩记录。'); }
  e.target.value = '';
});
$('sys').addEventListener('click', e => { if(e.target === $('sys')) closeSys(); });
addEventListener('keydown', e => { if(e.code !== 'Escape') return; if(focusOn && !sysOpen){ exitFocus(); return; } if(sysOpen){ if(sysOpen !== 'main' && sysFrom === 'game'){ sysOpen = 'main'; renderSys(); } else closeSys(); } else if(state !== 'intro') openSys('main'); });
$('menuBtn').addEventListener('click', () => openSys('main'));
$('sysBtn').addEventListener('click', () => openSys('main'));
// ---- the title screen
function startGame(snap){
  if(state !== 'intro') return;
  if(snap) applySnapshot(snap); else newRun();
  start(!!snap);
}
function renderTitle(){
  const s = readSlot('auto'), runs = store.get(RUNS_KEY) || [];
  $('go').disabled=false; $('tSet').disabled=false;
  $('tCont').style.display = s ? '' : 'none';
  if(s) $('tContInfo').textContent = gameText(`${seasonName(s.V.season)} · ${TIERS[devTier(s.V)].n} · 村库 ${Math.round(s.V.money)}`);
  $('go').classList.toggle('primary', !s); $('go').firstChild.textContent = gameText(s && $('go').dataset.armed ? '再点一次：新游戏会覆盖自动存档' : s ? '新游戏' : '开始经营');
  $('tLoad').style.display = SLOTS.some(k => readSlot(k)) ? '' : 'none';
  $('tLog').style.display = runs.length ? '' : 'none';
}
$('tCont').addEventListener('click', () => { const s = readSlot('auto'); if(s) startGame(s); });
$('go').addEventListener('click', () => {
  if(readSlot('auto') && !$('go').dataset.armed){ $('go').dataset.armed = 1; $('go').firstChild.textContent = gameText('再点一次：新游戏会覆盖自动存档'); return; }
  startGame(null);
});
$('tLoad').addEventListener('click', () => openSys('saves', 'title'));
$('tLog').addEventListener('click', () => openSys('log', 'title'));
$('tSet').addEventListener('click', () => openSys('settings', 'title'));
renderTitle();
document.addEventListener('ocean-language-changed', () => {
  if(state==='intro') renderTitle();
  if(sysOpen) renderSys();
});
{ let pend = null; try { pend = sessionStorage.getItem(PEND_KEY); sessionStorage.removeItem(PEND_KEY); } catch(e){}
  const s = pend && readSlot(pend); if(s) setTimeout(() => startGame(s), 60); }
// for checking a player's run from outside
Object.assign(window, { __saves: { slots: () => Object.fromEntries(SLOTS.map(k => [k, readSlot(k)])), runs: () => store.get(RUNS_KEY) || [], text: i => { const r = (store.get(RUNS_KEY) || [])[i || 0]; return r ? logText(r) : ''; } } });

$('surfaceBtn').addEventListener('click', surfaceUp);
addEventListener('keydown', e => { if(e.code === 'KeyE') surfaceUp(); });
