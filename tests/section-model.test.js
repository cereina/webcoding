import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('');globalThis.document=dom.window.document;globalThis.DOMParser=dom.window.DOMParser;
const {wrapHeadingSections:wrap}=await import('../section-model.ts');
const parse=s=>new JSDOM(s).window.document;
test('nests all heading levels with content and siblings',()=>{
 const source='<p>Intro</p><h1>A</h1><p>A text</p><h2>B</h2><h3>C</h3><h4>D</h4><h5>E</h5><h6>F</h6><p>F text</p><h2>G</h2><h1>H</h1>';
 const result=wrap(source),doc=parse(result);
 assert.equal(doc.querySelectorAll('body > section').length,2);
 assert.equal(doc.querySelectorAll('body > section:first-of-type > section').length,2);
 assert.equal(doc.querySelector('section section section section section section p').textContent,'F text');
 assert.equal(doc.body.firstElementChild.tagName,'P');assert.equal(wrap(result),result);
});
test('preserves existing sections and protects TOC, tables, and lists',()=>{
 const source='<section id="keep"><h1>A</h1><h2>B</h2><p>Text</p></section><nav><h2>On this page</h2></nav><table><tr><td><h3>Cell</h3></td></tr></table><ul><li><h3>Step</h3></li></ul>';
 const doc=parse(wrap(source));assert.equal(doc.querySelector('#keep > h1').textContent,'A');assert.ok(doc.querySelector('#keep > section > h2'));assert.equal(doc.querySelector('nav section, td section, li section'),null);
});
test('handles skipped levels and complete HTML documents',()=>{
 const doc=parse(wrap('<!doctype html><html lang="fr"><head><title>Keep</title></head><body><main><h1 id="a">A</h1><h4>B</h4></main></body></html>'));
 assert.equal(doc.title,'Keep');assert.equal(doc.documentElement.lang,'fr');assert.ok(doc.querySelector('main > section > section > h4'));assert.ok(doc.getElementById('a'));
});

