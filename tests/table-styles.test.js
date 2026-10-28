import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createTableDraft, applyTableDraft } from '../table-model.ts';
import { setTableStyle, createTableStyleChecklist } from '../table-styles.ts';
const dom = new JSDOM(''); globalThis.document = dom.window.document;
test('styles apply to the selected table and preserve custom classes and semantics', () => {
 const source = '<table class="custom"><caption>Title</caption><tr><th id="h" scope="col">Name</th></tr><tr><td headers="h">A</td></tr></table><table><tr><td>B</td></tr></table>';
 const draft = createTableDraft(source);
 setTableStyle(draft.tables[0], 'table-striped', true);
 const output = applyTableDraft(draft);
 const doc = new JSDOM(output).window.document;
 assert.equal(doc.querySelectorAll('table')[1].className, '');
 assert.ok(doc.querySelector('table').classList.contains('custom'));
 assert.ok(doc.querySelector('table').classList.contains('table'));
 assert.equal(doc.querySelector('td').getAttribute('headers'), 'h');
 assert.equal(doc.querySelector('th').scope, 'col');
 setTableStyle(draft.tables[0], 'table', false);
 assert.equal(draft.tables[0].table.className, 'custom');
 assert.equal(draft.source, source);
});
test('checklist reflects switching tables, restored drafts, and the empty state', () => {
 const container = document.createElement('div'); document.body.append(container);
 const draft = createTableDraft('<table class="table table-bordered"><tr><td>A</td></tr></table><table><tr><td>B</td></tr></table>');
 let selected = draft.tables[0];
 const sync = createTableStyleChecklist(container, (name, enabled) => {setTableStyle(selected, name, enabled); sync(selected);});
 sync(selected); assert.equal(container.querySelector('input[value="table-bordered"]').checked, true);
 selected = draft.tables[1]; sync(selected);
 assert.equal(container.querySelector('input[value="table-bordered"]').checked, false);
 container.querySelector('input[value="table-condensed"]').click();
 assert.equal(container.querySelector('input[value="table"]').checked, true);
 selected = createTableDraft(draft.source).tables[1]; sync(selected);
 assert.equal(container.querySelector('input[value="table-condensed"]').checked, false);
 sync(); assert.equal(container.querySelector('fieldset').disabled, true);
});

