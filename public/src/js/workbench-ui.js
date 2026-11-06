'use strict';
function browserLanguage(key) {
  let saved;
  try { saved = globalThis.localStorage?.getItem(key); } catch {}
  const supported = ['en', 'es', 'ru'];
  if (supported.includes(saved)) return saved;
  const nav = globalThis.navigator;
  const languages = nav?.languages?.length ? nav.languages : [nav?.language];
  return languages.map(value => String(value).trim().toLowerCase().split(/[-_]/)[0]).find(value => supported.includes(value)) || 'en';
}
const importCopy = {
  en: {importMode:'Prepare for import',importHint:'The first nonempty record is the header. Map and validate columns; rejected records are exported separately.',inspect:'Read columns',keyHint:'Selected key columns form one composite unique key. Empty keys are rejected. Comparison is case-sensitive.',include:'Include',outputName:'Output name',type:'Type',required:'Required',unique:'Key',order:'Order',text:'Text',integer:'Integer',decimal:'Decimal (dot)',email:'Email',sample:'Sample',accepted_rows:'Accepted records',rejected_rows:'Rejected records',rejectDownload:'Download rejected rows',rejectedTitle:'Rejected records and reasons',rejectedHint:'First 30 rejections. Download contains all rejected records and the original cells as JSON.',record:'Record',reasons:'Reasons',original:'Original cells',column_count:'Column count differs from the header',duplicate_key:'Duplicate key',duplicate_row:'Duplicate row',requiredError:'Empty required field',integerError:'Expected integer',decimalError:'Expected decimal with a dot',emailError:'Invalid email format',schema:'Select at least one column. Output names must be nonempty and unique (ignoring case).',empty_input:'Add a CSV with a header and data.',columns_limit:'Import mapping supports up to 200 columns.',inspectFirst:'Read the source columns before preparing an import.',sourceRows:'Data records in source',importDone:'Import file prepared. Review accepted and rejected records before downloading.',importPreview:'Output header and first 30 accepted records. The download contains all accepted records.',up:'Move up',down:'Move down',sourceColumn:'Source column'},
  ru: {importMode:'Подготовить к импорту',importHint:'Первая непустая запись — заголовок. Выберите столбцы и проверки; отклонённые записи выгружаются отдельно.',inspect:'Прочитать столбцы',keyHint:'Отмеченные столбцы образуют один составной уникальный ключ. Пустые ключи отклоняются. Регистр учитывается.',include:'Включить',outputName:'Имя на выходе',type:'Тип',required:'Обязательное',unique:'Ключ',order:'Порядок',text:'Текст',integer:'Целое число',decimal:'Число с точкой',email:'Email',sample:'Пример',accepted_rows:'Принято записей',rejected_rows:'Отклонено записей',rejectDownload:'Скачать отклонённые',rejectedTitle:'Отклонённые записи и причины',rejectedHint:'Первые 30 отклонений. В файле — все отклонённые записи и исходные ячейки в JSON.',record:'Запись',reasons:'Причины',original:'Исходные ячейки',column_count:'Число столбцов отличается от заголовка',duplicate_key:'Повтор ключа',duplicate_row:'Повтор строки',requiredError:'Не заполнено обязательное поле',integerError:'Нужно целое число',decimalError:'Нужно число с десятичной точкой',emailError:'Некорректный формат email',schema:'Выберите хотя бы один столбец. Имена на выходе должны быть непустыми и уникальными без учёта регистра.',empty_input:'Добавьте CSV с заголовком и данными.',columns_limit:'Подготовка импорта поддерживает до 200 столбцов.',inspectFirst:'Сначала прочитайте столбцы исходного файла.',sourceRows:'Записей данных в источнике',importDone:'Файл для импорта подготовлен. Проверьте принятые и отклонённые записи перед скачиванием.',importPreview:'Заголовок и первые 30 принятых записей. В выгрузке — все принятые записи.',up:'Выше',down:'Ниже',sourceColumn:'Исходный столбец'},
  es: {importMode:'Preparar importación',importHint:'El primer registro no vacío es el encabezado. Selecciona columnas y reglas; los registros rechazados se exportan aparte.',inspect:'Leer columnas',keyHint:'Las columnas clave forman una clave única compuesta. Se rechazan claves vacías. Se distingue entre mayúsculas y minúsculas.',include:'Incluir',outputName:'Nombre de salida',type:'Tipo',required:'Obligatorio',unique:'Clave',order:'Orden',text:'Texto',integer:'Entero',decimal:'Decimal (punto)',email:'Email',sample:'Ejemplo',accepted_rows:'Registros aceptados',rejected_rows:'Registros rechazados',rejectDownload:'Descargar rechazados',rejectedTitle:'Registros rechazados y motivos',rejectedHint:'Primeros 30 rechazos. La descarga incluye todos los rechazos y las celdas originales en JSON.',record:'Registro',reasons:'Motivos',original:'Celdas originales',column_count:'Cantidad de columnas distinta del encabezado',duplicate_key:'Clave duplicada',duplicate_row:'Fila duplicada',requiredError:'Campo obligatorio vacío',integerError:'Se requiere un entero',decimalError:'Se requiere decimal con punto',emailError:'Formato de email incorrecto',schema:'Selecciona al menos una columna. Los nombres de salida deben ser únicos y no vacíos.',empty_input:'Añade un CSV con encabezado y datos.',columns_limit:'El mapeo admite hasta 200 columnas.',inspectFirst:'Primero lee las columnas del archivo de origen.',sourceRows:'Registros de datos en origen',importDone:'Archivo preparado. Revisa los registros aceptados y rechazados antes de descargar.',importPreview:'Encabezado y primeros 30 registros aceptados. La descarga contiene todos los aceptados.',up:'Subir',down:'Bajar',sourceColumn:'Columna de origen'}
};
importCopy.en.prepare = 'Build import file →';
importCopy.ru.prepare = 'Сформировать файл импорта →';
importCopy.es.prepare = 'Preparar archivo de importación →';
for (const language of Object.keys(importCopy)) Object.assign(copy[language], importCopy[language]);
const $ = id => document.getElementById(id);
let lang = 'en', result = null, working = false, statusKey = '', mapping = null, inspected = null, fileVersion = 0;
lang = browserLanguage('csv-language');
const t = key => copy[lang][key] || copy[lang].other;
function message(key, error = false) {statusKey = key; $('status').textContent = t(key); $('status').className = error ? 'error' : '';}
function invalidate(resetSchema = false) {
  result = null; $('results').hidden = true;
  if (resetSchema) {mapping = null; inspected = null; $('schema-panel').hidden = true; fileVersion++;}
  if (!working) message('stale');
}
function controlsBusy(value) {
  working = value;
  for (const id of ['clean','source','file','demo','delimiter','trim','dedup','safe','schema-mode','inspect','prepare']) $(id).disabled = value;
  document.querySelectorAll('#mapping input, #mapping select, #mapping button').forEach(el => {el.disabled = value;});
  if (!value && mapping) renderMapping();
}
function basePayload() {return {text:$('source').value, delimiter:$('delimiter').value === 'tab' ? '\t' : $('delimiter').value, trim:$('trim').checked, dedup:$('dedup').checked, safe:$('safe').checked};}
async function request(route, payload) {
  const response = await fetch(route, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'other');
  return data;
}
function setLanguage(value, persist = false) {
  lang = value; document.documentElement.lang = lang; $('language').value = lang;
  document.querySelectorAll('[data-i]').forEach(el => {el.textContent = t(el.dataset.i);});
  $('language').setAttribute('aria-label', t('language'));
  if (statusKey) message(statusKey, $('status').classList.contains('error'));
  if (mapping && !working) renderMapping();
  if (result) render();
  if (persist) try {localStorage.setItem('csv-language', lang);} catch {}
}
function table(target, headers, rows) {
  target.replaceChildren(); const head = document.createElement('thead'), tr = document.createElement('tr');
  for (const text of headers) {const th = document.createElement('th'); th.textContent = text; tr.append(th);}
  head.append(tr); target.append(head); const body = document.createElement('tbody');
  for (const row of rows) {const tr = document.createElement('tr'); for (const value of row) {const td = document.createElement('td'); td.textContent = value; tr.append(td);} body.append(tr);}
  target.append(body);
}
function issueText(issue) {
  const key = ['required','integer','decimal','email'].includes(issue.code) ? issue.code + 'Error' : issue.code;
  return t(key) + (issue.column ? ': ' + issue.column : '');
}
function render() {
  const report = result.report, importing = report.schema_enabled;
  $('stats').replaceChildren();
  for (const key of importing ? ['input_rows','accepted_rows','rejected_rows','empty_removed'] : ['input_rows','output_rows','empty_removed','duplicates_removed']) {
    const box = document.createElement('div'), num = document.createElement('strong'), label = document.createElement('span');
    box.className = 'stat'; num.textContent = report[key].toLocaleString(lang); label.textContent = t(key); box.append(num,label); $('stats').append(box);
  }
  $('warning').textContent = `${t('protected')}: ${report.protected_cells}. ${report.ragged_rows ? t('ragged') : ''}`;
  const rows = importing ? result.preview.slice(1) : result.preview;
  const headers = importing ? result.preview[0] : Array.from({length:Math.max(0,...rows.map(row => row.length))}, (_,i) => '#' + (i+1));
  table($('preview'), headers, rows);
  document.querySelector('[data-i="preview"]').textContent = t(importing ? 'importPreview' : 'preview');
  $('rejects').hidden = !importing || !report.rejected_rows;
  $('rejected-section').hidden = !importing || !report.rejected_rows;
  if (importing) table($('rejected-preview'), [t('record'),t('reasons'),t('original')], result.rejected_preview.map(row => [row.record,row.issues.map(issueText).join('; '),JSON.stringify(row.row)]));
  $('results').hidden = false;
}
function fieldLabel(key, control) {const label = document.createElement('label'), title = document.createElement('span'); title.textContent = t(key); label.append(title,control); return label;}
function renderMapping() {
  $('mapping').replaceChildren(); $('source-summary').textContent = t('sourceRows') + ': ' + inspected.data_rows;
  mapping.forEach((field,index) => {
    const row = document.createElement('div'); row.className = 'mapping-row';
    const source = document.createElement('div'); source.className = 'source-column'; source.textContent = `${field.source + 1}. ${inspected.headers[field.source] || '—'}`;
    const sample = document.createElement('small'); sample.textContent = t('sample') + ': ' + (inspected.sample[0]?.[field.source] ?? '—'); source.append(sample); row.append(source);
    for (const key of ['include','name','type','required','unique']) {
      const control = document.createElement(key === 'type' ? 'select' : 'input');
      control.dataset.field = key; control.dataset.source = String(field.source);
      if (key === 'type') {for (const kind of ['text','integer','decimal','email']) {const option = document.createElement('option'); option.value = kind; option.textContent = t(kind); control.append(option);} control.value = field.type;}
      else if (['include','required','unique'].includes(key)) {control.type = 'checkbox'; control.checked = field[key];}
      else {control.type = 'text'; control.value = field.name; control.maxLength = 100;}
      control.setAttribute('aria-label', `${t(key === 'name' ? 'outputName' : key)}: ${inspected.headers[field.source] || field.source + 1}`);
      control.addEventListener('input', () => {
        field[key] = control.type === 'checkbox' ? control.checked : control.value; invalidate();
        if (key === 'name') row.querySelectorAll('.mapping-order button').forEach((button,i) => button.setAttribute('aria-label', t(i === 0 ? 'up' : 'down') + ': ' + field.name));
      });
      row.append(fieldLabel(key === 'name' ? 'outputName' : key, control));
    }
    const moves = document.createElement('div'); moves.className = 'mapping-order';
    for (const [key,offset] of [['up',-1],['down',1]]) {
      const button = document.createElement('button'); button.textContent = offset < 0 ? '↑' : '↓'; button.title = t(key); button.setAttribute('aria-label', t(key) + ': ' + field.name);
      button.disabled = index + offset < 0 || index + offset >= mapping.length;
      button.addEventListener('click', () => {const other = index + offset; if (other < 0 || other >= mapping.length) return; [mapping[index],mapping[other]] = [mapping[other],mapping[index]]; invalidate(); renderMapping();});
      moves.append(button);
    }
    row.append(moves); $('mapping').append(row);
  });
  $('schema-panel').hidden = false;
}
$('language').addEventListener('change', e => setLanguage(e.target.value, true));
$('prepare').addEventListener('click', () => $('clean').click());
for (const id of ['source','delimiter','trim','dedup','safe']) $(id).addEventListener('input', () => invalidate(['source','delimiter'].includes(id)));
$('schema-mode').addEventListener('change', () => {invalidate(); $('inspect').hidden = !$('schema-mode').checked; $('schema-panel').hidden = !$('schema-mode').checked || !mapping;});
$('inspect').addEventListener('click', async () => {
  if (working) return; invalidate(); controlsBusy(true); message('working');
  try {inspected = await request('/api/inspect', basePayload()); mapping = inspected.headers.map((name,source) => ({source,name:name.trim() || 'column_' + (source+1),type:'text',required:false,unique:false,include:true})); renderMapping(); message('inspectFirst'); $('status').textContent = t('sourceRows') + ': ' + inspected.data_rows; statusKey = '';}
  catch (error) {mapping = null; $('schema-panel').hidden = true; message(error.message === 'Failed to fetch' ? 'network' : error.message,true);}
  finally {controlsBusy(false);}
});
$('demo').addEventListener('click', () => {
  $('delimiter').value = ',';
  $('source').value = 'name,email,sku,price\n Alice ,alice@example.test,001,12.50\nBad address,wrong,002,abc\nDuplicate,copy@example.test,001,2\nMissing,,003,3\nRagged,a@example.test,004\n';
  $('file').value = ''; $('filename').textContent = ''; invalidate(true);
});
$('file').addEventListener('change', async () => {
  const file = $('file').files[0]; invalidate(true); const version = fileVersion;
  if (!file) return;
  if (file.size > 1_000_000) {$('source').value = ''; message('text_limit',true); return;}
  controlsBusy(true);
  try {const bytes = await file.arrayBuffer(); if (version !== fileVersion) return; $('source').value = new TextDecoder('utf-8',{fatal:true}).decode(bytes); $('filename').textContent = file.name;}
  catch {if (version === fileVersion) {$('source').value = ''; message('encoding',true);}}
  finally {controlsBusy(false);}
});
$('clean').addEventListener('click', async () => {
  if (working) return;
  const payload = basePayload();
  if (new TextEncoder().encode(payload.text).length > 1_000_000) {message('text_limit',true); return;}
  if ($('schema-mode').checked) {
    if (!mapping) {message('inspectFirst',true); return;}
    payload.schema = mapping.filter(field => field.include).map(({include,...field}) => ({...field,name:field.name.trim()}));
  }
  fileVersion++; invalidate(); controlsBusy(true); message('working');
  try {result = await request('/api/clean',payload); render(); message(result.report.schema_enabled ? 'importDone' : 'done');}
  catch (error) {message(error.message === 'Failed to fetch' ? 'network' : error.message,true);}
  finally {controlsBusy(false);}
});
function download(content,name,type) {const url = URL.createObjectURL(new Blob([content],{type})), a = document.createElement('a'); a.href=url; a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),60000);}
$('csv').addEventListener('click', () => {if (result) download(result.csv,result.report.schema_enabled ? 'import-ready.csv' : 'cleaned.csv','text/csv;charset=utf-8');});
$('rejects').addEventListener('click', () => {if (result?.rejected_csv) download(result.rejected_csv,'rejected-records.csv','text/csv;charset=utf-8');});
$('report').addEventListener('click', () => {if (result) download(JSON.stringify(result.report,null,2),'cleaning-report.json','application/json');});
setLanguage(lang);
