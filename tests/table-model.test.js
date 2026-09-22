import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.document = dom.window.document;
const { createTableDraft, setTableCaption, setTableHeaders, applyTableDraft } = await import('../table-model.ts');
const table = '<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>';
const parse = html => new JSDOM(html).window.document;

test('detects every table including nested tables with matching source ranges', () => {
 const source = '<p>Before</p><table id="outer"><tr><td><table id="inner"><tr><td>Nested</td></tr></table></td></tr></table>' + table;
 const draft = createTableDraft(source);
 assert.equal(draft.tables.length, 3);
 assert.deepEqual(draft.tables.map(item => item.table.id), ['outer', 'inner', '']);
 for (const item of draft.tables) assert.match(source.slice(item.range.startOffset, item.range.endOffset), /^<table/);
 assert.equal(draft.tables[0].rows.length, 1);
 assert.equal(draft.tables[0].width, 1);
});

test('adds literal captions and removes captions without removing nested captions', () => {
 const draft = createTableDraft(table);
 setTableCaption(draft.tables[0], '<script>alert(1)</script> & Rates');
 let doc = parse(applyTableDraft(draft));
 assert.equal(doc.querySelector('caption').textContent, '<script>alert(1)</script> & Rates');
 assert.equal(doc.querySelector('script'), null);
 setTableCaption(draft.tables[0], '  ');
 assert.equal(parse(applyTableDraft(draft)).querySelector('caption'), null);
 const nested = createTableDraft('<table><tr><td><table><caption>Inner caption</caption><tr><td>X</td></tr></table></td></tr></table>');
 setTableCaption(nested.tables[0], '');
 assert.equal(parse(applyTableDraft(nested)).querySelector('caption').textContent, 'Inner caption');
});

test('sets row and column headers with col precedence at intersections and supports deselection', () => {
 const draft = createTableDraft(table), item = draft.tables[0];
 setTableHeaders(item, 'row', 0, true);
 setTableHeaders(item, 'column', 0, true);
 let rows = parse(applyTableDraft(draft)).querySelector('table').rows;
 assert.equal(rows[0].cells[0].scope, 'col');
 assert.equal(rows[0].cells[1].scope, 'col');
 assert.equal(rows[1].cells[0].scope, 'row');
 assert.equal(rows[1].cells[1].tagName, 'TD');
 setTableHeaders(item, 'row', 0, false);
 rows = parse(applyTableDraft(draft)).querySelector('table').rows;
 assert.equal(rows[0].cells[0].scope, 'row');
 assert.equal(rows[0].cells[1].tagName, 'TD');
 setTableHeaders(item, 'column', 0, false);
 assert.equal(parse(applyTableDraft(draft)).querySelector('th,[scope]'), null);
});

test('recognizes existing row and column headers', () => {
 const draft = createTableDraft('<table><tr><th scope="col">Name</th><th scope="col">Value</th></tr><tr><th scope="row">First</th><td>1</td></tr></table>');
 assert.deepEqual([...draft.tables[0].headerRows], [0]);
 assert.deepEqual([...draft.tables[0].headerColumns], [0]);
});

test('preserves cell attributes and rich content when switching header types', () => {
 const draft = createTableDraft('<table class="table"><tr><td id="label" class="keep" data-custom="yes" aria-label="Name"><strong>Rich</strong> &amp; <a href="#target">link</a></td><td>B</td></tr></table>');
 setTableHeaders(draft.tables[0], 'row', 0, true);
 let cell = parse(applyTableDraft(draft)).querySelector('#label');
 assert.equal(cell.tagName, 'TH');
 assert.equal(cell.className, 'keep');
 assert.equal(cell.getAttribute('data-custom'), 'yes');
 assert.equal(cell.getAttribute('aria-label'), 'Name');
 assert.equal(cell.querySelector('strong').textContent, 'Rich');
 assert.equal(cell.querySelector('a').getAttribute('href'), '#target');
 setTableHeaders(draft.tables[0], 'row', 0, false);
 cell = parse(applyTableDraft(draft)).querySelector('#label');
 assert.equal(cell.tagName, 'TD');
 assert.equal(cell.id, 'label');
 assert.equal(cell.querySelector('strong').textContent, 'Rich');
});

test('preserves all source outside changed tables byte for byte and leaves untouched tables unchanged', () => {
 const prefix = "<!-- Keep -->\r\n<DIV class='x'>&copy;  before</DIV>\n";
 const middle = '\n<!-- between -->\n';
 const suffix = "\r\n<P title='exact'>After &amp; end</P>";
 const source = prefix + table + middle + table + suffix;
 const draft = createTableDraft(source);
 assert.equal(applyTableDraft(draft), source);
 setTableCaption(draft.tables[0], 'First');
 const output = applyTableDraft(draft);
 assert.ok(output.startsWith(prefix));
 assert.ok(output.endsWith(middle + table + suffix));
 const empty = '<p>No tables &copy;</p>\r\n';
 assert.equal(applyTableDraft(createTableDraft(empty)), empty);
});

test('keeps both parent and nested edits regardless of edit order', () => {
 for (const childFirst of [false, true]) {
  const draft = createTableDraft('<table id="outer"><tr><td><table id="inner"><tr><td>Nested</td></tr></table></td></tr></table>');
  const outer = () => { setTableCaption(draft.tables[0], 'Outer'); setTableHeaders(draft.tables[0], 'row', 0, true); };
  const inner = () => { setTableCaption(draft.tables[1], 'Inner'); setTableHeaders(draft.tables[1], 'column', 0, true); };
  if (childFirst) { inner(); outer(); } else { outer(); inner(); }
  const doc = parse(applyTableDraft(draft));
  assert.equal(doc.querySelector('#outer').caption.textContent, 'Outer');
  assert.equal(doc.querySelector('#inner').caption.textContent, 'Inner');
  assert.equal(doc.querySelector('#outer').rows[0].cells[0].scope, 'col');
  assert.equal(doc.querySelector('#inner').rows[0].cells[0].scope, 'row');
 }
});

test('patches nested-only edits without reserializing parent source', () => {
 const before = "<TABLE id='outer'><TR><TD>";
 const after = '</TD></TR></TABLE>';
 const draft = createTableDraft(before + table + after);
 setTableCaption(draft.tables[1], 'Nested');
 const output = applyTableDraft(draft);
 assert.ok(output.startsWith(before));
 assert.ok(output.endsWith(after));
 assert.equal(parse(output).querySelectorAll('caption').length, 1);
});

test('rejects merged or uneven header edits but permits captions', () => {
 for (const source of ['<table><tr><td colspan="2">Merged</td></tr><tr><td>A</td><td>B</td></tr></table>', '<table><tr><td rowspan="2">Merged</td><td>B</td></tr><tr><td>C</td></tr></table>', '<table><tr><td>A</td><td>B</td></tr><tr><td>C</td></tr></table>']) {
  const draft = createTableDraft(source), item = draft.tables[0];
  assert.equal(item.complex, true);
  assert.throws(() => setTableHeaders(item, 'row', 0, true), /Merged or uneven/);
  assert.throws(() => setTableHeaders(item, 'column', 0, true), /Merged or uneven/);
  assert.equal(applyTableDraft(draft), source);
  setTableCaption(item, 'Still editable');
  assert.equal(parse(applyTableDraft(draft)).querySelector('caption').textContent, 'Still editable');
 }
});

test('column heading rows move into thead and deselection restores body order', () => {
 const draft=createTableDraft('<table><caption>Title</caption><colgroup><col span="2"></colgroup><tbody id="body"><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr><tr><td>E</td><td>F</td></tr></tbody><tfoot><tr><td>Total</td><td>3</td></tr></tfoot></table>');
 const item=draft.tables[0];
 setTableHeaders(item,'row',0,true);
 assert.equal(item.table.tHead.rows.length,1);
 assert.equal(item.table.tBodies[0].id,'body');
 setTableHeaders(item,'row',1,true);
 assert.equal(item.table.tHead.rows.length,2);
 setTableHeaders(item,'row',0,false);
 assert.equal(item.table.tHead,null);
 assert.deepEqual([...item.table.rows].map(r=>r.cells[0].textContent),['A','C','E','Total']);
 assert.equal(item.table.tFoot.rows.length,1);
});
test('row headers and nonleading column headings do not reorder data', () => {
 const item=createTableDraft(table).tables[0];
 setTableHeaders(item,'column',0,true);
 assert.equal(item.table.tHead,null);
 setTableHeaders(item,'row',1,true);
 assert.equal(item.table.tHead,null);
 assert.equal(item.rows[0].cells[0].textContent,'A');
});
test('individual complex heading edits move the complete band without splitting rowspan', async () => {
 const {setCellHeader}=await import('../table-model.ts');
 const item=createTableDraft('<table><tbody><tr><td rowspan="2">Name</td><td>Group</td></tr><tr><td>Detail</td></tr><tr><td>A</td><td>B</td></tr></tbody></table>').tables[0];
 setCellHeader(item,0,0,'col'); setCellHeader(item,0,1,'col');
 assert.equal(item.table.tHead,null);
 setCellHeader(item,1,0,'col');
 assert.equal(item.table.tHead.rows.length,2);
 assert.equal(item.table.tHead.rows[0].cells[0].rowSpan,2);
 assert.equal(item.table.tBodies[0].rows.length,1);
});
