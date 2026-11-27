'use strict';

// Translate at the UI boundary. The simulation, the survey evidence and old save files
// keep their original values, so changing language never changes an outcome.
const GameLocale = (() => {
  const preference = 'bts.language.v1';
  let language = 'en';
  try { if (localStorage.getItem(preference) === 'zh-CN') language = 'zh-CN'; } catch {}
  const hasChinese = /[\p{Script=Han}，。；：、（）「」【】]/u;
  const cache = new Map();
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const phrases = new RegExp(Object.keys(EN_MESSAGES).sort((a,b) => b.length-a.length).map(source => {
    const start = /^\d/.test(source) ? '(?<![\\d.])' : '';
    const end = /\d$/.test(source) ? '(?![\\d.])' : '';
    return start+escape(source)+end;
  }).join('|'), 'gu');
  const attributes = ['title','aria-label','data-tip','placeholder','alt'];
  const originalText = [], originalAttrs = [];
  const clean = s => s.trim().replace(/\s+/g, ' ');

  // # is a signed number and @ is a phrase. Fields in the English line can be
  // reordered. The same formats also translate observations in imported journals.
  const formats = [
    ['第 # 年 · @','Year $1 · $2'], ['第#年','Year $1'], ['第 # 天','Day $1'],
    ['每季约 #。入海污水减到 40%。','About $1 per season. Only 40% of sewage reaches the sea.'],
    ['每季约 #。入海污水减到 10%，旧渔网回收。','About $1 per season. Only 10% of sewage reaches the sea. Old nets are recycled.'],
    ['存鱼 # 吨。每季村民吃 # 吨（# 人 × 0.12），最多留 # 吨过季，其余按 #/吨 卖出。留下的鱼每季坏 #%@。不够吃时村库按 #/吨 进口。','Fish in storage: $1 t. Each season $3 residents eat $2 t at 0.12 t each. Store up to $4 t and sell any surplus for $5 per tonne. Spoilage is $6% $7. Food imports cost $8 per tonne.'],
    ['锁定 1 季','Locked for one season'], ['锁定 # 季','Locked for $1 seasons'], ['撤销升级，退还 #','Undo upgrade · refund $1'],
    ['撤销，退还 #','Undo · refund $1'], ['还差 #','Short by $1'], ['村库还差 #','Treasury short by $1'],
    ['如果改成「@」','Preview: $1'], ['如果建「@」','Build $1'], ['如果把这座@升到 Lv #','Upgrade $1 to Lv $2'],
    ['村子发展成了「@」','The village is now a $1:lower'], ['需要先建@','Build $1:lower first'],
    ['@季节影响 # 个百分点','$1: seasonal effect $2 pp'],
    ['产卵季捕鱼：鱼群繁殖 −#%。','Fishing during spawning reduces reproduction by $1%.'],
    ['人手 #%：船和店按这个比例开工。','Staffing is $1%. Boats and shops will work at this capacity.'],
    ['人手 #%：船和店没有满员。','Boats and shops were staffed at $1%.'],
    ['缺粮 # 吨，村库买不起：村民挨饿，民心 −16。','The village is short $1 t of food and cannot afford imports. Hunger costs 16 morale.'],
    ['缺粮 # 吨，村库买不起：村民挨饿。','The village was short $1 t and could not afford imports. Residents went hungry.'],
    ['缺粮 # 吨，村库进口要花 #。','The village needs $1 t more food. Imports will cost $2.'],
    ['进口粮食 # 吨，村库 −#。','Imported $1 t of food at a cost of $2.'],
    ['幽灵网 1 张缠在礁上，每季鱼群 −#%。潜下去割掉。','A ghost net is tangled on the reef. Reef fish fall $1% per season. Dive to cut it free.'],
    ['幽灵网 # 张缠在礁上，每季鱼群 −#%。潜下去割掉。','$1 ghost nets on the reef. Reef fish fall $2% per season. Dive to cut them free.'],
    ['长棘海星 # 只没清理：珊瑚 −#%。','$1 starfish left on the reef. Coral −$2%.'],
    ['垃圾 # 处没捡：鱼群 −#%，声誉 −#。','$1 litter sites remained. Reef fish −$2%, reputation −$3.'],
    ['清掉长棘海星 # 只。','Starfish cleared: $1.'], ['捡走垃圾 # 处。','Litter sites cleared: $1.'],
    ['# 吨鱼货放坏@。','$1 t of fish spoiled $2.'],
    ['村民 −#：@，有人搬走了。','$1 residents moved away ($2).'],
    ['村民 +#，住满了（# 人）。再建民居才会长人。','Residents +$1. All $2 places are occupied. Build more homes to grow.'],
    ['保护资助 #：村库 #，修复工资 #。礁区越好，资助越少。','Conservation grant $1. Treasury $2, restoration wages $3. Grants fall as the reef recovers.'],
    ['鱼群只剩 #%。','Reef fish are down to $1%.'],
    ['远洋鱼群只剩 #%：远洋渔获和观鲸收入都在下降。','Offshore fish are down to $1%. Offshore catches and whale-watching income are falling.'],
    ['@变化的原因（百分点）','Drivers of change in $1 (percentage points)'],
    ['@未过目标线','Below target: $1'], ['目标 >#%','Goal >$1%'],
    ['渔村每季收入','Seasonal village income'], ['升到 Lv #：@','Lv $1: $2'],
    ['村子长成了@，门前的珊瑚礁也还活着。这需要克制，也需要胆量。','The settlement grew into a $1:lower, and its reef is still alive. That took restraint and courage.'],
    ['它带走了 # 条鱼，其中 # 条根本不是它要捕的。','It caught $1 fish. $2 were bycatch.'],
    ['它带走了 # 条鱼。','It caught $1 fish.'],
    ['鱼群还剩 #%。这一网能给你的村子带来 # 的收入。','$1% of the school survived. The haul brings $2 to the village.'],
    ['礁上缠着遗落的渔网，把它们割掉（还剩 # 张）','Cut the nets tangled on the reef. Remaining: $1.'],
    ['正在调查@… #% · 待在这里别走','Surveying $1… $2% · Hold position'],
    ['调查了 # 处','Surveyed $1 sites'], ['清掉 # 只长棘海星','Cleared $1 starfish'], ['捡走 # 处垃圾','Cleared $1 litter sites'],
    ['还剩 # 只。','Remaining: $1.'], ['还剩 # 处。','Sites remaining: $1.'],
    ['全村能住 # 人，现在住着 # 人。','Housing for $1. Current population: $2.'],
    ['现在停着 # 条远洋渔船、# 条观鲸船。','Currently berthed: $1 offshore boats and $2 whale boats.'],
    ['湾内停留 # 条 · 能接到邻礁 # 条','Stayed in the bay: $1 · Reached the next reef: $2'],
    ['你带着 # / # 条鱼穿过窄口，尾队在礁背重新聚拢。','You guided $1 of $2 fish through the pass. The stragglers regrouped behind the reef.'],
    ['现场有 # 条幼鱼留在湾内，# 条能接到邻礁。@','$1 young fish stayed in the bay and $2 reached the next reef. $3'],
    ['你从@换到一口气，记下了可留给海龟的空档。','You took a breath at the $1:lower and recorded a quiet window for the turtles.'],
    ['座头鲸在@换气，观鲸船有了能远观的位置。','The humpback surfaced in the $1. The crew now has a place to watch from a distance.'],
    ['尾迹正往@侧去','The wake is moving $1'], ['第一拨成鱼 · # 秒后过湾','First adult school · passes in $1 s'],
    ['与沿用原安排相比，预计渔获 # 吨，季末村库 #。','Compared with the current schedule: catch $1 t, closing treasury $2.'],
    ['@有新动静，潜入后能亲手试一趟。','A new encounter awaits at $1. Dive to investigate.'],
    ['· 村子将升级为「@」','· Next settlement tier: $1'], ['村库账本（# 季）· 合计','Treasury ledger ($1 seasons) · total'],
    ['最大的一笔支出是「@」。@','Largest expense: $1. $2'],
  ].map(([source, en]) => {
    const tokens = source.split(/([#@])/);
    return [new RegExp('^'+tokens.map(t => t==='#'?'([+−-]?\\d+(?:\\.\\d+)?)':t==='@'?'(.*?)':escape(t)).join('')+'$','u'), en];
  });

  const punctuation = {'。':'. ','，':', ','、':', ','：':': ','；':'. ','（':' (','）':') ','「':'“','」':'”','【':'[','】':'] '};
  function tidy(text) {
    return text.replace(/\s+/g,' ').replace(/\s+([.,:;!?%)”\]])/g,'$1')
      .replace(/([“[(])\s+/g,'$1').replace(/([+−])\s+(?=\d)/g,'$1').trim();
  }
  function english(value) {
    if (!hasChinese.test(value)) return value;
    const key=clean(value);
    if (Object.hasOwn(EN_MESSAGES,key)) return EN_MESSAGES[key];
    if (cache.has(key)) return cache.get(key);
    let result;
    for (const [pattern, template] of formats) {
      const match=pattern.exec(key);
      if (!match) continue;
      result=template.replace(/\$(\d+)(:lower)?/g, (_,i,lower) => {
        const field=english(match[Number(i)]);
        return lower ? field.toLowerCase() : field;
      });
      break;
    }
    if (result===undefined) {
      // Composed ledgers and HUD lines combine independently authored labels with
      // live numbers and punctuation. Match whole messages before their shorter labels.
      result=key.replace(phrases, source=>' '+EN_MESSAGES[source]+' ')
        .replace(/[。，、：；（）「」【】]/g, c=>punctuation[c]);
    }
    result=tidy(result);
    if(cache.size>=1000)cache.clear();
    cache.set(key,result);
    return result;
  }
  function text(source) {
    if (language!=='en'||typeof source!=='string'||!hasChinese.test(source)) return source;
    if(source.includes('\n'))return source.split('\n').map(text).join('\n');
    const leading=source.match(/^\s*/)[0], trailing=source.match(/\s*$/)[0];
    return leading+english(source)+trailing;
  }
  function walk(root, remember=false) {
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{
      acceptNode(node) {
        if(node.nodeType===1 && (node.matches('script,style,defs,[data-native-language]')))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(node.nodeType===Node.TEXT_NODE){
        if(!hasChinese.test(node.data))continue;
        if(remember)originalText.push([node,node.data]);
        node.data=text(node.data);
      }else{
        for(const name of attributes){
          const value=node.getAttribute(name);
          if(value===null||!hasChinese.test(value))continue;
          if(remember)originalAttrs.push([node,name,value]);
          node.setAttribute(name,text(value));
        }
      }
    }
  }
  function select(next,save=true){
    if(next!=='en'&&next!=='zh-CN')return;
    language=next;document.documentElement.lang=next;
    if(save){try{localStorage.setItem(preference,next);}catch{}}
    for(const [node,source] of originalText)if(node.isConnected)node.data=text(source);
    for(const [el,name,source] of originalAttrs)if(el.isConnected)el.setAttribute(name,text(source));
    document.title=text('海面之下');
    for(const button of document.querySelectorAll('[data-language]')){
      button.setAttribute('aria-pressed',String(button.dataset.language===next));
    }
    document.dispatchEvent(new Event('ocean-language-changed'));
  }
  function init(){
    walk(document.body,true);
    document.getElementById('languageChoice').addEventListener('click',e=>{
      const button=e.target.closest('[data-language]');
      if(button&&button.dataset.language!==language)select(button.dataset.language);
    });
    select(language,false);
    document.documentElement.classList.remove('locale-pending');
  }
  return {text,walk,init,get language(){return language;}};
})();

const gameText=GameLocale.text;
if(typeof document!=='undefined')GameLocale.init();
function setGameHTML(element,source){
  element.innerHTML=source;
  if(GameLocale.language==='en' && /\p{Script=Han}/u.test(source))GameLocale.walk(element);
}
