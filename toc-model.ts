import { parse, parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
export interface TocHeading { key: number; text: string; level: number; id: string; selected: boolean; }
export interface TocDraft { source: string; headings: TocHeading[]; placement: string; availableLevels: number[]; selectedLevels: Set<number>; }
interface Patch { start: number; end: number; text: string; }
const escape = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[character] ?? character);
const isElement = (node: Node): node is Element => 'tagName' in node;
const attribute = (element: Element, name: string): string | undefined => element.attrs.find(item => item.name === name)?.value;
const managed = (node: Node): node is Element => isElement(node) && node.tagName === 'nav' && attribute(node, 'data-maple-toc') === 'true';
const children = (node: Node): Node[] => 'childNodes' in node ? node.childNodes : [];
function walk(node: Node, visit: (element: Element) => void, excludeToc = false): void {
  if (excludeToc && managed(node)) return;
  if (isElement(node)) visit(node);
  children(node).forEach(child => walk(child, visit, excludeToc));
}
function tree(source: string): Node {
  return /^\s*(?:<!doctype\s|<html[\s>])/i.test(source) ? parse(source, { sourceCodeLocationInfo: true }) : parseFragment(source, { sourceCodeLocationInfo: true });
}
function textContent(node: Node): string {
  if ('value' in node) return node.value;
  if (isElement(node) && ['script', 'style'].includes(node.tagName)) return '';
  return children(node).map(textContent).join('');
}
function existingTocs(root: Node): Element[] {
  const result: Element[] = [];
  function visit(node: Node): void {
    if (managed(node)) { result.push(node); return; }
    children(node).forEach(visit);
  }
  visit(root); return result;
}
function leadingH1(root: Node): Element | undefined {
  for (const child of children(root)) {
    if (child.nodeName === '#comment' || child.nodeName === '#documentType' || ('value' in child && !child.value.trim())) continue;
    if (managed(child)) continue;
    if (!isElement(child)) return undefined;
    if (child.tagName === 'head') continue;
    if (child.tagName === 'h1') return child;
    if (['html', 'body', 'main', 'div', 'article', 'section', 'header'].includes(child.tagName)) return leadingH1(child);
    return undefined;
  }
  return undefined;
}
function idCounts(root: Node): Map<string, number> {
  const result = new Map<string, number>();
  walk(root, element => { const id = attribute(element, 'id'); if (id) result.set(id, (result.get(id) ?? 0) + 1); }, true);
  return result;
}
function unique(base: string, occupied: Set<string>): string {
  let id = base; let suffix = 2;
  while (occupied.has(id)) id = `${base}-${suffix++}`;
  occupied.add(id); return id;
}
function slug(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
}
export function createTocDraft(source: string): TocDraft {
  const root = tree(source); const existing = existingTocs(root); const counts = idCounts(root);
  const occupied = new Set(counts.keys()); const previous = new Set<string>();
  existing.forEach(nav => walk(nav, element => {
    const href = attribute(element, 'href');
    if (element.tagName === 'a' && href?.startsWith('#')) {
      try { previous.add(decodeURIComponent(href.slice(1))); } catch { previous.add(href.slice(1)); }
    }
  }));
  const first = leadingH1(root); const headings: TocHeading[] = [];
  walk(root, element => {
    if (!/^h[1-6]$/.test(element.tagName) || !element.sourceCodeLocation) return;
    const text = textContent(element).replace(/\s+/g, ' ').trim(); if (!text) return;
    const oldId = attribute(element, 'id');
    const id = oldId && counts.get(oldId) === 1 ? oldId : unique(slug(text), occupied);
    headings.push({ key: element.sourceCodeLocation.startOffset, text, level: Number(element.tagName[1]), id,
      selected: existing.length > 0 ? Boolean(oldId && previous.has(oldId)) : element !== first });
  }, true);
  headings.sort((a, b) => a.key - b.key);
  const availableLevels = [...new Set(headings.map(heading => heading.level).filter(level => level >= 2 && level <= 6))].sort((a,b)=>a-b);
  const selectedLevels = new Set<number>();
  if (existing.length) {
    for (const level of availableLevels) if (headings.some(heading => heading.level === level && heading.selected)) selectedLevels.add(level);
    for (let i = 1; i < availableLevels.length; i++) {
      const previousLevel = availableLevels[i - 1]!, level = availableLevels[i]!;
      if (!selectedLevels.has(previousLevel)) selectedLevels.delete(level);
    }
  } else if (availableLevels.length) {
    selectedLevels.add(availableLevels[0]!);
  }
  headings.forEach(heading => { heading.selected = heading.level >= 2 && selectedLevels.has(heading.level); });
  return { source, headings, availableLevels, selectedLevels, placement: existing.length ? 'Replace the existing table of contents' : first ? 'After the opening heading' : 'At the top of the document' };
}

export function isTocLevelEnabled(draft: TocDraft, level: number): boolean {
  const index = draft.availableLevels.indexOf(level);
  if (index < 0) return false;
  return index === 0 || draft.selectedLevels.has(draft.availableLevels[index - 1]!);
}

export function setTocLevel(draft: TocDraft, level: number, selected: boolean): void {
  const index = draft.availableLevels.indexOf(level);
  if (index < 0) return;
  if (selected) {
    if (!isTocLevelEnabled(draft, level)) return;
    draft.selectedLevels.add(level);
    draft.headings.forEach(heading => { if (heading.level === level) heading.selected = true; });
    return;
  }
  for (const deeper of draft.availableLevels.slice(index)) {
    draft.selectedLevels.delete(deeper);
    draft.headings.forEach(heading => { if (heading.level === deeper) heading.selected = false; });
  }
}

export function renderToc(draft: TocDraft, language: string): string {
  const occupied = new Set(idCounts(tree(draft.source)).keys());
  draft.headings.forEach(heading => occupied.add(heading.id));
  const navId = unique('on-this-page', occupied); const titleId = unique('on-this-page-title', occupied);
  interface Entry { heading: TocHeading; children: Entry[] }
  const roots: Entry[] = [], stack: Entry[] = [];
  for (const heading of [...draft.headings].sort((a, b) => a.key - b.key)) {
    while (stack.length && stack[stack.length - 1]!.heading.level >= heading.level) stack.pop();
    const entry: Entry = { heading, children: [] };
    (stack.length ? stack[stack.length - 1]!.children : roots).push(entry);
    stack.push(entry);
  }
  // Omitted headings promote their children, without changing their actual ancestry.
  function selectedEntries(entries: Entry[]): Entry[] {
    return entries.flatMap(entry => {
      const children = selectedEntries(entry.children);
      return entry.heading.selected ? [{ ...entry, children }] : children;
    });
  }
  function renderEntries(entries: Entry[], depth: number): string {
    const indent = '  '.repeat(depth);
    return entries.map(({ heading, children }) => {
      const link = `<a href="#${escape(encodeURIComponent(heading.id))}">${escape(heading.text)}</a>`;
      return children.length
        ? `${indent}<li>${link}\n${indent}  <ul>\n${renderEntries(children, depth + 2)}\n${indent}  </ul>\n${indent}</li>`
        : `${indent}<li>${link}</li>`;
    }).join('\n');
  }
  const links = renderEntries(selectedEntries(roots), 2);
  return `<nav id="${navId}" data-maple-toc="true" lang="${language === 'fr' ? 'fr' : 'en'}" aria-labelledby="${titleId}">\n  <h2 id="${titleId}">On this page</h2>\n  <ul>\n${links}\n  </ul>\n</nav>`;
}
export function applyToc(draft: TocDraft, language: string): string {
  if (!draft.headings.some(heading => heading.selected)) throw new Error('Select at least one heading for the table of contents.');
  const root = tree(draft.source); const existing = existingTocs(root); const patches: Patch[] = [];
  const selected = new Map(draft.headings.filter(heading => heading.selected).map(heading => [heading.key, heading]));
  walk(root, element => {
    const location = element.sourceCodeLocation; if (!location || !/^h[1-6]$/.test(element.tagName)) return;
    const heading = selected.get(location.startOffset); if (!heading || attribute(element, 'id') === heading.id) return;
    const idLocation = location.attrs?.id;
    if (idLocation) patches.push({ start: idLocation.startOffset, end: idLocation.endOffset, text: `id="${escape(heading.id)}"` });
    else if (location.startTag) {
      const offset = location.startTag.endOffset - 1;
      patches.push({ start: offset, end: offset, text: ` id="${escape(heading.id)}"` });
    }
  }, true);
  const markup = renderToc(draft, language);
  if (existing.length) existing.forEach((nav, index) => {
    const location = nav.sourceCodeLocation;
    if (location) patches.push({ start: location.startOffset, end: location.endOffset, text: index === 0 ? markup : '' });
  });
  else {
    const first = leadingH1(root);
    let fallbackOffset = 0;
    if (root.nodeName === '#document') {
      fallbackOffset = draft.source.length;
      walk(root, element => {
        if (element.tagName === 'html') fallbackOffset = element.sourceCodeLocation?.endTag?.startOffset ?? fallbackOffset;
        if (element.tagName === 'head') fallbackOffset = element.sourceCodeLocation?.endOffset ?? fallbackOffset;
        if (element.tagName === 'body') {
          const firstChildOffset = element.childNodes.find(child => child.sourceCodeLocation)?.sourceCodeLocation?.startOffset;
          fallbackOffset = element.sourceCodeLocation?.startTag?.endOffset ?? firstChildOffset ?? fallbackOffset;
        }
      });
    }
    const offset = first?.sourceCodeLocation?.endOffset ?? fallbackOffset;
    patches.push({ start: offset, end: offset, text: offset ? `\n${markup}\n` : `${markup}\n` });
  }
  let output = draft.source;
  patches.sort((a, b) => b.start - a.start || b.end - a.end).forEach(patch => { output = output.slice(0, patch.start) + patch.text + output.slice(patch.end); });
  return output;
}




