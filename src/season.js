'use strict';
function seasonStep(){
  const pre = { season: V.season, money: V.money, morale: V.morale, food: V.food, pol: { ...V.pol }, built: V.built.slice().concat((V.ups || []).map(u => 'up:' + u.k)), spent: V.buildSpent || 0, ev: V.evLog || null };
  const { e, v, r } = simulateSeason(eco, V, pendingHaul);
  pendingHaul = 0;
  Object.assign(eco, e); Object.assign(V, v);
  if(r.reefDmg > 0) for(let n=0;n<V.trawlers;n++) scar[(rng()*13)|0] = 0.55; else for(let i=0;i<13;i++) scar[i] *= 0.6;
  V.history.push({ fishing: r.fishInc, tour: r.tourInc, cost: r.privCost + r.pubTotal });
  r.buildSpent = V.buildSpent || 0; V.built = []; V.buildSpent = 0; V.ups = [];
  r.seaS = V.sea || null; V.sea = rollSea(eco, V, V.season + 1, rng);
  V.prevPol = { ...V.pol }; V.mods = {};
  for(const k in V.locks){ if(--V.locks[k] <= 0) delete V.locks[k]; }
  logSeason(pre, r);
  return r;
}
// random events: each a small dilemma, rolled at the start of a season
const EVENTS = [
  { id: 'storm', when: s => s % 4 >= 2, w: 1.2, t: '风暴要来了', x: '气象站说，这一季会有一场大风暴。', o: [
    { t: '听天由命', d: '损失一条船（有拖网船时一半概率是拖网船），珊瑚 −6%，渔获 −30%，民心下降。', go(){ if(V.trawlers > 0 && rng() < 0.5) V.trawlers--; else if(V.boats > 1) V.boats--;
      Object.assign(V.mods, { stormCoral: 0.06, storm: true, morale: -4, moraleLabel: '风暴损失' }); } },
    { t: '加固码头和渔船', d: '村库 −25，没有损失。', go(){ V.money -= 25; } } ] },
  { id: 'heat', when: s => s % 4 === 1, w: 1.4, t: '海洋热浪', x: '海水比往年热了两度，珊瑚开始发白。海水越浑，白化越严重。', o: [
    { t: '照常营业', d: '旅游照常。珊瑚白化 −10% 到 −17%（水越浑越重）。', go(){ V.mods.heat = 0.14; } },
    { t: '暂停潜水，让珊瑚喘口气', d: '本季旅游关闭，白化减半。', go(){ Object.assign(V.mods, { heat: 0.14, tourRest: true }); V.pol.tour = 'closed'; V.locks.tour = 1; } } ] },
  { id: 'price', w: 0.8, t: '鱼价暴涨', x: '城里的餐馆抢着收鱼，这一季鱼价涨了五成。', o: [
    { t: '知道了', d: '本季卖鱼收入 ×1.5。', go(){ V.mods.priceK = 1.5; } } ] },
  { id: 'poach', when: () => V.pol.zone !== 'none', w: 1, t: '外地渔船闯进保护区', x: '有人趁夜在保护区里下网。', o: [
    { t: '睁一只眼闭一只眼', d: '鱼群 −7%，珊瑚 −3%，民心下降。', go(){ Object.assign(V.mods, { poach: 0.07, stormCoral: 0.03, morale: -3, moraleLabel: '保护区形同虚设' }); } },
    { t: '出钱组织巡逻', d: '村库 −30，没有损失。', go(){ V.money -= 30; } } ] },
  { id: 'science', when: () => eco.coral > 0.65, w: 0.8, t: '科研团队来访', x: '海洋学家听说这片礁保存得很好，想来做研究。', o: [
    { t: '欢迎他们', d: '村库 +45，声誉上升。', go(){ V.money += 45; V.mods.rep = 0.08; } } ] },
  { id: 'bloom', when: () => (eco.nutr || 0) > 0.22, w: 1.6, t: '赤潮', x: '海湾里的藻类疯长，海水变成了铁锈色。', o: [
    { t: '只能等它过去', d: '鱼群 −6%，本季游客减半。', go(){ V.mods.bloom = true; eco.fish = Math.max(0.02, eco.fish - 0.06); } } ] },
  { id: 'petition', when: () => (V.pol.fish === 'ban' || V.pol.fish === 'quota') && V.morale < 55, w: 1.2, t: '渔民请愿', x: '渔民聚在村口，说限制捕捞让他们揭不开锅。', o: [
    { t: '坚持政策', d: '民心下降（约 −8）。', go(){ Object.assign(V.mods, { morale: -8, moraleLabel: '请愿被拒' }); } },
    { t: '发放补贴', d: '村库 −30，民心回升（约 +6）。', go(){ V.money -= 30; Object.assign(V.mods, { morale: 6, moraleLabel: '发放补贴' }); } } ] },
  { id: 'investor', when: () => !V.resort && V.season >= 1, w: 0.9, t: '投资商来访', x: '一家公司愿意免费在海边盖一座度假村。条件是：两季之内，污水直接排进海湾。', o: [
    { t: '接受', d: '免费获得度假村，有了新工作；两季内污水政策锁定为直排。', go(){ V.resort = 1; V.pol.waste = 'dump'; V.locks.waste = 2; Object.assign(V.mods, { morale: 5, moraleLabel: '新的工作' }); } },
    { t: '婉拒', d: '什么都不变。', go(){} } ] },
];
function rollEvent(){
  if(V.season === 0 || rng() > 0.7) return null;
  const pool = EVENTS.filter(ev => ev.id !== V.lastEvent && !(V.evAt && V.evAt[ev.id] !== undefined && V.season - V.evAt[ev.id] < 6) && (!ev.when || ev.when(V.season)));
  let tot = pool.reduce((a, ev) => a + ev.w, 0), x = rng()*tot;
  for(const ev of pool){ x -= ev.w; if(x <= 0) return ev; }
  return null;
}
const EV_TYPE = { storm: 'crisis', heat: 'crisis', price: 'chance', poach: 'crisis', science: 'chance', bloom: 'crisis', petition: 'crisis', investor: 'chance' };
function showEvent(ev, after){
  setState('event'); V.lastEvent = ev.id; (V.evAt = V.evAt || {})[ev.id] = V.season; $('village').classList.add('modal');
  const type = EV_TYPE[ev.id] || 'info';
  $('vEvent').innerHTML = `<div class="kicker ${type}">${seasonName(V.season)} · ${type === 'crisis' ? '危机' : type === 'chance' ? '机会' : '消息'}</div><h3>${ev.t}</h3><p>${ev.x}</p>
    <div class="opts">${ev.o.map((o, i) => `<button data-i="${i}"><b>${o.t}</b><span>${o.d}</span></button>`).join('')}</div>`;
  $('vEvent').querySelectorAll('button').forEach(b => b.onclick = () => { V.evLog = { t: ev.t, c: ev.o[+b.dataset.i].t }; ev.o[+b.dataset.i].go(); $('vEvent').classList.remove('on'); $('village').classList.remove('modal');
    setState('plan'); chime(3); renderVillageUI(); if(after) after(); });
  $('vEvent').classList.add('on'); renderVillageUI();
}
