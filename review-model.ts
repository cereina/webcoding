import { parse, parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { buildPage, inspectHtml } from './converter.ts';

type ParseNode = DefaultTreeAdapterMap['node'];
export function reviewDocument(source: string, language: string) {
  // A fresh attribute prevents document-authored attributes from impersonating mappings.
  const attribute = `data-maple-source-${Math.random().toString(36).slice(2)}`;
  const tree = /^\s*(?:<!doctype\s|<html[\s>])/i.test(source)
    ? parse(source, { sourceCodeLocationInfo: true })
    : parseFragment(source, { sourceCodeLocationInfo: true });
  const ranges = new Map<string, { start: number; end: number }>();
  const inserts: { offset: number; text: string }[] = [];
  function walk(node: ParseNode) {
    if ('tagName' in node && node.sourceCodeLocation?.startTag) {
      const loc = node.sourceCodeLocation;
      const id = String(ranges.size);
      ranges.set(id, { start: loc.startOffset, end: loc.endOffset });
      const end = loc.startTag!.endOffset;
      inserts.push({ offset: source[end - 2] === '/' ? end - 2 : end - 1, text: ` ${attribute}="${id}"` });
    }
    if ('childNodes' in node) node.childNodes.forEach(walk);
  }
  walk(tree);
  let annotated = source;
  for (const entry of inserts.sort((a,b) => b.offset - a.offset)) annotated = annotated.slice(0, entry.offset) + entry.text + annotated.slice(entry.offset);
  return { source, attribute, ranges, findings: inspectHtml(annotated, attribute), page: buildPage(annotated, { language, sourceAttribute: attribute }).replace('<head>', '<head><base href="about:srcdoc">') };
}

