// item 1: what each fishing / tourism option actually returns, from the real model
import { gameSource } from './lib.mjs';
const src = gameSource(), a = src.indexOf('const REC = {'), b = src.indexOf('function seasonStep(){');
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x)), lerp = (x, y, t) => x + (y - x)*t;
const M = new Function('clamp', 'lerp', src.slice(a, b) + '; return { simulateSeason };')(clamp, lerp);
const e = { coral: 0.85, fish: 0.8, bait: 0.8, clar: 0.9, ghost: 0, nutr: 0.08, pelagic: 1 };
const v = { season: 6, money: 120, food: 3, houses: 6, pop: 24, morale: 60, rep: 0.4, boats: 4, trawlers: 1, shops: 2, resort: 0, plant: 0, recycle: 0, cold: 0, nursery: 0, school: 0, harbor: 0, offshore: 0, whale: 0, research: 0,
  pol: { fish: 'quota', tour: 'limited', zone: 'core', waste: 'basic', work: 'normal', tax: 'mid' }, prevPol: null, locks: {}, mods: {}, mpaSeasons: 3 };
const row = (lab, pol, ee = e) => { const o = M.simulateSeason(ee, { ...v, pol: { ...v.pol, ...pol } }, 0), r = o.r;
  return `${lab.padEnd(8)} 村库${(r.moneyDelta >= 0 ? '+' : '') + r.moneyDelta.toFixed(0).padStart(4)} 税${r.tax.toFixed(0).padStart(3)} 门票${r.fee.toFixed(0).padStart(3)} 资助${(r.grant - r.wages).toFixed(0).padStart(3)} | 村民到手${r.earn.toFixed(0).padStart(4)} 成本${r.privCost.toFixed(0).padStart(3)} | 渔获${r.catchT.toFixed(1)} 自吃${Math.min(r.catchT + v.food, r.foodNeed).toFixed(1)} 卖${r.sold.toFixed(1)} 坏${r.spoiled.toFixed(1)} | 游客${r.visitors.toFixed(0)} 价${(r.tourInc/Math.max(1, r.visitors)).toFixed(1)} 旅游${r.tourInc.toFixed(0)} | 珊${((o.e.coral - ee.coral)*100).toFixed(1)} 鱼${((o.e.fish - ee.fish)*100).toFixed(1)} 心${r.dMor}`; };
console.log('== 捕鱼（旅游=限流）'); for(const f of ['industrial', 'quota', 'line', 'ban']) console.log(row(f, { fish: f }));
console.log('== 旅游（捕鱼=配额）, 珊瑚 85%'); for(const t of ['open', 'limited', 'closed']) console.log(row(t, { tour: t }));
console.log('== 旅游, 珊瑚 45%'); const e2 = { ...e, coral: 0.45, fish: 0.5 }; for(const t of ['open', 'limited', 'closed']) console.log(row(t, { tour: t }, e2));
console.log('== 旅游, 3 家潜水店+度假村'); v.shops = 3; v.resort = 1; v.pop = 32; v.houses = 8; for(const t of ['open', 'limited', 'closed']) console.log(row(t, { tour: t }));
