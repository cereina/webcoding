export const extraBlocks = [
  ['figure', 'Figure with caption', 'An embedded image, alternative text, and caption'],
  ['quote', 'Quote with attribution', 'A quotation and its source'],
  ['definitions', 'Terms and definitions', 'A glossary or labelled facts'],
  ['steps', 'Step-by-step instructions', 'Numbered steps with explanations'],
  ['related', 'Related links', 'Supporting resources for your readers'],
  ['contact', 'Contact information', 'Email, telephone, and address'],
  ['code', 'Code example', 'Code with preserved spacing'],
  ['download', 'Download link', 'A descriptive file link and size'],
  ['faq', 'Frequently asked questions', 'Expandable questions and answers'],
  ['footnote', 'Footnote and reference', 'A linked note with a return link'],
] as const;
export function makeBlock(key: string, source: string, language: string): string | undefined {
  const samples: Record<string,string> = {
    quote: '<figure><blockquote><p>Replace this text with your quotation.</p></blockquote><figcaption>Author name, <cite>Title of the source</cite></figcaption></figure>',
    definitions: '<dl><dt>Term or label</dt><dd>Add its definition or value.</dd><dt>Another term</dt><dd>Add its definition or value.</dd></dl>',
    steps: '<section><h2>How to complete this task</h2><ol><li><h3>Prepare</h3><p>Explain what readers need before starting.</p></li><li><h3>Complete the task</h3><p>Describe the action to take.</p></li><li><h3>Check the result</h3><p>Explain how to confirm success.</p></li></ol></section>',
    related: '<nav aria-label="Related resources"><h2>Related links</h2><ul><li><a href="https://example.com/guide">Read the supporting guide</a></li><li><a href="https://example.com/resources">Explore additional resources</a></li></ul></nav>',
    contact: '<section><h2>Contact us</h2><address>Organization name<br>Street address<br>City, postal code<br><a href="mailto:contact@example.com">contact@example.com</a><br><a href="tel:+15550100100">+1 555 010 0100</a></address></section>',
    code: '<figure><figcaption>Example HTML paragraph</figcaption><pre><code>&lt;p&gt;Hello, world!&lt;/p&gt;</code></pre></figure>',
    download: '<p><a href="https://example.com/user-guide.pdf">Download the user guide (PDF, 2 MB)</a></p>',
    faq: '<section><h2>Frequently asked questions</h2><details><summary>What do I need to get started?</summary><p>Replace this with your answer.</p></details><details><summary>Where can I find more information?</summary><p>Replace this with helpful information.</p></details></section>',
  };
  if(key === 'footnote') {
    const template=document.createElement('template'); template.innerHTML=source;
    const ids=new Set([...template.content.querySelectorAll('[id]')].map(e=>e.id));
    let n=1; while(ids.has(`footnote-${n}`)||ids.has(`footnote-ref-${n}`)) n++;
    const back=language==='fr'?'Retour au texte':'Back to reference';
    return `<p>Add the sentence that needs a note.<sup><a id="footnote-ref-${n}" href="#footnote-${n}" role="doc-noteref" aria-label="${language==='fr'?'Note':'Footnote'} ${n}">${n}</a></sup></p><aside id="footnote-${n}" role="note" aria-label="${language==='fr'?'Note':'Footnote'} ${n}"><p>${n}. Add your footnote text here. <a href="#footnote-ref-${n}" role="doc-backlink">${back}</a></p></aside>`;
  }
  return samples[key];
}

