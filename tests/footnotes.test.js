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

function checkWetFootnotes(doc, expected, language = 'en') {
  const aside = doc.querySelector('aside.wb-fnote');
  assert.ok(aside, 'WET footnotes aside exists');
  assert.equal(aside.closest('section'), null, 'WET footnotes aside is not nested in section');
  assert.equal(aside.getAttribute('role'), 'note');
  assert.equal(aside.querySelector(':scope > h2')?.textContent, language === 'fr' ? 'Notes de bas de page' : 'Footnotes');
  assert.equal(aside.querySelectorAll(':scope > dl > dt').length, expected);
  assert.equal(aside.querySelectorAll(':scope > dl > dd').length, expected);
  assert.equal(doc.querySelectorAll('a.fn-lnk').length >= expected, true);
  for (const link of doc.querySelectorAll('a.fn-lnk')) {
    const target = doc.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
    assert.ok(target, 'WET reference destination exists');
    const referrer = link.closest('sup');
    assert.ok(referrer?.id, 'WET reference has a referrer ID');
    assert.ok([...target.querySelectorAll('.fn-rtn a')].some(back => back.getAttribute('href') === `#${referrer.id}`), 'note links back to its reference');
  }
}

test('converts Mammoth footnotes and endnotes to WET-BOEW markup', () => {
  const html = '<h1>Title</h1><p>Text <a id="footnote-ref-1" href="#footnote-1">1</a> and <a id="endnote-ref-2" href="#endnote-2">2</a></p><ol><li id="footnote-1">Footnote <a href="#footnote-ref-1">↑</a></li><li id="endnote-2">Endnote <a href="#endnote-ref-2">↑</a></li></ol>';
  const doc = parse(linkFootnotes(html));
  checkWetFootnotes(doc, 2);
  assert.equal(doc.querySelector('sup#fn1-rf > a.fn-lnk')?.getAttribute('href'), '#fn1');
  assert.equal(doc.querySelector('sup#fn2-rf > a.fn-lnk')?.getAttribute('href'), '#fn2');
  assert.equal(doc.querySelector('#fn1 .wb-inv')?.textContent, 'Return to footnote ');
  assert.equal(doc.querySelector('ol'), null, 'empty Mammoth footnote list is removed');
});

test('normalizes Word named anchors and creates French WET labels', () => {
  const html = '<h1>Titre</h1><p>Texte <a name="_ftnref1" href="#_ftn1">1</a> <a name="_ednref1" href="#_edn1">2</a></p><div><p><a name="_ftn1"></a>Une note <a href="#_ftnref1">1</a></p><p><a name="_edn1"></a>Une autre note <a href="#_ednref1">2</a></p></div>';
  const cleaned = cleanHtml(html);
  assert.ok(parse(cleaned).getElementById('_ftn1'));
  assert.ok(parse(cleaned).getElementById('_edn1'));
  const doc = parse(linkFootnotes(cleaned, 'fr'));
  checkWetFootnotes(doc, 2, 'fr');
  assert.equal(doc.querySelector('sup#fn1-rf .wb-inv')?.textContent, 'Note de bas de page ');
  assert.match(doc.querySelector('#fn1 .fn-rtn .wb-inv')?.textContent ?? '', /^Retour à la référence de la note de bas de page /);
});

test('repeated references get unique WET referrer IDs and remain idempotent', () => {
  const html = '<div id="footnote-1-reference"></div><p><a id="same" href="#footnote-1">1</a><a id="same" href="#footnote-1">1</a><a href="#footnote-1">1</a></p><ol><li id="footnote-1">Note</li></ol>';
  const linked = linkFootnotes(html);
  const doc = parse(linked);
  checkWetFootnotes(doc, 1);
  const referrerIds = [...doc.querySelectorAll('a.fn-lnk')].map(link => link.closest('sup')?.id);
  assert.equal(referrerIds.length, 3);
  assert.equal(new Set(referrerIds).size, 3);
  assert.equal(doc.querySelectorAll('#fn1 .fn-rtn a').length, 3);
  const again = linkFootnotes(linked);
  assert.equal(again, linked);
});

test('missing and ambiguous Word destinations remain unconverted for review', () => {
  const html = '<h1>Title</h1><p><a id="missing" href="#footnote-9">9</a><a id="ambiguous" href="#endnote-2">2</a></p><div id="endnote-2">One</div><div id="endnote-2">Two</div>';
  const linked = linkFootnotes(html);
  const doc = parse(linked);
  assert.equal(doc.getElementById('missing').outerHTML, '<a id="missing" href="#footnote-9">9</a>');
  assert.equal(doc.getElementById('ambiguous').outerHTML, '<a id="ambiguous" href="#endnote-2">2</a>');
  assert.equal(doc.querySelector('aside.wb-fnote'), null);
  const warnings = inspectHtml(linked).map(f => f.message).join('\n');
  assert.match(warnings, /no matching note/);
  assert.match(warnings, /ambiguous destination/);
});

test('DOCX notes are automatically WET-BOEW after the same import pipeline used by the app', async () => {
  const zip = new JSZip();
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/><Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/></Types>');
  zip.file('_rels/.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFootnotes" Type="${rel}/footnotes" Target="footnotes.xml"/><Relationship Id="rIdEndnotes" Type="${rel}/endnotes" Target="endnotes.xml"/></Relationships>`);
  zip.file('word/document.xml', `<w:document xmlns:w="${ns}"><w:body><w:p><w:r><w:t>Document with a footnote</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:t> and an endnote</w:t></w:r><w:r><w:endnoteReference w:id="2"/></w:r></w:p></w:body></w:document>`);
  zip.file('word/footnotes.xml', `<w:footnotes xmlns:w="${ns}"><w:footnote w:id="1"><w:p><w:r><w:t>Footnote content.</w:t></w:r></w:p></w:footnote></w:footnotes>`);
  zip.file('word/endnotes.xml', `<w:endnotes xmlns:w="${ns}"><w:endnote w:id="2"><w:p><w:r><w:t>Endnote content.</w:t></w:r></w:p></w:endnote></w:endnotes>`);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const result = await mammoth.convertToHtml({ buffer });
  assert.match(result.value, /footnote-1/);
  assert.match(result.value, /endnote-2/);

  const imported = linkFootnotes(cleanHtml(result.value), 'en');
  for (const html of [imported, formatHtml(imported), buildPage(formatHtml(imported), { theme: false })]) {
    const doc = parse(html);
    checkWetFootnotes(doc, 2);
    assert.match(doc.body.textContent, /Footnote content/);
    assert.match(doc.body.textContent, /Endnote content/);
  }
});

test('retains note text when a Word destination anchor also contains the old return link', () => {
  const html = '<h1>Title</h1><p>Text<a name="_ftnref7" href="#_ftn7">[7]</a></p><p><a name="_ftn7" href="#_ftnref7">[7]</a>Note text</p>';
  const result = linkFootnotes(cleanHtml(html));
  const doc = parse(result);
  checkWetFootnotes(doc, 1);
  assert.match(doc.querySelector('#fn1')?.textContent ?? '', /Note text/);
  assert.equal(inspectHtml(result).length, 0);
});
