import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.window = dom.window; globalThis.document = dom.window.document;
const { reviewDocument } = await import('../review-model.ts');
const { cleanHtml } = await import('../converter.ts');
test('findings map to exact original offsets with repeated content and unsafe markup', () => {
 const source='<h1>Title</h1><script>bad()</script>\n<p>Same</p><h3>Same</h3><table><tr><td>x</td></tr></table>';
 const result=reviewDocument(source,'en');
 const finding=result.findings.find(f=>f.message.includes('skips'));
 const range=result.ranges.get(finding.target);
 assert.equal(source.slice(range.start,range.end),'<h3>Same</h3>');
 assert.ok(!result.page.includes('<script>'));
 const page=new JSDOM(result.page).window.document;
 assert.equal(page.querySelector(`[${result.attribute}="${finding.target}"]`).tagName,'H3');
 assert.ok(!cleanHtml(result.page).includes(result.attribute));
});
test('maps full pages, Word headings and image findings', () => {
 const source='<!doctype html><html><body><p class="MsoHeading1">Title</p><img src="data:image/png;base64,YQ=="></body></html>';
 const r=reviewDocument(source,'fr');
 assert.equal(r.findings.filter(f=>f.message.includes('No main heading')).length,0);
 const page=new JSDOM(r.page).window.document;
 assert.ok(page.querySelector('h1').hasAttribute(r.attribute));
 const img=r.findings.find(f=>f.message.includes('needs alternative'));
 const range=r.ranges.get(img.target); assert.ok(source.slice(range.start,range.end).startsWith('<img'));
});
test('nested table headers do not hide missing outer headers and broken links are located', () => {
 const r=reviewDocument('<h1>T</h1><table><tr><td><table><tr><th>Inner</th></tr></table></td></tr></table><a href="#footnote-8">8</a>','en');
 assert.ok(r.findings.some(f=>f.message.includes('Table 1 has no header') && f.target));
 assert.ok(r.findings.some(f=>f.message.includes('no matching note') && f.target));
});

