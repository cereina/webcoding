import { formatHtml } from './formatter.ts';

/** Group headings inside their existing content container, preserving semantic boundaries. */
export function wrapHeadingSections(source: string): string {
  const fullPage = /^\s*(?:<!doctype\s|<html[\s>])/i.test(source);
  const page = fullPage ? new DOMParser().parseFromString(source, 'text/html') : undefined;
  const template = document.createElement('template');
  if (!page) template.innerHTML = source;
  const root = page?.body ?? template.content;
  let changed = false;
  const level = (node: Node): number => node.nodeType === 1 && /^H[1-6]$/.test((node as Element).tagName) ? Number((node as Element).tagName[1]) : 0;
  function group(parent: Element | DocumentFragment): void {
    // Never restructure navigation, tables, lists, or other self-contained components.
    for (const child of [...parent.children]) {
      if (['MAIN','ARTICLE','DIV','SECTION'].includes(child.tagName)) group(child);
    }
    const nodes = [...parent.childNodes];
    const first = nodes.find(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent?.trim()));
    const alreadySection = parent.nodeType === 1 && (parent as Element).tagName === 'SECTION' && first && level(first);
    const stack: { level: number; section: Element }[] = [];
    for (const node of nodes) {
      const headingLevel = level(node);
      if (headingLevel) {
        while (stack.length && stack[stack.length - 1]!.level >= headingLevel) stack.pop();
        if (alreadySection && node === first) continue;
        const section = document.createElement('section');
        if (stack.length) stack[stack.length - 1]!.section.append(section);
        else parent.insertBefore(section, node);
        section.append(node); stack.push({level: headingLevel, section}); changed = true;
      } else {
        if (node.nodeType === 1 && ['SECTION','ARTICLE','MAIN'].includes((node as Element).tagName)) {
          const firstHeading = [...(node as Element).children].find(el => /^H[1-6]$/.test(el.tagName));
          if (firstHeading) while (stack.length && stack[stack.length - 1]!.level >= Number(firstHeading.tagName[1])) stack.pop();
        }
        if (stack.length) stack[stack.length - 1]!.section.append(node);
      }
    }
  }
  group(root);
  if (!changed) return source;
  return formatHtml(page ? '<!doctype html>\n' + page.documentElement.outerHTML : template.innerHTML);
}

