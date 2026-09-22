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

test('manual explicit links remove scope from participating cells and preserve unrelated headers',()=>{
 const d=m.createTableDraft('<table><tr><th scope="col">A</th><th scope="col">B</th></tr><tr><td>1</td><td>2</td></tr></table>'),t=d.tables[0];
 m.associateCellHeaders(d,t,1,0,[t.rows[0].cells[0]]);
 assert.equal(t.rows[0].cells[0].hasAttribute('scope'),false);
 assert.equal(t.rows[0].cells[1].scope,'col');
 assert.equal(t.rows[1].cells[0].headers,t.rows[0].cells[0].id);
});

test('table cleanup removes paragraph wrappers while keeping content',()=>{
 const d=m.createTableDraft('<table><tr><td><p>Hello <strong>world</strong></p><p>Again</p></td></tr></table>'),t=d.tables[0];
 assert.equal(m.removeTableParagraphs(t),2);
 assert.equal(t.table.querySelectorAll('p').length,0);
 assert.match(t.rows[0].cells[0].textContent,/Hello world.*Again/s);
});
test('table-only cleanup unwraps formatting and links but keeps table structure',()=>{
 const d=m.createTableDraft('<table><caption><span>Title</span></caption><tr><td><p><a href="https://example.com"><strong>Value</strong></a></p></td></tr></table>'),t=d.tables[0];
 assert.ok(m.keepOnlyTableTags(t)>=4);
 assert.equal(t.table.querySelector('p,a,strong,span'),null);
 assert.equal(t.table.querySelector('caption').textContent,'Title');
 assert.equal(t.rows[0].cells[0].textContent,'Value');
});
test('attribute cleanup preserves table semantics and removes presentation attributes',()=>{
 const d=m.createTableDraft('<table class="word" style="width:100%"><tr><th id="h" scope="col" class="x">Name</th><td headers="h" colspan="1" style="color:red" data-x="1">A</td></tr></table>'),t=d.tables[0];
 const count=m.removeUnnecessaryTableAttributes(t);
 assert.ok(count>=5);
 assert.equal(t.table.hasAttribute('class'),false);
 assert.equal(t.rows[0].cells[0].id,'h');
 assert.equal(t.rows[0].cells[0].scope,'col');
 assert.equal(t.rows[0].cells[1].headers,'h');
 assert.equal(t.rows[0].cells[1].hasAttribute('colspan'),false);
 assert.equal(t.rows[0].cells[1].hasAttribute('style'),false);
});
test('cleanup leaves nested tables for their own table editor entry',()=>{
 const d=m.createTableDraft('<table><tr><td><p>Outer</p><table class="inner"><tr><td><p>Inner</p></td></tr></table></td></tr></table>'),outer=d.tables[0];
 m.keepOnlyTableTags(outer);
 assert.ok(outer.table.querySelector('table.inner'));
 assert.ok(outer.table.querySelector('table.inner p'));
});
