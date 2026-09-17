import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import mammoth from 'mammoth';
const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
const { linkFootnotes } = await import('../footnotes.ts');
const { cleanHtml, inspectHtml, buildPage } = await import('../converter.ts');
const { formatHtml } = await import('../formatter.ts');
const parse = html => new JSDOM(html).window.document;
const targetOf = (doc, link) => doc.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
function checkReciprocal(doc, expected) {
 const references = [...doc.querySelectorAll('[role="doc-noteref"]')];
 assert.equal(references.length, expected);
 for (const reference of references) {
  const target = targetOf(doc, reference);
  assert.ok(target, 'reference destination exists');
  const note = target.tagName === 'A' ? target.closest('p,li,div') ?? target : target;
  assert.ok([...note.querySelectorAll('[role="doc-backlink"]')].some(back => targetOf(doc, back) === reference), 'note links back to the original reference');
 }
 for (const backlink of doc.querySelectorAll('[role="doc-backlink"]')) assert.equal(targetOf(doc, backlink)?.getAttribute('role'), 'doc-noteref');
}

test('links Mammoth footnote and endnote anchors with accessible reciprocal navigation', () => {
 const html = '<h1>Title</h1><p>Text <a id="footnote-ref-1" href="#footnote-1">1</a> and <a id="endnote-ref-2" href="#endnote-2">2</a></p><ol><li id="footnote-1">Footnote <a href="#footnote-ref-1">↑</a></li><li id="endnote-2">Endnote <a href="#endnote-ref-2">↑</a></li></ol>';
 const doc = parse(linkFootnotes(html));
 checkReciprocal(doc, 2);
 assert.equal(doc.querySelectorAll('[role="doc-backlink"]').length, 2);
 assert.equal(doc.getElementById('footnote-ref-1').getAttribute('aria-label'), 'Footnote 1');
 assert.equal(doc.getElementById('endnote-ref-2').getAttribute('aria-label'), 'Footnote 2');
 assert.match(doc.querySelector('[role="doc-backlink"]').textContent, /Back to reference/);
});

test('normalizes Word named anchors and supports French backlink labels', () => {
 const html = '<h1>Titre</h1><p>Texte <a name="_ftnref1" href="#_ftn1">1</a> <a name="_ednref1" href="#_edn1">2</a></p><div><p><a name="_ftn1"></a>Une note <a href="#_ftnref1">1</a></p><p><a name="_edn1"></a>Une autre note <a href="#_ednref1">2</a></p></div>';
 const cleaned = cleanHtml(html);
 assert.ok(parse(cleaned).getElementById('_ftn1'));
 assert.ok(parse(cleaned).getElementById('_edn1'));
 const doc = parse(linkFootnotes(cleaned, 'fr'));
 checkReciprocal(doc, 2);
 assert.equal(doc.getElementById('_ftnref1').getAttribute('aria-label'), 'Note 1');
 assert.ok([...doc.querySelectorAll('[role="doc-backlink"]')].every(a => a.textContent === 'Retour au texte'));
});

test('repeated references get unique IDs and one backlink each without duplicates on reprocessing', () => {
 const html = '<div id="footnote-1-reference"></div><p><a id="same" href="#footnote-1">1</a><a id="same" href="#footnote-1">1</a><a href="#footnote-1">1</a></p><ol><li id="footnote-1">Note</li></ol>';
 const linked = linkFootnotes(html);
 const doc = parse(linked);
 checkReciprocal(doc, 3);
 const ids = [...doc.querySelectorAll('[id]')].map(el => el.id);
 assert.equal(ids.length, new Set(ids).size);
 assert.equal(doc.querySelectorAll('[role="doc-backlink"]').length, 3);
 const again = parse(linkFootnotes(linked));
 checkReciprocal(again, 3);
 assert.equal(again.querySelectorAll('[role="doc-backlink"]').length, 3);
});

test('missing and ambiguous destinations remain unlinked and produce review warnings', () => {
 const html = '<h1>Title</h1><p><a id="missing" href="#footnote-9">9</a><a id="ambiguous" href="#endnote-2">2</a></p><div id="endnote-2">One</div><div id="endnote-2">Two</div>';
 const linked = linkFootnotes(html);
 const doc = parse(linked);
 assert.equal(doc.getElementById('missing').outerHTML, '<a id="missing" href="#footnote-9">9</a>');
 assert.equal(doc.getElementById('ambiguous').outerHTML, '<a id="ambiguous" href="#endnote-2">2</a>');
 assert.equal(doc.querySelector('[role="doc-backlink"]'), null);
 const warnings = inspectHtml(linked).map(f => f.message).join('\n');
 assert.match(warnings, /no matching note/);
 assert.match(warnings, /ambiguous destination/);
});

test('DOCX footnotes and endnotes survive conversion, cleanup, formatting and page export', async () => {
 const zip = new JSZip();
 const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/><Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/></Types>');
 zip.file('_rels/.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="word/document.xml"/></Relationships>`);
 zip.file('word/_rels/document.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFootnotes" Type="${rel}/footnotes" Target="footnotes.xml"/><Relationship Id="rIdEndnotes" Type="${rel}/endnotes" Target="endnotes.xml"/></Relationships>`);
 zip.file('word/document.xml', `<w:document xmlns:w="${ns}"><w:body><w:p><w:r><w:t>Document with a footnote</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:t> and an endnote</w:t></w:r><w:r><w:endnoteReference w:id="2"/></w:r></w:p></w:body></w:document>`);
 zip.file('word/footnotes.xml', `<w:footnotes xmlns:w="${ns}"><w:footnote w:id="1"><w:p><w:r><w:t>Footnote content.</w:t></w:r></w:p></w:footnote></w:footnotes>`);
 zip.file('word/endnotes.xml', `<w:endnotes xmlns:w="${ns}"><w:endnote w:id="2"><w:p><w:r><w:t>Endnote content.</w:t></w:r></w:p></w:endnote></w:endnotes>`);
 const buffer = await zip.generateAsync({type:'nodebuffer'});
 const result = await mammoth.convertToHtml({buffer});
 assert.match(result.value, /footnote-1/);
 assert.match(result.value, /endnote-2/);
 const linked = linkFootnotes(cleanHtml(result.value));
 for (const html of [linked, formatHtml(linked), buildPage(formatHtml(linked), {theme:false})]) {
  const doc = parse(html);
  checkReciprocal(doc, 2);
  assert.match(doc.body.textContent, /Footnote content/);
  assert.match(doc.body.textContent, /Endnote content/);
 }
});

test('retains Word note destination when the named anchor also contains the old return link', () => {
 const html = '<h1>Title</h1><p>Text<a name="_ftnref7" href="#_ftn7">[7]</a></p><p><a name="_ftn7" href="#_ftnref7">[7]</a>Note text</p>';
 const result = linkFootnotes(cleanHtml(html));
 const doc = parse(result);
 checkReciprocal(doc, 1);
 assert.equal(doc.getElementById('_ftnref7').getAttribute('aria-label'), 'Footnote 7');
 assert.equal(inspectHtml(result).length, 0);
});

