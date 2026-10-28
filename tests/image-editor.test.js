import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { collectEditableImages, applyImageEdits } from '../image-editor-model.ts';
import { collectExportImages, prepareImageExport } from '../image-export-model.ts';
const dom = new JSDOM(''); globalThis.window = dom.window; globalThis.document = dom.window.document;
const { cleanHtml } = await import('../converter.ts');
const png = 'data:image/png;base64,aGVsbG8=';
test('descriptions are per occurrence; shared filenames survive cleanup and ZIP preparation', () => {
 const source = `<p>Before</p><img src="${png}"><img src="${png}" alt=""><p>After</p>`;
 const images = collectEditableImages(source);
 assert.equal(images[0].decorative, false); assert.equal(images[1].decorative, true);
 images.forEach(i => i.filename = 'team.png'); images[0].alt = 'Team & "friends" <outside>';
 const html = applyImageEdits(source, images);
 const parsed = new JSDOM(html).window.document;
 assert.equal(parsed.querySelector('img').alt, images[0].alt); assert.equal(parsed.querySelectorAll('img')[1].alt, '');
 const cleaned = cleanHtml(html); const exported = collectExportImages(cleaned);
 assert.equal(exported.length, 1); assert.equal(exported[0].filename, 'team.png');
 assert.match(prepareImageExport(cleaned, exported, '/images/').html, /src="\/images\/team.png"/);
 assert.ok(html.startsWith('<p>Before</p>')); assert.ok(html.endsWith('<p>After</p>'));
});
test('validates missing alt, unsafe names, duplicate names and repeated-name disagreement', () => {
 const images = collectEditableImages(`<img src="${png}"><img src="data:image/png;base64,d29ybGQ=">`);
 assert.throws(() => applyImageEdits('', images), /alternative text/);
 images.forEach(i => i.decorative = true); images[0].filename = '../bad.png';
 assert.throws(() => applyImageEdits('', images), /filename/);
 images.forEach(i => i.filename = 'same.png'); assert.throws(() => applyImageEdits('', images), /different filenames/);
 const repeated = collectEditableImages(`<img src="${png}" alt="a"><img src="${png}" alt="b">`);
 repeated[0].filename = 'new.png'; assert.throws(() => applyImageEdits('', repeated), /share a filename/);
});
test('renames existing local paths and safely preserves other attributes', () => {
 const source = '<img src="/en/images/old.png" width="20" alt="Old">';
 const images = collectEditableImages(source); images[0].filename = 'new.png'; images[0].decorative = true;
 const html = applyImageEdits(source, images);
 assert.match(html, /src="\/en\/images\/new.png"/); assert.match(html, /width="20"/); assert.match(html, /alt=""/);
 const remote = collectEditableImages('<img src="https://example.com/a.png" alt="Example">'); assert.equal(remote[0].renameable, false);
});
