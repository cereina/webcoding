import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
const { createTableDraft, applyTableDraft } = await import('../table-model.ts');
const { assignTableHeaders } = await import('../table-auto-headers.ts');

const simple = '<table><tr><th>Product</th><th>Price</th></tr><tr><th scope="row">Book</th><td>10</td></tr></table>';

test('simple tables keep semantic scope and do not add unnecessary headers relationships', () => {
  const t = createTableDraft(simple).tables[0];
  assert.deepEqual(assignTableHeaders(t).issues, []);
  assert.equal(t.rows[0].cells[0].scope, 'col');
  assert.equal(t.rows[0].cells[1].scope, 'col');
  assert.equal(t.rows[1].cells[0].scope, 'row');
  assert.equal(t.rows[1].cells[1].hasAttribute('headers'), false);
  assert.equal(t.table.querySelector('[id]'), null);
});

test('grouped tables keep scope relationships without forcing explicit headers attributes', () => {
  const t = createTableDraft('<table><tr><th colspan="2">Sales</th></tr><tr><th>A</th><th>B</th></tr><tr><td>10</td><td>20</td></tr></table>').tables[0];
  assert.deepEqual(assignTableHeaders(t).issues, []);
  assert.equal(t.rows[0].cells[0].scope, 'colgroup');
  assert.equal(t.rows[1].cells[0].scope, 'col');
  assert.equal(t.rows[1].cells[1].scope, 'col');
  assert.equal(t.rows[2].cells[0].hasAttribute('headers'), false);
});

test('complex tables receive explicit ids and headers while keeping scope', () => {
  const t = createTableDraft('<table><tr><th rowspan="2">Product</th><th colspan="2">Sales</th></tr><tr><th>2025</th><th>2026</th></tr><tr><th scope="row">Book</th><td>10</td><td>20</td></tr></table>').tables[0];
  assert.deepEqual(assignTableHeaders(t).issues, []);
  const ids = Object.fromEntries([...t.table.querySelectorAll('th')].map(h => [h.textContent, h.id]));
  assert.deepEqual(t.rows[2].cells[1].headers.split(' '), [ids.Sales, ids['2025'], ids.Book]);
  assert.equal(t.rows[0].cells[0].scope, 'col');
  assert.equal(t.rows[0].cells[1].scope, 'colgroup');
  assert.equal(t.rows[2].cells[0].scope, 'row');
  const before = t.table.outerHTML;
  assert.equal(assignTableHeaders(t).changed, 0);
  assert.equal(t.table.outerHTML, before);
});

test('allocates IDs across the complete document and preserves explicit relationships', () => {
  const complex = '<table><tr><th rowspan="2">A</th><th colspan="2">Group</th></tr><tr><th>B</th><th>C</th></tr><tr><td>1</td><td>2</td><td>3</td></tr></table>';
  const d = createTableDraft('<p id="table-header-1">Intro</p>' + complex + complex);
  for (const t of d.tables) assert.deepEqual(assignTableHeaders(t).issues, []);
  const ids = d.tables.flatMap(t => [...t.table.querySelectorAll('th')].map(h => h.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.includes('table-header-1'));

  const t = createTableDraft('<table><tr><th rowspan="2" id="a">A</th><th colspan="2" id="b">Group</th></tr><tr><th id="c">B</th><th id="d">C</th></tr><tr><td headers="b c">1</td><td>2</td><td>3</td></tr></table>').tables[0];
  assert.deepEqual(assignTableHeaders(t).issues, []);
  assert.equal(t.rows[2].cells[0].headers, 'b c');
});

for (const [name, html] of Object.entries({
  missing: '<table><tr><th rowspan="2">A</th><th colspan="2">Group</th></tr><tr><th>B</th><th>C</th></tr><tr><td headers="missing">1</td><td>2</td><td>3</td></tr></table>',
  duplicate: '<p id="a">x</p><table><tr><th rowspan="2" id="a">A</th><th colspan="2">Group</th></tr><tr><th>B</th><th>C</th></tr><tr><td>1</td><td>2</td><td>3</td></tr></table>',
  uneven: '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td></tr></table>',
  noHeaders: '<table><tr><td>1</td></tr></table>',
  nested: '<table><tr><th>A</th></tr><tr><td><table><tr><td>1</td></tr></table></td></tr></table>',
})) test(`rejects ${name} without modifying the draft`, () => {
  const t = createTableDraft(html).tables[0], before = t.table.outerHTML;
  const result = assignTableHeaders(t);
  assert.ok(result.issues.length); assert.equal(result.changed, 0);
  assert.equal(t.table.outerHTML, before); assert.equal(t.dirty, false);
});

test('rowspan zero group headings do not leak into another tbody', () => {
  const t = createTableDraft('<table><thead><tr><th>Group</th><th>Value</th></tr></thead><tbody><tr><th scope="rowgroup" rowspan="0">A</th><td>1</td></tr><tr><td>2</td></tr></tbody><tbody><tr><th scope="rowgroup">B</th><td>3</td></tr></tbody></table>').tables[0];
  assert.deepEqual(assignTableHeaders(t).issues, []);
  assert.ok(t.rows[2].cells[0].headers.includes(t.rows[1].cells[0].id));
  assert.ok(!t.rows[3].cells[1].headers.split(' ').includes(t.rows[1].cells[0].id));
});

test('merged data crossing child headings requires explicit relationships', () => {
  const t = createTableDraft('<table><tr><th colspan="2">Sales</th></tr><tr><th>A</th><th>B</th></tr><tr><td colspan="2">Total</td></tr></table>').tables[0];
  const before=t.table.outerHTML;
  assert.ok(assignTableHeaders(t).issues.some(i=>i.includes('crosses')));
  assert.equal(t.table.outerHTML,before);
});

test('applied output retains generated associations for complex tables', () => {
  const draft=createTableDraft('<table><tr><th rowspan="2">Product</th><th colspan="2">Sales</th></tr><tr><th>2025</th><th>2026</th></tr><tr><th scope="row">Book</th><td>10</td><td>20</td></tr></table>');
  assignTableHeaders(draft.tables[0]);
  const output=new JSDOM(applyTableDraft(draft)).window.document;
  const value=output.querySelector('td');
  for(const id of value.headers.split(' ')) assert.equal(output.getElementById(id).tagName,'TH');
  assert.ok(output.querySelector('th[scope]'));
});

test('invalid explicit relationships do not strip valid scope', () => {
  const bad=createTableDraft('<table><tr><th rowspan="2" scope="col">Name</th><th colspan="2" scope="colgroup">Details</th></tr><tr><th scope="col">A</th><th scope="col">B</th></tr><tr><td headers="missing">1</td><td>2</td><td>3</td></tr></table>').tables[0];
  const before=bad.table.outerHTML;
  assert.ok(assignTableHeaders(bad).issues.length);
  assert.equal(bad.table.outerHTML,before);
});
