import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
const { createTableDraft, applyTableDraft } = await import('../table-model.ts');
const { inspectTableRelationships } = await import('../table-accessibility.ts');
const inspect = html => {
 const draft = createTableDraft(html);
 const before = applyTableDraft(draft);
 const item = draft.tables[0];
 const report = inspectTableRelationships(item);
 assert.equal(applyTableDraft(draft), before);
 return { item, report, data: [...report].filter(([cell]) => cell.tagName === 'TD').map(([,value]) => value) };
};
test('shows explicit grouped headings and their parents without mutating HTML', () => {
 const {data} = inspect('<table><tr><th id="g" colspan="2">Sales</th></tr><tr><th id="a" headers="g">Actual</th><th id="b">Budget</th></tr><tr><td headers="a">10</td><td headers="b">20</td></tr></table>');
 assert.deepEqual(data[0].headings.map(h=>h.textContent), ['Actual','Sales']);
 assert.deepEqual(data[0].issues, []);
});
test('reports missing, duplicate, non-heading, outside-table and circular references', () => {
 const {data} = inspect('<p id="dup"></p><p id="text"></p><table><tr><th id="dup">A</th><th id="a" headers="b">B</th><th id="b" headers="a">C</th></tr><tr><td headers="missing dup text other a">10</td></tr></table><table><tr><th id="other">Other</th></tr></table>');
 assert.ok(data[0].issues.some(s=>s.includes('Missing')));
 assert.ok(data[0].issues.some(s=>s.includes('Ambiguous')));
 assert.equal(data[0].issues.filter(s=>s.includes('must identify')).length,2);
 assert.ok(data[0].issues.some(s=>s.includes('Circular')));
});
test('uses scope with logical coordinates for merged row headings', () => {
 const {data} = inspect('<table><tr><th scope="col">Item</th><th scope="col">Price</th></tr><tr><th rowspan="2" scope="row">Book</th><td>10</td></tr><tr><td>20</td></tr></table>');
 for(const cell of data) assert.deepEqual(cell.headings.map(h=>h.textContent),['Price','Book']);
});
test('explicit empty headers does not silently fall back to scope', () => {
 const {data} = inspect('<table><tr><th scope="col">Price</th></tr><tr><td headers="">10</td></tr></table>');
 assert.equal(data[0].method,'explicit');
 assert.equal(data[0].headings.length,0);
 assert.ok(data[0].issues.length);
});
test('rowgroup scope stays within its own body', () => {
 const {data} = inspect('<table><tbody><tr><th scope="rowgroup">Group</th><td>10</td></tr></tbody><tbody><tr><td>Other</td><td>20</td></tr></tbody></table>');
 assert.equal(data[0].headings.length,1);
 assert.equal(data[2].headings.length,0);
});
test('does not guess unscoped or column group relationships', () => {
 const {data} = inspect('<table><tr><th scope="colgroup">Group</th><th>Heading</th></tr><tr><td>1</td><td>2</td></tr></table>');
 assert.equal(data[0].headings.length,0);
 assert.ok(data[0].issues.some(s=>s.includes('manual review')));
});
