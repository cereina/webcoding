import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
globalThis.document=new JSDOM('').window.document;
const {createBulkTableDraft,generateTableIds,applyBulkTables}=await import('../bulk-tables-model.ts');
const table='<table><tr><td>Value</td></tr></table>';
const parse=html=>new JSDOM(html).window.document;
test('suggests only adjacent paragraphs/headings and keeps existing captions',()=>{
 const d=createBulkTableDraft('<p>Caption A</p>'+table+'<h3>Caption B</h3>'+table+'<div>Ignore</div>'+table+'<p>Ignore too</p><table><caption>Existing</caption><tr><td>x</td></tr></table>');
 assert.deepEqual(d.entries.map(e=>e.suggestion),['Caption A','Caption B','','']);
 assert.equal(d.entries[3].caption,'Existing');
});
test('generates unique IDs across all elements and preserves existing unique IDs',()=>{
 const d=createBulkTableDraft('<p id="table-1">Title</p>'+table+'<table id="keep"><tr><td>x</td></tr></table><table id="dup"></table><table id="dup"></table>');
 generateTableIds(d);const ids=d.entries.map(e=>e.table.id);
 assert.equal(ids[0],'table-1-2');assert.equal(ids[1],'keep');assert.equal(new Set(ids).size,4);
 generateTableIds(d);assert.deepEqual(d.entries.map(e=>e.table.id),ids);
});
test('applies classes and safe captions, places links after TOC, and updates without duplicating',()=>{
 const source='<nav data-maple-toc="true"><h2>On this page</h2></nav><p>A & B</p><table class="custom"><tr><td>x</td></tr></table>';
 let d=createBulkTableDraft(source);
 let html=applyBulkTables(d,['A & B'],new Map([['table-striped',true]]),true,'Tables <script>');
 let doc=parse(html),nav=doc.querySelector('[data-maple-table-toc]');
 assert.equal(nav.previousElementSibling.dataset.mapleToc,'true');
 assert.equal(nav.querySelector('h2').textContent,'Tables <script>');assert.equal(doc.querySelector('script'),null);
 assert.equal(doc.querySelector('table').className,'custom table-striped table');
 assert.equal(nav.querySelector('a').getAttribute('href'),'#'+doc.querySelector('table').id);
 assert.equal(doc.querySelector('p').textContent,'A & B');
 d=createBulkTableDraft(html);html=applyBulkTables(d,['A & B'],new Map(),true,'Updated');
 assert.equal(parse(html).querySelectorAll('[data-maple-table-toc]').length,1);
});
test('list goes first without a page TOC; requires caption and supplied heading',()=>{
 const d=createBulkTableDraft('<h1>Title</h1>'+table);
 assert.throws(()=>applyBulkTables(d,[''],new Map(),true,'Tables'),/caption/);
 assert.throws(()=>applyBulkTables(d,['Caption'],new Map(),true,''),/heading/);
 const html=applyBulkTables(d,['Caption'],new Map(),true,'Tables');
 assert.equal(parse(html).body.firstElementChild.tagName,'NAV');
});
test('classes and IDs can be applied without creating a list or caption',()=>{
 const d=createBulkTableDraft(table);generateTableIds(d);
 const doc=parse(applyBulkTables(d,[''],new Map([['table-bordered',true]]),false,''));
 assert.ok(doc.querySelector('table[id].table.table-bordered'));assert.equal(doc.querySelector('nav,caption'),null);
});

test('accepted captions move their source and preserve links and anchor targets',()=>{
 const d=createBulkTableDraft('<h3 id="results">Annual <em>results</em> <a href="#note">note</a></h3>'+table);
 const doc=parse(applyBulkTables(d,[d.entries[0].suggestion],new Map(),false,'',new Set([0])));
 assert.equal(doc.querySelector('h3'),null);
 assert.ok(doc.querySelector('caption#results em'));
 assert.equal(doc.querySelector('caption a').getAttribute('href'),'#note');
});
test('unchecked suggestions and manually entered captions retain original text',()=>{
 const d=createBulkTableDraft('<p>Original</p>'+table);
 const doc=parse(applyBulkTables(d,['Manual caption'],new Map(),false,''));
 assert.equal(doc.querySelector('p').textContent,'Original');
 assert.equal(doc.querySelector('caption').textContent,'Manual caption');
 const empty=createBulkTableDraft('<p>Original</p>'+table);
 assert.throws(()=>applyBulkTables(empty,[''],new Map(),false,'',new Set([0])),/needs a caption/);
 assert.equal(empty.root.content.querySelector('p').textContent,'Original');
});
