import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import mammoth from 'mammoth';
const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { cleanHtml, analyzeCleanup, plainTextToHtml, inspectHtml, buildPage } = await import('../converter.ts');
const parse = (html) => new JSDOM(html).window.document;
test('sanitizes executable markup, event handlers, styles and unsafe URLs', () => {
 const doc = parse(cleanHtml('<script>alert(1)</script><style>body{display:none}</style><iframe src="https://example.com"></iframe><p onclick="alert(1)" style="color:red">Safe</p><a href="javascript:alert(1)">Link</a>'));
 assert.equal(doc.querySelector('script,style,iframe,[onclick],[style],a[href]'), null);
 assert.equal(doc.querySelector('p').textContent, 'Safe');
});
test('preserves semantic HTML and converts Word heading styles', () => {
 const doc = parse(cleanHtml('<p class="MsoHeading1"><strong>Title</strong></p><p class="Heading2">Section</p><p class="lead MsoNormal"><em>Detail</em></p><ul><li>First</li></ul><table class="table"><caption>Rates</caption><tr><th scope="col">Name</th><td>Value</td></tr></table><a href="https://example.com">Site</a>'));
 assert.equal(doc.querySelector('h1 strong'), null);
 assert.equal(doc.querySelector('h1').textContent, 'Title');
 assert.equal(doc.querySelector('h2').textContent, 'Section');
 assert.equal(doc.querySelector('p').className, 'lead');
 assert.equal(doc.querySelector('em').textContent, 'Detail');
 assert.equal(doc.querySelector('li').textContent, 'First');
 assert.equal(doc.querySelector('th').getAttribute('scope'), 'col');
 assert.equal(doc.querySelector('a').getAttribute('href'), 'https://example.com');
});
test('allows embedded raster images and omits remote and SVG images', () => {
 const doc = parse(cleanHtml('<img src="data:image/png;base64,aGVsbG8=" alt="Chart"><img src="https://example.com/image.png" alt="Remote"><img src="data:image/svg+xml;base64,aGVsbG8=" alt="Vector">'));
 assert.equal(doc.querySelectorAll('img').length, 1);
 assert.match(doc.body.textContent, /Image omitted: Remote/);
 assert.match(doc.body.textContent, /Image omitted: Vector/);
});
test('checks heading hierarchy, table headers and link names', () => {
 const messages = inspectHtml('<h1>Title</h1><h3>Skipped</h3><h2></h2><table><tr><td>Cell</td></tr></table><a href="https://example.com">Click here</a><a></a>').map(f => f.message).join('\n');
 for (const pattern of [/skips from h1 to h3/, /no header cells/, /more descriptive name/, /no accessible text/, /no valid destination/]) assert.match(messages, pattern);
 assert.doesNotMatch(messages, /h2 heading is empty/);
 assert.match(inspectHtml('<p>Text</p>')[0].message, /No main heading/);
 assert.ok(inspectHtml('<h1>One</h1><h1>Two</h1>').some(f => /2 main headings/.test(f.message)));
});
test('distinguishes missing alternative text from decorative images', () => {
 const findings = inspectHtml('<h1>Title</h1><img src="data:image/png;base64,aGVsbG8="><img src="data:image/png;base64,aGVsbG8=" alt="">');
 assert.ok(findings.some(f => f.level === 'warning' && /needs alternative text/.test(f.message)));
 assert.ok(findings.some(f => f.level === 'info' && /decorative/.test(f.message)));
});
test('escapes document title and validates language', () => {
 const title = '</title><script>alert("x")</script> & Guide';
 const doc = parse(buildPage('<h1 onclick="alert(1)">Title</h1>', {title, language:'fr-CA'}));
 assert.equal(doc.title, title);
 assert.equal(doc.documentElement.lang, 'fr-CA');
 assert.equal(doc.querySelector('script,[onclick],link[rel="stylesheet"]'), null);
 assert.equal(parse(buildPage('', {language:'en" onclick="bad'})).documentElement.lang, 'en');
 assert.equal(parse(buildPage('')).querySelector('link[rel="stylesheet"], [class]'), null);
});
test('plain text escapes markup and keeps paragraphs and line breaks', () => {
 const doc = parse(plainTextToHtml('<script>alert("x")</script> & text\nnext\n\nSecond'));
 assert.equal(doc.querySelector('script'), null);
 assert.equal(doc.querySelectorAll('p').length, 2);
 assert.equal(doc.querySelectorAll('br').length, 1);
 assert.match(doc.body.textContent, /<script>/);
 assert.equal(plainTextToHtml('  '), '');
});
test('converts a minimal real DOCX archive', async () => {
 const zip = new JSZip();
 zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Imported title</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold text</w:t></w:r></w:p></w:body></w:document>');
 const buffer = await zip.generateAsync({type:'nodebuffer'});
 const result = await mammoth.convertToHtml({buffer}, {styleMap:['p.Heading1 => h1:fresh']});
 const doc = parse(cleanHtml(result.value));
 assert.equal(doc.querySelector('h1').textContent, 'Imported title');
 assert.equal(doc.querySelector('p strong').textContent, 'Bold text');
});


test('moves empty Word bookmark anchors onto headings without changing internal links', () => {
 const html='<p>L’<a href="#abeille">abeille</a> est dans sa maison.</p><h2><a id="abeille"></a>Abeille</h2><p>Text</p>';
 const doc=parse(cleanHtml(html));
 assert.equal(doc.querySelector('h2').id,'abeille');
 assert.equal(doc.querySelector('h2 > a[id]'),null);
 assert.equal(doc.querySelector('p a').getAttribute('href'),'#abeille');
});
test('uses a Word bookmark as the canonical heading ID and rewrites the old heading link', () => {
 const html='<p>L’<a href="#abeille">abeille</a> est dans sa <a href="#_Abeille">maison</a>.</p><h2 id="abeille"><a id="_Abeille"></a>Abeille</h2>';
 const doc=parse(cleanHtml(html));
 assert.equal(doc.querySelector('h2').id,'_Abeille');
 assert.equal(doc.querySelector('h2 > a[id]'),null);
 assert.deepEqual([...doc.querySelectorAll('p a')].map(a=>a.getAttribute('href')),['#_Abeille','#_Abeille']);
});
test('keeps bookmark anchors that are not the first meaningful heading content', () => {
 const doc=parse(cleanHtml('<h2>Prefix <a id="bookmark"></a>Heading</h2>'));
 assert.equal(doc.querySelector('h2').hasAttribute('id'),false);
 assert.equal(doc.querySelector('h2 > a').id,'bookmark');
});

test('rewrites IDREF attributes when a bookmark replaces an existing heading ID', () => {
 const html='<h2 id="abeille"><a id="_Abeille"></a>Abeille</h2><div aria-labelledby="abeille" aria-describedby="abeille other"></div><table><tr><th id="other">Other</th><td headers="abeille other">Value</td></tr></table>';
 const doc=parse(cleanHtml(html));
 const div=doc.querySelector('div');
 assert.equal(div.getAttribute('aria-labelledby'),'_Abeille');
 assert.equal(div.getAttribute('aria-describedby'),'_Abeille other');
 assert.equal(doc.querySelector('td').getAttribute('headers'),'_Abeille other');
});
test('leaves duplicate bookmark destinations untouched instead of guessing', () => {
 const doc=parse(cleanHtml('<div id="_Abeille">Other</div><h2 id="abeille"><a id="_Abeille"></a>Abeille</h2>'));
 assert.equal(doc.querySelector('h2').id,'abeille');
 assert.equal(doc.querySelector('h2 > a').id,'_Abeille');
});

test('normalizes smart apostrophes only in text content', () => {
 const html='<p title="L’abeille">L’abeille et l‘autre</p><a href="#l’abeille">L’abeille</a><h2 id="l’abeille">Titre</h2>';
 const doc=parse(cleanHtml(html));
 assert.equal(doc.querySelector('p').textContent,"L'abeille et l'autre");
 assert.equal(doc.querySelector('a').textContent,"L'abeille");
 assert.equal(doc.querySelector('p').getAttribute('title'),'L’abeille');
 assert.equal(doc.querySelector('a').getAttribute('href'),'#l’abeille');
 assert.equal(doc.querySelector('h2').id,'l’abeille');
});

test('reports cleanup changes before applying and returns prepared cleaned HTML', () => {
 const html='<p class="MsoNormal" style="color:red">L’abeille</p><h2 id="abeille"><a id="_Abeille"></a>Abeille</h2><p><a href="#abeille">Jump</a></p>';
 const report=analyzeCleanup(html);
 assert.ok(report.totalChanges >= 4);
 assert.ok(report.changes.some(item=>item.label==='Word-specific classes removed'));
 assert.ok(report.changes.some(item=>item.label==='Inline styles removed'));
 assert.ok(report.changes.some(item=>item.label==='Smart apostrophes converted'));
 assert.ok(report.changes.some(item=>item.label==='Word bookmarks normalized'));
 const doc=parse(report.cleanedHtml);
 assert.equal(doc.querySelector('p').textContent,"L'abeille");
 assert.equal(doc.querySelector('h2').id,'_Abeille');
 assert.equal(doc.querySelector('a[href="#_Abeille"]').textContent,'Jump');
});
test('cleanup report surfaces duplicate IDs and broken internal links for review', () => {
 const report=analyzeCleanup('<h2 id="same">One</h2><p id="same">Two</p><a href="#missing">Missing</a><a href="#same">Ambiguous</a>');
 assert.ok(report.warnings.some(item=>item.label==='Duplicate IDs found' && item.count===1));
 assert.ok(report.warnings.some(item=>item.label==='Internal links need review' && item.count===2));
});

test('removes strong tags from all heading levels but preserves their content', () => {
 const html='<h1><strong>Main <em>title</em></strong></h1><h2>Before <strong>bold</strong> after</h2><p><strong>Keep paragraph bold</strong></p>';
 const doc=parse(cleanHtml(html));
 assert.equal(doc.querySelector('h1 strong,h2 strong'),null);
 assert.equal(doc.querySelector('h1').innerHTML,'Main <em>title</em>');
 assert.equal(doc.querySelector('h2').textContent,'Before bold after');
 assert.equal(doc.querySelector('p strong').textContent,'Keep paragraph bold');
});

test('removes empty and whitespace-only elements recursively', () => {
 const html='<div><p></p><p> </p><p>    </p><p>&nbsp;</p><p>\u200B</p><section><span> </span></section><p>Keep</p></div>';
 const doc=parse(cleanHtml(html));
 assert.equal(doc.querySelectorAll('p').length,1);
 assert.equal(doc.querySelector('p').textContent,'Keep');
 assert.equal(doc.querySelector('section,span'),null);
});

test('preserves structural empty cells, void elements and bookmark targets', () => {
 const html='<table><tr><th></th><td> </td></tr></table><br><hr><img src="data:image/png;base64,aGVsbG8=" alt=""><a id="bookmark"></a><p></p>';
 const doc=parse(cleanHtml(html));
 assert.ok(doc.querySelector('th'));
 assert.ok(doc.querySelector('td'));
 assert.ok(doc.querySelector('br'));
 assert.ok(doc.querySelector('hr'));
 assert.ok(doc.querySelector('img'));
 assert.equal(doc.querySelector('a#bookmark')?.id,'bookmark');
 assert.equal(doc.querySelector('p'),null);
});

test('cleanup report includes heading strong removal and empty element removal', () => {
 const report=analyzeCleanup('<h2><strong>Title</strong></h2><div><p> </p></div>');
 assert.ok(report.changes.some(item=>item.label==='Strong tags removed from headings' && item.count===1));
 assert.ok(report.changes.some(item=>item.label==='Empty elements removed' && item.count>=2));
 const doc=parse(report.cleanedHtml);
 assert.equal(doc.querySelector('h2 strong'),null);
 assert.equal(doc.querySelector('p,div'),null);
});
