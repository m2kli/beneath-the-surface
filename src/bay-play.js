'use strict';
// Local coordinates follow a section of the reef: x across the bay, y towards the surface.
const BAY_SEASONS = [
  ['借潮找鱼道','浅湾礁门','current','在背流练习喷水','jelly'],
  ['等海龟靠近','清洁站','watch','陪老海龟游一段','turtle'],
  ['带尾队出围','浅湾礁门','school','沿沙沟看幼鱼','school'],
  ['从背流找冬鱼','浅湾礁门','current','反向漂回春季礁门','jelly'],
  ['给幼鱼摆落脚点','育幼浅湾','racks','看幼鱼选落脚点','reef'],
  ['给观鱼小团找位置','育幼浅湾','viewing','回访春天留下的幼鱼','reef'],
  ['趁松潮清出通道','外缘礁壁','lift','游过原来的支沟','reef'],
  ['让换班渔户自己走','浅湾礁门','teach','去清洁站看老海龟','turtle'],
  ['在窄口让行','浅湾礁门','school','等两群鱼在礁背汇合','school'],
  ['替海龟挑换气点','清洁站','breath','回老礁头歇一会','turtle'],
  ['连接两片栖地','育幼浅湾','racks','在邻礁等成鱼','reef'],
  ['在礁壁外等鲸','远洋礁壁','whale','随深流看礁壁','jelly'],
  ['试撤一座庇护架','育幼浅湾','racks','对照两拨幼鱼','reef'],
  ['老海龟去了哪里','清洁站','trace','认回那块缺口背甲','turtle'],
  ['最后一班秋捕','外缘礁壁','harvest','陪尾队归礁','school'],
  ['大潮入夜','浅湾礁门','final','留在礁头等天亮','reef']
];
const bayPoint = (x,y,label='') => ({x,y,label});
const bayDistance = (p,q) => Math.hypot(p.x-q.x,p.y-q.y);
const bayNear = (g,p,r=1.65) => p && bayDistance(g,p) <= r;
const bayRound = x => Math.round(x*10)/10;
function bayMarks(g, list){ g.marks = list.map(p=>bayPoint(...p)); g.target = null; }
function bayPhase(g, step, list){ g.stage = step; g.since = g.t; if(list) bayMarks(g,list); }
function bayNotice(g, message){ g.message = message; g.messageUntil = g.t + 2.5; }
function bayResult(g, sign, quality, note){
  g.result = {season:g.season, title:g.title, quality:clamp(quality,0,1), sign, note,
    points:g.racks.map(p=>({x:bayRound(p.x),y:bayRound(p.y)}))};
}
const BAY_FORMS = {current:'jelly', watch:'manta', school:'school', racks:'rig', viewing:'rig', lift:'rig',
  teach:'rig', breath:'turtle', whale:'manta', trace:'manta', harvest:'rig', still:'manta'};
function createBayGame(v, e, sea, choice){
  const n = sea.season, row = BAY_SEASONS[n], mem = v.bay || {};
  let kind = row[2], title = row[0], practice = choice === 'slow'||choice==='openSchool';
  if(practice){ kind = {jelly:'current', school:'school', turtle:'watch', reef:'still'}[row[4]]; title = row[3]; }
  if(choice==='openSchool'){kind='school';title='浅湾里的鲹鱼围猎';}
  if(kind === 'final'){ kind = {jelly:'current', school:'school', turtle:'watch'}[choice] || 'final'; }
  const seed = (sea.seed || 0) + n*31;
  const racks = (mem.racks || []).map(p=>bayPoint(p.x,p.y));
  const g = {season:n, kind, title, choice, form:BAY_FORMS[kind] || 'manta', practice, finale:n===15 && !practice,
    seed, side:seed%2 ? 1 : -1, busy:!mem.quiet && ((v.pol.fish!=='ban' && (v.pol.fish!=='quota'||e.fish>0.42) && v.boats>=2) || (v.pol.tour!=='closed' && v.shops>0)),
    hasNet:e.ghost>=0.125, whaleHere:(e.pelagic??1)>0.6, reef:clamp(e.coral*0.5+e.clar*0.28+(mem.young||0)*0.22,0,1),
    cause:v.pol.waste==='dump' && (e.nutr||0)>0.09 ? 'outfall' : (!mem.quiet && v.pol.tour!=='closed' && v.shops ? 'boats' : 'tide'),
    young:mem.young || 0, racks, marks:[], target:null,
    x:-6,y:0,vx:0,vy:0,facing:1,t:0,since:0,stage:0, edits:0, held:0, air:1, gather:0, dash:0,
    feedback:0, kept:0, sent:0, message:'',messageUntil:0, result:null,
    fish:[], subject:bayPoint(0,0), hazard:bayPoint(0,0), boat:bayPoint(-9,3.4), pins:[], hint:'', status:'', primary:'', secondary:''};
  const count=Math.round(12+10*e.fish+6*g.young);
  for(let i=0;i<count;i++) g.fish.push({x:-6+(i%5)*0.34,y:Math.sin(i*2.4)*0.8,z:Math.cos(i*2.4)*0.55,large:i%3===0});
  switch(kind){
    case 'current':
      g.reverse = !g.finale && n===3; g.x=g.reverse?6:-6; g.y=1.2;
      bayMarks(g, [[g.reverse?3:-3,-2.4,g.finale?'第一股上升流':'底层回流']]); break;
    case 'watch':
      g.x=-6; bayMarks(g,[[-3.2,-0.6,'礁影'],[3.4,0.3,'侧礁']]); break;
    case 'school':{
      const last=g.finale?g.racks.at(-1):null;
      g.x=-6; bayMarks(g,[[-4,-1,'礁背集群'],last?[clamp(last.x+2,2.5,8),last.y,'旧庇护地']:[6,0,'窄口外侧']]); break;}
    case 'racks':
      if(n===4 && !g.racks.length) g.racks=[];
      else if(!g.racks.length) g.racks=[bayPoint(-3,-1.1),bayPoint(2,-0.6)];
      g.original=g.racks.map(p=>({...p}));
      bayMarks(g,[[-3,-1,'内礁'],[2,-0.6,'通道'],[6,0.3,'邻礁']]); break;
    case 'viewing': bayMarks(g,[[-4,-0.7,'礁边'],[1.4,1.3,'沙地外缘'],[7,2.2,'远点']]); break;
    case 'lift': bayMarks(g,[[-4,-1.0,'沙地一端'],[3.6,-1.2,'活礁一端']]); break;
    case 'teach': bayMarks(g,[[-4,-1.2,'第一处岔口'],[3,1.4,'第二处岔口']]); break;
    case 'breath': g.x=0; g.y=-1.6; bayMarks(g,[[-5,3,'近岸水面'],[5.5,3,'礁背水面']]); break;
    case 'whale': bayMarks(g,[[-5,1.5,g.whaleHere?'西侧水痕':'第一枚漂标'],[5,1.5,g.whaleHere?'东侧水痕':'第二枚漂标']]); break;
    case 'trace': bayMarks(g,[[-4,0,'旧清洁站'],[4.8,1.4,'侧礁气泡']]); break;
    case 'harvest': bayMarks(g,[[-4,-0.4,'先到的小群'],[5,1.2,'外缘鱼讯']]); break;
    case 'still': bayMarks(g,[[-3,-0.8,'内礁'],[5,0.4,'邻礁']]); break;
  }
  return g;
}
function bayFlow(g,y){
  const tide = Math.sin(g.t*0.68 + g.seed%5);
  return (g.reverse?-1:1)*(y < -0.65 ? 1 : -1)*(0.65+0.36*tide);
}
function bayLift(g,x){
  if(!g.finale||g.kind!=='current')return 0;
  const column=(cx,delay)=>Math.max(0,1-Math.abs(x-cx)/2.9)*Math.max(0,Math.cos(g.t*0.7+g.seed%5-delay));
  return 2.1*(column(-3,0)+column(4,1.65));
}
function bayMove(g,dt,input){
  let dx=input.x || 0, dy=input.y || 0;
  if(dx || dy) g.target=null;
  else if(g.target){ dx=g.target.x-g.x; dy=g.target.y-g.y; }
  const distance=Math.hypot(dx,dy), scale=Math.max(1,distance);
  dx/=scale; dy/=scale;
  const speed=g.form==='jelly'?3.2:g.gather>0?2.1:g.form==='rig'?6.5:5.4;
  const drag=1-Math.exp(-dt*(g.form==='jelly'?2.3:5));
  g.vx+=(dx*speed-g.vx)*drag; g.vy+=(dy*speed-g.vy)*drag;
  if(g.dash>0){ g.x+=g.facing*dt*5; g.dash-=dt; }
  const flow=g.form==='jelly'?bayFlow(g,g.y):g.kind==='breath'&&!g.busy?0.48:0;
  g.x=clamp(g.x+(g.vx+flow)*dt,-9.4,9.4); g.y=clamp(g.y+(g.vy+bayLift(g,g.x))*dt,-3.8,3.8);
  if(Math.abs(g.vx)>0.3) g.facing=Math.sign(g.vx);
  g.gather=Math.max(0,g.gather-dt);
}
function baySwimFish(g,dt){
  const school=g.kind==='school', habitat=['racks','viewing','still','lift'].includes(g.kind);
  let nearExit=0, sheltered=0, reaching=0;
  const layout=bayHabitat(g);
  for(let i=0;i<g.fish.length;i++){
    const f=g.fish[i], phase=i*2.39996, wave=(g.t*0.13+i/g.fish.length)%1;
    let x,y;
    if(school){
      const spread=g.gather>0?0.52:1.15;
      x=g.x-g.facing*(i%7)*0.32*spread + Math.cos(phase+g.t)*0.4;
      y=g.y+Math.sin(phase+g.t*0.55)*spread;
      const sheltered=g.racks.some(p=>bayDistance(f,p)<2.2);
      const danger=g.choice==='slow'||(g.finale&&!g.busy)?Infinity:bayDistance(f,g.hazard);
      if(!sheltered && danger<2.4 && g.gather<=0 && g.stage===1){
        x-=2.6; y+=Math.sign(f.y-g.hazard.y || 1)*1.3;
        if(danger<1.35 && i%4===3 && !f.stray && g.t>(f.safeUntil||0)) f.stray=bayPoint(f.x,f.y);
      }
      if(f.stray){
        x=f.stray.x+Math.cos(phase+g.t)*0.4;y=f.stray.y+Math.sin(phase+g.t)*0.4;
        if(bayDistance(g,f)<2.1 && (g.gather>0||Math.hypot(g.vx,g.vy)<1.5)){f.stray=null;f.safeUntil=g.t+5;}
      }
    }else if(habitat){
      const larger=Math.ceil(g.fish.length/3);
      const rank=f.large?Math.floor(i/3):larger+i-Math.floor(i/3)-1;
      const strength=(rank+0.5)/g.fish.length, crosses=strength<=layout.cross;
      const stays=!crosses && (strength-layout.cross)/(1-layout.cross)<=layout.stay;
      const first=g.racks[0] || {x:-3,y:-1}, last=g.racks[1] || first;
      const route=[{x:-8,y:-1},first,last,{x:8,y:0}];
      const limit=crosses?3:stays?1.6:0.65;
      const travel=(0.5-0.5*Math.cos(wave*Math.PI*2))*limit;
      const k=Math.min(2,Math.floor(travel)), frac=travel-k;
      x=lerp(route[k].x,route[k+1].x,frac)+Math.cos(phase)*0.55;
      y=lerp(route[k].y,route[k+1].y,frac)+Math.sin(phase+g.t*0.9)*0.55;
      if(g.kind==='viewing' && g.pins.length && bayDistance(g.pins[0],{x:-3,y:-1})<2.7){x-=2;y-=1.4;}
      if(f.layout!==g.edits){f.layout=g.edits;f.seenHere=false;f.seenAcross=false;}
      if(stays && travel>=0.9) f.seenHere=true;
      if(crosses && travel>=2.4) f.seenAcross=true;
      if(f.seenHere) sheltered++; if(f.seenAcross) reaching++;
    }else if(g.kind==='watch'||g.kind==='trace'||g.kind==='breath'){
      const turtle=g.kind==='breath'?g:g.subject;
      x=turtle.x+Math.cos(phase+g.t*0.8)*(i%3?1.3:2.8); y=turtle.y+Math.sin(phase+g.t)*0.75;
    }else{
      const side=g.kind==='current'&&g.stage>0?g.side:1;
      x=g.kind==='harvest'?(g.t-g.since<6?-4:5)+Math.cos(phase+g.t)*1.4:side*(4.7+Math.sin(g.t*0.45+i*0.25)*1.5);
      y=(g.kind==='current'&&g.stage>0?g.side*1.9 : -0.5)+Math.sin(phase+g.t)*0.7;
    }
    const ease=1-Math.exp(-dt*(school?(g.gather>0?3.5:1.6)/(1+i*0.038):4));
    f.x+=(x-f.x)*ease;f.y+=(y-f.y)*ease;
    if(school && !f.stray && bayDistance(f,g.marks[1])<3.25) nearExit++;
  }
  g.kept=school?nearExit:sheltered; g.sent=reaching;
}
function bayHabitat(g){
  const a=g.racks[0],b=g.racks[1];
  if(!a){const base=clamp(0.12+0.52*g.reef,0,1);return {stay:base,cross:base*0.45};}
  const reach=1-clamp(bayDistance(a,{x:-3,y:-1})/10,0,1);
  const gap=b?bayDistance(a,b):0, cover=b?1-clamp(Math.abs(b.y-0.5)/6,0,1):0;
  const stay=clamp(0.12+reach*0.46+(b?0.47*(1-clamp(gap/10,0,1)):0.24*g.reef),0.08,0.98);
  const cross=b?clamp(0.08+reach*0.15+cover*0.12+0.45*(1-clamp(Math.abs(gap-6)/5,0,1)),0.08,0.93):0.11+0.51*g.reef;
  return {stay,cross};
}
function bayStep(g,dt,input={}) {
  if(!dt) return;
  g.t+=dt; const age=g.t-g.since;
  if(!g.result) bayMove(g,dt,input);
  const tide=Math.sin(g.t*0.7+g.seed%5);
  g.boat.x=Math.sin(g.t*0.6)*8; g.boat.y=3.3;
  if(g.kind==='teach'&&g.stage===2 && g.pins.length===2){
    const k=clamp(age/5.9,0,1)*3, i=Math.min(2,Math.floor(k));
    const path=[{x:-8,y:2.8},...g.pins,{x:8,y:2.8}];
    g.boat.x=lerp(path[i].x,path[i+1].x,k-i);
    g.boat.y=lerp(path[i].y,path[i+1].y,k-i)+0.45;
  }
  const crossingBoat=g.kind==='school' && (g.season===8||g.finale) && g.busy;
  g.hazard.x=crossingBoat?g.boat.x:Math.sin(g.t*0.84)*7;
  g.hazard.y=crossingBoat?1:Math.cos(g.t*0.92)*1.1;
  if(g.kind==='watch'){
    if(g.finale && g.stage===1){
      const p=clamp(age/4.8,0,1);
      g.subject.x=lerp(0.4,4.5,p);g.subject.y=lerp(-0.25,3.2,p);
      const distance=bayDistance(g,g.subject);
      g.held=clamp(g.held+(distance<5.2 && distance>1.35?dt:-dt*0.5),0,2.2);
    }else{
      const disturbed=bayDistance(g,g.subject)<2.15;
      g.feedback=clamp(g.feedback+(disturbed?1.4:-0.55)*dt,0,1);
      g.subject.x=0.3+Math.sin(g.t*0.37)*0.8+g.feedback*3;g.subject.y=-0.25+g.feedback*1.7;
      const dist=bayDistance(g,g.subject), still=Math.hypot(g.vx,g.vy)<0.9;
      g.held=clamp(g.held+((dist>2.2&&dist<5.6&&still&&g.feedback<0.35)?dt:-dt*0.6),0,2.2);
    }
  }else if(g.kind==='whale'){ g.subject.x=g.side*(3+2*Math.cos(g.t*0.72));g.subject.y=0.8+2.4*Math.sin(g.t*0.72); }
  else if(g.kind==='trace'){ g.subject.x=4.8+Math.sin(g.t*0.5)*0.7; g.subject.y=1+Math.cos(g.t*0.5)*0.8; }
  if(g.kind==='breath'&&!g.result){
    g.air-=dt*0.041;
    if(g.air<=0){g.air=1;g.x=0;g.y=-1.6;g.target=null;bayNotice(g,'在礁背换了应急的一口气，再挑一次水面。');}
  }
  baySwimFish(g,dt);
  if(g.kind==='teach'&&g.stage===2&&age>=5.9&&!g.result){
    const miss=bayDistance(g.pins[0],g.marks[0])+bayDistance(g.pins[1],g.marks[1]);
    if(miss>6.8){g.pins=[];bayPhase(g,0);bayNotice(g,'试航船走错岔口。把两个标往岔口挪近一些。');}
    else bayResult(g,'trained',clamp(1-miss/11,0.35,1),'换班渔户依照你留下的两枚标志，独自走通了礁门。');
  }
  const slack=Math.abs(tide)<0.68;
  switch(g.kind){
    case 'current':{
      g.hint=g.finale?(g.stage?'跟着第二股上升的浮屑，在亮水交会时喷出去。':'靠近第一股向上漂的浮屑，趁潮水交会喷一下。'):(g.stage?'看鱼影在哪一侧聚拢，游到那个出口核实鱼讯。':'点底层回流，或用方向键下沉。到达时喷一下借流。');
      g.primary=g.stage?(g.finale?'穿过亮水':'确认出口'):'收伞喷水';
      g.status=(g.y<-0.65?'底层流':'表层流')+(bayFlow(g,g.y)>0?' 向右 →':' 向左 ←')+(slack?' · 两股流已相接':' · 急流掠过礁门');break;}
    case 'watch':
      if(g.finale&&g.stage){g.hint='老龟正往水面游。沿它侧后的气泡跟上，在它浮头时一起迎接天亮。';g.status=g.held>1.5?'和老龟并游中':'跟到气泡旁，给它留出浮头的空隙';g.primary='陪它浮上去';}
      else{g.hint='停在礁影或侧礁。太近龟会绕走，等清洁鱼围拢再观察背甲。';g.status=g.feedback>0.35?'海龟正在避开你':'清洁鱼停留 '+Math.round(g.held/2.2*100)+'%';g.primary='认背甲';}break;
    case 'school':g.hint=g.stage?(g.finale&&g.racks.length?'带尾队靠近留下的旧架，等散开的鱼聚齐再归礁。':'把尾队带到窄口外侧。可以急转抢过，也可以减速聚群后再记下结果。'):'先到礁背收拢鱼群，再决定何时穿过窄口。';
      g.status=(g.season===8?(g.busy?'船影穿过窄口':'第二群鱼正在汇入'):g.finale?'旧礁前的回游鱼':g.hazard.x>g.x?'鲹鱼从右侧切入':'鲹鱼从左侧切入')+' · 已到窄口 '+g.kept+'/'+g.fish.length;
      if(g.fish.some(f=>f.stray))g.status+=' · 有鱼掉队，游近减速可接回';
      g.primary=g.stage?'记下通过的鱼':'在礁背集群';g.secondary=g.stage?'急转冲刺':'呼回尾队';break;
    case 'racks':g.hint=g.season===12?'先暂收一座架，看看下一拨鱼能否靠天然礁通过。也可以放回原处。':
      g.season===10?'试移外侧的一座架，观察原湾留下多少、邻礁接到多少。':'点水中任意位置移动吊钩，放第一座和第二座架。两架间距会改变鱼的走法。';
      g.status='湾内停留 '+g.kept+' 条 · 能接到邻礁 '+g.sent+' 条';
      g.primary=g.season===12?(g.edits%2?'放回原架':'试收一座架'):(g.season===10||g.edits%2?'放置外侧架':'放置内侧架');
      g.secondary='按当前布局记录';break;
    case 'viewing':g.hint='把浮标放到一个能看见幼鱼、也不会惊散鱼群的位置。可以反复试移。';
      g.primary='试放观赏浮标';g.secondary='记录观赏位';g.status=g.pins.length?(g.feedback>0.55?'鱼群在视野里，仍肯穿礁':g.pins[0].x<0?'鱼群躲进了礁缝':'礁头挡住了视线'):'先选一处试看的位置';break;
    case 'lift':g.hint=g.hasNet?'看网角摆动。游到沙地一端，趁松潮提起网角。':'借松潮从沙地一端接住试架，再送到邻礁。';
      g.status=slack?'潮松了 · 可以起吊':'潮绷紧了 · 先选吊点';g.primary=g.stage?'在邻礁落架':g.hasNet?'提起网角':'接起试架';break;
    case 'teach':g.hint=g.stage<2?'把两枚转向标分别放在岔口，你放在哪里，换班船就往哪里走。':'看换班渔户独自走完这一趟。';
      g.primary=g.stage===2?'观察试航':g.stage?'留下第二枚标':'留下第一枚标';g.status='已放 '+g.pins.length+'/2 枚 · '+(g.stage===2?'试航中':'等待布标');break;
    case 'breath':g.hint=g.busy?'在气用完前选一处浮头。船影正上方会挡住去路。':'借侧流去礁背平水，观察涌浪的空档再上浮。';
      g.status='余气 '+Math.ceil(g.air*100)+'% · '+(g.busy?'留意头顶船影':slack?'浪间有空档':'侧浪涌过');g.primary='浮头换气';break;
    case 'whale':g.hint=g.whaleHere?'看鲸尾和水痕朝哪侧移动。先到一处水面，等它再次浮头。':'没有鲸讯。在西侧放一枚漂标，再到东侧等潮水反向，放下另一枚看它们往哪儿漂。';
      g.status=g.whaleHere?(g.subject.y>1?'水痕扩大 · 正在浮头':'尾迹正往'+(g.side>0?'东':'西')+'侧去'):'漂标 '+g.pins.length+'/2 · '+(tide>=0?'水正往东走':'水正往西走');
      g.primary=g.whaleHere?'确认浮头位置':'放下漂标';break;
    case 'trace':g.hint=g.stage===0?'先查老清洁站的水色，再沿气泡追到新站。':g.stage===1?'找到那块有缺口的背甲，认回老海龟。':'回到线索源头，核对船影、排水口或清澈的回流。';
      g.primary=['查看旧站','认背甲','核对原因'][g.stage];g.status=['清洁鱼离开了旧礁头','气泡在侧礁浮起','新站已确认，回查旧站'][g.stage];break;
    case 'harvest':g.hint='这班船只能下一网。先到的小群比较稳，等外缘的大群会错过第一拨。也可放过两拨。';
      g.status=age<6?'第一拨成鱼 · '+Math.ceil(6-age)+' 秒后过湾':'外缘第二拨 · '+(g.seed%3?'成鱼较多':'夹着许多幼鱼');
      g.primary='向这拨鱼下网';g.secondary='两拨都放行';break;
    case 'still':
      g.hint='沿礁自由游动，观察尾队在哪里停留。';g.status='湾内幼鱼 '+g.kept+' 条';g.primary='留下一次观察';
      if(g.season===15){g.hint='在旧礁旁等一会儿。水面亮起来时，可以把这一幕留进村庄记录。';g.primary='记下天光';}
      break;
  }
  if(g.choice==='slow'&&g.kind==='current'){
    g.hint='看浮屑往哪一边走。松开方向让水流带你漂，或喷一下换到另一层。';
    g.primary='收伞喷水';g.secondary='结束这趟漂游';
  }else if(g.choice==='slow'&&g.kind==='school'){
    const nearby=g.fish.filter(f=>bayDistance(f,g)<2.3).length;
    g.hint='带着幼鱼沿礁慢游，停下来等落后的同伴。';g.status='身边的鱼 '+nearby+' / '+g.fish.length;
    g.primary='招呼尾队';g.secondary='结束陪游';
  }
}
function actBayGame(g,secondary=false){
  if(g.result||g.kind==='final')return;
  const index=g.marks.findIndex(p=>bayNear(g,p)), age=g.t-g.since;
  const goNear=()=>bayNotice(g,'先游到现场，再做这个动作。点水中的标记也能游过去。');
  if(g.choice==='slow'&&(g.kind==='current'||g.kind==='school')){
    if(secondary)bayResult(g,'visit',0,g.kind==='current'?'你随回流漂过礁壁，看见上下两层水往不同方向去。':'尾队赶上了，你陪这群鱼沿浅沟游了一段。');
    else if(g.kind==='school')g.gather=2.4;
    else if(g.t-(g.pulseAt??-1)>=0.52){g.pulseAt=g.t;g.vx+=g.facing*3.5;g.vy+=0.55;g.dash=0.17;}
    return;
  }
  switch(g.kind){
    case 'current':
      if(g.t-(g.pulseAt??-1)<0.52)return;
      g.pulseAt=g.t;
      if(index<0){g.vx+=g.facing*3.5;g.vy+=0.55;g.dash=0.17;return;}
      if(!g.stage){
        if((g.reverse||g.finale)&&Math.abs(Math.sin(g.t*0.7+g.seed%5))>0.82){
          g.vx=-g.facing*2;g.vy=0.8;return bayNotice(g,'急流把伞推回侧湾。等两股流相接再试。');
        }
        bayPhase(g,1,g.finale?[[4,2.6,'第二股上升流']]:[[-5.8,-1.9,'西侧礁窝'],[5.8,1.9,'东侧礁窝']]);
        bayNotice(g,g.finale?'这一股带你离开礁底，向右找下一股亮水。':'借到了底流。看前面鱼影聚在哪一侧。');
      }else if(g.finale && Math.abs(Math.sin(g.t*0.7+g.seed%5))>=0.68) bayNotice(g,'两股流还没接上，下一次转潮再喷。');
      else{const rich=g.finale||Math.sign(g.marks[index].x)===g.side;
        bayResult(g,rich?'fish':'thin',rich?1:0.25,g.finale?'你随两股上升流穿过发光的浮游带，在外湾见到天亮。':rich?'礁门外的成鱼正沿这股水通过，渔户有了可用的鱼讯。':'这个出口只有零散幼鱼，盲目加开一班冬捕并不划算。');}
      break;
    case 'watch':
      if(g.finale&&g.stage){
        if(index!==0 || age<4.6 || g.held<1.2)return bayNotice(g,'沿着气泡陪在它身边，等它把头探出水面。');
        bayResult(g,'turtle',0.9,'你认出缺口背甲，陪老海龟从安静的礁面浮上去看天亮。');break;
      }
      if(g.held<1.65)return bayNotice(g,'留两三个身位，停住等清洁鱼围回来。');
      if(g.finale){g.held=0;bayPhase(g,1,[[1.8,2.6,'老龟侧后的气泡']]);}
      else bayResult(g,'turtle',0.9,'背甲边缘有一道旧缺口。你记住了清洁站旁不会惊扰它的位置。');break;
    case 'school':
      if(secondary){if(g.stage)g.dash=0.55;else g.gather=2;return;}
      if(!g.stage){if(index!==0)return goNear();g.gather=2.4;bayPhase(g,1);return;}
      if(index!==1)return goNear();
      if(!g.kept){g.gather=2;return bayNotice(g,'前队刚到，停一停让尾队追上来。');}
      bayResult(g,'school',g.kept/g.fish.length,'你带着 '+g.kept+' / '+g.fish.length+' 条鱼穿过窄口，尾队在礁背重新聚拢。');break;
    case 'racks':
      if(secondary){
        if(!g.edits||age<2.3)return bayNotice(g,'试摆之后，等下一拨幼鱼走过再记录。');
        if(g.season===4&&g.racks.length<2)return bayNotice(g,'再放一座外侧架，看看两处遮蔽能否接起来。');
        const natural=g.season===12&&g.racks.length<g.original.length&&g.sent/g.fish.length>=0.48;
        bayResult(g,natural?'independent':'shelter',g.season===10?g.sent/g.fish.length:g.kept/g.fish.length,
          '现场有 '+g.kept+' 条幼鱼留在湾内，'+g.sent+' 条能接到邻礁。'+(natural?'天然礁已经能接住下一拨。':'村里可以按这次试摆安排养护。'));break;
      }
      if(g.season===12){g.racks=g.edits%2?g.original.map(p=>({...p})):g.original.slice(0,1).map(p=>({...p}));}
      else{const slot=g.season===10?1:g.edits%2;g.racks[slot]=bayPoint(g.x,g.y);}
      g.edits++;g.since=g.t;break;
    case 'viewing':
      if(!secondary){g.pins=[bayPoint(g.x,g.y)];g.feedback=clamp(1-bayDistance(g,g.marks[1])/6,0,1);g.since=g.t;break;}
      if(!g.pins.length||age<1.5)return bayNotice(g,'先放浮标，看看这一拨鱼是否还肯穿礁。');
      bayResult(g,'view',g.feedback,g.feedback>0.55?'从沙地外缘能看见幼鱼穿礁，鱼群没有躲开。':'这个观赏点的视野或距离欠佳，育幼时段仍值得保留。');break;
    case 'lift':
      if(g.stage){if(index!==0)return goNear();g.racks[1]=bayPoint(g.x,g.y);bayResult(g,'shelter',0.8,'你借回流把试架送到邻礁，给幼鱼接出另一处遮蔽。');break;}
      if(index!==0)return bayNotice(g,'活礁那一端会被扫到，改从沙地一侧接住。');
      if(Math.abs(Math.sin(g.t*0.7+g.seed%5))>=0.68)return bayNotice(g,'现在太绷。等网角回落、潮水松开。');
      if(g.hasNet)bayResult(g,'net',0.9,'沙地网角已标明，可以开一道窄口，也可以派船回收整网。');
      else{bayPhase(g,1,[[5,0.5,'邻礁落架点']]);g.racks=[bayPoint(-3,-0.8),bayPoint(5,0.5)];}break;
    case 'teach':
      if(g.stage>=2)return;
      g.pins.push(bayPoint(g.x,g.y));bayPhase(g,g.stage+1);break;
    case 'breath':
      if(index<0)return goNear();
      if(g.busy?Math.abs(g.boat.x-g.x)<3:Math.abs(Math.sin(g.t*0.7+g.seed%5))>0.8)return bayNotice(g,'这一口被挡住了，等下一次空档或改去另一侧。');
      bayResult(g,'surface',0.65+0.35*g.air,'你从'+g.marks[index].label+'换到一口气，记下了可留给海龟的空档。');break;
    case 'whale':
      if(index<0)return goNear();
      if(!g.whaleHere){
        if(index!==g.stage)return bayNotice(g,'依次在两处水面采回水样。');
        const direction=Math.sign(Math.sin(g.t*0.7+g.seed%5))||1;
        if(g.stage && direction===g.pins[0].direction)return bayNotice(g,'等水面浮屑改向，再放东侧的那一枚。');
        g.pins.push({x:g.x,y:g.y,time:g.t,direction});
        if(!g.stage){bayPhase(g,1);break;}
        bayResult(g,'drift',0.8,'两枚漂标汇进同一处回水湾，本次没有看到鲸。');break;
      }
      if(Math.sign(g.marks[index].x)!==g.side||g.subject.y<1)return bayNotice(g,'这里还没有浮头，看水痕的方向和起伏。');
      bayResult(g,'whale',1,'座头鲸在'+g.marks[index].label+'换气，观鲸船有了能远观的位置。');break;
    case 'trace':
      if(g.stage<2){
        if(index!==g.stage)return goNear();
        if(!g.stage)bayPhase(g,1);
        else bayPhase(g,2,[[-5,-1.4,'岸边排水口'],[0,2.3,'航道船影'],[5,-1.1,'清澈回流']]);
        break;
      }
      if(index<0)return goNear();
      if(index!==['outfall','boats','tide'].indexOf(g.cause))return bayNotice(g,'这里没有连续线索，再看水里哪处仍有浑水、船影或回流。');
      bayResult(g,g.cause,0.9,{outfall:'旧站的浑水连到岸边排水口，海龟已换到侧礁。',boats:'每班船经过旧站时海龟都会避开，侧礁还有清洁鱼。',tide:'旧站的水很清。老海龟只是随潮转到了新的清洁站。'}[g.cause]);break;
    case 'harvest':
      if(secondary){bayResult(g,'letgo',0.9,'两拨鱼都留在湾里，尾队沿旧礁归群。');break;}
      if(index!==(age<6?0:1))return bayNotice(g,'船位还不在这拨鱼旁。第一拨过湾后可以等外缘的第二拨。');
      bayResult(g,age<6?'early':'late',age<6?0.68:g.seed%3?1:0.31,age<6?'你选了先到的小群成鱼，为越冬留下一份确定的渔获。':'你等到了外缘第二拨鱼，按实际成鱼比例给出作业信号。');break;
    case 'still':
      if(g.season===15){
        if(g.t<8)return bayNotice(g,'天边刚泛白，鱼群还在慢慢归礁。');
        bayResult(g,'dawn',0,'你留在礁旁，看着海湾自己的鱼群慢慢游进晨光。');
      }else bayResult(g,'visit',0,'你在礁边等了一拨幼鱼，记住它们歇脚的地方。');
      break;
  }
}
