import { formatHtml } from './formatter.ts';
import { tableStyles } from './table-styles.ts';

export function createBulkTableDraft(source: string) {
  const root = document.createElement('template');
  root.innerHTML = source;
  const tables = [...root.content.querySelectorAll('table')];
  const entries = tables.map((table, index) => {
    const caption = table.caption?.textContent?.trim() || '';
    const above = table.previousElementSibling;
    const suggestion = !caption && above && /^(P|H[1-6])$/.test(above.tagName)
      ? above.textContent?.trim() || '' : '';
    return { table, index, caption, suggestion, suggestionSource: suggestion ? above : null };
  });
  return { root, entries };
}
export type BulkTableDraft = ReturnType<typeof createBulkTableDraft>;

export function generateTableIds(draft: BulkTableDraft): void {
  const elements = [...draft.root.content.querySelectorAll('[id]')];
  const counts = new Map<string, number>();
  for (const el of elements) counts.set(el.id, (counts.get(el.id) || 0) + 1);
  const used = new Set(elements.map(el => el.id));
  for (const { table, index } of draft.entries) {
    if (table.id && !/\s/.test(table.id) && counts.get(table.id) === 1) continue;
    let id = `table-${index + 1}`, suffix = 2;
    while (used.has(id)) id = `table-${index + 1}-${suffix++}`;
    table.id = id; used.add(id);
  }
}

export function applyBulkTables(draft: BulkTableDraft, captions: string[], classes: Map<string, boolean>, toc: boolean, title: string, acceptedSuggestions: Set<number> = new Set()): string {
  if (toc && !title.trim()) throw new Error('Enter a heading for the list of tables.');
  if (toc && captions.some(caption => !caption.trim())) throw new Error('Give every table a caption before creating the list of tables.');
  for (const index of acceptedSuggestions) {
    if (!draft.entries[index]?.suggestionSource || !captions[index]?.trim()) throw new Error('An accepted suggestion needs a caption.');
  }
  const allowed = new Set<string>(tableStyles.map(([name]) => name));
  for (const name of classes.keys()) if (!allowed.has(name)) throw new Error('Unknown table class.');
  draft.entries.forEach(({ table, caption, suggestion, suggestionSource }, index) => {
    const text = captions[index]?.trim() || '';
    if (text !== caption) {
      if (text) (table.caption || table.createCaption()).textContent = text;
      else table.caption?.remove();
    }
    if (acceptedSuggestions.has(index) && suggestionSource) {
      const target = table.caption!;
      // Preserve inline links, emphasis and anchors when moving the suggested text.
      if (text === suggestion) target.replaceChildren(...suggestionSource.childNodes);
      if (suggestionSource.id) {
        if (!target.id) target.id = suggestionSource.id;
        else { const anchor = document.createElement('span'); anchor.id = suggestionSource.id; target.prepend(anchor); }
      }
      suggestionSource.remove();
    }
    for (const [name, enabled] of classes) table.classList.toggle(name, enabled);
    if (classes.get('table') === false) for (const [name] of tableStyles) table.classList.remove(name);
    if ([...classes].some(([name, enabled]) => name !== 'table' && enabled)) table.classList.add('table');
    if (!table.className) table.removeAttribute('class');
  });
  if (toc) {
    generateTableIds(draft);
    draft.root.content.querySelectorAll('[data-maple-table-toc="true"]').forEach(el => el.remove());
    const nav = document.createElement('nav');
    nav.dataset.mapleTableToc = 'true';
    const heading = document.createElement('h2'); heading.textContent = title.trim();
    const used = new Set([...draft.root.content.querySelectorAll('[id]')].map(el => el.id));
    let id = 'list-of-tables-title', i = 2;
    while (used.has(id)) id = `list-of-tables-title-${i++}`;
    heading.id = id; nav.setAttribute('aria-labelledby', id);
    const list = document.createElement('ul');
    for (const { table } of draft.entries) {
      const li = document.createElement('li'), link = document.createElement('a');
      link.setAttribute('href', `#${encodeURIComponent(table.id)}`);
      link.textContent = table.caption!.textContent; li.append(link); list.append(li);
    }
    nav.append(heading, list);
    const tocElement = draft.root.content.querySelector('nav[data-maple-toc="true"], nav#toc, #table-of-contents, nav[role="doc-toc"]');
    if (tocElement) tocElement.after(nav);
    else draft.root.content.prepend(nav);
  }
  return formatHtml(draft.root.innerHTML);
}
