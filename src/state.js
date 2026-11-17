'use strict';
// ======================================================================= the two halves of the game
// the ocean
const eco = { coral: 1, fish: 1, bait: 1, clar: 1, ghost: 0, pelagic: 1 };
const vis = { clar: 1 };
const scar = new Float32Array(13), patchVar = Float32Array.from({ length: 13 }, () => rng() - 0.6);
// the village
const V = { season: 0, money: 150, food: 6, houses: 4, pop: 14, morale: 60, rep: 0.3,
  boats: 2, trawlers: 0, shops: 0, resort: 0, plant: 0, recycle: 0, cold: 0, nursery: 0, school: 0, harbor: 0, offshore: 0, whale: 0, research: 0, lv: {}, ups: [],
  pol: { fish: 'quota', tour: 'closed', zone: 'none', waste: 'dump', work: 'normal', tax: 'mid' },
  prevPol: null, locks: {}, mods: {}, mpaSeasons: 0, history: [], lastEvent: null, seenEv: [] };
eco.nutr = 0;
const SEASONS_PER_GAME = 16;
const wasteK = v => [1, 0.5, 0.4, 0.3][v.plant ? lvOf(v, 'plant', 0) : 0];   // the treatment plant's discount on running the sewers
const POLICIES = [
  { k: 'fish', name: '渔业', opts: [
    { v: 'industrial', n: '大规模捕捞', d: '全部船出海，拖网下网。渔获最多；拖网刮礁，误捕 30%，丢网最多。拿不到保护资助。' },
    { v: 'quota', n: '配额捕捞', d: '鱼群低于 75% 开始减捕，低于 42% 停捕。误捕 8%。' },
    { v: 'line', n: '传统钓线', d: '渔获约为配额的一半，误捕 3%，不伤礁。拖网船闲置。' },
    { v: 'ban', n: '休渔', d: '不出海，鱼群恢复最快。渔民没有渔获收入，船只停泊仍有少量成本。' } ] },
  { k: 'tour', name: '旅游', opts: [
    { v: 'open', n: '全面开放', d: '游客约为限流的 1.75 倍，人均消费低。礁区好时收入和限流差不多，礁区受损后收入比限流高。踩坏珊瑚、留下垃圾，要的人手更多；游客超过村民 2.2 倍时民心下降。' },
    { v: 'limited', n: '限流观光', d: '游客少，票价高，几乎不踩珊瑚。票价看礁区好不好看：礁区好时收入和开放差不多，礁区受损后跌得比开放快。' },
    { v: 'closed', n: '关闭旅游', d: '不接待游客。店铺只付闲置成本。' } ] },
  { k: 'zone', name: '海洋保护区', opts: [
    { v: 'none', n: '不设', d: '全部海域可捕捞。拿不到保护资助。' },
    { v: 'core', n: '保护核心礁区', d: '礁区禁捕，礁区渔获 −38%。设立满 4 季后，鱼外溢补回一部分。礁区受损时有保护资助。' },
    { v: 'wide', n: '大范围保护', d: '大半海域禁捕，礁区渔获 −70%，游客 −10%。珊瑚恢复最快；受损时资助最多，闲置村民去做修复。' } ] },
  { k: 'waste', name: '污水与垃圾', opts: [
    { v: 'dump', n: '直排入海', d: v => `每季 0。污水 100% 入海。` },
    { v: 'basic', n: '简易处理', d: v => `每季约 ${Math.round((3 + v.pop*0.08)*wasteK(v))}。入海污水减到 40%。` },
    { v: 'full', n: '全面处理', d: v => `每季约 ${Math.round((7 + v.pop*0.15)*wasteK(v))}。入海污水减到 10%，旧渔网回收。` } ] },
  { k: 'work', name: '劳作制度', opts: [
    { v: 'overtime', n: '延长工时', d: '人手 +25%，民心每季约 −10。' },
    { v: 'normal', n: '正常作息', d: '人手 100%。' },
    { v: 'festival', n: '节庆休养', d: '人手 −20%，村库每季 −8，民心每季约 +9。' } ] },
  { k: 'tax', name: '税率', opts: [
    { v: 'high', n: '高税', d: '抽 32%，民心每季约 −12。' },
    { v: 'mid', n: '中税', d: '抽 22%。只对卖出的鱼和旅游收入抽税，村民自己吃的鱼不交。' },
    { v: 'low', n: '低税', d: '抽 12%，民心每季约 +4。' } ] },
];
