import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
const load = new Function('localStorage', source('locale-en.js') + '\n' + source('locale.js')
  + '\nreturn { language: GameLocale.language, text: gameText, messages: EN_MESSAGES };');
const en = load({ getItem: () => null });

test('first launch, a saved language, and storage that cannot be read', () => {
  assert.equal(en.language, 'en');
  assert.equal(load({ getItem: () => 'unsupported' }).language, 'en');
  assert.equal(load({ getItem() { throw Error('storage unavailable'); } }).language, 'en');
  const zh = load({ getItem: key => key === 'bts.language.v1' ? 'zh-CN' : null });
  assert.equal(zh.language, 'zh-CN');
  assert.equal(zh.text('第 3 年 · 冬'), '第 3 年 · 冬');
});

test('catalogue and legacy observations render in English', () => {
  for (const [sourceText, translation] of Object.entries(en.messages)) {
    assert.ok(translation.trim() && !/\p{Script=Han}/u.test(translation), sourceText);
    assert.equal(en.text(sourceText), translation);
  }
  assert.equal(en.text('第 3 年 · 冬'), 'Year 3 · Winter');
  assert.equal(en.text('你带着 16 / 21 条鱼穿过窄口，尾队在礁背重新聚拢。'),
    'You guided 16 of 21 fish through the pass. The stragglers regrouped behind the reef.');
});

test('financial labels cannot consume part of an amount in a save or report', () => {
  for (const amount of [2, 23, 251, 35.6, 2.15, -22.5]) {
    const line = en.text('村库 ' + amount + ' · 民心 72');
    assert.deepEqual(line.match(/-?\d+(?:\.\d+)?/g), [String(amount), '72']);
  }
  assert.equal(en.text('与沿用原安排相比，预计渔获 −1.8 吨，季末村库 +21.3。'),
    'Compared with the current schedule: catch −1.8 t, closing treasury +21.3.');
  assert.equal(en.text('净变化 −51.2'), 'Net change −51.2');
});

test('inline spacing, multiline tips and values already in English survive rendering', () => {
  assert.equal(en.text('  村库\n  珊瑚'), '  Treasury\n  Coral');
  assert.equal(en.text('珊瑚：被拖网、游客、污水和热浪伤到会减少，受保护、水干净时会长回来。竖线是 55% 的目标。\n本季：污水 ▼'),
    'Trawls, visitors, sewage and heat damage coral. Clean, protected reefs recover. Goal: 55%.\nThis season: Sewage ▼');
  assert.equal(en.text('Q4 · −2.3 pp'), 'Q4 · −2.3 pp');
  assert.equal(en.text(150), 150);
});
