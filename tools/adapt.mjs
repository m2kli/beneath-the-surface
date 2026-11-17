// adaptive recovery strategies, the way a thinking player would steer out of a trap
import fs from 'fs';
const src0 = fs.readFileSync(new URL('./sim5.mjs', import.meta.url), 'utf8');
const cut = src0.indexOf('const summary = {};');
let src = src0.slice(0, cut) + `
const ADAPT = {
  '聪明恢复(配额)': (s, v, e) => ({ fish: e.fish < 0.45 ? 'quota' : 'quota', tour: 'limited', zone: e.coral < 0.6 ? 'wide' : 'core', waste: v.resort ? 'full' : 'basic', work: v.morale < 45 && v.money > 40 ? 'festival' : 'normal', tax: v.morale < 50 ? 'low' : 'mid' }),
  '聪明恢复(钓线→配额)': (s, v, e) => ({ fish: e.fish < 0.5 ? 'line' : 'quota', tour: 'limited', zone: e.coral < 0.6 ? 'wide' : 'core', waste: v.resort ? 'full' : 'basic', work: 'normal', tax: v.morale < 52 ? 'low' : 'mid' }),
  '先休渔两季再配额': (s, v, e) => ({ fish: s < v.__s0 + 2 ? 'ban' : 'quota', tour: 'limited', zone: e.coral < 0.6 ? 'wide' : 'core', waste: v.resort ? 'full' : 'basic', work: 'normal', tax: v.morale < 50 ? 'low' : 'mid' }),
  '只开旅游+保护': (s, v, e) => ({ fish: 'line', tour: e.coral > 0.5 ? 'limited' : 'closed', zone: 'wide', waste: 'full', work: 'normal', tax: 'low' }),
  '半吊子(核心区+开放)': (s, v, e) => ({ fish: 'quota', tour: 'open', zone: 'core', waste: 'basic', work: 'normal', tax: 'mid' }),
};
const ABUILD = (s, v, e) => [e.coral < 0.6 ? 'nursery' : null, 'house', v.pop >= v.houses*4 - 2 ? 'house' : null, e.coral > 0.5 ? 'shop' : null].filter(Boolean);
for(const [name, [e0, v0]] of Object.entries(TRAPS)){
  const row = [];
  for(const [an, f] of Object.entries(ADAPT)){ const vv = { ...v0, __s0: v0.season }; const r = sim(e0, vv, f, ABUILD, 25);
    row.push(an + ':' + r.end + '(珊' + r.e.coral.toFixed(2) + ' 鱼' + r.e.fish.toFixed(2) + ' 库' + Math.round(r.v.money) + ' 心' + r.v.morale + ' 人' + r.v.pop + ')'); }
  console.log(name); row.forEach(x => console.log('   ' + x));
}
`;
fs.writeFileSync(new URL('./adapt_run.mjs', import.meta.url), src);
