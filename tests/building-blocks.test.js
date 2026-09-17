import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('');globalThis.window=dom.window;globalThis.document=dom.window.document;
const {makeBlock,extraBlocks}=await import('../building-blocks.ts');
const {cleanHtml}=await import('../converter.ts');
test('all text building blocks survive export cleanup with semantic elements',()=>{
 assert.equal(extraBlocks.length,10);
 for(const [key] of extraBlocks.filter(([key])=>key!=='figure')) assert.ok(cleanHtml(makeBlock(key,'','en')));
 assert.match(cleanHtml(makeBlock('quote','','en')),/<cite>/);
 assert.match(cleanHtml(makeBlock('contact','','en')),/<address>/);
 assert.match(cleanHtml(makeBlock('code','','en')),/&lt;p&gt;/);
});
test('footnote references stay unique and reciprocal across insertions',()=>{
 const first=makeBlock('footnote','<p id="footnote-1">Existing</p>','en');
 const second=makeBlock('footnote',first,'fr');
 const doc=new JSDOM(cleanHtml(first+second)).window.document;
 const ids=[...doc.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
 for(const a of doc.querySelectorAll('a')) assert.ok(doc.getElementById(a.hash.slice(1)));
 assert.match(second,/Retour au texte/);
});

