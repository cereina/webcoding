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
  ['footnote', 'WET-BOEW footnote', 'Adds a linked footnote and a root-level WET footnotes section'],
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
  return samples[key];
}

export interface WetFootnoteResult {
  html: string;
  noteNumber: number;
}

/**
 * Adds a WET-BOEW footnote reference at the requested source offset and keeps the
 * actual footnotes container as a root-level <aside>, never nested in <section>.
 */
export function insertWetFootnote(source: string, offset: number, language: string): WetFootnoteResult {
  const lang = language === 'fr' ? 'fr' : 'en';
  const position = Math.max(0, Math.min(offset, source.length));
  let marker = 'maple-wet-footnote-marker';
  let suffix = 2;
  while (source.includes(`data-${marker}`)) marker = `maple-wet-footnote-marker-${suffix++}`;

  const marked = source.slice(0, position) + `<span data-${marker}></span>` + source.slice(position);
  const template = document.createElement('template');
  template.innerHTML = marked;
  const root = template.content;
  const placeholder = root.querySelector<HTMLElement>(`[data-${marker}]`);
  if (!placeholder) throw new Error('Place the cursor between HTML elements or in text, then try the footnote tool again.');

  const ids = new Set([...root.querySelectorAll<HTMLElement>('[id]')].map(node => node.id));
  let number = 1;
  while (ids.has(`fn${number}`) || ids.has(`fn${number}-rf`)) number++;
  const noteId = `fn${number}`;
  const referenceId = `fn${number}-rf`;

  const sup = document.createElement('sup');
  sup.id = referenceId;
  const reference = document.createElement('a');
  reference.className = 'fn-lnk';
  reference.href = `#${noteId}`;
  const hiddenReference = document.createElement('span');
  hiddenReference.className = 'wb-inv';
  hiddenReference.textContent = lang === 'fr' ? 'Note de bas de page ' : 'Footnote ';
  reference.append(hiddenReference, String(number));
  sup.append(reference);
  placeholder.replaceWith(sup);

  let footnotes = root.querySelector<HTMLElement>('aside.wb-fnote');
  if (footnotes) {
    if (footnotes.closest('section')) root.append(footnotes);
    const heading = footnotes.querySelector<HTMLHeadingElement>(':scope > h2');
    if (heading) heading.textContent = lang === 'fr' ? 'Notes de bas de page' : 'Footnotes';
  } else {
    footnotes = document.createElement('aside');
    footnotes.className = 'wb-fnote';
    footnotes.setAttribute('role', 'note');
    const heading = document.createElement('h2');
    let headingId = 'fn';
    let headingSuffix = 2;
    while (ids.has(headingId)) headingId = `fn-${headingSuffix++}`;
    heading.id = headingId;
    heading.textContent = lang === 'fr' ? 'Notes de bas de page' : 'Footnotes';
    const list = document.createElement('dl');
    footnotes.append(heading, list);
    root.append(footnotes);
  }

  let list = footnotes.querySelector<HTMLDListElement>(':scope > dl');
  if (!list) {
    list = document.createElement('dl');
    footnotes.append(list);
  }

  const term = document.createElement('dt');
  term.textContent = `${lang === 'fr' ? 'Note de bas de page' : 'Footnote'} ${number}`;
  const definition = document.createElement('dd');
  definition.id = noteId;
  const text = document.createElement('p');
  text.textContent = lang === 'fr' ? 'Ajoutez le texte de votre note de bas de page ici.' : 'Add your footnote text here.';
  const returnParagraph = document.createElement('p');
  returnParagraph.className = 'fn-rtn';
  const returnLink = document.createElement('a');
  returnLink.href = `#${referenceId}`;
  const returnHidden = document.createElement('span');
  returnHidden.className = 'wb-inv';
  returnHidden.textContent = lang === 'fr' ? 'Retour à la référence de la note de bas de page ' : 'Return to footnote ';
  returnLink.append(returnHidden, String(number));
  if (lang === 'en') {
    const referrer = document.createElement('span');
    referrer.className = 'wb-inv';
    referrer.textContent = ' referrer';
    returnLink.append(referrer);
  }
  returnParagraph.append(returnLink);
  definition.append(text, returnParagraph);
  list.append(term, definition);

  return { html: template.innerHTML, noteNumber: number };
}
