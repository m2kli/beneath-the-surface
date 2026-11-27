// In-page playtest bot: plays a whole game through the real UI (clicks the real buttons), advancing time with __g.step
// so it works in a hidden tab. It watches for errors, stuck modals, overlapping cards and panels off screen.
// Use from the browser console on a running game (?mute=1):
//   const bot = await import('/tools/playbot.mjs?' + Date.now()); const rep = await bot.playGame({ dive: 0.4 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
// where an element comes to rest: a hidden tab freezes CSS transitions mid-way, which reads as overlaps that aren't there
const rest = el => { const t = el.style.transition; el.style.transition = 'none'; const r = el.getBoundingClientRect(); el.style.transition = t; return r; };
const on = id => $(id) && $(id).classList.contains('on');
const vis = el => { if(!el) return false; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };

export const PLANS = {
  balanced: { fish: 'quota', tour: 'limited', zone: 'core', waste: 'basic', work: 'normal', tax: 'mid' },
  greedy: { fish: 'industrial', tour: 'open', zone: 'none', waste: 'dump', work: 'overtime', tax: 'high' },
  green: { fish: 'line', tour: 'limited', zone: 'wide', waste: 'full', work: 'normal', tax: 'low' },
};
const BUILD_ORDER = ['house', 'shop', 'house', 'boat', 'cold', 'school', 'nursery', 'house', 'shop', 'plant', 'recycle', 'harbor', 'house', 'whale', 'research', 'house', 'offshore', 'house', 'resort'];

export async function playGame(o = {}){
  const g = window.__g, R = mulberry(o.seed || 7), plan = PLANS[o.plan || 'balanced'], issues = [], notes = [], t0 = performance.now();
  const issue = (s) => { if(!issues.includes(s)) issues.push(s); (o.log || console.log)('[bot] ' + s); };
  const errs0 = (window.__errs || []).length;
  const step = async (n = 1, dt = 1/30) => { for(let i=0;i<n;i++){ g.step(1, dt); if(i % 30 === 29) await sleep(4); } };
  const until = async (cond, what, maxSteps = 3000) => { for(let i=0;i<maxSteps;i++){ if(cond()) return true; g.step(1, 1/30); if(i % 20 === 19) await sleep(20); } issue('卡住：等不到 ' + what + `（state=${g.state} mode=${g.mode}）`); return false; };
  const click = (el, what) => { if(!el){ issue('找不到按钮 ' + what); return false; } if(el.disabled){ issue('按钮不可点 ' + what); return false; } el.click(); return true; };
  const audit = (where) => {
    const cards = ['vEvent', 'vPrompt', 'vReport', 'montage'].filter(on);
    if(cards.length > 1) issue(`${where}：同时打开了 ${cards.join('+')}`);
    if($('village').classList.contains('modal') && !cards.length && g.mode === 'village' && !['event'].includes(g.state)) issue(`${where}：遮罩开着但没有任何卡片（state=${g.state}）`);
    if(g.state === 'plan' && g.mode === 'village' && !cards.length && $('vRun').disabled) issue(`${where}：规划阶段“开始本季”是灰的`);
    if(g.state === 'plan' && g.mode === 'village' && !cards.length && !g.zoom && !on('coach') && vis($('vDive'))){
      const button = $('vDive'), rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2);
      if(!button.contains(hit)) issue(`${where}：鼠标点不到“潜入海底”`);
    }
    for(const id of ['vTop', 'vSide', 'vClock', 'hud', 'vBottom', ...cards, 'bInfo']){ const el = $(id); if(!vis(el)) continue; const r = rest(el);
      if(r.left < -2 || r.top < -2 || r.right > innerWidth + 2 || r.bottom > innerHeight + 2) issue(`${where}：#${id} 超出屏幕 (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)} / ${innerWidth}x${innerHeight})`); }
    const e = (window.__errs || []).slice(errs0); if(e.length) issue(`${where}：报错 ${e[e.length - 1]}`);
  };
  // ---- title -> new game
  if(g.state === 'intro'){ localStorage.removeItem('bts.save.v1.auto'); click($('go'), '开始经营'); if($('go').dataset.armed) click($('go'), '开始经营(确认)'); }
  await until(() => g.state === 'plan' && g.mode === 'village', '进入规划');
  await sleep(300);
  for(let i=0;i<6 && $('coach').classList.contains('on');i++){ $('coach').querySelector('button').click(); await sleep(30); }
  let bi = 0, dives = 0, seaDone = 0;
  let openingMoney = g.V.planStart ?? g.V.money, openingSea = { ...(g.V.planOcean || g.eco) };
  for(let s=0; s<(o.seasons || 16); s++){
    if(g.state === 'over') break;
    await until(() => g.state === 'plan' || g.state === 'event', '规划或事件');
    if(g.state === 'event'){ const bs = [...$('vEvent').querySelectorAll('button')]; click(bs[Math.floor(R()*bs.length)], '事件选项'); await step(3); }
    audit(`第${s + 1}季规划`);
    // policies, through the real segmented buttons
    for(const [k, v] of Object.entries(plan)){ const b = document.querySelector(`.pseg button[data-k="${k}"][data-v="${v}"]`); if(b && !b.disabled && !b.classList.contains('on')) b.click(); }
    // build what the bot can afford, in order
    document.querySelector('#vTabs button[data-t="build"]')?.click();
    for(let k=0;k<3 && bi < BUILD_ORDER.length;k++){ const c = document.querySelector(`#vBuild button.bc[data-k="${BUILD_ORDER[bi]}"]`); if(!c){ bi++; continue; }
      if(c.disabled){ if(/上限|渔港|capacity|limit|harbour/i.test(c.querySelector('.why')?.textContent || '')) bi++; break; } c.click(); bi++; await step(2); }
    document.querySelector('#vTabs button[data-t="pol"]')?.click();
    // now and then, focus a building and upgrade it through the card
    if(R() < 0.35 && window.PICK){ const owned = PICK.filter(p => (V[KEY[p.k]] || 0) > p.i && lvOf(V, p.k, p.i) < LVMAX[p.k]); const p = owned[Math.floor(R()*owned.length)];
      if(p){ openFocus(p); await step(40); audit(`第${s + 1}季聚焦${p.k}`); const up = $('bUp'); if(up && !up.disabled) up.click(); await step(2); $('bInfo').querySelector('.bx')?.click(); await step(40); } }
    // dive before the season
    if(R() < (o.dive ?? 0.3)){ dives++; seaDone += await diveOnce(g, until, step, sleep, issue, audit, `第${s + 1}季潜水`); if(g.state !== 'plan') await until(() => g.state === 'plan', '潜水后回到规划'); }
    if(!click($('vRun'), '开始本季')) break;
    await step(2);
    if(on('vPrompt')) click($('pStay'), '留在岸上');
    if(g.state === 'running'){
      const skip = $('skipMontage'), available = getComputedStyle(skip).display !== 'none';
      if(available !== (g.V.season >= 4)) issue(`第${s + 1}季的快进按钮出现时机有误`);
      if(available && s % 2 === 0){ click(skip, '直接看季报'); await step(); }
    }
    await until(() => g.state === 'report', '季度报告', 4000);
    audit(`第${s + 1}季报告`);
    const report = $('vReport'), cash = report.querySelector('.tiles b')?.textContent;
    const net = Number(report.querySelector('.tiles em')?.textContent.match(/[+−-]?\d+(?:\.\d+)?\s*$/)?.[0].replace('−', '-'));
    if(cash !== `${openingMoney} → ${g.V.money}` || net !== Math.round((g.V.money - openingMoney)*10)/10)
      issue(`第${s + 1}季季报的村库余额或净变化与实际不符`);
    const percent = value => Math.round(value*1000)/10;
    for(const key of ['coral', 'fish', 'clar', 'pelagic']){
      const endpoints = report.querySelector(`[data-metric="${key}"] td`)?.textContent;
      if(endpoints !== `${percent(openingSea[key])}% → ${percent(g.eco[key])}%`) issue(`第${s + 1}季 ${key} 的季初或季末海况有误`);
    }
    openingMoney = g.V.money; openingSea = { ...g.eco };
    notes.push([s + 1, [...document.querySelectorAll('#vReport .notes li')].map(l => l.innerText)]);
    click($('rNext'), '下一季'); await step(5);
  }
  await until(() => g.state === 'over', '结局', 400);
  audit('结局');
  const ending = $('endTitle')?.textContent;
  return { ending, issues, dives, seaDone, seasons: g.V.season + 1, money: Math.round(g.V.money), morale: g.V.morale, pop: g.V.pop, coral: +g.eco.coral.toFixed(2), fish: +g.eco.fish.toFixed(2), ms: Math.round(performance.now() - t0), notes };
}
// one free dive: do the season's underwater tasks the quick way (teleport between them), surface, answer any find
async function diveOnce(g, until, step, sleep, issue, audit, where){
  const btn = $('vDive'); if(!btn || btn.disabled){ issue(where + '：潜入按钮不可用'); return 0; }
  btn.click();
  if(!await until(() => g.mode === 'dive' && g.state === 'freedive', '进入潜水', 600)) return 0;
  if(!$('bayDive').hidden) $('bayFree').click();
  await step(20); audit(where);
  let done = 0; const S = V.sea, go = (p, dy = 1.5) => { player.pos.set(p.x, p.y + dy, p.z); player.speed = 0; };
  for(const k of SEA_KEYS){ if(S.seen[k]) continue; for(let i=0;i<90;i++){ go(SURV[k].pos, 0); g.step(1, 1/30); } if(S.seen[k]) done++; else issue(where + '：调查没完成 ' + k); }
  for(const c of COTS) if(c.visible){ go(c.position); await step(2); done++; }
  for(const t of TRASH) if(t.visible){ go(t.position); await step(2); done++; }
  for(const d of debris) if(d.alive){ go(d.pos); await step(2); done++; }
  if(S.ev && !S.evFound){ go(sea3.evPos, 3); await step(3); }
  await step(30);
  surfaceUp();
  await until(() => g.mode === 'village' && ['plan', 'event'].includes(g.state), '浮上水面', 900);
  if(g.state === 'event' && on('vEvent')){ const b = $('vEvent').querySelector('button[data-i="0"]'); b && b.click(); await step(3); }
  audit(where + '后');
  return done;
}
function mulberry(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; }
