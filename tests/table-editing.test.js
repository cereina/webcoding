import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM(''); globalThis.document=dom.window.document; globalThis.DOMParser=dom.window.DOMParser;
const m=await import('../table-model.ts');
test('cell text is escaped and edits remain in draft until applied',()=>{
 const source='<p>Keep</p><table><tr><td><b>Old</b></td></tr></table>';
 const d=m.createTableDraft(source);m.editCellText(d.tables[0],0,0,'<script>text</script>');
 assert.equal(d.source,source);assert.match(m.applyTableDraft(d),/&lt;script&gt;/);
});
test('insert and remove rows and columns preserve a nonempty rectangular table',()=>{
 const d=m.createTableDraft('<table><tr><th scope="col">Name</th><th scope="col">Value</th></tr><tr><td>A</td><td>B</td></tr></table>'),t=d.tables[0];
 m.changeTableStructure(t,'row',1,false);assert.equal(t.rows.length,3);
 m.changeTableStructure(t,'column',0,false);assert.equal(t.width,3);assert.equal(t.rows[0].cells[1].scope,'col');
 m.changeTableStructure(t,'row',2,true);m.changeTableStructure(t,'column',1,true);assert.equal(t.width,2);assert.equal(t.rows.length,2);
 m.changeTableStructure(t,'row',1,true);assert.throws(()=>m.changeTableStructure(t,'row',0,true));
});
test('complex cells support explicit headers while preserving spans',()=>{
 const d=m.createTableDraft('<p id="table-header-1">Intro</p><table><tr><td colspan="2">Group</td></tr><tr><td>A</td><td>B</td></tr></table>'),t=d.tables[0];
 m.setCellHeader(t,0,0,'colgroup');m.associateCellHeaders(d,t,1,0,[t.rows[0].cells[0]]);
 assert.equal(t.rows[0].cells[0].colSpan,2);assert.equal(t.rows[0].cells[0].id,'table-header-2');assert.equal(t.rows[1].cells[0].headers,'table-header-2');
 assert.throws(()=>m.changeTableStructure(t,'row',0,false));
 m.setCellHeader(t,0,0,'');assert.equal(t.rows[1].cells[0].headers,'');
});
test('nested tables cannot be destroyed through cell text or structure controls',()=>{
 const d=m.createTableDraft('<table><tr><td><table><tr><td>Inner</td></tr></table></td></tr></table>');
 assert.throws(()=>m.editCellText(d.tables[0],0,0,'Gone'));assert.throws(()=>m.changeTableStructure(d.tables[0],'row',0,true));
});

