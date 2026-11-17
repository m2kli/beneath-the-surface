// trap hunt: reach a mid-game state by random play, then see whether ANY sensible recovery survives
process.argv[3] = 'none';
const S = await import('./stress.mjs');
const { newGame, bots, playSeason, ending, mod, rnd } = S;
const clone = G => JSON.parse(JSON.stringify(G));
const ADAPT = {
  '配额恢复': (G) => { const { V, eco: e } = G; return { fish: 'quota', tour: 'limited', zone: e.coral < 0.6 ? 'wide' : 'core', waste: V.resort ? 'full' : 'basic', work: V.morale < 45 && V.money > 40 ? 'festival' : 'normal', tax: V.morale < 50 ? 'low' : 'mid' }; },
  '钓线→配额': (G) => { const { V, eco: e } = G; return { fish: e.fish < 0.5 ? 'line' : 'quota', tour: 'limited', zone: e.coral < 0.6 ? 'wide' : 'core', waste: V.resort ? 'full' : 'basic', work: 'normal', tax: V.morale < 52 ? 'low' : 'mid' }; },
  '保民心优先': (G) => { const { V, eco: e } = G; return { fish: e.fish < 0.45 ? 'line' : 'quota', tour: 'limited', zone: e.coral < 0.5 ? 'wide' : 'core', waste: V.money < 30 ? 'basic' : (V.resort ? 'full' : 'basic'), work: V.money > 30 ? 'festival' : 'normal', tax: 'low' }; },
  '省钱优先': (G) => { const { V, eco: e } = G; return { fish: e.fish < 0.45 ? 'line' : 'quota', tour: 'limited', zone: 'core', waste: 'basic', work: 'normal', tax: V.money < 20 ? 'high' : 'mid' }; },
};
const build = (G) => { const { V, eco: e } = G; return [e.coral < 0.6 ? 'nursery' : null, V.pop >= V.houses*4 - 2 ? 'house' : null, e.coral > 0.5 && V.shops < 2 ? 'shop' : null].filter(Boolean); };
const FAIL = new Set(['破产', '民心崩溃', '人走光']);
const results = { total: 0, trapped: 0, onlyMid: 0, goodPossible: 0 }; const coralHist = [0,0,0,0,0]; const examples = [];
for(let i=0;i<+(process.argv[4] || 1500);i++){
  const k = [3, 5, 7, 9, 11][i % 5];
  const G0 = newGame(); let dead = false;
  const kind = process.argv[5] || 'random';
  const greedyMix = () => { const r = rnd(); return { fish: r < 0.6 ? 'industrial' : 'quota', tour: rnd() < 0.7 ? 'open' : 'limited', zone: rnd() < 0.8 ? 'none' : 'core', waste: rnd() < 0.7 ? 'dump' : 'basic', work: rnd() < 0.15 ? 'overtime' : 'normal', tax: rnd() < 0.25 ? 'high' : 'mid' }; };
  const rb = kind === 'hard' ? { policy: () => ({ fish: 'industrial', tour: 'open', zone: 'none', waste: 'dump', work: 'normal', tax: rnd() < 0.5 ? 'mid' : 'low' }), build: () => [['trawler', 'trawler', 'boat', 'shop', 'house', 'resort', 'house'][(rnd()*7)|0]], keep: 10 } : kind === 'greedy' ? { policy: greedyMix, build: () => [['trawler', 'boat', 'shop', 'house', 'resort'][(rnd()*5)|0]], keep: 10 } : bots.random();
  for(let s=0;s<k;s++){ playSeason(G0, rb); G0.V.season++; if(G0.V.morale <= 5 || G0.V.money < -100 || G0.V.pop <= 6){ dead = true; break; } }
  if(dead){ results.diedEarly = (results.diedEarly || 0) + 1; continue; }
  results.total++; coralHist[Math.min(4, Math.floor(G0.eco.coral*5))]++;
  let best = 'x', bestRank = -1; const rank = { '好结局': 5, '中·村好海差': 3, '海好村差': 3, '原地踏步': 3, '中': 2, '坏结局': 1, '破产': 0, '民心崩溃': 0, '人走光': 0 };
  for(const [an, f] of Object.entries(ADAPT)) for(let rep=0; rep<3; rep++){
    const G = clone(G0); let fail = '';
    for(let s=G.V.season;s<16;s++){ playSeason(G, { policy: f, build, keep: 20, event: (GG, ev) => ev.o.length > 1 && /补贴|巡逻|加固|暂停/.test(ev.o[0].t) && GG.V.money > 45 ? 0 : ev.o.length - 1 }); G.V.season++;
      if(G.V.morale <= 5){ fail = '民心崩溃'; break; } if(G.V.money < -100){ fail = '破产'; break; } if(G.V.pop <= 6){ fail = '人走光'; break; } }
    const e = ending(G, fail); if(rank[e] > bestRank){ bestRank = rank[e]; best = e; } }
  if(bestRank === 0){ results.trapped++; if(examples.length < 8) examples.push(`第${k + 1}季 珊${G0.eco.coral.toFixed(2)} 鱼${G0.eco.fish.toFixed(2)} 水${G0.eco.clar.toFixed(2)} 库${Math.round(G0.V.money)} 心${G0.V.morale} 人${G0.V.pop}/${G0.V.houses*4} 船${G0.V.boats}/${G0.V.trawlers} 店${G0.V.shops} 度假村${G0.V.resort} 建筑${['cold', 'plant', 'recycle', 'nursery', 'school'].filter(x => G0.V[x]).join(',')}`); }
  else if(bestRank === 5) results.goodPossible++; else results.onlyMid++;
}
console.log(`(前段就死掉 ${results.diedEarly || 0})`); console.log(`随机玩到中途的局面 ${results.total} 个：仍能拿好结局 ${results.goodPossible}（${(results.goodPossible/results.total*100).toFixed(1)}%）· 只能保住中间结局 ${results.onlyMid} · 怎么走都失败 ${results.trapped}（${(results.trapped/results.total*100).toFixed(1)}%）`);
examples.forEach(x => console.log('   卡死例：' + x)); console.log('   起始珊瑚分布 0-20/20-40/40-60/60-80/80-100%: ' + coralHist.join('/'));
