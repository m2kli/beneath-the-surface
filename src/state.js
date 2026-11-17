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
const POLICIES = [
  { k: 'fish', name: '渔业', opts: [
    { v: 'industrial', n: '大规模捕捞', d: '所有船都出海，拖网船也下网。渔获最多，伤礁、误捕和丢网也最多。' },
    { v: 'quota', n: '配额捕捞', d: '只捕鱼群补得回来的量。鱼一少，配额自动收紧。' },
    { v: 'line', n: '传统钓线', d: '只用钓线，渔获少，几乎不伤海。拖网船闲置。' },
    { v: 'ban', n: '休渔', d: '不出海。鱼群喘口气，渔民没有收入。' } ] },
  { k: 'tour', name: '旅游', opts: [
    { v: 'open', n: '全面开放', d: '游客越多越好。收入高，但会踩坏珊瑚、留下垃圾，村民也嫌吵。' },
    { v: 'limited', n: '限流观光', d: '控制人数、提高票价。只有礁区足够好看，游客才肯付这个价。' },
    { v: 'closed', n: '关闭旅游', d: '不接待游客。' } ] },
  { k: 'zone', name: '海洋保护区', opts: [
    { v: 'none', n: '不设', d: '所有海域都能捕鱼和潜水。' },
    { v: 'core', n: '保护核心礁区', d: '礁区禁捕禁锚。渔获减少，几季之后鱼会外溢到周边海域。礁区受损时能申请到一部分海洋保护资助。' },
    { v: 'wide', n: '大范围保护', d: '大半海域禁捕。恢复最快，渔业收入最少。礁区受损时，保护资助最多，闲着的村民可以去做修复礁区的工作。' } ] },
  { k: 'waste', name: '污水与垃圾', opts: [
    { v: 'dump', n: '直排入海', d: '不花钱。污水和垃圾都进了海湾。' },
    { v: 'basic', n: '简易处理', d: '花一点钱，去掉大部分污染。' },
    { v: 'full', n: '全面处理', d: '花较多钱，污水处理干净，旧渔网统一回收。' } ] },
  { k: 'work', name: '劳作制度', opts: [
    { v: 'overtime', n: '延长工时', d: '人手多出四分之一，民心下降。' },
    { v: 'normal', n: '正常作息', d: '不多也不少。' },
    { v: 'festival', n: '节庆休养', d: '人手减少，村库出钱办节庆，民心回升。' } ] },
  { k: 'tax', name: '税率', opts: [
    { v: 'high', n: '高税', d: '收三成。村库宽裕，村民不满。' },
    { v: 'mid', n: '中税', d: '卖出去的鱼和旅游收入，两成多上交村库。村民自己吃掉的鱼不交税。' },
    { v: 'low', n: '低税', d: '只收一成多。村民多留些钱，民心上升，村库收入少。' } ] },
];
