import { parse, parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

export interface HeadingItem {
  key: number;
  text: string;
  originalLevel: number;
  level: number;
  startTagStart: number;
  startTagEnd: number;
  endTagStart?: number;
  endTagEnd?: number;
}
export interface HeadingDraft { source: string; headings: HeadingItem[]; hasManagedToc: boolean; }
export interface HeadingWarning { key?: number; message: string; }

const isElement = (node: Node): node is Element => 'tagName' in node;
const children = (node: Node): Node[] => 'childNodes' in node ? node.childNodes : [];
const attribute = (element: Element, name: string): string | undefined => element.attrs.find(item => item.name === name)?.value;
const managedToc = (node: Node): node is Element => isElement(node) && node.tagName === 'nav' && attribute(node, 'data-maple-toc') === 'true';

function tree(source: string): Node {
  return /^\s*(?:<!doctype\s|<html[\s>])/i.test(source)
    ? parse(source, { sourceCodeLocationInfo: true })
    : parseFragment(source, { sourceCodeLocationInfo: true });
}
function textContent(node: Node): string {
  if ('value' in node) return node.value;
  if (isElement(node) && ['script', 'style'].includes(node.tagName)) return '';
  return children(node).map(textContent).join('');
}

export function createHeadingDraft(source: string): HeadingDraft {
  const root = tree(source);
  const headings: HeadingItem[] = [];
  let hasManagedToc = false;

  function walk(node: Node): void {
    if (managedToc(node)) { hasManagedToc = true; return; }
    if (isElement(node) && /^h[1-6]$/.test(node.tagName) && node.sourceCodeLocation?.startTag) {
      const location = node.sourceCodeLocation;
      const text = textContent(node).replace(/\s+/g, ' ').trim() || '(empty heading)';
      const level = Number(node.tagName[1]);
      headings.push({
        key: location.startOffset,
        text,
        originalLevel: level,
        level,
        startTagStart: location.startTag.startOffset,
        startTagEnd: location.startTag.endOffset,
        endTagStart: location.endTag?.startOffset,
        endTagEnd: location.endTag?.endOffset,
      });
    }
    children(node).forEach(walk);
  }
  walk(root);
  headings.sort((a, b) => a.key - b.key);
  return { source, headings, hasManagedToc };
}

export function headingWarnings(draft: HeadingDraft): HeadingWarning[] {
  const warnings: HeadingWarning[] = [];
  let previous = 0;
  let h1Count = 0;
  for (const heading of draft.headings) {
    if (heading.level === 1) h1Count++;
    if (previous && heading.level > previous + 1) {
      warnings.push({
        key: heading.key,
        message: `Heading level skips from H${previous} to H${heading.level} at “${heading.text}”.`,
      });
    }
    previous = heading.level;
  }
  if (h1Count > 1) warnings.unshift({ message: `${h1Count} H1 headings found. Confirm the page should have more than one main heading.` });
  return warnings;
}

export function applyHeadingDraft(draft: HeadingDraft): string {
  const patches: { start: number; end: number; text: string }[] = [];
  for (const heading of draft.headings) {
    if (heading.level === heading.originalLevel) continue;
    if (!Number.isInteger(heading.level) || heading.level < 1 || heading.level > 6) throw new Error('Heading level must be between H1 and H6.');
    const startTag = draft.source.slice(heading.startTagStart, heading.startTagEnd);
    const updatedStart = startTag.replace(/^<h[1-6]\b/i, `<h${heading.level}`);
    if (updatedStart === startTag) throw new Error('Could not safely update a heading start tag.');
    patches.push({ start: heading.startTagStart, end: heading.startTagEnd, text: updatedStart });

    if (heading.endTagStart != null && heading.endTagEnd != null) {
      const endTag = draft.source.slice(heading.endTagStart, heading.endTagEnd);
      const updatedEnd = endTag.replace(/^<\/h[1-6]\s*>/i, `</h${heading.level}>`);
      if (updatedEnd === endTag) throw new Error('Could not safely update a heading end tag.');
      patches.push({ start: heading.endTagStart, end: heading.endTagEnd, text: updatedEnd });
    }
  }
  let output = draft.source;
  patches.sort((a, b) => b.start - a.start).forEach(patch => {
    output = output.slice(0, patch.start) + patch.text + output.slice(patch.end);
  });
  return output;
}
