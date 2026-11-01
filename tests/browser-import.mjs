// Optional full browser check using preinstalled Python, Chrome and Playwright.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, mkdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
if (!process.env.PYTHON_EXE || !process.env.PLAYWRIGHT_MODULE) throw Error('Set PYTHON_EXE and PLAYWRIGHT_MODULE to installed runtimes');
const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.QA_OUTPUT || await mkdtemp(path.join(os.tmpdir(),'csv-import-qa-'));
await mkdir(output,{recursive:true});
const child = spawn(process.env.PYTHON_EXE,['-u','-c',"from app import Server,Handler; s=Server(('127.0.0.1',0),Handler); print(s.server_address[1],flush=True); s.serve_forever()"], {cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
try {
  const ready = new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(Error('Local test server did not start')),5000);
    child.once('error',error => {clearTimeout(timer); reject(error);});
    child.stdout.once('data',data => {clearTimeout(timer); resolve(Number(data.toString().trim()));});
    child.once('exit',code => {clearTimeout(timer); reject(Error('Server exited: '+code));});
  });
  const port = await ready;
  browser = await chromium.launch({channel:'chrome',headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[]; page.on('pageerror',error => errors.push(error.message));
  await page.goto('http://127.0.0.1:'+port);
  await page.locator('#language').selectOption('ru');
  await page.locator('#demo').click();
  await page.locator('#schema-mode').check();
  await page.locator('#inspect').click();
  await page.locator('#schema-panel').waitFor({state:'visible'});
  await page.locator('[data-field="include"][data-source="0"]').uncheck();
  await page.locator('[data-field="type"][data-source="1"]').selectOption('email');
  await page.locator('[data-field="required"][data-source="1"]').check();
  await page.locator('[data-field="name"][data-source="1"]').fill('contact');
  await page.locator('[data-field="name"][data-source="2"]').fill('id');
  await page.locator('[data-field="unique"][data-source="2"]').check();
  await page.locator('[data-field="type"][data-source="3"]').selectOption('decimal');
  await page.getByRole('button',{name:'Выше: id',exact:true}).click();
  await page.locator('#prepare').click();
  await page.locator('#results').waitFor({state:'visible'});
  assert.deepEqual(await page.locator('#stats strong').allTextContents(),['6','1','4','0']);
  assert.deepEqual(await page.locator('#preview th').allTextContents(),['id','contact','price']);
  assert.match(await page.locator('#rejected-preview').textContent(), /Повтор ключа/);
  const acceptedDownload = page.waitForEvent('download'); await page.locator('#csv').click();
  const accepted = await acceptedDownload; await accepted.saveAs(path.join(output,'import-ready.csv'));
  assert.equal(await readFile(path.join(output,'import-ready.csv'),'utf8'),'id,contact,price\r\n001,alice@example.test,12.50\r\n');
  const rejectedDownload = page.waitForEvent('download'); await page.locator('#rejects').click();
  const rejected = await rejectedDownload; await rejected.saveAs(path.join(output,'rejected-records.csv'));
  assert.match(await readFile(path.join(output,'rejected-records.csv'),'utf8'), /column_count/);
  await page.screenshot({path:path.join(output,'csv-import-desktop.png'),fullPage:true});
  await page.locator('.import-workspace').screenshot({path:path.join(output,'csv-import-mapping.png')});
  await page.locator('#results').screenshot({path:path.join(output,'csv-import-results.png')});
  for (const language of ['en','es','ru']) {
    await page.locator('#language').selectOption(language);
    assert.equal(await page.locator('[data-field="name"][data-source="2"]').inputValue(),'id');
    assert.equal(await page.locator('#results').isVisible(),true);
  }
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({path:path.join(output,'csv-import-mobile.png'),fullPage:true});
  await page.locator('#source').fill('a,b\n1,2');
  assert.equal(await page.locator('#results').isVisible(),false);
  assert.equal(await page.locator('#schema-panel').isVisible(),false);
  await page.locator('#clean').click();
  assert.match(await page.locator('#status').textContent(), /Сначала прочитайте/);
  await page.locator('#schema-mode').uncheck();
  await page.locator('#clean').click();
  await page.locator('#results').waitFor({state:'visible'});
  assert.equal(await page.locator('#rejects').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: map, rename, reorder, validate, composite-key flag, accepted/rejected downloads, RU/EN/ES, mobile, stale source and legacy cleaning');
  console.log('Artifacts: '+output);
} finally {
  if (browser) await browser.close();
  if (child.exitCode === null) {child.kill(); await once(child,'exit');}
}
