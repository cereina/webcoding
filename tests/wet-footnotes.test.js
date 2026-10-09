import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Element = dom.window.Element;

const { insertWetFootnote } = await import('../building-blocks.ts');

function parseFragment(html) {
  const page = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
  return page.window.document;
}

test('creates an English WET-BOEW footnote section outside section tags', () => {
  const source = '<section><h2>Details</h2><p>Sentence that needs a note.</p></section>';
  const offset = source.indexOf('</p>');
  const result = insertWetFootnote(source, offset, 'en');
  const doc = parseFragment(result.html);

  const aside = doc.querySelector('aside.wb-fnote');
  assert.ok(aside);
  assert.equal(aside.getAttribute('role'), 'note');
  assert.equal(aside.closest('section'), null);
  assert.equal(aside.parentElement.tagName, 'BODY');
  assert.equal(aside.querySelector(':scope > h2').textContent, 'Footnotes');
  assert.equal(aside.querySelector(':scope > h2').id, 'fn');
  assert.equal(aside.querySelector('dt').textContent, 'Footnote 1');
  assert.equal(aside.querySelector('dd').id, 'fn1');

  const reference = doc.querySelector('sup#fn1-rf > a.fn-lnk');
  assert.ok(reference);
  assert.equal(reference.getAttribute('href'), '#fn1');
  assert.equal(reference.querySelector('.wb-inv').textContent, 'Footnote ');
  assert.equal(doc.querySelector('#fn1 .fn-rtn a').getAttribute('href'), '#fn1-rf');
});

test('creates French WET-BOEW labels when French is selected', () => {
  const source = '<p>Phrase avec une note.</p>';
  const result = insertWetFootnote(source, source.indexOf('</p>'), 'fr');
  const doc = parseFragment(result.html);

  const aside = doc.querySelector('aside.wb-fnote');
  assert.equal(aside.querySelector(':scope > h2').textContent, 'Notes de bas de page');
  assert.equal(aside.querySelector('dt').textContent, 'Note de bas de page 1');
  assert.equal(doc.querySelector('sup a .wb-inv').textContent, 'Note de bas de page ');
  assert.match(doc.querySelector('#fn1 .fn-rtn a .wb-inv').textContent, /^Retour à la référence de la note de bas de page /);
});

test('reuses a WET footnotes aside and moves it out of a section if necessary', () => {
  const source = '<section><h2>Content</h2><p>Text.</p><aside class="wb-fnote" role="note"><h2 id="fn">Footnotes</h2><dl><dt>Footnote 1</dt><dd id="fn1"><p>Existing note.</p></dd></dl></aside></section>';
  const offset = source.indexOf('</p>');
  const result = insertWetFootnote(source, offset, 'en');
  const doc = parseFragment(result.html);

  const asides = doc.querySelectorAll('aside.wb-fnote');
  assert.equal(asides.length, 1);
  assert.equal(asides[0].closest('section'), null);
  assert.equal(asides[0].querySelectorAll('dt').length, 2);
  assert.ok(asides[0].querySelector('#fn2'));
  assert.ok(doc.querySelector('#fn2-rf'));
});

test('does not mix English and French in one existing WET footnotes section', () => {
  const source = '<p>Text.</p><aside class="wb-fnote" role="note"><h2 id="fn">Footnotes</h2><dl></dl></aside>';
  assert.throws(() => insertWetFootnote(source, source.indexOf('</p>'), 'fr'), /already has an English/);
});
