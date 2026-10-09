import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('');
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.NodeFilter = dom.window.NodeFilter;

const { cleanHtml } = await import('../converter.ts');

test('sanitizer removes executable markup, handlers, styles and unsafe links', () => {
  const result = cleanHtml('<script>alert(1)</script><p style="color:red" onclick="alert(1)"><a href="javascript:alert(1)">Unsafe</a><strong>Safe text</strong></p>');
  assert.doesNotMatch(result, /<script|onclick=|style=|javascript:/i);
  assert.match(result, /Safe text/);
});

test('sanitizer drops remote and SVG image sources but keeps embedded raster data', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const result = cleanHtml(`<img src="https://example.invalid/a.png" alt="remote"><img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="svg"><img src="${png}" alt="local">`);
  assert.doesNotMatch(result, /https:\/\/example\.invalid|image\/svg\+xml/i);
  assert.match(result, /data:image\/png;base64/i);
});

test('sanitizer allows safe local fragments while stripping unsafe schemes', () => {
  const result = cleanHtml('<a href="#section">Section</a><a href="mailto:test@example.com">Mail</a><a href="data:text/html,boom">Bad</a>');
  assert.match(result, /href="#section"/);
  assert.match(result, /href="mailto:test@example\.com"/);
  assert.doesNotMatch(result, /data:text\/html/i);
});
