import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
const { createTableDraft, applyTableDraft } = await import('../table-model.ts');
const { assignTableHeaders } = await import('../table-auto-headers.ts');
const simple = '<table><tr><th>Product</th><th>Price</th></tr><tr><th scope="row">Book</th><td>10</td></tr></table>';

test('assigns row and multilevel column headings and is repeatable', () => {
 const t = createTableDraft('<table><tr><th rowspan="2">Product</th><th colspan="2">Sales</th></tr><tr><th>2025</th><th>2026</th></tr><tr><th scope="row">Book</th><td>10</td><td>20</td></tr></table>').tables[0];
 assert.deepEqual(assignTableHeaders(t).issues, []);
 const ids = Object.fromEntries([...t.table.querySelectorAll('th')].map(h => [h.textContent, h.id]));
 assert.deepEqual(t.rows[2].cells[1].headers.split(' '), [ids.Sales, ids['2025'], ids.Book]);
 const before = t.table.outerHTML;
 assert.equal(assignTableHeaders(t).changed, 0);
 assert.equal(t.table.outerHTML, before);
});
test('allocates IDs across the complete document and preserves explicit relationships', () => {
 const d = createTableDraft('<p id="table-header-1">Intro</p>' + simple + simple);
 for (const t of d.tables) assert.deepEqual(assignTableHeaders(t).issues, []);
 const ids = d.tables.flatMap(t => [...t.table.querySelectorAll('th')].map(h => h.id));
 assert.equal(new Set(ids).size, ids.length);
 assert.ok(!ids.includes('table-header-1'));
 const t = createTableDraft('<table><tr><th id="a">A</th><th id="b">B</th></tr><tr><td headers="b">1</td><td>2</td></tr></table>').tables[0];
 assert.deepEqual(assignTableHeaders(t).issues, []);
 assert.equal(t.rows[1].cells[0].headers, 'b');
});
for (const [name, html] of Object.entries({
 missing: '<table><tr><th>A</th></tr><tr><td headers="missing">1</td></tr></table>',
 duplicate: '<p id="a">x</p><table><tr><th id="a">A</th></tr><tr><td>1</td></tr></table>',
 cycle: '<table><tr><th id="a" headers="b">A</th><th id="b" headers="a">B</th></tr><tr><td>1</td><td>2</td></tr></table>',
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
test('applied output retains generated associations', () => {
 const draft=createTableDraft(simple);
 assignTableHeaders(draft.tables[0]);
 const output=new JSDOM(applyTableDraft(draft)).window.document;
 const value=output.querySelector('td');
 for(const id of value.headers.split(' ')) assert.equal(output.getElementById(id).tagName,'TH');
});

test('automatic explicit associations remove scope only after successful analysis', () => {
 const draft=createTableDraft('<table><thead><tr><th scope="col">Name</th><th scope="col">Value</th></tr></thead><tbody><tr><th scope="row">A</th><td>1</td></tr></tbody></table>');
 const item=draft.tables[0];
 assert.deepEqual(assignTableHeaders(item).issues,[]);
 assert.equal(item.table.querySelector('[scope]'),null);
 assert.ok(item.table.querySelector('td').headers);
 assert.equal(new JSDOM(applyTableDraft(draft)).window.document.querySelector('[scope]'),null);
 assert.deepEqual(assignTableHeaders(item),{changed:0,issues:[]});
 const bad=createTableDraft('<table><tr><th scope="col">Name</th></tr><tr><td headers="missing">1</td></tr></table>').tables[0];
 const before=bad.table.outerHTML;
 assert.ok(assignTableHeaders(bad).issues.length);
 assert.equal(bad.table.outerHTML,before);
});
