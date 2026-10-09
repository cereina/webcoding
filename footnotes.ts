/** Recognizes the anchor conventions used by Mammoth and Word's clipboard HTML. */
export function isNoteTarget(id: string): boolean {
  return /^(?:footnote-|endnote-|_ftn\d|_edn\d)/i.test(id) && !/ref/i.test(id);
}

interface WetLabels {
  heading: string;
  term: string;
  hiddenReference: string;
  returnPrefix: string;
  returnSuffix: string;
}

function wetLabels(language: string): WetLabels {
  return language === 'fr'
    ? {
        heading: 'Notes de bas de page',
        term: 'Note de bas de page',
        hiddenReference: 'Note de bas de page ',
        returnPrefix: 'Retour à la référence de la note de bas de page ',
        returnSuffix: '',
      }
    : {
        heading: 'Footnotes',
        term: 'Footnote',
        hiddenReference: 'Footnote ',
        returnPrefix: 'Return to footnote ',
        returnSuffix: ' referrer',
      };
}

function decodedFragment(link: HTMLAnchorElement): string {
  const raw = (link.getAttribute('href') ?? '').replace(/^#/, '');
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function noteContainer(target: HTMLElement): HTMLElement {
  if (['LI', 'P', 'DIV'].includes(target.tagName)) return target;
  return target.closest<HTMLElement>('li,p,div') ?? target;
}

function removeEmptyNoteContainer(element: HTMLElement | null): void {
  let current = element;
  while (current && ['OL', 'UL', 'DIV'].includes(current.tagName)) {
    const parent = current.parentElement;
    if (current.children.length || (current.textContent ?? '').trim()) break;
    current.remove();
    current = parent;
  }
}

function extractedNoteContent(note: HTMLElement, targetId: string, referenceIds: ReadonlySet<string>): DocumentFragment {
  const clone = note.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');

  clone.querySelectorAll<HTMLElement>('[id]').forEach(element => {
    if (element.id !== targetId) return;
    if (element.tagName === 'A') element.remove();
    else element.removeAttribute('id');
  });

  clone.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link => {
    const destination = decodedFragment(link);
    if (referenceIds.has(destination) || link.getAttribute('role') === 'doc-backlink') link.remove();
  });

  const fragment = document.createDocumentFragment();
  if (clone.tagName === 'P') {
    fragment.append(clone);
    return fragment;
  }

  const children = [...clone.childNodes];
  const hasBlockContent = children.some(node => node.nodeType === 1 && /^(?:P|UL|OL|DL|DIV|BLOCKQUOTE|PRE|FIGURE|TABLE)$/i.test((node as Element).tagName));
  if (hasBlockContent) {
    fragment.append(...children);
    return fragment;
  }

  const paragraph = document.createElement('p');
  paragraph.append(...children);
  fragment.append(paragraph);
  return fragment;
}

function createReference(number: number, noteId: string, referenceId: string, labels: WetLabels): HTMLElement {
  const sup = document.createElement('sup');
  sup.id = referenceId;
  const link = document.createElement('a');
  link.className = 'fn-lnk';
  link.href = `#${noteId}`;
  const hidden = document.createElement('span');
  hidden.className = 'wb-inv';
  hidden.textContent = labels.hiddenReference;
  link.append(hidden, String(number));
  sup.append(link);
  return sup;
}

function createReturnLinks(number: number, referenceIds: string[], labels: WetLabels): HTMLParagraphElement {
  const paragraph = document.createElement('p');
  paragraph.className = 'fn-rtn';
  referenceIds.forEach((referenceId, index) => {
    if (index) paragraph.append(document.createTextNode(' '));
    const link = document.createElement('a');
    link.href = `#${referenceId}`;
    const hidden = document.createElement('span');
    hidden.className = 'wb-inv';
    hidden.textContent = labels.returnPrefix;
    link.append(hidden, String(number));
    if (referenceIds.length > 1) link.append(` (${index + 1})`);
    if (labels.returnSuffix) {
      const suffix = document.createElement('span');
      suffix.className = 'wb-inv';
      suffix.textContent = labels.returnSuffix;
      link.append(suffix);
    }
    paragraph.append(link);
  });
  return paragraph;
}

/**
 * Converts Mammoth/Word footnotes and endnotes to the WET-BOEW footnotes pattern.
 * The WET <aside class="wb-fnote"> is always appended at the fragment root,
 * never inside a <section>. Broken or ambiguous Word note links are left alone
 * so the accessibility review can flag them for manual repair.
 */
export function linkFootnotes(html: string, language = 'en'): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content;
  const labels = wetLabels(language);
  const occupied = new Set([...root.querySelectorAll<HTMLElement>('[id]')].map(node => node.id));
  const references = new Map<string, HTMLAnchorElement[]>();

  root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link => {
    const target = decodedFragment(link);
    if (!isNoteTarget(target)) return;
    const list = references.get(target) ?? [];
    list.push(link);
    references.set(target, list);
  });

  const valid = [...references.entries()].flatMap(([targetId, links]) => {
    const matches = [...root.querySelectorAll<HTMLElement>('[id]')].filter(node => node.id === targetId);
    return matches.length === 1 ? [{ targetId, links, target: matches[0]! }] : [];
  });
  if (!valid.length) return template.innerHTML;

  let footnotes = root.querySelector<HTMLElement>('aside.wb-fnote');
  if (footnotes?.closest('section')) root.append(footnotes);
  if (!footnotes) {
    footnotes = document.createElement('aside');
    footnotes.className = 'wb-fnote';
    footnotes.setAttribute('role', 'note');
    const heading = document.createElement('h2');
    let headingId = 'fn', suffix = 2;
    while (occupied.has(headingId)) headingId = `fn-${suffix++}`;
    occupied.add(headingId);
    heading.id = headingId;
    heading.textContent = labels.heading;
    footnotes.append(heading, document.createElement('dl'));
    root.append(footnotes);
  } else {
    let heading = footnotes.querySelector<HTMLHeadingElement>(':scope > h2');
    if (!heading) {
      heading = document.createElement('h2');
      let headingId = 'fn', suffix = 2;
      while (occupied.has(headingId)) headingId = `fn-${suffix++}`;
      occupied.add(headingId);
      heading.id = headingId;
      footnotes.prepend(heading);
    }
    heading.textContent = labels.heading;
  }

  let list = footnotes.querySelector<HTMLDListElement>(':scope > dl');
  if (!list) {
    list = document.createElement('dl');
    footnotes.append(list);
  }

  let nextNumber = 1;
  for (const { targetId, links, target } of valid) {
    while (occupied.has(`fn${nextNumber}`) || occupied.has(`fn${nextNumber}-rf`)) nextNumber++;
    const number = nextNumber++;
    const noteId = `fn${number}`;
    occupied.add(noteId);

    const referenceIds: string[] = [];
    links.forEach((link, index) => {
      let referenceId = index === 0 ? `fn${number}-rf` : `fn${number}-rf-${index + 1}`;
      let suffix = 2;
      while (occupied.has(referenceId)) referenceId = `fn${number}-rf-${index + 1}-${suffix++}`;
      occupied.add(referenceId);
      referenceIds.push(referenceId);

      const wetReference = createReference(number, noteId, referenceId, labels);
      const parentSup = link.parentElement?.tagName === 'SUP' ? link.parentElement as HTMLElement : undefined;
      if (parentSup) {
        parentSup.id = referenceId;
        parentSup.replaceChildren(...wetReference.childNodes);
      } else {
        link.replaceWith(wetReference);
      }
    });

    const originalReferenceIds = new Set(links.map(link => link.id).filter(Boolean));
    const note = noteContainer(target);
    const noteParent = note.parentElement;
    const content = extractedNoteContent(note, targetId, originalReferenceIds);
    note.remove();
    removeEmptyNoteContainer(noteParent);

    const term = document.createElement('dt');
    term.textContent = `${labels.term} ${number}`;
    const definition = document.createElement('dd');
    definition.id = noteId;
    definition.append(content, createReturnLinks(number, referenceIds, labels));
    list.append(term, definition);
  }

  // Keep the WET component at the document root even if source notes originally
  // lived inside a section or another Word-generated wrapper.
  if (footnotes.parentNode !== root) root.append(footnotes);
  return template.innerHTML;
}
