import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const cases = [
 [{languages:['en-US']},'en'], [{languages:['es-MX']},'es'], [{languages:['ru-RU']},'ru'],
 [{languages:['de-DE','ES_ar','en']},'es'], [{languages:[' RU_ru ']},'ru'],
 [{languages:['de-DE','ja-JP']},'en'], [{languages:[]},'en'],
 [{language:'es-MX',languages:[]},'es'], [{language:'ru-RU'},'ru'],
];

for (const file of ["public/src/js/workbench-ui.js"]) test(file + ': browser locale and saved preferences', async () => {
 const source = await readFile(new URL('../'+file, import.meta.url), 'utf8');
 const start = source.indexOf('function browserLanguage(');
 assert.ok(start >= 0);
 const end = source.indexOf('\n}', start) + 2;
 const detector = source.slice(start, end);
 for (const [navigator, expected] of cases) for (const saved of [null,'invalid','constructor','ru','en','es']) for (const blocked of [false,true]) {
  const wanted = !blocked && ['en','es','ru'].includes(saved) ? saved : expected;
  const result = runInNewContext(detector + ';browserLanguage("fixture-language")', {navigator,localStorage:{getItem(){if(blocked)throw Error('blocked');return saved;}}});
  assert.equal(result, wanted, JSON.stringify({navigator,saved,blocked}));
 }
 assert.equal(runInNewContext(detector + ';browserLanguage("fixture-language")', {}), 'en');
});
