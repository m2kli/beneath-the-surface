// tuning harness: trap states x every steady policy, plus whole-game strategy archetypes. REC overrides via argv[3] JSON.
import fs from 'fs';
import { gameSource } from './lib.mjs';
const html = gameSource();
const over = JSON.parse(process.argv[3] || '{}'), quiet = process.argv.includes('-q');
const a = html.indexOf('const REC = {'), b = html.indexOf('function seasonStep(){');
let src = html.slice(a, b);
src = src.replace(/const REC = (\{[^\n]*\});/, (m, o) => `const REC = Object.assign(${o}, ${JSON.stringify(over)});`);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x)), lerp = (x, y, t) => x + (y - x)*t;
const mod = new Function('clamp', 'lerp', src + '; return { simulateSeason, devTier, devScore: typeof devScore === "function" ? devScore : null, BUILD, KEY, maxOf: typeof maxOf === "function" ? maxOf : null, upCost: typeof upCost === "function" ? upCost : null, LVMAX: typeof LVMAX === "object" ? LVMAX : null };')(clamp, lerp);
const COST = {}, MAX = {}; for(const x of mod.BUILD){ COST[x.k] = x.cost; MAX[x.k] = x.max; }
const KEY = mod.KEY;
const end = (e, v, fail) => { const oceanOK = e.fish > 0.55 && e.coral > 0.55 && (e.pelagic === undefined || e.pelagic > 0.4), grew = mod.devTier(v) >= 1 && v.pop >= 20, villageOK = v.morale >= 50 && v.money >= 0 && grew;
  return fail || (oceanOK ? (villageOK ? '好结局' : !grew && v.morale >= 50 ? '原地踏步' : '海好村差') : e.fish > 0.33 ? (villageOK ? '中·村好海差' : '中') : '坏结局'); };
function sim(e, v, polF, wishF, keep, N = 16){
  e = { ...e }; v = { ...v, pol: { ...v.pol }, locks: {}, mods: {} }; let fail = '', minM = 1e9, qi = 0;
  for(let s=v.season;s<N;s++){
    Object.assign(v.pol, typeof polF === 'function' ? polF(s, v, e) : polF);
    const tryOne = (k) => {   // 1 built, 0 cannot afford yet, -1 impossible
      if(k.startsWith('up:')){ const kk = k.slice(3), cnt = v[KEY[kk]] || 0; if(!mod.upCost || !cnt) return -1; v.lv = { ...(v.lv || {}) }; const arr = v.lv[kk] = [...(v.lv[kk] || [])];
        for(let i=0;i<cnt;i++){ const lv = arr[i] || 1; if(lv < mod.LVMAX[kk]){ const c = mod.upCost(kk, lv); if(v.money - c >= keep){ v.money -= c; arr[i] = lv + 1; return 1; } return 0; } } return -1; }
      if(MAX[k] === undefined) return -1; const mx = mod.maxOf ? mod.maxOf(v, k) : MAX[k]; if((v[KEY[k]] || 0) >= mx) return -1;
      if(v.money - COST[k] >= keep){ v.money -= COST[k]; v[KEY[k]] = (v[KEY[k]] || 0) + 1; return 1; } return 0; };
    if(wishF && wishF.queue){ while(qi < wishF.queue.length){ const r = tryOne(wishF.queue[qi]); if(r === 0) break; qi++; } }
    else for(const k of (typeof wishF === 'function' ? wishF(s, v, e) : wishF)) tryOne(k);
    const o = mod.simulateSeason(e, v, 0); e = o.e; v = o.v; v.prevPol = { ...v.pol }; v.season++; minM = Math.min(minM, v.money);
    if(v.morale <= 5){ fail = '民心崩溃'; break; } if(v.money < -100){ fail = '破产'; break; } if(v.pop <= 6){ fail = '人走光'; break; }
  }
  return { e, v, fail, minM, end: end(e, v, fail) };
}
const base = { coral: 1, fish: 1, bait: 1, clar: 1, ghost: 0, nutr: 0 };
const vbase = { season: 0, money: 150, food: 6, houses: 4, pop: 14, morale: 60, rep: 0.3, boats: 2, trawlers: 0, shops: 0, resort: 0, plant: 0, recycle: 0, cold: 0, nursery: 0, school: 0,
  pol: { fish: 'quota', tour: 'closed', zone: 'none', waste: 'dump', work: 'normal', tax: 'mid' }, prevPol: null, mpaSeasons: 0 };
const TRAPS = {
  A_s6_reef35_cash20: [{ ...base, coral: 0.35, fish: 0.30, bait: 0.3, clar: 0.7, ghost: 0.1, nutr: 0.15 }, { ...vbase, season: 6, money: 20, food: 2, houses: 6, pop: 22, morale: 48, rep: 0.2, boats: 4, trawlers: 1, shops: 2, prevPol: { fish: 'industrial' } }],
  B_s6_reef45_cash40: [{ ...base, coral: 0.45, fish: 0.40, bait: 0.4, clar: 0.75, nutr: 0.1 }, { ...vbase, season: 6, money: 40, food: 2, houses: 6, pop: 22, morale: 50, rep: 0.25, boats: 4, trawlers: 1, shops: 2 }],
  C_s9_reef30_broke: [{ ...base, coral: 0.30, fish: 0.25, bait: 0.25, clar: 0.6, ghost: 0.2, nutr: 0.2 }, { ...vbase, season: 9, money: 0, food: 1, houses: 7, pop: 24, morale: 40, rep: 0.1, boats: 5, trawlers: 2, shops: 2, resort: 1 }],
  D_s4_reef50_cash60: [{ ...base, coral: 0.50, fish: 0.45, bait: 0.45, clar: 0.8, nutr: 0.08 }, { ...vbase, season: 4, money: 60, food: 3, houses: 5, pop: 19, morale: 52, rep: 0.3, boats: 3, trawlers: 1, shops: 1 }],
};
const O = { fish: ['industrial', 'quota', 'line', 'ban'], tour: ['open', 'limited', 'closed'], zone: ['none', 'core', 'wide'], waste: ['dump', 'basic', 'full'], work: ['normal', 'festival', 'overtime'], tax: ['low', 'mid', 'high'] };
const BUILDS = { none: [], nursery: ['nursery'], houses: ['house', 'house', 'nursery', 'house'], shops: ['shop', 'nursery', 'house'] };
const INTUITIVE = {
  '配额+限流+核心区+苗圃': [{ fish: 'quota', tour: 'limited', zone: 'core', waste: 'basic', work: 'normal', tax: 'mid' }, 'nursery'],
  '休渔+限流+大保护+全处理': [{ fish: 'ban', tour: 'limited', zone: 'wide', waste: 'full', work: 'normal', tax: 'mid' }, 'nursery'],
  '钓线+关旅游+大保护': [{ fish: 'line', tour: 'closed', zone: 'wide', waste: 'full', work: 'normal', tax: 'low' }, 'nursery'],
  '配额+限流+大保护': [{ fish: 'quota', tour: 'limited', zone: 'wide', waste: 'basic', work: 'normal', tax: 'mid' }, 'none'],
  '配额+开放+核心区': [{ fish: 'quota', tour: 'open', zone: 'core', waste: 'basic', work: 'normal', tax: 'mid' }, 'none'],
  '继续贪婪': [{ fish: 'industrial', tour: 'open', zone: 'none', waste: 'dump', work: 'overtime', tax: 'high' }, 'none'],
  '贪婪+挂保护区': [{ fish: 'industrial', tour: 'open', zone: 'wide', waste: 'dump', work: 'normal', tax: 'mid' }, 'none'] };
const summary = {};
for(const [name, [e0, v0]] of Object.entries(TRAPS)){
  let both = 0, tot = 0, failed = 0; const goods = new Set();
  for(const fish of O.fish) for(const tour of O.tour) for(const zone of O.zone) for(const waste of O.waste) for(const work of O.work) for(const tax of O.tax) for(const bk in BUILDS){
    const r = sim(e0, v0, { fish, tour, zone, waste, work, tax }, BUILDS[bk], 15); tot++;
    if(r.fail) failed++; if(r.end === '好结局'){ both++; goods.add(`${fish}/${tour}/${zone}/${waste}/${work}/${tax}`); } }
  const fishT = new Set([...goods].map(x => x.split('/')[0])), tourT = new Set([...goods].map(x => x.split('/')[1])), zoneT = new Set([...goods].map(x => x.split('/')[2]));
  summary[name] = `${both}/${tot} 政策${goods.size} 失败${Math.round(failed/tot*100)}% 渔[${[...fishT]}] 游[${[...tourT]}] 区[${[...zoneT]}]`;
  if(!quiet){ console.log(`\n${name}: 好结局 ${summary[name]}`);
    for(const [iname, [pol, bk]] of Object.entries(INTUITIVE)){ const r = sim(e0, v0, pol, BUILDS[bk], 15);
      console.log(`   ${iname.padEnd(16)} ${r.end.padEnd(7)} 珊${r.e.coral.toFixed(2)} 鱼${r.e.fish.toFixed(2)} 库${String(Math.round(r.v.money)).padStart(4)} 心${r.v.morale} 人${r.v.pop}`); } }
}
const order = list => () => list, queue = list => ({ queue: list });
const ALL = ['house', 'shop', 'boat', 'cold', 'school', 'house', 'shop', 'plant', 'recycle', 'nursery', 'house', 'shop', 'boat', 'house', 'resort', 'house', 'house', 'house', 'boat', 'house', 'house', 'house'];
const BAL = { fish: 'quota', tour: 'limited', zone: 'core', waste: 'basic', work: 'normal', tax: 'mid' };
const GREED = { fish: 'industrial', tour: 'open', zone: 'none', waste: 'dump', work: 'overtime', tax: 'high' };
const GB = order(['trawler', 'shop', 'boat', 'house', 'resort', 'trawler', 'shop', 'boat', 'house', 'house', 'boat', 'house']);
const ARCH = [
  ['均衡·稳步建设', BAL, order(ALL), 40], ['均衡·不建设', BAL, [], 40],
  ['贪婪拉满·狂建', GREED, order(['trawler', 'shop', 'boat', 'house', 'resort', 'trawler', 'shop', 'boat', 'house', 'trawler', 'boat', 'house', 'house', 'boat', 'house']), 0],
  ['贪婪·中税正常工时', { ...GREED, work: 'normal', tax: 'mid' }, GB, 40],
  ['贪婪+挂保护区', { ...GREED, zone: 'wide', work: 'normal', tax: 'mid' }, GB, 40],
  ['纯渔业·配额', { fish: 'quota', tour: 'closed', zone: 'none', waste: 'basic', work: 'normal', tax: 'mid' }, order(['boat', 'house', 'boat', 'cold', 'boat', 'house', 'boat', 'school', 'house', 'boat', 'house', 'recycle', 'house', 'boat']), 40],
  ['纯渔业·大规模', { fish: 'industrial', tour: 'closed', zone: 'none', waste: 'basic', work: 'normal', tax: 'mid' }, order(['trawler', 'boat', 'house', 'trawler', 'boat', 'cold', 'house', 'trawler', 'boat', 'house', 'house']), 40],
  ['纯旅游·全面开放', { fish: 'line', tour: 'open', zone: 'core', waste: 'basic', work: 'normal', tax: 'mid' }, order(['shop', 'house', 'shop', 'house', 'shop', 'resort', 'house', 'plant', 'house', 'house', 'house']), 40],
  ['纯旅游·限流', { fish: 'line', tour: 'limited', zone: 'wide', waste: 'full', work: 'normal', tax: 'mid' }, order(['shop', 'house', 'shop', 'school', 'house', 'shop', 'nursery', 'house', 'plant', 'house', 'resort', 'house']), 40],
  ['度假村·直排', { fish: 'quota', tour: 'open', zone: 'none', waste: 'dump', work: 'normal', tax: 'mid' }, order(['shop', 'resort', 'house', 'shop', 'house', 'shop', 'house', 'house']), 40],
  ['全程休渔', { fish: 'ban', tour: 'limited', zone: 'wide', waste: 'full', work: 'normal', tax: 'mid' }, order(['shop', 'house', 'shop', 'school', 'nursery', 'house', 'shop', 'house']), 40],
  ['高税敛财', { ...BAL, tax: 'high' }, order(ALL), 40], ['低税讨好', { ...BAL, tax: 'low' }, order(ALL), 40],
  ['永远加班', { ...BAL, work: 'overtime' }, order(ALL), 40], ['永远节庆', { ...BAL, work: 'festival' }, order(ALL), 40],
  ['春季休渔轮换', s => ({ ...BAL, fish: s % 4 === 0 ? 'ban' : 'quota' }), order(ALL), 40],
  ['先贪后转型6', s => s < 6 ? GREED : { ...BAL, zone: 'wide', waste: 'full' }, order(['trawler', 'shop', 'boat', 'house', 'shop', 'nursery', 'plant', 'house', 'house', 'school', 'house', 'house']), 40],
  ['先贪后转型9', s => s < 9 ? { ...GREED, work: 'normal', tax: 'mid' } : { fish: 'line', tour: 'limited', zone: 'wide', waste: 'basic', work: 'normal', tax: 'low' }, order(['trawler', 'shop', 'boat', 'house', 'shop', 'nursery', 'house', 'house', 'house']), 40],
  ['先贪后转型12', s => s < 12 ? { ...GREED, work: 'normal', tax: 'mid' } : { fish: 'line', tour: 'limited', zone: 'wide', waste: 'full', work: 'normal', tax: 'low' }, order(['trawler', 'shop', 'boat', 'house', 'shop', 'nursery', 'house', 'house', 'house']), 40],
  ['海洋至上', { fish: 'line', tour: 'closed', zone: 'wide', waste: 'full', work: 'normal', tax: 'low' }, order(['nursery', 'recycle', 'plant', 'house']), 40],
  ['躺平', {}, [], 40],
  ['均衡+全面升级', BAL, queue(['house', 'shop', 'boat', 'cold', 'school', 'up:house', 'house', 'shop', 'up:shop', 'plant', 'nursery', 'up:boat', 'house', 'harbor', 'whale', 'up:house', 'research', 'house', 'up:school', 'shop', 'up:house', 'house', 'up:harbor', 'whale', 'up:house', 'house', 'up:shop', 'house', 'up:house', 'house', 'up:house']), 40],
  ['远洋渔业·配额', BAL, queue(['house', 'shop', 'harbor', 'offshore', 'house', 'offshore', 'cold', 'up:harbor', 'offshore', 'house', 'offshore', 'up:offshore', 'house', 'house']), 20],
  ['远洋滥捕', { fish: 'industrial', tour: 'limited', zone: 'core', waste: 'basic', work: 'normal', tax: 'mid' }, queue(['house', 'shop', 'harbor', 'offshore', 'offshore', 'up:harbor', 'offshore', 'offshore', 'house', 'up:harbor', 'offshore', 'offshore', 'up:offshore', 'up:offshore', 'house', 'house']), 20],
  ['观鲸+保护', { fish: 'line', tour: 'limited', zone: 'wide', waste: 'full', work: 'normal', tax: 'mid' }, queue(['shop', 'house', 'harbor', 'whale', 'house', 'up:harbor', 'whale', 'research', 'house', 'up:whale', 'house', 'up:harbor', 'whale', 'house', 'up:house', 'house']), 40],
  ['全力发展(均衡)', BAL, queue(['house', 'shop', 'house', 'shop', 'cold', 'school', 'house', 'up:shop', 'house', 'harbor', 'whale', 'house', 'up:house', 'up:house', 'research', 'shop', 'house', 'up:harbor', 'whale', 'up:shop', 'house', 'up:house', 'resort', 'house', 'up:house', 'shop', 'up:school', 'house', 'up:house', 'house', 'up:whale', 'up:house', 'house', 'up:house', 'house', 'up:house', 'house', 'up:house']), 10],
  ['贪婪+全面升级', { ...GREED, work: 'normal', tax: 'mid' }, queue(['trawler', 'shop', 'boat', 'house', 'resort', 'up:boat', 'up:shop', 'trawler', 'resort', 'up:resort', 'harbor', 'offshore', 'offshore', 'up:house', 'house', 'house']), 20] ];
const archOut = {};
if(!quiet) console.log('');
for(const [n, p, w, k] of ARCH){ const r = sim(base, vbase, p, w, k); archOut[n] = r.end;
  if(!quiet) console.log(`${n.padEnd(14)} ${r.end.padEnd(7)} 季${r.v.season} 库${String(Math.round(r.v.money)).padStart(5)}(低${Math.round(r.minM)}) 心${r.v.morale} 人${r.v.pop} 鱼${r.e.fish.toFixed(2)} 珊${r.e.coral.toFixed(2)} 远洋${(r.e.pelagic ?? 1).toFixed(2)} 发展${mod.devTier(r.v)}(${mod.devScore ? mod.devScore(r.v).toFixed(0) : ''}) 港${r.v.harbor||0}远${r.v.offshore||0}鲸${r.v.whale||0}研${r.v.research||0}房${r.v.houses} 升${JSON.stringify(r.v.lv||{}).length}`); }
if(quiet) console.log(JSON.stringify(over), '\n  ', Object.values(summary).join('\n   '), '\n  ', Object.entries(archOut).map(([k, v]) => k + ':' + v).join(' '));
