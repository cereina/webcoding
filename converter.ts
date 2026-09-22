import { isNoteTarget } from './footnotes.ts';
import DOMPurify from 'dompurify';
const escapeHtml = (value: unknown): string => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string, string>)[c] ?? c);

export function cleanHtml(input: string, sourceAttribute?: string): string {
  const template = document.createElement('template');
  template.innerHTML = String(input ?? '');
  template.content.querySelectorAll<HTMLAnchorElement>('a[name]').forEach(anchor => {
    if (!anchor.id) anchor.id = anchor.getAttribute('name') ?? '';
  });
  template.content.querySelectorAll('p').forEach((p) => {
    const match = [...p.classList].join(' ').match(/(?:^|\\s)(?:Mso)?Heading([1-6])(?:\\s|$)/i);
    if (match) { const h = document.createElement(`h${match[1]}`); if (sourceAttribute && p.hasAttribute(sourceAttribute)) h.setAttribute(sourceAttribute, p.getAttribute(sourceAttribute)!); h.append(...p.childNodes); p.replaceWith(h); }
  });

  // Word can represent a bookmark as an empty anchor at the start of a heading.
  // Normalize it to one canonical heading ID and redirect local references to that ID.
  const idCounts = new Map<string, number>();
  template.content.querySelectorAll<HTMLElement>('[id]').forEach(element => {
    if (element.id) idCounts.set(element.id, (idCounts.get(element.id) ?? 0) + 1);
  });
  const rewriteIdReferences = (oldId: string, newId: string): void => {
    template.content.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link => {
      const href = link.getAttribute('href') ?? '';
      let target = href.slice(1);
      try { target = decodeURIComponent(target); } catch { /* Keep malformed fragments unchanged. */ }
      if (target === oldId) link.setAttribute('href', `#${encodeURIComponent(newId)}`);
    });
    for (const attribute of ['aria-labelledby', 'aria-describedby', 'headers']) {
      template.content.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach(element => {
        const ids = (element.getAttribute(attribute) ?? '').trim().split(/\\s+/).filter(Boolean);
        if (!ids.includes(oldId)) return;
        element.setAttribute(attribute, ids.map(id => id === oldId ? newId : id).join(' '));
      });
    }
  };
  template.content.querySelectorAll<HTMLHeadingElement>('h1,h2,h3,h4,h5,h6').forEach(heading => {
    const anchor = heading.querySelector<HTMLAnchorElement>(':scope > a[id]:not([href])');
    if (!anchor || !anchor.id || anchor.textContent?.trim() || anchor.children.length) return;
    let node: ChildNode | null = heading.firstChild;
    while (node && node !== anchor) {
      if (node.nodeType !== 3 || node.textContent?.trim()) return;
      node = node.nextSibling;
    }
    if (node !== anchor) return;

    const bookmarkId = anchor.id;
    const headingId = heading.id;

    if (headingId === bookmarkId) {
      // Safe legacy duplicate: the heading and its own empty bookmark carry the same ID.
      if ((idCounts.get(bookmarkId) ?? 0) === 2) anchor.remove();
      return;
    }
    // Do not guess when either destination is duplicated elsewhere in the document.
    if ((idCounts.get(bookmarkId) ?? 0) !== 1) return;
    if (headingId && (idCounts.get(headingId) ?? 0) !== 1) return;

    heading.id = bookmarkId;
    anchor.remove();
    if (headingId) rewriteIdReferences(headingId, bookmarkId);
  });
  template.innerHTML = DOMPurify.sanitize(template.innerHTML, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','hr','div','span','section','article','header','footer','aside','nav','main','strong','b','em','i','u','s','small','sup','sub','mark','abbr','blockquote','cite','address','pre','code','ul','ol','li','dl','dt','dd','a','img','figure','figcaption','table','caption','colgroup','col','thead','tbody','tfoot','tr','th','td','details','summary'],
    ALLOWED_ATTR: [...(sourceAttribute ? [sourceAttribute] : []), 'data-maple-toc','class','id','href','title','src','alt','width','height','scope','headers','span','colspan','rowspan','start','value','reversed','lang','dir','open','role','aria-label','aria-labelledby','aria-describedby','aria-hidden'],
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ['style','script','iframe','object','embed','form','input','button'],
  });
  const textWalker = document.createTreeWalker(template.content, 4); // NodeFilter.SHOW_TEXT
  while (textWalker.nextNode()) {
    const node = textWalker.currentNode;
    if (node.textContent?.match(/[‘’]/)) node.textContent = node.textContent.replace(/[‘’]/g, "'");
  }
  template.content.querySelectorAll('*').forEach((element) => {
    if (element.hasAttribute('class')) {
      const classes = [...element.classList].filter((name) => /^[a-z][a-z0-9_-]*$/i.test(name) && !/^(?:Mso|WordSection)/i.test(name));
      if (classes.length) element.className = classes.join(' '); else element.removeAttribute('class');
    }
    if (element.tagName === 'IMG' && !/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(element.getAttribute('src') || '')) {
      const replacement = document.createElement('span');
      replacement.textContent = `[Image omitted${element.getAttribute('alt') ? `: ${element.getAttribute('alt')}` : ': upload the DOCX to extract embedded images'}]`;
      element.replaceWith(replacement);
    }
    if (element.tagName === 'A' && element.hasAttribute('href')) {
      const href = (element.getAttribute('href') ?? '').trim();
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^(?:https?:|mailto:|tel:)/i.test(href)) element.removeAttribute('href');
    }
  });
  template.content.querySelectorAll('span').forEach((span) => { if (!span.attributes.length) span.replaceWith(...span.childNodes); });
  return template.innerHTML.trim();
}

export function plainTextToHtml(text: string): string {
  return String(text ?? '').trim().split(/\r?\n\s*\r?\n/).filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br>')}</p>`).join('\n');
}

// Review prompts, not a certification of accessibility compliance.
export interface HtmlFinding { level: 'warning' | 'info'; message: string; target?: string; }

export function inspectHtml(html: string, sourceAttribute?: string): HtmlFinding[] {
  const template = document.createElement('template'); template.innerHTML = cleanHtml(html, sourceAttribute);
  const root = template.content; const findings: HtmlFinding[] = [];
  let current: Element | null = null;
  const target = () => sourceAttribute ? current?.getAttribute(sourceAttribute) ?? undefined : undefined;
  const warn = (message: string): number => findings.push({level:'warning', message, target: target()});
  const count = root.querySelectorAll('h1').length;
  if (!count) warn('No main heading (h1). Add one, unless the publishing template supplies it.');
  current = root.querySelectorAll('h1')[1] ?? null;
  if (count > 1) warn(`${count} main headings (h1). Review the page heading structure.`);
  let previous = 0;
  root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => {
    current = heading;
    const level = Number(heading.tagName[1]);
    if (previous && level > previous + 1) warn(`Heading level skips from h${previous} to h${level}: “${(heading.textContent ?? '').trim().slice(0,70)}”.`);
    if (!(heading.textContent ?? '').trim()) warn(`An h${level} heading is empty.`);
    previous = level;
  });
  root.querySelectorAll('img').forEach((img, index) => {
    current = img;
    if (!img.hasAttribute('alt')) warn(`Image ${index+1} needs alternative text, or an empty alt attribute if decorative.`);
    else if (!(img.getAttribute('alt') ?? '').trim()) findings.push({level:'info',target: target(),message:`Image ${index+1} has empty alternative text. Confirm it is decorative.`});
  });
  root.querySelectorAll('img[alt]').forEach(img => { if (img.getAttribute('alt')?.trim()) findings.push({ level: 'info', message: 'Confirm this image description conveys its purpose: “' + img.getAttribute('alt')!.slice(0,100) + '”.', target: sourceAttribute ? img.getAttribute(sourceAttribute) ?? undefined : undefined }); });
  root.querySelectorAll('table').forEach((table,index) => { current = table; if (![...table.querySelectorAll('th')].some(th => th.closest('table') === table)) warn(`Table ${index+1} has no header cells. Identify its row or column headers.`); });
  root.querySelectorAll('table').forEach((table,index) => { if (!table.querySelector(':scope > caption')) findings.push({ level: 'info', message: `Table ${index+1} has no caption. Consider a descriptive title in Edit tables.`, target: sourceAttribute ? table.getAttribute(sourceAttribute) ?? undefined : undefined }); });
  root.querySelectorAll('a').forEach((link) => {
    if (!link.hasAttribute('href') && link.id) return; // Named destinations are anchors, not interactive links.
    current = link;
    const name = (link.getAttribute('aria-label') || link.textContent || link.querySelector('img')?.getAttribute('alt') || '').trim();
    if (!name) warn('A link has no accessible text. Give it a meaningful name.');
    else if (/^(?:click here|here|read more|learn more|more)$/i.test(name)) warn(`The link “${name}” may need a more descriptive name.`);
    const href = link.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      let target = href.slice(1); try { target = decodeURIComponent(target); } catch { /* Keep malformed fragments for review. */ }
      if (target) {
        const matches = [...root.querySelectorAll('[id]')].filter(node => node.id === target);
        if (matches.length !== 1) warn(`${isNoteTarget(target) ? 'Footnote reference' : 'Internal link'} ${link.textContent?.trim() || target} has ${matches.length ? 'an ambiguous destination' : 'no matching note'}. Upload the original Word document or repair its target.`);
      }
    }
    if (!link.hasAttribute('href')) warn(`The link “${name || '(unnamed)'}” has no valid destination.`);
  });
  return findings;
}

export interface PageOptions { language?: string; title?: string; sourceAttribute?: string; }

export function buildPage(html: string, {language='en', title='Converted document', sourceAttribute}: PageOptions = {}): string {
  const lang = /^(?:en|fr)(?:-CA)?$/.test(language) ? language : 'en';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{font-family:Arial,sans-serif;line-height:1.65;color:#26374a;background:#fff;margin:0}body > main{max-width:1100px;margin:auto;padding:32px}h1,h2,h3,h4,h5,h6{line-height:1.25}a{color:#284162;text-decoration:underline}img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #aab3bd;padding:.6em;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere}blockquote{border-left:4px solid #aab3bd;padding-left:1em}</style>
</head>
<body><main>
${cleanHtml(html, sourceAttribute)}
</main></body>
</html>`;
}


