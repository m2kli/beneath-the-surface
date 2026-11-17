// stress harness: the real season model + the real events + trawl prompts + policy locks, driven by many kinds of players
import fs from 'fs';
import { gameSource } from './lib.mjs';
const html = gameSource();
// the hidden sea: none (off), ignore (a player who never dives), dive (dives and fixes everything)
const SEAM = process.env.SEA || 'ignore';
const MODE = process.argv[3] || 'all', NGAMES = +(process.argv[4] || 3000);
const a = html.indexOf('const REC = {'), b = html.indexOf('function seasonStep(){');
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x)), lerp = (x, y, t) => x + (y - x)*t;
const mod = new Function('clamp', 'lerp', html.slice(a, b) + '; return { simulateSeason, rollSea: typeof rollSea === "function" ? rollSea : null, seaView: typeof seaView === "function" ? seaView : null, SEA_EV: typeof SEA_EV === "object" ? SEA_EV : null, devTier, BUILD, KEY, maxOf: typeof maxOf === "function" ? maxOf : null, upCost: typeof upCost === "function" ? upCost : null, LVMAX: typeof LVMAX === "object" ? LVMAX : null };')(clamp, lerp);
const evSrc = html.slice(html.indexOf('const EVENTS = ['), html.indexOf('function rollEvent(){'));
let seed = 12345; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; };
const COST = {}, MAX = {}; for(const x of mod.BUILD){ COST[x.k] = x.cost; MAX[x.k] = x.max; }
const KEY = mod.KEY, N = 16;
const OPTS = { fish: ['industrial', 'quota', 'line', 'ban'], tour: ['open', 'limited', 'closed'], zone: ['none', 'core', 'wide'], waste: ['dump', 'basic', 'full'], work: ['normal', 'festival', 'overtime'], tax: ['low', 'mid', 'high'] };
const ALLPOL = []; (function rec(i, cur){ const ks = Object.keys(OPTS); if(i === ks.length){ ALLPOL.push({ ...cur }); return; } for(const v of OPTS[ks[i]]) rec(i + 1, { ...cur, [ks[i]]: v }); })(0, {});
const newGame = () => ({ eco: { coral: 1, fish: 1, bait: 1, clar: 1, ghost: 0, nutr: 0 },
  V: { season: 0, money: 150, food: 6, houses: 4, pop: 14, morale: 60, rep: 0.3, boats: 2, trawlers: 0, shops: 0, resort: 0, plant: 0, recycle: 0, cold: 0, nursery: 0, school: 0,
    pol: { fish: 'quota', tour: 'closed', zone: 'none', waste: 'dump', work: 'normal', tax: 'mid' }, prevPol: null, locks: {}, mods: {}, mpaSeasons: 0, history: [], lastEvent: null, evAt: {} } });
const bad = [];
function check(G, tag){
  const { V, eco } = G;
  for(const [k, x] of Object.entries({ ...eco, money: V.money, morale: V.morale, pop: V.pop, food: V.food, rep: V.rep })) if(!Number.isFinite(x)) bad.push(`${tag} 非数值 ${k}=${x}`);
  const cap = (() => { let c = 0; for(let i=0;i<V.houses;i++) c += [4, 6, 8][((V.lv && V.lv.house && V.lv.house[i]) || 1) - 1]; return c; })(); if(V.pop > cap + 0.01) bad.push(`${tag} 人口超过住房 ${V.pop}/${cap}`);
  if(V.morale < 0 || V.morale > 100) bad.push(`${tag} 民心越界 ${V.morale}`);
  for(const k of ['coral', 'fish', 'bait', 'clar', 'pelagic']) if(eco[k] < 0 || eco[k] > 1.0001) bad.push(`${tag} 海洋越界 ${k}=${eco[k]}`);
  if(V.food < -0.01) bad.push(`${tag} 存鱼为负 ${V.food}`);
  for(const k of Object.values(KEY)) if(V[k] < 0) bad.push(`${tag} 建筑为负 ${k}`);
}
// one season, the way the game runs it: event at the start (from season 1), the player plans, the trawl prompt, the season
function rollEvent(G){
  const { V } = G; if(V.season === 0 || rnd() > 0.7) return null;
  const EV = new Function('V', 'eco', 'rng', evSrc + '; return EVENTS;')(V, G.eco, rnd);
  const pool = EV.filter(ev => ev.id !== V.lastEvent && !(V.evAt[ev.id] !== undefined && V.season - V.evAt[ev.id] < 6) && (!ev.when || ev.when(V.season)));
  let tot = pool.reduce((s, ev) => s + ev.w, 0), x = rnd()*tot; for(const ev of pool){ x -= ev.w; if(x <= 0) return ev; } return null;
}
function playSeason(G, bot){
  const { V } = G;
  const ev = rollEvent(G);
  if(ev){ V.lastEvent = ev.id; V.evAt[ev.id] = V.season; const i = bot.event ? bot.event(G, ev) : (rnd()*ev.o.length)|0; ev.o[i].go(); }
  if(SEAM !== 'none'){ const S = V.sea = mod.rollSea(G.eco, V, V.season, rnd);
    if(SEAM === 'dive'){ S.dived = true; S.seen = { coral: 1, fish: 1, pel: 1 }; S.gone.cots = Array(S.cots).fill(0); S.gone.trash = Array(S.trash).fill(0);
      if(S.ev){ S.evFound = true; const E = mod.SEA_EV[S.ev]; if(V.money > E.fix - 60){ S.evFix = true; V.money += E.gain - E.fix; } } } }
  const want = bot.policy(G); for(const k in want) if(!V.locks[k]) V.pol[k] = want[k];
  for(const k of bot.build(G)){
    if(k.startsWith('up:')){ const kk = k.slice(3), cnt = V[KEY[kk]] || 0; if(!mod.upCost || !cnt) continue; V.lv = V.lv || {}; const arr = V.lv[kk] = V.lv[kk] || [];
      for(let i=0;i<cnt;i++){ const lv = arr[i] || 1; if(lv < mod.LVMAX[kk]){ const c = mod.upCost(kk, lv); if(V.money - c >= (bot.keep ?? 30)){ V.money -= c; arr[i] = lv + 1; } break; } } continue; }
    const mx = mod.maxOf ? mod.maxOf(V, k) : MAX[k]; if(MAX[k] === undefined) continue;
    if(V.money - COST[k] >= (bot.keep ?? 30) && (V[KEY[k]] || 0) < mx){ V.money -= COST[k]; V[KEY[k]] = (V[KEY[k]] || 0) + 1; if(V.lv && V.lv[k]) V.lv[k].push(1); } }
  let haul = 0;
  if(V.pol.fish === 'industrial' && V.trawlers > 0 && V.pol.zone !== 'wide' && G.eco.bait > 0.12){   // auto-trawl (the player stays ashore)
    const takenB = Math.round(G.eco.bait*1800*0.85), takenR = Math.round(140 + 60*G.eco.fish); haul = takenB*0.04 + takenR*0.03; G.eco.bait *= 0.15; G.eco.fish *= 0.94; }
  const o = mod.simulateSeason(G.eco, V, haul);
  Object.assign(G.eco, o.e); for(const k of Object.keys(V)) delete V[k]; Object.assign(V, o.v);
  delete V.sea; V.prevPol = { ...V.pol }; V.mods = {}; for(const k in V.locks){ if(--V.locks[k] <= 0) delete V.locks[k]; }
  return o.r;
}
function ending(G, fail){ const { V, eco: e } = G; const oceanOK = e.fish > 0.55 && e.coral > 0.55 && (e.pelagic === undefined || e.pelagic > 0.4), grew = mod.devTier(V) >= 1 && V.pop >= 20, villageOK = V.morale >= 50 && V.money >= 0 && grew;
  return fail || (oceanOK ? (villageOK ? '好结局' : !grew && V.morale >= 50 ? '原地踏步' : '海好村差') : e.fish > 0.33 ? (villageOK ? '中·村好海差' : '中') : '坏结局'); }
function playGame(bot, G = newGame(), tag = ''){
  let fail = '', maxMoney = -1e9, rs = [];
  for(let s=G.V.season;s<N;s++){
    const r = playSeason(G, bot); rs.push(r); G.V.season++; check(G, `${tag}季${s}`); maxMoney = Math.max(maxMoney, G.V.money);
    if(G.V.morale <= 5){ fail = '民心崩溃'; break; } if(G.V.money < -100){ fail = '破产'; break; } if(G.V.pop <= 6){ fail = '人走光'; break; }
  }
  return { end: ending(G, fail), G, maxMoney, rs };
}
// ---- players
const pickR = arr => arr[(rnd()*arr.length)|0];
const randomPol = () => Object.fromEntries(Object.entries(OPTS).map(([k, v]) => [k, pickR(v)]));
const BKEYS = Object.keys(KEY).concat(Object.keys(KEY).map(k => 'up:' + k));
const bots = {
  // changes one or two policies now and then, builds whatever it can afford
  random: () => { let cur = randomPol(); return { policy(){ if(rnd() < 0.5){ const k = pickR(Object.keys(OPTS)); cur[k] = pickR(OPTS[k]); } return cur; }, build(){ return rnd() < 0.6 ? [pickR(BKEYS)] : []; } }; },
  // looks only at next season's forecast: money and morale
  myopicMoney: () => ({ policy(G){ return bestBy(G, r => r.v.money + r.v.morale*0.5); }, build: () => ['house', 'shop', 'boat', 'trawler', 'resort'] }),
  // looks at next season's forecast, cares about the sea too (the way a careful first-time player reads the forecast panel)
  myopicBalanced: () => ({ policy(G){ return bestBy(G, r => r.v.money*0.3 + r.v.morale + 120*(r.e.coral + r.e.fish + (r.e.pelagic ?? 1)*0.5)); }, build: (G) => G.eco.coral < 0.6 ? ['nursery', 'house'] : G.V.season < 6 ? ['house', 'shop', 'school', 'cold'] : ['house', 'shop', 'up:shop', 'harbor', 'whale', 'up:house', 'research', 'up:harbor', 'offshore'], keep: 35 }),
  developer: () => ({ policy(G){ return bestBy(G, r => r.v.money*0.6 + r.v.morale*0.8 + 60*(r.e.coral + r.e.fish + (r.e.pelagic ?? 1)*0.5)); }, build: (G) => ['house', 'up:house', 'shop', 'up:shop', 'harbor', 'offshore', 'whale', 'up:harbor', 'up:offshore', 'resort', 'up:resort', 'research', 'school', 'up:boat', 'cold', 'plant', 'up:plant'], keep: 15 }),
  // the forecast reader who also watches the four-year goal lines: keeps coral and fish with a margin above 55%, pelagic above 40%
  careful: () => ({ policy(G){ return bestBy(G, r => r.v.money*0.3 + r.v.morale + 120*(r.e.coral + r.e.fish + (r.e.pelagic ?? 1)*0.5)
      - 900*(Math.max(0, 0.64 - r.e.coral) + Math.max(0, 0.62 - r.e.fish) + Math.max(0, 0.48 - (r.e.pelagic ?? 1))) - 4*Math.max(0, -r.v.money)); },
    build: (G) => G.eco.coral < 0.6 ? ['nursery', 'house'] : G.V.season < 6 ? ['house', 'shop', 'school', 'cold', 'house'] : ['house', 'up:house', 'shop', 'plant', 'harbor', 'whale', 'house', 'research'] }),
  // keeps morale up at all costs
  pleaser: () => ({ policy(G){ return bestBy(G, r => r.v.morale*3 + Math.min(r.v.money, 50)*0.2); }, build: () => ['house', 'shop'] }),
  // protects the sea at all costs
  greenest: () => ({ policy(G){ return bestBy(G, r => 200*(r.e.coral + r.e.fish) + Math.min(0, r.v.money)*2 + Math.min(0, r.v.morale - 30)); }, build: () => ['nursery', 'plant', 'recycle', 'house'] }),
};
function bestBy(G, score){
  let best = null, bs = -1e18;
  for(const p of ALLPOL){ const v = { ...G.V, pol: { ...G.V.pol }, sea: G.V.sea ? mod.seaView(G.V.sea, 0) : undefined }; let ok = true; for(const k in p){ if(G.V.locks[k] && p[k] !== G.V.pol[k]){ ok = false; break; } v.pol[k] = p[k]; } if(!ok) continue;
    const o = mod.simulateSeason(G.eco, v, 0); const s = score(o); if(s > bs){ bs = s; best = p; } }
  return best;
}
const tally = (arr) => { const t = {}; for(const x of arr) t[x] = (t[x] || 0) + 1; return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v/arr.length*100).toFixed(1)}%`).join(' · '); };
// ---- runs
if(MODE === 'all' || MODE === 'random'){
  const ends = [], monies = []; let rich = 0;
  for(let i=0;i<NGAMES;i++){ const r = playGame(bots.random(), newGame(), `随机#${i} `); ends.push(r.end); monies.push(r.G.V.money); if(r.maxMoney > 1500) rich++; }
  monies.sort((x, y) => x - y);
  console.log(`[随机玩家 ${NGAMES} 局] ${tally(ends)}\n   结束时村库 中位${Math.round(monies[monies.length >> 1])} 90分位${Math.round(monies[(monies.length*0.9)|0])} 最高${Math.round(monies[monies.length - 1])} · 村库曾超过1500的局 ${rich}`);
}
if(MODE === 'all' || MODE === 'bots'){
  for(const name of ['myopicMoney', 'myopicBalanced', 'careful', 'developer', 'pleaser', 'greenest']){
    const ends = []; const sample = [];
    for(let i=0;i<(+process.argv[5] || 40);i++){ const r = playGame(bots[name](), newGame(), `${name}#${i} `); ends.push(r.end); if(i < 1) sample.push(r); }
    const g = sample[0].G; console.log(`[${name}] ${tally(ends)} | 例: 库${Math.round(g.V.money)} 心${g.V.morale} 人${g.V.pop} 珊${g.eco.coral.toFixed(2)} 鱼${g.eco.fish.toFixed(2)} 远洋${(g.eco.pelagic ?? 1).toFixed(2)} 发展${mod.devTier(g.V)} 港${g.V.harbor||0}远${g.V.offshore||0}鲸${g.V.whale||0}`);
  }
}
console.log(bad.length ? `!! 发现 ${bad.length} 处异常，例：\n   ` + [...new Set(bad.map(x => x.replace(/#\d+ 季\d+/, '')))].slice(0, 12).join('\n   ') : '不变量检查：没有异常（无非数值、无越界、人口不超住房）');
export { playGame, newGame, bots, mod, ALLPOL, OPTS, rnd, ending, playSeason, check, bad, bestBy, N };
