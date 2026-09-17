/** Recognizes the anchor conventions used by Mammoth and Word's clipboard HTML. */
export function isNoteTarget(id: string): boolean {
  return /^(?:footnote-|endnote-|_ftn\d|_edn\d)/i.test(id) && !/ref/i.test(id);
}
export function linkFootnotes(html: string, language = 'en'): string {
  const template = document.createElement('template'); template.innerHTML = html;
  const root = template.content;
  const occupied = new Set([...root.querySelectorAll('[id]')].map(node => node.id));
  const references = new Map<string, HTMLAnchorElement[]>();
  root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link => {
    let target = link.hash.slice(1); try { target = decodeURIComponent(target); } catch { return; }
    if (!isNoteTarget(target)) return;
    const list = references.get(target) ?? []; list.push(link); references.set(target, list);
  });
  let number = 0;
  for (const [id, links] of references) {
    number++;
    const matches = [...root.querySelectorAll<HTMLElement>('[id]')].filter(node => node.id === id);
    // Ambiguous or absent destinations must be reviewed, not guessed.
    if (matches.length !== 1) continue;
    const target = matches[0];
    const note = target.tagName === 'A' ? target.closest('p,li,div') ?? target : target;
    const originalIds = new Set(links.map(link => link.id).filter(Boolean));
    note.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link => {
      const destination = link.getAttribute('href')?.slice(1) ?? '';
      if (originalIds.has(destination) || link.getAttribute('role') === 'doc-backlink') {
        if (link === target) { link.removeAttribute('href'); link.removeAttribute('role'); }
        else link.remove();
      }
    });
    links.forEach((link, index) => {
      const duplicate = !link.id || [...root.querySelectorAll('[id]')].filter(node => node.id === link.id).length > 1;
      if (duplicate) {
        const base = `${id}-reference`; let candidate = base, suffix = 2;
        while (occupied.has(candidate)) candidate = `${base}-${suffix++}`;
        link.id = candidate; occupied.add(candidate);
      }
      link.setAttribute('role', 'doc-noteref');
      const marker = link.textContent?.trim().replace(/^\[|\]$/g, '') || String(number);
      link.setAttribute('aria-label', language === 'fr' ? `Note ${marker}` : `Footnote ${marker}`);
      const back = document.createElement('a'); back.href = `#${encodeURIComponent(link.id)}`;
      back.setAttribute('role', 'doc-backlink');
      back.textContent = language === 'fr' ? `Retour au texte${links.length > 1 ? ` (${index + 1})` : ''}` : `Back to reference${links.length > 1 ? ` (${index + 1})` : ''}`;
      note.append(document.createTextNode(' '), back);
    });
  }
  return template.innerHTML;
}

