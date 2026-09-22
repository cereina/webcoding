import { formatHtml } from './formatter.ts';

const level = (node: Node): number =>
  node.nodeType === 1 && /^H[1-6]$/.test((node as Element).tagName)
    ? Number((node as Element).tagName[1])
    : 0;

function firstMeaningful(parent: Element): Node | undefined {
  return [...parent.childNodes].find(node =>
    node.nodeType === 1 || (node.nodeType === 3 && Boolean(node.textContent?.trim()))
  );
}

function headingSectionLevel(section: Element): number {
  if (section.tagName !== 'SECTION') return 0;
  const first = firstMeaningful(section);
  return first ? level(first) : 0;
}

function protectedSection(section: Element): boolean {
  return Boolean(section.closest('nav,table,thead,tbody,tfoot,tr,td,th,ul,ol,dl'));
}

function collectHeadingSectionTree(section: Element, output: Element[]): void {
  output.push(section);
  for (const child of [...section.children]) {
    if (headingSectionLevel(child) && !protectedSection(child)) collectHeadingSectionTree(child, output);
  }
}

function directHeadingSectionRuns(parent: Element | DocumentFragment): Element[][] {
  const runs: Element[][] = [];
  let current: Element[] = [];
  const flush = () => {
    if (current.length) runs.push(current);
    current = [];
  };
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === 3 && !node.textContent?.trim()) continue;
    if (node.nodeType === 1 && headingSectionLevel(node as Element) && !protectedSection(node as Element)) {
      current.push(node as Element);
      continue;
    }
    flush();
  }
  flush();
  return runs;
}

function syncHeadingSectionHierarchy(parent: Element | DocumentFragment): boolean {
  let changed = false;

  for (const roots of directHeadingSectionRuns(parent)) {
    const sections: Element[] = [];
    roots.forEach(section => collectHeadingSectionTree(section, sections));

    const stack: { level: number; section: Element }[] = [];
    let needsMove = false;
    for (const section of sections) {
      const sectionLevel = headingSectionLevel(section);
      while (stack.length && stack[stack.length - 1]!.level >= sectionLevel) stack.pop();
      const desiredParent: Node = stack.length ? stack[stack.length - 1]!.section : parent;
      if (section.parentNode !== desiredParent) needsMove = true;
      stack.push({ level: sectionLevel, section });
    }
    if (!needsMove) continue;

    const marker = document.createComment('maple-heading-section-position');
    parent.insertBefore(marker, roots[0]!);
    sections.forEach(section => section.remove());

    stack.length = 0;
    for (const section of sections) {
      const sectionLevel = headingSectionLevel(section);
      while (stack.length && stack[stack.length - 1]!.level >= sectionLevel) stack.pop();
      if (stack.length) stack[stack.length - 1]!.section.append(section);
      else parent.insertBefore(section, marker);
      stack.push({ level: sectionLevel, section });
    }
    marker.remove();
    changed = true;
  }

  for (const child of [...parent.children]) {
    if (['MAIN', 'ARTICLE', 'DIV'].includes(child.tagName) || (child.tagName === 'SECTION' && !headingSectionLevel(child))) {
      if (syncHeadingSectionHierarchy(child)) changed = true;
      continue;
    }
    if (headingSectionLevel(child)) {
      for (const nestedBoundary of [...child.children]) {
        if (['MAIN', 'ARTICLE', 'DIV'].includes(nestedBoundary.tagName) ||
            (nestedBoundary.tagName === 'SECTION' && !headingSectionLevel(nestedBoundary))) {
          if (syncHeadingSectionHierarchy(nestedBoundary)) changed = true;
        }
      }
    }
  }
  return changed;
}

function parsedRoot(source: string): { page?: Document; template: HTMLTemplateElement; root: Element | DocumentFragment } {
  const fullPage = /^\s*(?:<!doctype\s|<html[\s>])/i.test(source);
  const page = fullPage ? new DOMParser().parseFromString(source, 'text/html') : undefined;
  const template = document.createElement('template');
  if (!page) template.innerHTML = source;
  return { page, template, root: page?.body ?? template.content };
}

export function hasHeadingSections(source: string): boolean {
  const { root } = parsedRoot(source);
  return [...root.querySelectorAll('section')].some(section => headingSectionLevel(section) > 0 && !protectedSection(section));
}

/** Group headings inside their existing content container, preserving semantic boundaries. */
export function wrapHeadingSections(source: string): string {
  const { page, template, root } = parsedRoot(source);
  let changed = syncHeadingSectionHierarchy(root);

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
