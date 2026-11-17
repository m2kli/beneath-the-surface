'use strict';
// The season model: one season of the village and the sea as a pure function of (ecosystem, village, haul).
// No DOM, no three.js: the game, the forecast panel and the balance tools in tools/ all run this same file.
const REC = { top: 0.62, floor: 0.3, core: 0.7, nurs: 0.35, dumpK: 0.4, jobs: 0.35, jobsN: 0.15, grant: 60, wageShare: 0.65, mor: 4, nurseryCost: 55, nurseryUp: 2, food: 7, fishTop: 0.45, fishK: 0.7, trampleL: 0.0025 };
// the open sea beyond the reef wall, fished by the harbour's offshore boats and watched from its whale boats
const OFF = { catchK: 2.4, deplete: 0.011, regrow: 0.15, whaleV: 9, whaleP: 6, okLine: 0.4, resInc: 3 };
const BUILD = [
  { k: 'boat', name: '渔船', cost: 35, max: 10, desc: '多一条船出海。需要 2 名船员，每季成本 1–3（看捕捞政策）。' },
  { k: 'trawler', name: '拖网船', cost: 90, max: 3, desc: '只在大规模捕捞时下网，渔获约等于 3 条渔船，但会刮伤礁区。需要 3 名船员。' },
  { k: 'house', name: '民居', cost: 35, max: 20, desc: '住房上限 +4（升级后 6、8）。民心高于 55 时每季长 2 人。' },
  { k: 'shop', name: '潜水店', cost: 60, max: 5, desc: '接待潜水客。需要 2–3 名向导。' },
  { k: 'resort', name: '度假村', cost: 160, max: 2, desc: '大批游客，需要 5–8 名员工，污水量很大。' },
  { k: 'cold', name: '冷库', cost: 50, max: 1, desc: '留一整季口粮过季，存鱼损耗 35% → 5%，鱼价 +10%。' },
  { k: 'plant', name: '污水处理厂', cost: 70, max: 1, desc: '污水处理费 −50%（升级后 −60%、−70%）。' },
  { k: 'recycle', name: '渔网回收站', cost: 40, max: 1, desc: '遗落渔网 −85%（升级后 −94%）。' },
  { k: 'nursery', name: '珊瑚苗圃', cost: REC.nurseryCost, max: 1, desc: '珊瑚恢复速度 +90%，保护资助增加。需要 2 人。' },
  { k: 'school', name: '渔民学校', cost: 60, max: 1, desc: '配额捕捞渔获 +12%，限流观光票价 +15%（升级后更多）。' },
  { k: 'harbor', name: '渔港', cost: 120, max: 1, desc: '深水码头。能停靠远洋渔船和观鲸船，升级后停得更多。需要 2 人。' },
  { k: 'offshore', name: '远洋渔船', cost: 80, max: 6, need: 'harbor', desc: '去礁墙外的远洋捕鱼，不伤礁区，但远洋鱼群也会被捞空。需要 3 名船员。' },
  { k: 'whale', name: '观鲸船', cost: 70, max: 3, need: 'harbor', desc: '带游客出海看鲸和远洋鱼群。游客不碰礁区，远洋越健康越赚钱。需要 2 人。' },
  { k: 'research', name: '海洋研究站', cost: 100, max: 1, desc: '科研经费、声誉，礁区受损时能申请到更多保护资助。需要 2 人。' },
];
const KEY = { boat: 'boats', trawler: 'trawlers', house: 'houses', shop: 'shops', resort: 'resort', cold: 'cold', plant: 'plant', recycle: 'recycle', nursery: 'nursery', school: 'school',
  harbor: 'harbor', offshore: 'offshore', whale: 'whale', research: 'research' };
// every building can be upgraded; what each level does
const LVMAX = { house: 3, boat: 3, trawler: 2, shop: 3, resort: 3, cold: 2, plant: 3, recycle: 2, nursery: 3, school: 3, harbor: 3, offshore: 2, whale: 2, research: 3 };
const LV_TXT = {
  house: ['高脚木屋，住 4 人', '瓦顶小楼，住 6 人，住得更舒服', '现代民宿，住 8 人，民心更好'],
  boat: ['小木船', '机动渔船：渔获 +30%', '冷藏渔船：渔获 +60%'],
  trawler: ['底拖网：刮伤礁区', '中层拖网：几乎不再刮礁'],
  shop: ['小潜水店', '潜水中心：接待 +40%，潜水员受过培训，踩踏 −35%', '潜水学院：接待 +80%，踩踏 −55%，需要更多向导'],
  resort: ['度假村', '扩建：游客 +60%，污水 +25%', '生态度假村：游客 +120%，污水只多 30%'],
  cold: ['冷库', '冷链中心：几乎不坏，卖价更高'],
  plant: ['污水处理厂：处理费减半', '二级处理：费用再降，排放 −20%', '三级处理：费用最低，排放 −35%'],
  recycle: ['渔网回收站', '回收再生厂：遗落渔网再少一半'],
  nursery: ['珊瑚苗圃', '苗圃扩建：恢复 +50%', '珊瑚基因库：恢复 +100%'],
  school: ['渔民学校', '海洋学院：配额和限流更有效', '海洋大学：效果更好'],
  harbor: ['渔港：可停 2 条远洋渔船、1 条观鲸船', '深水港：4 条远洋、2 条观鲸', '远洋港：6 条远洋、3 条观鲸'],
  offshore: ['远洋渔船', '现代远洋船：渔获 +50%'],
  whale: ['观鲸船', '观鲸游艇：游客 +60%'],
  research: ['研究站', '研究所：经费和资助更多', '海洋研究中心：经费和资助最多'] };
const lvOf = (v, k, i) => (v.lv && v.lv[k] && v.lv[k][i]) || 1;
function W(v, k, tab){ let s = 0; const n = v[KEY[k]] || 0; for(let i=0;i<n;i++) s += tab[Math.min(tab.length, lvOf(v, k, i)) - 1]; return s; }
const avgLv = (v, k) => (v[KEY[k]] || 0) ? W(v, k, [1, 2, 3])/(v[KEY[k]] || 0) : 0;
const upCost = (k, lv) => Math.round(BUILD.find(b => b.k === k).cost*[0.9, 1.6][lv - 1]);
function maxOf(v, k){ const b = BUILD.find(x => x.k === k), hl = (v.harbor || 0) ? lvOf(v, 'harbor', 0) : 0;
  if(k === 'offshore') return [0, 2, 4, 6][hl]; if(k === 'whale') return [0, 1, 2, 3][hl]; return b.max; }
const seasonName = s => `第 ${Math.floor(s/4) + 1} 年 · ${['春', '夏', '秋', '冬'][s % 4]}`;
const SEASON_FX = [
  { spawn: 1.6, tour: 0.9, catchK: 1.0, price: 1.0, note: '产卵季：鱼群繁殖 ×1.6。这一季捕鱼，繁殖最多 −40%。' },
  { spawn: 1.0, tour: 1.5, catchK: 1.0, price: 1.0, note: '旅游旺季：游客 ×1.5。可能遇到热浪白化。' },
  { spawn: 0.8, tour: 0.9, catchK: 1.25, price: 0.9, note: '渔获 ×1.25，鱼价 ×0.9。' },
  { spawn: 0.5, tour: 0.45, catchK: 0.8, price: 1.2, note: '游客 ×0.45，渔获 ×0.8，鱼价 ×1.2。' },
];
const TAX = { low: 0.12, mid: 0.22, high: 0.32 };
// how developed the village is: buildings (and how far they have been upgraded) and people, not money
function devScore(v){ const w = (k, base) => W(v, k, [1, 1.5, 2])*base;
  return w('house', 1.2) + w('boat', 0.6) + w('trawler', 1.2) + w('shop', 2.2) + w('resort', 6) + w('cold', 1.8) + w('plant', 1.8) + w('recycle', 1.8) + w('nursery', 1.8) + w('school', 1.8)
    + w('harbor', 4) + w('offshore', 1.5) + w('whale', 2) + w('research', 4) + v.pop*0.25; }
const TIERS = [
  { n: '小渔村', at: 0, d: '几间高脚木屋、土路和火把。' },
  { n: '渔镇', at: 15, d: '木屋换成了瓦顶小楼，土路铺上了石板，码头边有了集市和灯塔。游客 +10%。' },
  { n: '海滨小城', at: 30, d: '现代民宿、柏油路、混凝土码头和沙滩伞。游客 +20%。' },
  { n: '港湾城', at: 50, d: '山坡上建起了新城区，铺了市政污水管网。游客 +30%，村子长人更快，居民污水 −25%。' },
  { n: '海洋之城', at: 75, d: '一座靠海、也守着海的城：观景塔、海洋馆和林荫大道。游客 +40%，居民污水 −40%。' } ];
function devTier(v){ const sc = devScore(v); let t = 0; for(let i=1;i<TIERS.length;i++) if(sc >= TIERS[i].at) t = i; return t; }
const FISH_RANK = { industrial: 3, quota: 2, line: 1, ban: 0 };
// ---- what lies under the surface this season: the village cannot see it until someone dives and looks
// t: the season's luck (water temperature, how many fry, the pelagic run); cots: crown-of-thorns starfish on the reef; trash: rubbish off the outfall; ev: trouble only a diver would notice
const SEA = { t: { coral: [-0.015, 0.02], fish: [-0.025, 0.03], pel: [-0.025, 0.025] }, cotsK: 0.0025, trashK: 0.002, evP: 0.2, sample: 2.5 };
const SEA_EV = {
  blast: { n: '炸鱼', coral: 0.02, fish: 0.02, fix: 20, gain: 0 },
  lion: { n: '狮子鱼入侵', coral: 0, fish: 0.03, fix: 10, gain: 16 },
  disease: { n: '珊瑚病', coral: 0.025, fish: 0, fix: 15, gain: 0 } };
const SEA_KEYS = ['coral', 'fish', 'pel'];
function rollSea(e, v, season, rnd){
  const t = {}; for(const k of SEA_KEYS){ const [a, b] = SEA.t[k]; t[k] = Math.round((a + (b - a)*rnd())*1000)/1000; }
  const cots = Math.min(5, Math.floor(clamp(((e.nutr || 0) - 0.08)/0.07, 0, 3.5) + rnd()*1.5));           // sewage feeds their larvae: more nutrients, more starfish
  const tourK = { open: 1, limited: 0.45, closed: 0.15 }[v.pol.tour];
  const trash = Math.min(4, Math.floor(((v.shops || 0) + 2*(v.resort || 0) + (v.pop || 0)/12)*0.35*tourK*(v.pol.waste === 'dump' ? 1.4 : 1) + rnd()*1.5));
  let ev = null;
  if(season >= 1 && rnd() < SEA.evP){ const pool = ['blast', 'lion'].concat(e.coral < 0.8 || (e.nutr || 0) > 0.12 ? ['disease'] : []); ev = pool[Math.floor(rnd()*pool.length)]; }
  return { season, t, cots, trash, ev, seed: Math.floor(rnd()*1e6), seen: {}, gone: { cots: [], trash: [] }, dived: false, evFound: false, evHint: false, evFix: false, evDone: false };
}
// how the hidden sea lands at the end of the season: the season's luck, whatever nobody cleared, the trouble nobody dealt with
function seaEffect(S){
  const cl = Math.max(0, S.cots - S.gone.cots.length), tl = Math.max(0, S.trash - S.gone.trash.length), E = S.ev && !S.evFix ? SEA_EV[S.ev] : null;
  return { cl, tl, E, dC: S.t.coral - SEA.cotsK*cl - (E ? E.coral : 0), dF: S.t.fish - SEA.trashK*tl - (E ? E.fish : 0), dP: S.t.pel, samples: SEA_KEYS.filter(k => S.seen[k]).length };
}
// what the village knows of it: surveyed numbers are exact; the rest is a guess (b = -1 the bad end, +1 the good end, 0 the middle); nothing it has not seen
function seaView(S, b){
  if(!S) return S;
  const t = {}; for(const k of SEA_KEYS){ const [lo, hi] = SEA.t[k]; t[k] = S.seen[k] ? S.t[k] : b < 0 ? lo : b > 0 ? hi : (lo + hi)/2; }
  return { ...S, t, cots: S.dived ? S.cots : 0, trash: S.dived ? S.trash : 0, ev: S.evFound ? S.ev : null };
}
let pendingHaul = 0, vTab = 'pol';
// One season of the village and the sea, as a pure function: used both to run the season and to preview it.
function simulateSeason(e0, v0, haul){
  const e = { ...e0 }, v = { ...v0, pol: { ...v0.pol } }, P = v.pol, sf = SEASON_FX[v.season % 4], M = v.mods || {};
  if(e.pelagic === undefined) e.pelagic = 1;
  const r = { morale: [], pub: [] }, n = k => v[KEY[k]] || 0, tier = devTier(v), Wl = (k, t) => W(v, k, t);
  // hands
  const workK = { overtime: 1.25, normal: 1, festival: 0.8 }[P.work];
  const labor = v.pop*0.62*workK*(v.morale < 30 ? 0.8 : 1);
  const qK = P.fish === 'quota' ? clamp((e.fish - 0.42)/0.33, 0, 1) : 1;      // a quota that has closed keeps the boats in harbour
  const pelQ = P.fish === 'quota' ? clamp((e.pelagic - OFF.okLine)/0.3, 0, 1) : 1;
  const offOn = { industrial: 1, quota: pelQ, line: 0.5, ban: 0 }[P.fish];     // the offshore fleet follows the same fishing policy
  const boatW = Wl('boat', [1, 1.3, 1.6]), offW = Wl('offshore', [1, 1.5]);
  const shopW = Wl('shop', [1, 1.4, 1.8]), resW = Wl('resort', [1, 1.6, 2.2]), whaleW = Wl('whale', [1, 1.6]);
  const needFish = { industrial: n('boat')*2 + n('trawler')*3, quota: (n('boat')*2 + n('trawler')*2)*Math.max(qK, 0.15), line: n('boat')*1.5, ban: 0 }[P.fish] + n('offshore')*3*(offOn > 0 ? Math.max(offOn, 0.3) : 0);
  const needTour = { open: n('shop')*3 + (shopW - n('shop'))*1.5 + resW*8, limited: n('shop')*2 + (shopW - n('shop'))*1 + resW*5, closed: 0 }[P.tour] + (P.tour === 'closed' ? 0 : n('whale')*2);
  const degraded = Math.max(clamp((REC.top - e0.coral)/(REC.top - REC.floor), 0, 1), clamp((REC.fishTop - e0.fish)/0.25, 0, 1)*REC.fishK);   // a fished-out bay counts too
  const nursW = Wl('nursery', [1, 1.5, 2]), resLv = Wl('research', [1, 2, 3]);
  const protect = ({ none: 0, core: REC.core, wide: 1 }[P.zone] + REC.nurs*nursW)*(P.fish === 'industrial' ? 0 : 1)*(P.waste === 'dump' ? REC.dumpK : 1);
  const needBld = n('nursery')*2 + n('plant') + n('recycle') + n('cold') + n('school') + n('harbor')*2 + n('research')*2;
  const need0 = needFish + needTour + needBld, staff = need0 > 0 ? Math.min(1, labor/need0) : 1;
  // restoration takes only hands that would otherwise be idle, so it never starves the boats or the shops
  const restoreNeed = protect > 0 ? Math.min(Math.max(0, labor - need0), degraded*labor*(REC.jobs + REC.jobsN*n('nursery'))) : 0;
  const need = need0 + restoreNeed;
  // fishing on the reef
  const access = { none: 1, core: 0.62, wide: 0.3 }[P.zone];
  const spill = P.zone === 'none' ? 0 : Math.min(1, v.mpaSeasons/4)*Math.max(0, e.fish - 0.5)*(P.zone === 'wide' ? 1.3 : 0.9);
  const effort = { industrial: boatW + n('trawler')*3, quota: boatW + n('trawler')*1.0, line: boatW*0.55, ban: 0 }[P.fish]*staff;
  const schoolLv = n('school') ? lvOf(v, 'school', 0) : 0;
  let reefCatch = effort*e.fish*(access + spill)*sf.catchK*3.0*(M.storm ? 0.7 : 1);
  if(P.fish === 'quota') reefCatch *= qK*[1, 1.12, 1.2, 1.28][schoolLv];
  const reefDmg = P.fish === 'industrial' ? Wl('trawler', [0.035, 0.012])*staff*{ none: 1, core: 0.35, wide: 0.1 }[P.zone] : 0;
  const bycatch = { industrial: 0.3, quota: 0.08, line: 0.03, ban: 0 }[P.fish];
  const recLv = n('recycle') ? lvOf(v, 'recycle', 0) : 0;
  const lost = effort*{ industrial: 0.03, quota: 0.016, line: 0.01, ban: 0 }[P.fish]*(recLv === 2 ? 0.06 : recLv || P.waste === 'full' ? 0.15 : 1);
  const spawnHit = v.season % 4 === 0 && P.fish !== 'ban' ? 1 - 0.4*Math.min(1, effort/5) : 1;
  // fishing the open sea
  const offCatch = offW*e.pelagic*OFF.catchK*offOn*staff*sf.catchK*(M.storm ? 0.5 : 1);
  const catchT = reefCatch + offCatch;
  // tourism: divers on the reef, whale-watchers out at sea
  const attract = e.coral*e.clar*(0.35 + 0.65*e.fish);
  const tierK = 1 + 0.1*tier;
  const baseV = { open: shopW*14 + resW*30, limited: shopW*8 + resW*12, closed: 0 }[P.tour];
  const visitors = baseV*sf.tour*staff*(0.5 + v.rep)*(M.bloom ? 0.5 : 1)*(P.zone === 'wide' ? 0.9 : 1)*tierK;
  const whaleVis = P.tour === 'closed' ? 0 : whaleW*OFF.whaleV*e.pelagic*sf.tour*staff*(0.5 + v.rep)*tierK;
  const price = P.tour === 'limited' ? 7*Math.pow(attract, 1.3)*[1, 1.15, 1.25, 1.35][schoolLv] : 3*(0.3 + attract);   // open: volume at a low price that holds up even on a damaged reef; limited: a premium that only a beautiful reef earns
  const whalePrice = OFF.whaleP*(0.4 + 0.6*e.pelagic);
  const tourInc = visitors*price + whaleVis*whalePrice;
  const diverK = n('shop') ? Wl('shop', [1, 0.65, 0.45])/n('shop') : 1;          // trained divers at the bigger dive centres break less coral
  const trample = { open: 0.016, limited: REC.trampleL, closed: 0 }[P.tour]*visitors/10*diverK;
  const allVis = visitors + whaleVis;
  const litter = allVis*(P.tour === 'open' ? 0.0016 : 0.0004);
  // waste
  const plantLv = n('plant') ? lvOf(v, 'plant', 0) : 0;
  const sewerK = [1, 1, 1, 0.75, 0.6][tier];                    // a bigger town lays proper sewers
  const nutr = (Wl('resort', [0.4, 0.5, 0.52]) + v.pop*0.004*sewerK + litter)*{ dump: 1, basic: 0.4, full: 0.1 }[P.waste]*[1, 1, 0.8, 0.65][plantLv];
  const wasteCost = { dump: 0, basic: 3 + v.pop*0.08, full: 7 + v.pop*0.15 }[P.waste]*[1, 0.5, 0.4, 0.3][plantLv];
  // food store and the fish market
  const coldLv = n('cold') ? lvOf(v, 'cold', 0) : 0;
  const foodNeed = v.pop*0.12;
  let stock = v.food + catchT;
  const eat = Math.min(stock, foodNeed); stock -= eat;
  const shortage = foodNeed - eat;
  const reserve = coldLv ? foodNeed : foodNeed*0.3;
  const sold = Math.max(0, stock - reserve); stock -= sold;
  const spoiled = stock*[0.35, 0.05, 0.03][coldLv]; stock -= spoiled;
  const fishPrice = 13*(M.priceK || 1)*sf.price*[1, 1.1, 1.18][coldLv];
  const fishInc = sold*fishPrice + (haul || 0);
  // households earn; the treasury lives on tax
  // running costs follow use: boats tied up in a ban or on hand-lines cost little, quiet shops cost less than busy ones
  const useT = baseV > 0 ? clamp(visitors/(baseV*0.6), 0.35, 1) : 0;
  const privCost = Wl('boat', [1, 1.2, 1.4])*{ industrial: 3, quota: 1 + 2*qK, line: 2, ban: 1 }[P.fish] + n('trawler')*{ industrial: 12, quota: 2 + 4*qK, line: 2, ban: 2 }[P.fish]
    + offW*{ industrial: 6, quota: 1.5 + 4.5*pelQ, line: 3, ban: 1.5 }[P.fish]
    + (P.tour === 'closed' ? n('shop')*1.5 + n('resort')*5 + n('whale')*1 : (shopW*4 + resW*12)*useT + (n('shop')*1.5 + n('resort')*5)*(1 - useT) + whaleW*3);
  const gross = fishInc + tourInc;
  const tax = gross*TAX[P.tax];                                 // the treasury takes its share of every sale
  const fee = allVis*(P.tour === 'limited' ? 1.6 : 1.0);        // and an entry fee from every visitor
  const grant = REC.grant*degraded*protect*Math.min(1, staff + 0.2)*(1 + 0.25*resLv);   // conservation funding while the reef recovers
  const wages = grant*REC.wageShare;                            // most of it pays the villagers doing the work
  const resInc = resLv*OFF.resInc*(e0.coral > 0.6 ? 1 : 0.5) + (v0.sea && resLv ? SEA.sample*SEA_KEYS.filter(k => v0.sea.seen[k]).length : 0);   // research money, more with a diver's samples
  const earn = gross - tax - privCost + wages;                  // what households keep
  const perCap = (Math.max(0, earn) + eat*fishPrice*0.8)/Math.max(1, v.pop);   // what a household lives on, fish on the table included
  const pub = r.pub, add = (label, x) => { if(x > 0.05) pub.push([label, x]); };
  add('污水与垃圾处理', wasteCost);
  const up = (k, base) => Wl(k, [1, 1.5, 2])*base;
  add('公共建筑维护', up('plant', 3) + up('recycle', 2) + up('cold', 2) + up('nursery', REC.nurseryUp) + up('school', 3) + up('harbor', 3) + up('research', 3));
  if(P.work === 'festival') add('节庆开支', 8);
  add('进口粮食', shortage*REC.food);
  const pubTotal = pub.reduce((a, x) => a + x[1], 0);
  const income = tax + fee + grant - wages + resInc;
  const hungry = shortage > 0.05 && v.money + income < pubTotal;
  v.money = Math.round((v.money + income - pubTotal)*10)/10;
  v.food = Math.round(stock*10)/10;
  // morale
  const mor = r.morale, m = (label, x) => { if(Math.abs(x) >= 0.5) mor.push([label, x]); };
  m('生计', (clamp(perCap/2.2, 0, 1.6) - 0.62)*12);
  m('税率', { low: 4, mid: 0, high: -12 }[P.tax]);
  m('劳作', { overtime: -10, normal: 0, festival: 9 }[P.work]);
  if(hungry) m('挨饿', -16);
  if(P.tour === 'open' && allVis > v.pop*2.2) m('游客太多', -4);
  if(staff >= 1 && need < labor*0.55) m('无事可做', -5);
  if(restoreNeed > 0.5) m('修复礁区的工作', REC.mor*degraded);
  if(attract > 0.72) m('海很美', 3);
  if(e.fish < 0.3) m('鱼越来越少', -5);
  const hl = avgLv(v, 'house'); if(hl > 1.05) m('住得舒服', (hl - 1)*3);
  if(v.prevPol && FISH_RANK[P.fish] < FISH_RANK[v.prevPol.fish]) m('渔民不满', -5);
  if(M.morale) m(M.moraleLabel || '事件', M.morale);
  const target = clamp(55 + mor.reduce((a, x) => a + x[1], 0)*2.2, 0, 100);
  const m0 = v.morale;
  v.morale = Math.round(clamp(v.morale + (target - v.morale)*0.45, 0, 100));
  const dMor = v.morale - m0; r.moraleTarget = target;
  const pop0 = v.pop, cap = Wl('house', [4, 6, 8]), grow = 2 + (tier >= 2 ? 1 : 0) + (tier >= 4 ? 1 : 0);
  if(v.morale < 30 || hungry) v.pop = Math.max(4, v.pop - 3);
  else if(v.morale > 55 && v.pop < cap) v.pop = Math.min(cap, v.pop + grow);
  // the sea
  const K = 0.3 + 0.7*e.coral;
  const growth = 0.32*sf.spawn*e.fish*(1 - e.fish/K)*spawnHit + (P.zone !== 'none' ? 0.012 : 0);
  const fishBefore = e.fish, coralBefore = e.coral, clarBefore = e.clar, pelBefore = e.pelagic;
  r.fishWhy = [['繁殖', growth], ['捕捞和误捕', -reefCatch*0.0059*(1 + bycatch)], ['幽灵网', -0.05*e.ghost], ['偷捕', -(M.poach || 0)]].filter(x => Math.abs(x[1]) >= 0.002);
  e.fish = clamp(e.fish + growth - reefCatch*0.0059*(1 + bycatch) - 0.05*e.ghost - (M.poach || 0), 0.02, 1);
  e.pelagic = clamp(e.pelagic + OFF.regrow*e.pelagic*(1 - e.pelagic)*(0.4 + 0.6*sf.spawn) - offCatch*OFF.deplete, 0.02, 1);
  e.ghost = e.ghost*0.85 + lost;
  e.nutr = nutr;
  e.clar += (clamp(1 - 0.9*nutr - (M.bloom ? 0.25 : 0), 0.1, 1) - e.clar)*0.6;
  const heat = M.heat ? M.heat*(1.3 - 0.6*e.clar)*(M.tourRest ? 0.5 : 1) : 0;
  const regrow = 0.04*(1 - e.coral)*e.clar*(1 + { none: 0, core: 0.4, wide: 0.8 }[P.zone] + Wl('nursery', [0.9, 1.35, 1.8]));
  r.coralWhy = [['自然恢复', regrow], ['拖网刮礁', -reefDmg], ['游客踩踏', -trample], ['污水', -0.1*nutr], ['热浪白化', -heat], ['风暴和偷捕', -(M.stormCoral || 0)]].filter(x => Math.abs(x[1]) >= 0.002);
  e.coral = clamp(e.coral + regrow - reefDmg - trample - 0.1*nutr - heat - (M.stormCoral || 0), 0.02, 1);
  e.bait = clamp(e.bait + 0.35*(e.fish - e.bait) + (P.fish === 'ban' ? 0.08 : 0), 0.02, 1);
  v.rep = clamp(v.rep + (attract - 0.55)*0.12 + (P.tour === 'limited' ? 0.02 : 0) + 0.012*resLv + (M.rep || 0), 0, 1);
  v.mpaSeasons = P.zone === 'none' ? 0 : v.mpaSeasons + 1;
  // the hidden sea: the season's luck, the starfish and rubbish nobody cleared, the trouble nobody dealt with
  let sea = null;
  if(v0.sea){ sea = seaEffect(v0.sea); const S = v0.sea;
    e.coral = clamp(e.coral + sea.dC, 0.02, 1); e.fish = clamp(e.fish + sea.dF, 0.02, 1); e.pelagic = clamp(e.pelagic + sea.dP, 0.02, 1);
    v.rep = clamp(v.rep - 0.004*sea.tl, 0, 1);
    if(Math.abs(S.t.coral) >= 0.002) r.coralWhy.push([S.t.coral > 0 ? '风平浪静的一季' : '水温偏高', S.t.coral]);
    if(sea.cl) r.coralWhy.push(['长棘海星', -SEA.cotsK*sea.cl]);
    if(sea.E && sea.E.coral) r.coralWhy.push([sea.E.n, -sea.E.coral]);
    if(Math.abs(S.t.fish) >= 0.002) r.fishWhy.push([S.t.fish > 0 ? '鱼苗多' : '鱼苗少', S.t.fish]);
    if(sea.tl) r.fishWhy.push(['垃圾', -SEA.trashK*sea.tl]);
    if(sea.E && sea.E.fish) r.fishWhy.push([sea.E.n, -sea.E.fish]); }
  r.sea = sea;
  Object.assign(r, { labor, need, staff, catchT, reefCatch, offCatch, sold, spoiled, fishPrice, fishInc, haul: haul || 0, tourInc, visitors, whaleVis, allVis, privCost, earn, tax, fee, gross, perCap, resInc,
    pubTotal, moneyDelta: income - pubTotal, eat, reserve, stock0: v0.food, grant, wages, degraded, protect, restoreNeed, dMor, pop0, pop1: v.pop, cap, foodNeed, shortage, hungry, food: v.food, attract,
    fishBefore, coralBefore, clarBefore, pelBefore, nutr, reefDmg, spawnHit, spring: v.season % 4 === 0 });
  return { e, v, r };
}
