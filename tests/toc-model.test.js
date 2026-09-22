import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
const { createTocDraft, renderToc, applyToc, isTocLevelEnabled, setTocLevel } = await import('../toc-model.ts');
const parse = html => new JSDOM(html).window.document;
const links = doc => [...doc.querySelectorAll('nav[data-maple-toc="true"] a')];

test('inserts after opening h1 and excludes that title from default selection', () => {
 const source = '<!--keep-->\n<h1>Main title</h1>\n<p>Intro</p><h2>Details</h2>';
 const draft = createTocDraft(source);
 assert.equal(draft.headings[0].selected, false);
 const output = applyToc(draft, 'en');
 assert.ok(output.startsWith('<!--keep-->\n<h1>Main title</h1>\n<nav'));
 const doc = parse(output);
 assert.equal(doc.querySelector('h1').nextElementSibling.tagName, 'NAV');
 assert.deepEqual(links(doc).map(a => a.textContent), ['Details']);
});

test('inserts at top when no opening h1 exists, including documents with a later h1', () => {
 for (const source of ['<p>Intro</p><h2>Details</h2>', '<p>Intro</p><h1>Later title</h1><h2>Details</h2>']) {
  const draft = createTocDraft(source);
  const output = applyToc(draft, 'en');
  assert.ok(output.startsWith('<nav'));
  assert.equal(parse(output).body.firstElementChild.tagName, 'NAV');
  assert.ok(draft.headings.filter(h => h.level >= 2).every(h => h.selected));
  assert.ok(draft.headings.filter(h => h.level === 1).every(h => !h.selected));
 }
});

test('assigns unique anchors for repeated, Unicode and punctuation-only headings', () => {
 const source = '<div id="resume">Reserved</div><h2>Résumé</h2><h2>Résumé</h2><h2>!!!</h2><h2>東京</h2><h2 id="duplicate">One</h2><h2 id="duplicate">Two</h2>';
 const draft = createTocDraft(source);
 assert.equal(new Set(draft.headings.map(h => h.id)).size, draft.headings.length);
 assert.ok(draft.headings.every(h => h.id && h.id !== 'resume' && h.id !== 'duplicate'));
 const doc = parse(applyToc(draft, 'en'));
 const ids = [...doc.querySelectorAll('[id]')].map(el => el.id);
 assert.equal(new Set(ids).size, ids.length);
 for (const a of links(doc)) assert.ok(doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))));
});

test('preserves existing unique heading IDs and safely escapes text and anchors', () => {
 const source = '<h2 id="custom:résumé">A &amp; B &lt;script&gt;</h2>';
 const draft = createTocDraft(source);
 assert.equal(draft.headings[0].id, 'custom:résumé');
 const doc = parse(applyToc(draft, 'en'));
 assert.equal(doc.querySelector('h2[id="custom:résumé"]').id, 'custom:résumé');
 assert.equal(links(doc)[0].textContent, 'A & B <script>');
 assert.equal(decodeURIComponent(links(doc)[0].getAttribute('href').slice(1)), 'custom:résumé');
 assert.equal(doc.querySelector('script'), null);
});

test('renders only selected headings in document order for both languages', () => {
 const draft = createTocDraft('<h2>First</h2><h3>Second</h3><h2>Third</h2>');
 draft.headings[1].selected = false;
 draft.headings.reverse();
 for (const language of ['en', 'fr']) {
  const doc = parse(renderToc(draft, language));
  assert.equal(doc.querySelector('nav h2').textContent, 'On this page');
  assert.equal(doc.querySelector('nav').lang, language);
  assert.deepEqual(links(doc).map(a => a.textContent), ['First', 'Third']);
 }
});

test('reopening restores selections, excludes TOC heading, and replaces its managed navigation', () => {
 const draft = createTocDraft('<h1>Title</h1><h2>First</h2><h2>Second</h2>');
 draft.headings.find(h => h.text === 'Second').selected = false;
 const first = applyToc(draft, 'en');
 const reopened = createTocDraft(first);
 assert.deepEqual(reopened.headings.map(h => h.text), ['Title', 'First', 'Second']);
 assert.deepEqual(reopened.headings.filter(h => h.selected).map(h => h.text), ['First']);
 reopened.headings.find(h => h.text === 'Second').selected = true;
 const second = parse(applyToc(reopened, 'fr'));
 assert.equal(second.querySelectorAll('nav[data-maple-toc="true"]').length, 1);
 assert.equal(second.querySelectorAll('nav h2').length, 1);
 assert.deepEqual(links(second).map(a => a.textContent), ['First', 'Second']);
});

test('preserves exact content outside inserted TOC and heading ID additions', () => {
 const source = "<!-- untouched -->\r\n<H1 class='keep'>Title &amp; intro</H1>\r\n<p data-x='yes'> A &copy; B </p>\n<H2 class='section'>Details <em>here</em></H2>\n<h3 id='stable'>Next</h3>\r\n<!-- end -->";
 const output = applyToc(createTocDraft(source), 'en');
 const withoutToc = output.replace(/\n<nav[\s\S]*?<\/nav>\n/, '');
 const withoutAddedId = withoutToc.replace(/(<H2 class='section') id="[^"]+"/, '$1');
 assert.equal(withoutAddedId, source);
});

test('cleanup retains the managed navigation marker for later editing', async () => {
 const { cleanHtml } = await import('../converter.ts');
 const output = applyToc(createTocDraft('<h1>Title</h1><h2>Details</h2>'), 'en');
 const cleaned = cleanHtml(output);
 assert.equal(parse(cleaned).querySelector('nav')?.getAttribute('data-maple-toc'), 'true');
 assert.equal(createTocDraft(cleaned).headings.some(h => h.text === 'On this page'), false);
});

test('nests H2 under its H1 list item and every deeper heading under its parent', () => {
 const draft = createTocDraft('<h1>One</h1><h2>Child</h2><h3>Detail</h3><h2>Sibling</h2><h1>Two</h1><h2>Other</h2>');
 draft.headings.forEach(h => h.selected = true);
 const doc = parse(renderToc(draft, 'en'));
 assert.deepEqual([...doc.querySelectorAll('nav > ul > li > a')].map(a=>a.textContent), ['One','Two']);
 assert.deepEqual([...doc.querySelectorAll('nav > ul > li:first-child > ul > li > a')].map(a=>a.textContent), ['Child','Sibling']);
 assert.equal(doc.querySelector('nav > ul > li > ul > li > ul > li > a').textContent,'Detail');
 assert.equal(doc.querySelectorAll('ul > ul').length,0);
 const reopened = createTocDraft(applyToc(draft,'en'));
 assert.ok(reopened.headings.filter(h=>h.level>=2).every(h=>h.selected));
 assert.ok(reopened.headings.filter(h=>h.level===1).every(h=>!h.selected));
});
test('omitted parents and skipped levels never nest under unrelated earlier siblings', () => {
 const draft = createTocDraft('<h1>Title</h1><h2>First</h2><h3>Detail</h3><h2>Omitted</h2><h4>Promoted</h4><h1>Next</h1><h2>Last</h2>');
 draft.headings.find(h=>h.text==='Omitted').selected=false;
 const doc=parse(renderToc(draft,'en'));
 assert.deepEqual([...doc.querySelectorAll('nav > ul > li > a')].map(a=>a.textContent),['First','Promoted','Next']);
 assert.equal(doc.querySelector('nav > ul > li:first-child > ul > li > a').textContent,'Detail');
 assert.equal(doc.querySelector('nav > ul > li:last-child > ul > li > a').textContent,'Last');
});



test('new TOC shows only available levels and selects only the shallowest level by default', () => {
 const draft=createTocDraft('<h1>Title</h1><h2>A</h2><h3>B</h3>');
 assert.deepEqual(draft.availableLevels,[2,3]);
 assert.deepEqual([...draft.selectedLevels],[2]);
 assert.deepEqual(draft.headings.filter(h=>h.selected).map(h=>h.level),[2]);
 assert.equal(isTocLevelEnabled(draft,2),true);
 assert.equal(isTocLevelEnabled(draft,3),true);
});
test('unchecking a parent level clears and disables deeper levels', () => {
 const draft=createTocDraft('<h2>A</h2><h3>B</h3><h4>C</h4>');
 setTocLevel(draft,3,true);
 setTocLevel(draft,4,true);
 assert.deepEqual([...draft.selectedLevels],[2,3,4]);
 setTocLevel(draft,2,false);
 assert.deepEqual([...draft.selectedLevels],[]);
 assert.equal(isTocLevelEnabled(draft,3),false);
 assert.equal(isTocLevelEnabled(draft,4),false);
 assert.equal(draft.headings.some(h=>h.selected),false);
 setTocLevel(draft,2,true);
 assert.equal(isTocLevelEnabled(draft,3),true);
 assert.equal(draft.selectedLevels.has(3),false);
});
test('missing heading levels are not exposed and dependency follows available levels', () => {
 const draft=createTocDraft('<h2>A</h2><h4>C</h4>');
 assert.deepEqual(draft.availableLevels,[2,4]);
 assert.equal(isTocLevelEnabled(draft,4),true);
 setTocLevel(draft,2,false);
 assert.equal(isTocLevelEnabled(draft,4),false);
});

test('TOC preserves normalized Word bookmark IDs', async () => {
 const { cleanHtml } = await import('../converter.ts');
 const source=cleanHtml('<p>L’<a href="#abeille">abeille</a> est dans sa maison.</p><h2><a id="abeille"></a>Abeille</h2>');
 assert.match(source,/<h2 id="abeille">Abeille<\/h2>/);
 const draft=createTocDraft(source);
 assert.equal(draft.headings.find(h=>h.text==='Abeille').id,'abeille');
 const output=applyToc(draft,'en');
 const doc=parse(output);
 assert.equal(doc.querySelector('h2#abeille').textContent,'Abeille');
 assert.ok([...doc.querySelectorAll('a[href="#abeille"]')].length>=2);
});
