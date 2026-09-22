import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('');globalThis.document=dom.window.document;globalThis.DOMParser=dom.window.DOMParser;
const {createTableDraft}=await import('../table-model.ts');
const {mergeNeighbour,mergeCells,splitCell,tableGrid}=await import('../table-merge.ts');
const table=()=>createTableDraft('<table><tr><td><b>A</b></td><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr></table>').tables[0];
test('horizontal merge preserves content and split restores grid',()=>{const t=table();mergeNeighbour(t,0,0,'right');assert.equal(t.rows[0].cells[0].colSpan,2);assert.match(t.rows[0].cells[0].innerHTML,/<b>A<\/b><br>B/);splitCell(t,0,0);assert.equal(t.rows[0].cells.length,3);assert.equal(t.rows[0].cells[1].textContent,'');assert.equal(tableGrid(t).grid[0].length,3)});
test('vertical merge and split restores correct column order',()=>{const t=table();mergeNeighbour(t,0,1,'down');assert.equal(t.rows[0].cells[1].rowSpan,2);assert.equal(t.rows[1].cells.length,2);splitCell(t,0,1);assert.deepEqual([...t.rows[1].cells].map(c=>c.textContent),['D','','F']);});
test('merged rectangles can combine and split in both directions',()=>{const t=table();mergeNeighbour(t,0,0,'right');mergeNeighbour(t,1,0,'right');mergeNeighbour(t,0,0,'down');splitCell(t,0,0);assert.equal(t.rows[0].cells.length,3);assert.equal(t.rows[1].cells.length,3);});
test('misaligned spans and mixed header roles reject without mutation',()=>{const t=table();mergeNeighbour(t,0,0,'right');const before=t.table.outerHTML;assert.throws(()=>mergeNeighbour(t,0,0,'down'));assert.equal(t.table.outerHTML,before);const h=createTableDraft('<table><tr><th>H</th><td>D</td></tr></table>').tables[0];assert.throws(()=>mergeNeighbour(h,0,0,'right'));});
test('rowspan zero splits and merges do not cross row groups',()=>{const t=createTableDraft('<table><tbody><tr><td rowspan="0">A</td><td>B</td></tr><tr><td>C</td></tr></tbody><tbody><tr><td>D</td><td>E</td></tr></tbody></table>').tables[0];assert.throws(()=>mergeNeighbour(t,0,0,'down'));splitCell(t,0,0);assert.equal(t.rows[1].cells.length,2);});
test('merging headers keeps destinations and updates header associations',()=>{const t=createTableDraft('<table><tr><th>A</th><th id="b">B</th></tr><tr><td headers="b">Value</td><td>X</td></tr></table>').tables[0];mergeNeighbour(t,0,0,'right');assert.equal(t.rows[0].cells[0].id,'b');assert.equal(t.table.querySelectorAll('[id="b"]').length,1);assert.equal(t.rows[1].cells[0].headers,'b');});


test('merges a rectangular selection in one action',()=>{
 const t=table(),{grid}=tableGrid(t);
 const merged=mergeCells(t,[grid[0][0],grid[0][1],grid[1][0],grid[1][1]]);
 assert.equal(merged.rowSpan,2);
 assert.equal(merged.colSpan,2);
 assert.match(merged.textContent,/A.*B.*D.*E/s);
 assert.equal(t.rows[0].cells.length,2);
 assert.equal(t.rows[1].cells.length,1);
});
test('configurable split keeps content in top-left cell',()=>{
 const t=table(); mergeNeighbour(t,0,0,'right'); mergeNeighbour(t,0,0,'down');
 splitCell(t,0,0,2,2);
 assert.equal(t.rows[0].cells[0].textContent.includes('A'),true);
 assert.equal(t.rows[0].cells[1].textContent,'');
 assert.equal(t.rows[1].cells[0].textContent,'');
 assert.equal(t.rows[1].cells[1].textContent,'');
});
