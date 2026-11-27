'use strict';
let baySession = null, bayWorld = null;
const bayHeader=$('bayDive').querySelector('header'), bayNav=$('bayDive').querySelector('nav'), bayControls=$('bayActions').parentElement;
const bayResize=new ResizeObserver(()=>{if(baySession)baySession.labelBounds=null;});
for(const el of [$('bayDive'),bayHeader,bayNav,bayControls])bayResize.observe(el);
const bayVector = new THREE.Vector3(), bayPointer = new THREE.Vector2(), bayRay = new THREE.Raycaster();
const bayPlane = new THREE.Plane(new THREE.Vector3(0,0,1),0);
const BAY_JOB_HELP = {
  route:'一艘普通船沿实测鱼道作业，鱼先供粮，余鱼出售。', moor:'让出清洁站，普通船移泊，内湾保持安静。',
  tour:'调一名向导接外缘小团，计入实际游客、税和踩踏。', selective:'一艘船少捕混群，降低幼鱼误捕。',
  winter:'按两处背风窝的实际鱼讯安排冬捕。',tie:'这一艘船停捕，减少开船费用，缺粮照常进口。',
  shelter:'调出一班船工，按水下试摆的位置留下两座架。',quiet:'让出一个安静时段，减少接待和礁区干扰。',
  lift:'占用一个船班，回收最多一张遗网。',gap:'缩短本班捕捞，先解开一段网口。',
  extend:'用本班船工把遮蔽送到邻礁。',teach:'普通渔户接手，渔民学校能把路线传给轮班人员。',
  stagger:'错开一个船班，少捕一部分，给窄口回游鱼让行。',bridge:'调船工或苗圃人员维护试出的两礁间距。',
  whale:'从实际浮头点远观，占一名向导。',cancelWatch:'少开一班观鲸船，减少游客和空驶开支。',
  sample:'向现有研究站提交这次远洋样本，同季只计一份。',reclaim:'回收外侧架，把养护工作调往邻礁。',
  keep:'由村民保留原湾庇护。首次正式布设需要船工。',filter:'村库支出 6，加开一班处理排水。',
  observe:'登记实际清洁站，供村民以后认回动物。',land:'按你选中的这拨鱼计算一艘船的可用渔获。',
  release:'这一班留港，回游鱼留湾育幼。',lastTour:'把已有的末班观赏改到外湾，按实到游客结算。'
};
function bayPlace(g){
  if(['watch','breath','trace'].includes(g.kind))return '清洁站';
  if(g.kind==='whale')return '远洋礁壁';
  if(g.choice==='slow'&&g.kind==='school')return '浅湾礁门';
  return BAY_SEASONS[g.season][1];
}
function baySite(g){
  const place=bayPlace(g);
  const relocated=['tide','boats','outfall'].includes(V.bay?.station);
  const shallow={x:22,z:-53}, station={x:TURTLE_HOME.x+(relocated?5:0),z:TURTLE_HOME.z+2};
  const site = place==='远洋礁壁'?{x:14,z:140}:place==='清洁站'?station:
    place==='外缘礁壁'?{x:14,z:33}:shallow;
  let floor=topAt(site.x,site.z);
  for(let i=-10;i<=10;i+=2) floor=Math.max(floor,topAt(site.x+i,site.z+1));
  const atSurface=g.kind==='breath'||(g.finale&&g.kind==='watch');
  const y=atSurface?SURFACE-3.45:clamp(floor+6.8,7,SURFACE-6);
  return new THREE.Vector3(site.x,y,site.z);
}
function bayFishMaterial(color){
  return mat({side:THREE.DoubleSide,uniforms:{uFishTint:{value:new THREE.Color(color)}},
    vertexShader:`
      uniform float uTime;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vBody; varying vec3 vTint;
      void main(){
        vBody=position;
        vec3 p=position;
        p.x+=sin(uTime*7.0+instanceMatrix[3].x*0.7+p.z*3.0)*smoothstep(0.15,1.5,-p.z)*0.18;
        mat4 world=modelMatrix*instanceMatrix;
        vec4 point=world*vec4(p,1.0);
        vWorld=point.xyz; vNormal=normalize(mat3(world)*normal);
        vTint=vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vTint=instanceColor;
        #endif
        gl_Position=projectionMatrix*viewMatrix*point;
      }`,
    fragmentShader:COMMON+`
      uniform vec3 uFishTint;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vBody; varying vec3 vTint;
      void main(){
        vec3 n=normalize(vNormal);
        vec3 alb=mix(vec3(0.92,0.97,0.92),uFishTint*vTint,smoothstep(-0.19,0.16,vBody.y));
        float eye=1.0-smoothstep(0.045,0.095,length(vBody.zy-vec2(0.66,0.08)));
        alb=mix(alb,vec3(0.025,0.06,0.08),eye);
        vec3 col=shade(alb,n,vWorld,1.0)+alb*0.13;
        gl_FragColor=vec4(fogged(col,vWorld),1.0);
      }`});
}
function createBayWorld(){
  const group=new THREE.Group(); group.visible=false;scene.add(group);
  const mesh=(geo,material,parent=group)=>{const m=new THREE.Mesh(geo,material);parent.add(m);return m;};
  const paint=(color,glow=0)=>litMat(color,{glow,spec:0.26});
  const warm=paint('#ffd89a',0.24), rope=paint('#c98b58'), mint=paint('#8affe1',0.48);
  const rod=(parent,a,b,r,material)=>{
    const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b), d=end.clone().sub(start);
    const m=mesh(new THREE.CylinderGeometry(r,r,d.length(),6),material,parent);
    m.position.copy(start).add(end).multiplyScalar(0.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return m;
  };
  function rack(){
    const obj=new THREE.Group();
    for(const z of [-0.7,0.7]){
      rod(obj,[-0.85,-0.65,z],[0,0.42,z],0.09,rope);rod(obj,[0,0.42,z],[0.85,-0.65,z],0.09,rope);
      rod(obj,[-0.85,-0.65,z],[0.85,-0.65,z],0.07,rope);
    }
    for(const x of [-0.64,0,0.64])rod(obj,[x,0.42-Math.abs(x)*1.25,-0.7],[x,0.42-Math.abs(x)*1.25,0.7],0.065,warm);
    for(const z of [-0.35,0.03,0.39])rod(obj,[-0.56,-0.3,z],[0.56,-0.3,z],0.055,rope);
    obj.userData.posts=[-0.71,0.71].map(x=>{
      const post=mesh(new THREE.CylinderGeometry(0.055,0.075,1,6),rope,obj);post.position.x=x;return post;
    });
    return obj;
  }
  function buoy(){const b=new THREE.Group();mesh(new THREE.SphereGeometry(0.22,12,8),warm,b);
    rod(b,[0,-0.65,0],[0,0.3,0],0.04,rope);return b;}
  const racks=[rack(),rack()],pins=[buoy(),buoy()];group.add(...racks,...pins);
  const persisted=new THREE.Group(), savedRacks=[rack(),rack(),rack()], savedMark=buoy();persisted.add(...savedRacks,savedMark);scene.add(persisted);
  const inst=new THREE.InstancedMesh(fishBase,bayFishMaterial('#81bcc6'),32);inst.frustumCulled=false;group.add(inst);
  const crossing=new THREE.InstancedMesh(fishBase,bayFishMaterial('#c7ba82'),14);crossing.frustumCulled=false;group.add(crossing);
  const fishPose=new THREE.Object3D(), silver=new THREE.Color('#b9e0ea'), gold=new THREE.Color('#f2c584');
  for(let i=0;i<32;i++)inst.setColorAt(i,i%3===0?gold:silver);
  const jack=mesh(fishBase,paint('#6697ad',0.08));jack.scale.set(1.4,1.6,2.4);
  const hook=new THREE.Group();group.add(hook);
  mesh(new THREE.TorusGeometry(0.32,0.064,6,20,Math.PI*1.6),warm,hook);
  rod(hook,[0.26,0.08,0],[0.26,7.4,0],0.024,rope);
  const flag=mesh(new THREE.TorusGeometry(0.28,0.035,6,22),mint);
  const net=new THREE.Group();group.add(net);
  for(let i=0;i<=8;i++)rod(net,[-3.8+i*0.9,-1.45,0],[-3.4+i*0.9,0.6,0],0.023,rope);
  for(let i=0;i<5;i++)rod(net,[-3.8+i*0.1,-1.45+i*0.5,0],[3.4+i*0.1,-1.45+i*0.5,0],0.023,rope);
  const boat=window.fleetModels.getObjectByName('line').clone(true);
  boat.traverse(o=>{if(o.isMesh)o.material=paint('#405e60');});group.add(boat);
  const boatBox=new THREE.Box3().setFromObject(boat), boatSize=boatBox.getSize(new THREE.Vector3());boat.scale.multiplyScalar(3.5/Math.max(boatSize.x,boatSize.z,0.1));
  const routeBoat=boat.clone(true);persisted.add(routeBoat);
  const shade=mesh(new THREE.CircleGeometry(1,26),new THREE.MeshBasicMaterial({color:'#102e36',transparent:true,opacity:0.28,depthWrite:false}));
  shade.scale.set(2.25,0.75,1);
  const pipe=mesh(new THREE.TorusGeometry(0.45,0.12,8,20),paint('#6b7974'));
  const traceGeo=new THREE.BufferGeometry(), positions=new Float32Array(90*3);
  traceGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const drift=new THREE.Points(traceGeo,new THREE.PointsMaterial({color:'#b9ffed',size:0.108,transparent:true,opacity:0.85,depthWrite:false}));drift.frustumCulled=false;group.add(drift);
  const scarMark=mesh(new THREE.TorusGeometry(0.22,0.042,5,14,2.45),warm,turtle);
  scarMark.position.set(-0.76,0.32,-0.65);scarMark.rotation.x=-0.9;
  return {group,racks,pins,inst,crossing,fishPose,jack,hook,flag,net,boat,shade,pipe,drift,positions,persisted,savedRacks,savedMark,routeBoat};
}
function placeBayRack(r,p,o){
  r.visible=!!p;
  if(!p)return;
  const z=p.z??-0.25;
  if(r.position.x===p.x && r.position.y===p.y && r.position.z===z && r.userData.siteX===o.x && r.userData.siteZ===o.z)return;
  r.position.set(p.x,p.y,z);r.userData.siteX=o.x;r.userData.siteZ=o.z;
  r.userData.posts.forEach(post=>{
    const length=Math.max(0.25,o.y+p.y-0.4-topAt(o.x+p.x+post.position.x,o.z+z));
    post.scale.y=length;post.position.y=-0.4-length/2;
  });
}
function syncBayLandmarks(){
  if(!bayWorld)return;
  const w=bayWorld,mem=V.bay;
  w.persisted.visible=!!mem;
  if(!w.persisted.visible)return;
  if(!w.savedOrigin)w.savedOrigin=baySite({season:4,kind:'racks'});
  w.persisted.position.copy(w.savedOrigin);
  const preview=baySession&&Math.abs(baySession.origin.z-w.savedOrigin.z)<10;
  for(let i=0;i<2;i++)placeBayRack(w.savedRacks[i],preview?null:mem.racks?.[i],w.savedOrigin);
  let outpost=mem.outpost||(mem.redeployed?{x:10,y:-1}:null);
  if(outpost?.outer){
    if(!w.outerOrigin)w.outerOrigin=baySite({season:6,kind:'lift'});
    const offset=w.outerOrigin, home=w.savedOrigin;
    outpost={x:offset.x-home.x+outpost.x,y:offset.y-home.y+outpost.y,z:offset.z-home.z-0.25};
  }
  placeBayRack(w.savedRacks[2],outpost,w.savedOrigin);
  w.savedMark.visible=!!mem.route;w.savedMark.position.set(5,1.9,0.2);
  w.routeBoat.visible=!!mem.routeOn && V.boats>0 && V.pol.fish!=='ban' && (V.pol.fish!=='quota'||eco.fish>0.42) && !baySession;
  if(w.routeBoat.visible){
    const angle=time*0.18;
    w.routeBoat.position.set(3+Math.sin(angle)*9,SURFACE-w.savedOrigin.y-0.35,5+Math.cos(angle)*2);
    w.routeBoat.rotation.y=Math.atan2(9*Math.cos(angle),-2*Math.sin(angle));
  }
}
function renderBayShore(){
  const box=$('bayShore'), S=V.sea;
  box.hidden=!S||state!=='plan'||vTab!=='pol'||!BAY_SEASONS[S.season];
  if(box.hidden)return;
  const row=BAY_SEASONS[S.season], finding=S.bayFinding, selected=S.bayPlan||'';
  const title=document.createElement('b');title.textContent=gameText('海湾 · '+row[0]);
  const desc=document.createElement('p');desc.textContent=gameText(finding?finding.note:row[1]+'有新动静，潜入后能亲手试一趟。');
  box.replaceChildren(title,desc);
  if(finding){
    const jobs=bayJobIds(V,finding);
    for(const job of [...jobs,'']){
      const btn=document.createElement('button'),why=job?bayJobBlock(job,V,eco,finding):'';
      btn.type='button';btn.dataset.bayJob=job;btn.disabled=!!why;btn.setAttribute('aria-pressed',String(!why && selected===job));
      btn.textContent=gameText((job?BAY_JOBS[job]:'维持原安排')+(why?' · '+why:''));
      btn.title=gameText(why||BAY_JOB_HELP[job]||'沿用日常生产'); btn.onclick=()=>{
        if(state!=='plan'||V.sea!==S)return;
        S.bayPlan=job;S.bayApproved=job?{...finding,points:(finding.points||[]).map(p=>({...p}))}:null;
        chime(2);renderVillageUI();
      };
      box.append(btn);
    }
    const block=selected?bayJobBlock(selected,V,eco,S.bayApproved||finding):'';
    if(selected){const small=document.createElement('small');small.textContent=gameText('已确认 · '+BAY_JOBS[selected]+'。'+(block||BAY_JOB_HELP[selected]));box.append(small);}
    if(selected && S.bayApproved && JSON.stringify(S.bayApproved)!==JSON.stringify(finding)){
      const note=document.createElement('small');note.textContent=gameText('目前执行上次确认的安排。再次选择作业可采用这次试潜的结果。');box.append(note);
    }
    if(selected&&!block){
      const known=seaView(S,0), apply=simulateSeason(eco,{...V,sea:known},pendingHaul);
      const base=simulateSeason(eco,{...V,sea:{...known,bayPlan:''}},pendingHaul);
      const forecast=document.createElement('small');forecast.textContent=gameText('与沿用原安排相比，预计渔获 '+signed1(apply.r.catchT-base.r.catchT)+' 吨，季末村库 '+signed1(apply.v.money-base.v.money)+'。');
      box.append(forecast);
    }
  }
  if(V.bay?.route||V.bay?.quietKnown){
    const ops=document.createElement('div');ops.className='bay-routine';
    for(const [key,label,exists] of [['routeOn','外缘轮班',V.bay.route],['quiet','安静时段',V.bay.quiet||V.bay.quietKnown]]){
      if(!exists)continue;
      const btn=document.createElement('button');btn.textContent=gameText(label+' '+(V.bay[key]?'· 已启用':'· 已暂停'));
      btn.onclick=()=>{V.bay[key]=!V.bay[key];renderVillageUI();};ops.append(btn);
    }
    box.append(ops);
  }
}
function bayReportHTML(r){
  const b=r.bayDive, m=r.bayRoutine;
  if(!b&&!m)return '';
  const section=document.createElement('section');section.className='bay-report';
  const line=(tag,content)=>{const el=document.createElement(tag);el.textContent=gameText(content);section.append(el);};
  line('b',b?'海湾 · '+b.title:'海湾 · 沿用往季安排');
  if(b){
    line('p',b.note);
    const actual=['渔获 '+signed1(b.catch)+' 吨','村库 '+signed1(b.cash)];
    if(b.guests)actual.push('游客 '+signed1(b.guests)+' 人次');
    if(b.imports)actual.push('进口开支 '+signed1(b.imports));
    if(b.fish)actual.push('鱼群 '+signed1(b.fish)+' 个百分点');
    if(b.waste)actual.push('入海污染 '+signed1(b.waste)+' 个百分点');
    if(b.recovered)actual.push('清除的遗网相当于 '+r1(b.recovered)+' 张');
    line('small',b.job?BAY_JOBS[b.job]+'。相较沿用原安排，'+actual.join('，')+'。':'村里沿用原安排。本次观察已写入游玩记录。');
  }
  if(m){
    const effects=[];
    if(m.route)effects.push(m.active?'一艘普通船在用实测路线':'外缘路线已记下，这季没有船走这条线');
    if(m.trained)effects.push('已教会 '+m.trained+' 个船班');
    if(m.racks)effects.push('原湾留架 '+m.racks+' 座');
    if(m.outpost||m.redeployed)effects.push(m.redeployed?'一座架已调去邻礁':'邻礁也有庇护架');
    if(m.quiet)effects.push('清洁站保留安静时段');
    if(m.recruit>=0.0005)effects.push('往季育幼为本季补回 '+r1(m.recruit*100)+' 个百分点鱼群');
    if(!b&&m.catch)effects.push('指定船较通常作业的渔获变化 '+signed1(m.catch)+' 吨');
    if(effects.length)line('small',effects.join('，')+'。');
  }
  return section.outerHTML;
}
function updateBayInvite(){
  const btn=$('bayInvite'), enabled=mode==='dive'&&state==='freedive'&&!baySession&&!rising&&BAY_SEASONS[V.sea?.season];
  btn.hidden=!enabled;
  if(enabled){queueBayPrograms();const label=gameText('去现场 · '+BAY_SEASONS[V.sea.season][0]);if(btn.textContent!==label)btn.textContent=label;}
}
function startBayEncounter(choice){
  if(mode!=='dive'||state!=='freedive'||rising||paused||!BAY_SEASONS[V.sea?.season])return;
  if(baySession)leaveBayEncounter();
  if(document.pointerLockElement)document.exitPointerLock();
  if(!bayWorld)bayWorld=createBayWorld();
  const game=createBayGame(V,eco,V.sea,choice);
  baySession={game,origin:baySite(game),sea:V.sea,marks:null,actionsKey:'',noted:false};
  bayWorld.group.position.copy(baySession.origin);bayWorld.group.visible=true;bayWorld.persisted.visible=false;
  const k=game.form==='rig'?'manta':game.form;
  becomeAvatar(k==='school'?{kind:k,sc:sBait,name:'沙丁鱼群'}:{kind:k},true);
  bayStep(game,0.001);
  document.body.classList.add('bay-active');$('bayDive').hidden=false;$('bayInvite').hidden=true;
  $('bayPlace').textContent=gameText(seasonName(game.season)+' / '+bayPlace(game));
  $('bayTitle').textContent=gameText(game.title);
  if(game.season===15)nightT=0.96;
  updateBayPanel();
}
function leaveBayEncounter(){
  if(!baySession){$('bayInvite').hidden=true;return;}
  const g=baySession.game;
  if(g.form==='rig')manta.visible=true;
  if(g.kind==='whale')whale.visible=whaleCruise;
  if(g.kind==='watch'||g.kind==='trace')turtle.position.copy(ENT.turtle.st.pos);
  bayWorld.group.visible=false;baySession=null;nightT=dioNight;
  document.body.classList.remove('bay-active');$('bayDive').hidden=true;$('bayTargets').replaceChildren();
  $('bayInvite').hidden=true;lookDX=lookDY=0;aimYaw=player.yaw;swapT=0;
  syncBayLandmarks();
}
function storeBayFinding(){
  const s=baySession,g=s.game;
  if(!g.result||s.noted)return;
  s.noted=true;chime(4);
  if((!g.practice||g.result.sign==='dawn') && s.sea===V.sea){
    s.sea.bayFinding=g.result;
    if(returnTo==='plan'){vTab='pol';selectShoreView('plan');$('vBody').scrollTop=0;}
  }
}
function bayActionButton(label,id,fn){
  const b=document.createElement('button');b.type='button';b.id=id;b.textContent=gameText(label);b.onclick=fn;return b;
}
function updateBayPanel(){
  const s=baySession,g=s.game;storeBayFinding();
  const text=(id,source)=>{const el=$(id),value=gameText(source);if(el.textContent!==value)el.textContent=value;};
  const finalMenu=g.kind==='final';
  text('bayHint',g.result?g.result.note:finalMenu?'大潮已经入湾。选一件你最想再做的事。':g.hint);
  text('bayStatus',g.result?(g.result.sign==='dawn'?'晨光中的海湾已经留进记录。':g.practice?'这次自由观察已经结束。':'现场观察已记下，可以返岸安排本季作业。'):
    g.t<g.messageUntil?g.message:g.status);
  text('bayKeys',g.result||finalMenu?'':'点水面或标记移动 · WASD / 方向键游动 · 空格行动 · E 返岸');
  const key=[g.kind,!!g.result,g.primary,g.secondary].join('/');
  if(key!==s.actionsKey){
    const box=$('bayActions');box.replaceChildren();s.actionsKey=key;
    if(finalMenu){
      for(const [k,l] of [['jelly','水母 · 接上升流'],['school','鱼群 · 归礁'],['turtle','海龟 · 看日出']])
        box.append(bayActionButton(l,'bay-'+k,()=>startBayEncounter(k)));
      box.append(bayActionButton('留在礁头等天亮','baySlow',()=>startBayEncounter('slow')));
    }else if(g.result){
      box.append(bayActionButton(g.practice?'返回岸上':'返岸安排','bayFinish',surfaceUp),bayActionButton('再试一趟','bayRetry',()=>startBayEncounter(g.choice)));
      if(g.finale)box.append(bayActionButton('换一个结尾','bayOther',()=>startBayEncounter()));
    }else{
      box.append(bayActionButton(g.primary,'bayAct',()=>{actBayGame(g);updateBayPanel();}));
      if(g.secondary) box.append(bayActionButton(g.secondary,'bayAlt',()=>{actBayGame(g,true);updateBayPanel();}));
    }
    if(!g.practice&&!finalMenu)box.append(bayActionButton(BAY_SEASONS[g.season][3],'baySlow',()=>startBayEncounter('slow')));
    if(g.season===0&&!g.practice&&!g.result)box.append(bayActionButton('浅湾鱼群脱围','baySchool',()=>startBayEncounter('openSchool')));
    if(g.practice)box.append(bayActionButton('回本季现场','bayMain',()=>startBayEncounter()));
  }
  const marks=g.result?null:g.marks;
  if(marks!==s.marks){
    const box=$('bayTargets');box.replaceChildren();s.marks=marks;s.labelBounds=null;
    (marks||[]).forEach((p,i)=>{const b=bayActionButton(p.label,'bayTarget'+i,()=>{g.target=p;});b.className='bay-point';box.append(b);});
  }
}
function updateBayFrame(dt){
  const s=baySession,g=s.game,w=bayWorld;
  window.__diving=false;lookDX=lookDY=0;
  const ix=Number(!!(keys.KeyD||keys.ArrowRight))-Number(!!(keys.KeyA||keys.ArrowLeft));
  const iy=Number(!!(keys.KeyW||keys.ArrowUp))-Number(!!(keys.KeyS||keys.ArrowDown));
  bayStep(g,dt,{x:ix,y:iy});
  const o=s.origin;
  player.pos.set(o.x+g.x,o.y+g.y,o.z);player.yaw=g.facing*Math.PI/2;player.pitch=clamp(g.vy*0.075,-0.45,0.45);
  player.fwd.set(g.facing,0,0);player.speed=Math.hypot(g.vx,g.vy);
  if(g.form==='jelly'){const st=ENT.jelly.st;st.axis.set(g.facing*0.6,0.8,0).normalize();st.pulseT=g.t-(g.pulseAt??-1);}
  if(g.season===15)nightT=g.result?0.04:g.kind==='still'?lerp(0.96,0.04,clamp((g.t-2)/8,0,1)):0.96;
  if(g.form==='turtle')player.air=g.air;
  simulateOcean(dt,false);seaRoot.visible=false;
  manta.visible=g.form!=='rig';
  if(g.form==='school')bait.mesh.visible=false;
  if(g.kind==='watch'||g.kind==='trace'){
    turtle.position.set(o.x+g.subject.x,o.y+g.subject.y,o.z-0.5);turtle.rotation.y=g.side*1.3;
  }
  if(g.kind==='whale'&&g.whaleHere){
    whale.visible=true;whale.position.set(o.x+g.subject.x*2,o.y+g.subject.y-0.5,o.z-15);whale.rotation.y=g.side*1.38;
  }
  w.hook.visible=g.form==='rig';w.hook.position.set(g.x,g.y,0.25);
  w.flag.visible=g.kind!=='final'&&!g.result;w.flag.position.set(g.x,g.y-0.75,0.15);
  const localRacks=g.kind==='lift'||['浅湾礁门','育幼浅湾'].includes(bayPlace(g));
  w.racks.forEach((r,i)=>placeBayRack(r,localRacks?g.racks[i]:null,o));
  w.pins.forEach((p,i)=>{
    const q=g.pins[i];p.visible=!!q;if(!q)return;
    const drift=g.kind==='whale' ? 1-Math.exp(-(g.t-q.time)*0.25) : 0;
    p.position.set(lerp(q.x,1.2+i*0.48,drift),q.y+Math.sin(g.t*1.6+i)*0.12,0.1);
  });
  w.net.visible=g.kind==='lift'&&g.hasNet;w.net.rotation.z=Math.sin(g.t*0.7+g.seed%5)*0.14;
  w.net.position.y=g.result?0.6:0;
  w.boat.visible=g.kind==='teach'||((g.kind==='breath'||(g.kind==='school'&&(g.season===8||g.finale)))&&g.busy)||(g.kind==='trace'&&g.cause==='boats');
  w.boat.position.set(g.boat.x,SURFACE-o.y-0.35,g.kind==='teach'?-0.3+g.boat.y:-0.3);w.boat.rotation.y=g.kind==='teach'?1.55:Math.cos(g.t*0.6)>0?1.55:-1.55;
  w.shade.visible=w.boat.visible;w.shade.position.set(g.boat.x,g.boat.y,-0.5);
  w.pipe.visible=g.kind==='trace'&&g.stage===2;w.pipe.position.set(-5,-1.4,-0.3);
  w.jack.visible=g.kind==='school'&&g.season!==8&&!g.finale&&g.choice!=='slow';w.jack.position.set(g.hazard.x,g.hazard.y,0.2);w.jack.rotation.y=Math.cos(g.t*0.84)>0?1.56:-1.56;
  w.inst.count=g.kind==='harvest'&&g.t-g.since<6?Math.ceil(g.fish.length*0.44):g.fish.length;g.fish.forEach((f,i)=>{
    const dummy=w.fishPose;dummy.position.set(f.x,f.y,f.z);
    dummy.rotation.set(0,(g.form==='school'?g.facing:Math.cos(g.t*0.78+i*0.17)>0?1:-1)*1.48,Math.sin(g.t+i)*0.1);
    const juvenile=g.kind==='harvest'&&g.t-g.since>=6&&g.seed%3===0&&i%4!==0;
    dummy.scale.setScalar(juvenile?0.23:f.large?0.55:0.32);dummy.updateMatrix();w.inst.setMatrixAt(i,dummy.matrix);
  });w.inst.instanceMatrix.needsUpdate=true;
  w.crossing.visible=g.kind==='school'&&g.season===8&&!g.busy;
  if(w.crossing.visible){for(let i=0;i<w.crossing.count;i++){
    const d=w.fishPose;d.position.set(g.hazard.x+Math.sin(i*2.4)*1.5,g.hazard.y+Math.cos(i*2.4)*0.7,-0.08*i);
    d.rotation.set(0,Math.cos(g.t*0.84)>0?1.55:-1.55,0);d.scale.setScalar(0.45);d.updateMatrix();w.crossing.setMatrixAt(i,d.matrix);
  }w.crossing.instanceMatrix.needsUpdate=true;}
  const plume=g.kind==='trace'&&g.stage===2;
  const source=plume?g.marks[['outfall','boats','tide'].indexOf(g.cause)]:null;
  w.drift.material.color.set(plume&&g.cause==='outfall'?'#bbad71':g.finale?'#9cfff3':'#b9eadd');
  for(let i=0;i<90;i++){
    const layer=(i%2?1:-1)*(1.55+(i%9)*0.19);
    const direction=bayFlow(g,layer)>0?1:-1;
    const x=((i*2.399+g.t*direction*1.35)%21+21)%21-10.5;
    w.positions[i*3]=source?source.x+Math.sin(i*1.3+g.t)*0.5+(i%8)*0.13:x;
    w.positions[i*3+1]=source?source.y+((i*0.31+g.t*0.5)%2.2):layer+Math.sin(i+g.t)*0.15;
    w.positions[i*3+2]=-0.6+Math.sin(i*2.4)*0.8;
    if(g.finale&&g.kind==='current'&&i>=44){
      const cx=i%2?4:-3, lift=bayLift(g,cx);
      w.positions[i*3]=cx+Math.sin(i*2.4+g.t)*0.55;
      w.positions[i*3+1]=((i*0.27+g.t*0.6+(i%2?Math.sin(g.t*0.7-1.65+g.seed%5):Math.sin(g.t*0.7+g.seed%5))*0.77)%8+8)%8-4;
      w.positions[i*3+2]-=(2.1-lift)*0.45;
    }else if(g.finale&&g.kind==='watch'&&g.stage===1&&i%2===0){
      w.positions[i*3]=g.subject.x-0.65+Math.sin(i*2.4+g.t)*0.45;
      w.positions[i*3+1]=g.subject.y+((i*0.32+g.t*0.8)%2.2);
    }
  }
  w.drift.geometry.attributes.position.needsUpdate=true;
  const dist=Math.max(17.5,12.4/(Math.tan(THREE.MathUtils.degToRad(24))*camera.aspect));
  camLook.copy(o);camPos.set(o.x,o.y+2.15,o.z+dist);camera.position.copy(camPos);camera.lookAt(camLook);camera.fov=48;
  placeOceanCamera();updateShadowCam(o);
  updateBayPanel();
  const labels=$('bayTargets').children;
  if(labels.length && !s.labelBounds){
    s.labelBounds={top:[bayHeader.getBoundingClientRect(),bayNav.getBoundingClientRect()],bottom:bayControls.getBoundingClientRect(),
      sizes:Array.from(labels,el=>({half:el.offsetWidth/2,height:el.offsetHeight}))};
  }
  for(let i=0;i<labels.length;i++){
    const p=g.marks[i];bayVector.set(o.x+p.x,o.y+p.y-0.65,o.z).project(camera);
    const bounds=s.labelBounds,{half,height}=bounds.sizes[i];
    const x=clamp((bayVector.x+1)*innerWidth/2,half+5,innerWidth-half-5);
    const crosses=rect=>x+half>rect.left && x-half<rect.right;
    const ceiling=Math.max(8,...bounds.top.filter(crosses).map(rect=>rect.bottom+8));
    const floor=(crosses(bounds.bottom)?bounds.bottom.top:innerHeight)-height-8;
    labels[i].style.left=x+'px';labels[i].style.top=clamp((1-bayVector.y)*innerHeight/2,ceiling,floor)+'px';
    labels[i].classList.toggle('near',bayNear(g,p));
  }
  renderFrame(false, true);
}
$('bayInvite').onclick=()=>startBayEncounter();
$('bayFree').onclick=()=>{
  leaveBayEncounter();updateBayInvite();showFreeDiveTip();
  $('surfaceBtn').classList.add('on');
};
$('bayReturn').onclick=surfaceUp;
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!baySession||paused)return;
  const s=baySession;
  bayPointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
  bayRay.setFromCamera(bayPointer,camera);bayPlane.constant=-s.origin.z;
  if(bayRay.ray.intersectPlane(bayPlane,bayVector)){
    s.game.target=bayPoint(clamp(bayVector.x-s.origin.x,-9.4,9.4),clamp(bayVector.y-s.origin.y,-3.8,3.8));
  }
});
addEventListener('keydown',e=>{
  if(!baySession||paused||e.repeat||e.code!=='Space')return;
  e.preventDefault();
  const button=e.target.closest?.('#bayDive button:focus-visible');
  if(button && !button.classList.contains('bay-point'))button.click();
  else {actBayGame(baySession.game);updateBayPanel();}
});
