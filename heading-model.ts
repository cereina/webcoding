export interface HeadingItem {
  key: number;
  text: string;
  originalLevel: number;
  level: number;
  startTagStart: number;
  startTagEnd: number;
  endTagStart: number;
  endTagEnd: number;
}
export interface HeadingDraft { source: string; headings: HeadingItem[]; hasManagedToc: boolean; }
export interface HeadingWarning { key?: number; message: string; }

interface HeadingRange {
  level: number;
  startTagStart: number;
  startTagEnd: number;
  endTagStart: number;
  endTagEnd: number;
}

function headingRanges(source: string): HeadingRange[] {
  const ranges: HeadingRange[] = [];
  const startPattern = /<h([1-6])\b[^>]*>/gi;
  let start: RegExpExecArray | null;
  while ((start = startPattern.exec(source))) {
    const level = Number(start[1]);
    const endPattern = new RegExp(`<\\/h${level}\\s*>`, 'gi');
    endPattern.lastIndex = startPattern.lastIndex;
    const end = endPattern.exec(source);
    if (!end) continue;
    ranges.push({
      level,
      startTagStart: start.index,
      startTagEnd: start.index + start[0].length,
      endTagStart: end.index,
      endTagEnd: end.index + end[0].length,
    });
    startPattern.lastIndex = end.index + end[0].length;
  }
  return ranges;
}

function parsedHeadings(source: string): { element: HTMLHeadingElement; text: string; level: number; managed: boolean }[] {
  const fullPage = /^\s*(?:<!doctype\s|<html[\s>])/i.test(source);
  let root: ParentNode;
  if (fullPage) {
    root = new DOMParser().parseFromString(source, 'text/html');
  } else {
    const template = document.createElement('template');
    template.innerHTML = source;
    root = template.content;
  }
  return [...root.querySelectorAll<HTMLHeadingElement>('h1,h2,h3,h4,h5,h6')].map(element => ({
    element,
    text: (element.textContent ?? '').replace(/\s+/g, ' ').trim() || '(empty heading)',
    level: Number(element.tagName[1]),
    managed: Boolean(element.closest('nav[data-maple-toc="true"]')),
  }));
}

export function createHeadingDraft(source: string): HeadingDraft {
  const ranges = headingRanges(source);
  const parsed = parsedHeadings(source);
  const headings: HeadingItem[] = [];
  let hasManagedToc = false;

  const count = Math.min(ranges.length, parsed.length);
  for (let index = 0; index < count; index++) {
    const range = ranges[index]!;
    const item = parsed[index]!;
    if (item.managed) {
      hasManagedToc = true;
      continue;
    }
    headings.push({
      key: range.startTagStart,
      text: item.text,
      originalLevel: item.level,
      level: item.level,
      startTagStart: range.startTagStart,
      startTagEnd: range.startTagEnd,
      endTagStart: range.endTagStart,
      endTagEnd: range.endTagEnd,
    });
  }

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
    const endTag = draft.source.slice(heading.endTagStart, heading.endTagEnd);
    const updatedEnd = endTag.replace(/^<\/h[1-6]\s*>/i, `</h${heading.level}>`);

    if (updatedStart === startTag || updatedEnd === endTag) throw new Error('Could not safely update a heading.');
    patches.push({ start: heading.startTagStart, end: heading.startTagEnd, text: updatedStart });
    patches.push({ start: heading.endTagStart, end: heading.endTagEnd, text: updatedEnd });
  }

  let output = draft.source;
  patches.sort((a, b) => b.start - a.start).forEach(patch => {
    output = output.slice(0, patch.start) + patch.text + output.slice(patch.end);
  });
  return output;
}
