import test from 'node:test';
import assert from 'node:assert/strict';
const { createHeadingDraft, headingWarnings, applyHeadingDraft } = await import('../heading-model.ts');

test('reads document headings in order and excludes managed TOC headings', () => {
 const source='<h1 id="title">Title</h1><nav data-maple-toc="true"><h2>On this page</h2></nav><h2 id="section">Section</h2><h3>Detail</h3>';
 const draft=createHeadingDraft(source);
 assert.deepEqual(draft.headings.map(h=>[h.level,h.text]),[[1,'Title'],[2,'Section'],[3,'Detail']]);
 assert.equal(draft.hasManagedToc,true);
});

test('changes only heading tag names while preserving IDs attributes and content', () => {
 const source='<h2 id="_Abeille" class="keep">Abeille <em>important</em></h2><p><a href="#_Abeille">Jump</a></p>';
 const draft=createHeadingDraft(source);
 draft.headings[0].level=3;
 const output=applyHeadingDraft(draft);
 assert.equal(output,'<h3 id="_Abeille" class="keep">Abeille <em>important</em></h3><p><a href="#_Abeille">Jump</a></p>');
});

test('reports skipped heading levels and multiple H1 headings', () => {
 const draft=createHeadingDraft('<h1>One</h1><h3>Skipped</h3><h1>Two</h1>');
 const warnings=headingWarnings(draft).map(w=>w.message).join('\n');
 assert.match(warnings,/2 H1 headings/);
 assert.match(warnings,/skips from H1 to H3/);
});

test('applies multiple heading changes without changing surrounding source', () => {
 const source='<!--keep--><h2 data-x="1">A</h2>\n<p>Text</p>\n<H4 id="b">B</H4><!--end-->';
 const draft=createHeadingDraft(source);
 draft.headings[0].level=3;
 draft.headings[1].level=2;
 const output=applyHeadingDraft(draft);
 assert.equal(output,'<!--keep--><h3 data-x="1">A</h3>\n<p>Text</p>\n<h2 id="b">B</h2><!--end-->');
});
