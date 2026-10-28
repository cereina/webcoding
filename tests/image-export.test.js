import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import { collectExportImages, prepareImageExport, normalizeImageDirectory } from '../image-export-model.ts';
const dom = new JSDOM(''); globalThis.window = dom.window; globalThis.document = dom.window.document;
const { cleanHtml, buildPage } = await import('../converter.ts');
const png = 'data:image/png;base64,aGVsbG8=';
test('deduplicates images and updates only src while retaining alt and source markup', async () => {
 const source=`<!-- unchanged --><p><img alt='A &amp; B' width="20" src="${png}"></p><img src='${png}' alt=""><img src="/old/existing.png" alt="Existing">`;
 const images=collectExportImages(source); assert.equal(images.length,1); assert.equal(images[0].occurrences.length,2);
 images[0].filename='team-photo.png';
 const {html}=prepareImageExport(source,images,'/en/team/images');
 assert.equal(html,source.replace(`src="${png}"`,'src="/en/team/images/team-photo.png"').replace(`src='${png}'`,'src="/en/team/images/team-photo.png"'));
 const zip=new JSZip();images.forEach(i=>zip.file(i.filename,i.base64,{base64:true}));
 const loaded=await JSZip.loadAsync(await zip.generateAsync({type:'uint8array'}));
 assert.deepEqual(Object.keys(loaded.files),['team-photo.png']); assert.equal(await loaded.file('team-photo.png').async('string'),'hello');
 assert.match(cleanHtml(html),/src="\/en\/team\/images\/team-photo.png"/);
 assert.match(buildPage(html),/src="\/en\/team\/images\/team-photo.png"/);
});
test('rejects unsafe paths, filenames, extension changes and duplicate names',()=>{
 for(const path of ['https://host/images/','//host/','../images/','/a/../b/','/a%2fb/','/a?b/','']) assert.throws(()=>normalizeImageDirectory(path));
 assert.equal(normalizeImageDirectory('images'),'images/');
 const images=collectExportImages(`<img src="${png}"><img src="data:image/png;base64,d29ybGQ=">`);
 for(const name of ['../photo.png','a/b.png','photo.jpg','a".png']) {images[0].filename=name;assert.throws(()=>prepareImageExport('',images,'/images/'));}
 images[0].filename='same.png';images[1].filename='SAME.png';assert.throws(()=>prepareImageExport('',images,'/images/'));
});
test('ignores remote and unsupported images and rejects invalid Base64',()=>{
 assert.equal(collectExportImages('<img src="https://example.com/a.png"><img src="data:image/svg+xml;base64,YQ==">').length,0);
 assert.throws(()=>collectExportImages('<img src="data:image/png;base64,a">'));
 assert.match(cleanHtml('<img src="https://example.com/a.png">'),/Image omitted/);
 assert.doesNotMatch(cleanHtml('<img src="//example.com/a.png">'),/<img/);
});
