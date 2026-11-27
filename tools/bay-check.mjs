// Run with node --test tools/bay-check.mjs. The driver swims and uses the same actions as the sea view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = name => readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x)), lerp=(a,b,t)=>a+(b-a)*t;
const { V:initial, eco:ocean, rollSea, simulateSeason, createBayGame, bayStep, actBayGame, bayJobBlock } =
  new Function('rng','clamp','lerp',[source('state.js'),source('model.js'),source('bay-play.js'),
    'return {V,eco,rollSea,simulateSeason,createBayGame,bayStep,actBayGame,bayJobBlock};'].join('\n'))(()=>0.41,clamp,lerp);
function fixture(season, e={}, v={}) {
  const water={...ocean,...e}, village={...structuredClone(initial),...v,season,pol:{...initial.pol,...v.pol}};
  village.sea=rollSea(water,village,season,()=>0.41);
  return {v:village,e:water};
}
function observation(b,job,f={}){
  b.v.sea.bayFinding={season:b.v.season,title:'现场',note:'观察',quality:1,sign:'fish',points:[],...f};
  b.v.sea.bayPlan=job;
}
const run = b => simulateSeason(b.e,b.v,0);
const advance=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds*30);i++)bayStep(g,1/30);};
function approach(g,index){
  const goal=g.marks[index];assert.ok(goal,'missing target '+index);g.target=goal;
  for(let i=0;i<750;i++){
    if(Math.hypot(g.x-goal.x,g.y-goal.y)<0.9)return;
    bayStep(g,1/30);
  }
  assert.fail('Could not swim to '+goal.label+' in '+g.title);
}
function interact(g,id){approach(g,id);actBayGame(g);advance(g,0.1);}
function untilAction(g,ready){
  for(let i=0;i<100;i++){if(ready())return;actBayGame(g);advance(g,0.16);}
  assert.fail(g.title+' '+g.hint+' '+g.message);
}
function play(b,choice){
  const g=createBayGame(b.v,b.e,b.v.sea,choice);
  advance(g,0.01);
  switch(g.kind){
    case 'current':
      approach(g,0);untilAction(g,()=>g.stage===1);approach(g,g.finale?0:g.side>0?1:0);untilAction(g,()=>g.result);break;
    case 'watch':
      approach(g,0);
      if(g.finale){untilAction(g,()=>g.stage===1);approach(g,0);}
      untilAction(g,()=>g.result);break;
    case 'school':interact(g,0);approach(g,1);advance(g,1);untilAction(g,()=>g.result);break;
    case 'racks':
      if(g.season===4){interact(g,0);interact(g,1);}
      else if(g.season===10)interact(g,2);else actBayGame(g);
      advance(g,8.3);actBayGame(g,true);break;
    case 'viewing':interact(g,1);advance(g,3);actBayGame(g,true);break;
    case 'lift':approach(g,0);untilAction(g,()=>g.stage===1||g.result);if(!g.result)interact(g,0);break;
    case 'teach':interact(g,0);interact(g,1);advance(g,7);break;
    case 'breath':approach(g,1);untilAction(g,()=>g.result);break;
    case 'whale':
      if(g.whaleHere){approach(g,g.side>0?1:0);untilAction(g,()=>g.result);}
      else{interact(g,0);approach(g,1);untilAction(g,()=>g.result);assert.equal(g.pins.length,2);assert.notEqual(g.pins[0].direction,g.pins[1].direction);}break;
    case 'trace':interact(g,0);interact(g,1);interact(g,['outfall','boats','tide'].indexOf(g.cause));break;
    case 'harvest':interact(g,0);break;
  }
  assert.ok(g.result,g.title+' failed to complete');assert.equal(g.result.season,b.v.season);
  assert.ok(g.result.quality>=0&&g.result.quality<=1);
  return g;
}
test('sixteen live encounters and all three independent final dives',()=>{
  for(let n=0;n<16;n++)for(const choice of n===15?['school','turtle','jelly']:[undefined])play(fixture(n),choice);
});
test('quiet water, a real net, an empty offshore area and three possible turtle trails',()=>{
  const quiet=play(fixture(8,{},{pol:{fish:'ban',tour:'closed'}}));assert.equal(quiet.busy,false);
  assert.equal(play(fixture(6,{ghost:0.6})).result.sign,'net');
  assert.equal(play(fixture(6,{ghost:0})).result.sign,'shelter');
  assert.equal(play(fixture(11,{pelagic:0.15})).result.sign,'drift');
  assert.equal(play(fixture(13,{nutr:0.21})).result.sign,'outfall');
  assert.equal(play(fixture(13,{nutr:0.03},{shops:1,pol:{tour:'open'}})).result.sign,'boats');
  assert.equal(play(fixture(13,{nutr:0.03})).result.sign,'tide');
});
test('first spring uses one boat, old saves work, forecast is pure and training carries forward',()=>{
  const old=fixture(0);delete old.v.sea;
  const initialSeason=run(old);assert.equal(initialSeason.r.catchT,6);
  const b=fixture(0);observation(b,'route');const before=JSON.stringify(b);
  const first=run(b);assert.ok(Math.abs(first.r.catchT-6.6)<1e-8);assert.equal(JSON.stringify(b),before);
  assert.deepEqual(first,run(b));
  const next=fixture(1,{}, {bay:first.v.bay});const normal=fixture(1);assert.ok(run(next).r.catchT>run(normal).r.catchT);
  next.v.bay.routeOn=false;assert.equal(run(next).r.catchT,run(normal).r.catchT);
  const teach=fixture(7,{}, {school:1});observation(teach,'teach');assert.equal(run(teach).v.bay.trained,2);
});
test('policies, missing infrastructure and early investigation cannot grant out-of-season income',()=>{
  for(const [season,job,sign] of [[0,'route','fish'],[5,'tour','view'],[11,'whale','whale'],[11,'sample','drift']]){
    const b=fixture(season,{},{pol:{fish:'ban',tour:'closed'}});observation(b,job,{sign});
    assert.ok(bayJobBlock(job,b.v,b.e,b.v.sea.bayFinding));
    const rejected=run(b);b.v.sea.bayPlan='';const ordinary=run(b);assert.equal(rejected.v.money,ordinary.v.money);
  }
  const b=fixture(1);observation(b,'route',{season:0});b.v.sea.season=0;assert.equal(run(b).r.bayJob,'');
  const depleted=fixture(0,{fish:0.3});observation(depleted,'route');assert.equal(run(depleted).r.catchT,0);
});
test('a confirmed layout survives a practice dive, save reload, forecasts and a later removal trial',()=>{
  const b=fixture(4);const g=play(b);observation(b,'shelter',g.result);
  b.v.sea.bayApproved=structuredClone(g.result);b.v.sea.bayFinding.points=[{x:8,y:1}];
  const s=run(JSON.parse(JSON.stringify(b)));assert.deepEqual(s.v.bay.racks,b.v.sea.bayApproved.points);assert.equal(s.v.bay.racks.length,2);
  assert.ok(g.kept+g.sent<=g.fish.length);
  const healthy=fixture(12,{}, {bay:{...s.v.bay,young:0.9}});const natural=play(healthy);
  assert.equal(natural.result.sign,'independent');
  observation(healthy,'reclaim',natural.result);assert.equal(run(healthy).v.bay.racks.length,1);
  const poor=fixture(12,{coral:0.15,clar:0.22},{bay:{...s.v.bay,young:0.1}});const weak=play(poor);
  assert.equal(weak.result.sign,'shelter');assert.ok(bayJobBlock('reclaim',poor.v,poor.e,weak.result));
});
test('net removal and distant-water sample are credited exactly once; guesses alone grant neither',()=>{
  const b=fixture(6,{ghost:0.5});observation(b,'lift',{sign:'net'});const safe=run(b);
  b.v.sea.bayPlan='';const norm=run(b);assert.ok(safe.e.ghost<norm.e.ghost);assert.ok(safe.r.catchT<norm.r.catchT);
  b.e.ghost=0;observation(b,'lift',{sign:'net'});assert.equal(run(b).r.bayJob,'');
  const sea=fixture(11,{}, {research:1});observation(sea,'sample',{sign:'drift'});
  const sampled=run(sea).r.resInc;sea.v.sea.seen.pel=true;assert.equal(run(sea).r.resInc,sampled);
});
test('an offshore shelter preserves the two original racks and the confirmed turtle station',()=>{
  const racks=[{x:-4.1,y:0.3},{x:2.5,y:-1.4}];
  const b=fixture(6,{ghost:0},{bay:{racks,young:0.25}}), trial=play(b);
  observation(b,'extend',trial.result);
  const result=run(b);
  assert.deepEqual(result.v.bay.racks,racks);
  assert.deepEqual(result.v.bay.outpost,{...trial.result.points.at(-1),outer:true});
  assert.equal(result.r.bayRoutine.outpost,true);assert.ok(result.r.bayRoutine.recruit>0);
  const turtle=fixture(13,{nutr:0.23},{bay:result.v.bay,pol:{waste:'dump'}}), trail=play(turtle);
  observation(turtle,'filter',trail.result);const treated=run(turtle);turtle.v.sea.bayPlan='';
  assert.equal(treated.v.bay.station,'outfall');assert.ok(treated.r.nutr<run(turtle).r.nutr);
  assert.equal(run(turtle).v.money-treated.v.money,6);
});
test('practice keeps its chosen form, and a booking survives returning with a different finding',()=>{
  const first=fixture(0), school=play(first,'openSchool');
  assert.equal(createBayGame(first.v,first.e,first.v.sea,school.choice).kind,'school');
  const harvest=fixture(14);const net=play(harvest);
  observation(harvest,'land',net.result);harvest.v.sea.bayApproved=structuredClone(net.result);
  const agreed=run(harvest);
  const released=createBayGame(harvest.v,harvest.e,harvest.v.sea);actBayGame(released,true);
  assert.equal(released.result.sign,'letgo');harvest.v.sea.bayFinding=released.result;
  assert.equal(run(harvest).r.bayJob,'land');assert.equal(run(harvest).v.money,agreed.v.money);
  harvest.v.sea.bayApproved=structuredClone(released.result);harvest.v.sea.bayPlan='release';
  assert.ok(run(harvest).r.catchT<agreed.r.catchT);assert.ok(run(harvest).v.bay.young>agreed.v.bay.young);
});
test('each quarter offers a slower dive, including staying at the reef for dawn',()=>{
  for(let n=0;n<16;n++){
    const b=fixture(n),g=createBayGame(b.v,b.e,b.v.sea,'slow');
    assert.ok(g.practice);
    if(g.kind==='watch'){approach(g,0);untilAction(g,()=>g.result);}
    else if(g.kind==='still'){advance(g,9);actBayGame(g);}
    else{advance(g,1);actBayGame(g);advance(g,1);actBayGame(g,true);}
    assert.ok(g.result,'slow dive '+(n+1));
    assert.ok(!b.v.sea.bayPlan);
    if(n===15){assert.equal(g.result.sign,'dawn');observation(b,'lastTour',g.result);assert.equal(run(b).r.bayJob,'');}
  }
});
