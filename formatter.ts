// Indent structural HTML without inserting spaces into inline text or preformatted content.
const containers = new Set(['HTML', 'HEAD', 'BODY', 'MAIN', 'SECTION', 'ARTICLE', 'ASIDE', 'NAV', 'HEADER', 'FOOTER', 'DIV', 'UL', 'OL', 'DL', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'BLOCKQUOTE', 'FIGURE', 'DETAILS']);
const blocks = new Set([...containers, 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'DT', 'DD', 'TH', 'TD', 'CAPTION', 'FIGCAPTION', 'SUMMARY', 'PRE', 'HR', 'TITLE', 'META', 'LINK', 'STYLE', 'SCRIPT']);

// nodeType works across browser windows and in tests without global DOM constructors.
function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function formatChildren(parent: Element | DocumentFragment, depth: number): void {
  // Mixed inline content stays byte-for-byte as serialized by the browser.
  const nodes = [...parent.childNodes];
  if (!nodes.some(isElement) || !nodes.every(node =>
    (node.nodeType === 3 && !(node.textContent ?? '').trim()) || node.nodeType === 8 || node.nodeType === 10 ||
    (isElement(node) && blocks.has(node.tagName)))) return;
  const meaningful = nodes.filter(node => node.nodeType !== 3);
  parent.replaceChildren();
  meaningful.forEach((node, index) => {
    if (index || parent.nodeType === 1) parent.appendChild(document.createTextNode('\n' + '  '.repeat(depth)));
    parent.appendChild(node);
    if (isElement(node) && containers.has(node.tagName)) formatChildren(node, depth + 1);
  });
  if (parent.nodeType === 1) parent.appendChild(document.createTextNode('\n' + '  '.repeat(Math.max(0, depth - 1))));
}

export function formatHtml(source: string): string {
  if (!source.trim()) return '';
  const fullPage = /^\s*(?:<!doctype\s|<html[\s>])/i.test(source);
  if (fullPage) {
    const root = new DOMParser().parseFromString(source, 'text/html');
    formatChildren(root.documentElement, 1);
    return '<!doctype html>\n' + root.documentElement.outerHTML + '\n';
  }
  const template = document.createElement('template');
  template.innerHTML = source;
  formatChildren(template.content, 0);
  return template.innerHTML.trim() + '\n';
}

