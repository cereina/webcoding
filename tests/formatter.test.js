import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
const { formatHtml } = await import('../formatter.ts');
test('formats Word-style one-line structure with indentation', () => {
  assert.equal(formatHtml('<h1>Title</h1><p>Text</p><ul><li>One</li><li>Two</li></ul>'), '<h1>Title</h1>\n<p>Text</p>\n<ul>\n  <li>One</li>\n  <li>Two</li>\n</ul>\n');
});
test('preserves inline spacing and preformatted text', () => {
  const source = '<p>Hello<strong>world</strong>! <a href="#x">Link</a>.</p><pre>  one\n    two</pre>';
  const result = formatHtml(source);
  assert.ok(result.includes('<p>Hello<strong>world</strong>! <a href="#x">Link</a>.</p>'));
  assert.ok(result.includes('<pre>  one\n    two</pre>'));
  assert.equal(formatHtml(result), result);
});
test('formats complete-page exports and preserves style content', () => {
  const result = formatHtml('<!doctype html><html lang="fr"><head><title>Page</title><style>p { color: red; }</style></head><body><main><h1>Title</h1><p>Text</p></main></body></html>');
  assert.match(result, /<body>\n    <main>\n      <h1>/);
  assert.match(result, /<style>p \{ color: red; \}<\/style>/);
  assert.match(result, /<html lang="fr">/);
  assert.equal(formatHtml(result), result);
});

