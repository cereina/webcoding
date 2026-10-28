import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

export interface ExportImage {
  dataUrl: string;
  base64: string;
  extension: string;
  filename: string;
  alt: string;
  occurrences: { start: number; end: number }[];
}

export function collectExportImages(source: string): ExportImage[] {
  const images = new Map<string, ExportImage>();
  const root = parseFragment(source, { sourceCodeLocationInfo: true });
  function visit(node: DefaultTreeAdapterTypes.Node): void {
    if ('tagName' in node && node.tagName === 'img') {
      const src = node.attrs.find(a => a.name === 'src')?.value ?? '';
      const match = /^data:image\/(png|jpeg|gif|webp);base64,([a-z0-9+/=\s]+)$/i.exec(src);
      const location = node.sourceCodeLocation?.attrs?.src;
      if (match && location) {
        const base64 = match[2]!.replace(/\s/g, '');
        try { atob(base64); } catch { throw new Error('An embedded image has invalid Base64 data. Repair or remove it before exporting.'); }
        const extension = match[1]!.toLowerCase() === 'jpeg' ? 'jpg' : match[1]!.toLowerCase();
        const key = `${extension}:${base64}`;
        let image = images.get(key);
        if (!image) {
          image = { dataUrl: src, base64, extension, filename: node.attrs.find(a => a.name === 'data-maple-filename')?.value || `image-${String(images.size + 1).padStart(3, '0')}.${extension}`, alt: node.attrs.find(a => a.name === 'alt')?.value ?? '', occurrences: [] };
          images.set(key, image);
        }
        image.occurrences.push({ start: location.startOffset, end: location.endOffset });
      }
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  }
  visit(root);
  return [...images.values()];
}

/** Same-origin image paths only: no remote URLs, traversal or encoded separators. */
export function isLocalImagePath(path: string): boolean {
  return /^(?:\/?|\.\/)(?:[a-z0-9_~-][a-z0-9._~-]*\/)*[a-z0-9_~-][a-z0-9._~-]*\.(?:png|jpe?g|gif|webp)$/i.test(path);
}

export function normalizeImageDirectory(value: string): string {
  let path = value.trim();
  if (!path) throw new Error('Enter an image folder, such as /en/team/images/.');
  if (!path.endsWith('/')) path += '/';
  if (!isLocalImagePath(path + 'image.png')) throw new Error('Use a website folder such as /en/team/images/ or images/. Avoid spaces, full URLs and parent-folder paths.');
  return path;
}

export function prepareImageExport(source: string, images: ExportImage[], directory: string): { html: string; directory: string } {
  const path = normalizeImageDirectory(directory);
  const names = new Set<string>();
  const edits: { start: number; end: number; text: string }[] = [];
  for (const image of images) {
    const filename = image.filename.trim();
    if (!/^[a-z0-9_-][a-z0-9._-]*$/i.test(filename) || !filename.toLowerCase().endsWith('.' + image.extension)) {
      throw new Error(`Use a filename ending in .${image.extension}, with letters, numbers, hyphens or underscores.`);
    }
    if (names.has(filename.toLowerCase())) throw new Error('Each image needs a different filename.');
    names.add(filename.toLowerCase());
    for (const position of image.occurrences) edits.push({ ...position, text: `src="${path}${filename}"` });
  }
  let html = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) html = html.slice(0, edit.start) + edit.text + html.slice(edit.end);
  return { html, directory: path };
}
