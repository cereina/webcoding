import { parseFragment, serializeOuter, type DefaultTreeAdapterTypes } from 'parse5';
import { collectExportImages, isLocalImagePath } from './image-export-model.ts';

export interface EditableImage {
  src: string; filename: string; originalName: string; alt: string; decorative: boolean;
  renameable: boolean; embedded: boolean; start: number; end: number;
  node: DefaultTreeAdapterTypes.Element;
}
export function collectEditableImages(source: string): EditableImage[] {
  const exports = collectExportImages(source);
  const result: EditableImage[] = [];
  const root = parseFragment(source, { sourceCodeLocationInfo: true });
  function visit(node: DefaultTreeAdapterTypes.Node): void {
    if ('tagName' in node && node.tagName === 'img' && node.sourceCodeLocation) {
      const src = node.attrs.find(a => a.name === 'src')?.value ?? '';
      const embedded = exports.find(image => image.occurrences.some(p => p.start === node.sourceCodeLocation?.attrs?.src?.startOffset));
      const alt = node.attrs.find(a => a.name === 'alt');
      const filename = embedded?.filename ?? (/^(data:|blob:)/i.test(src)
        ? `Image ${result.length + 1} (embedded)`
        : (src.split(/[?#]/)[0]!.split('/').pop() || 'Unnamed image'));
      result.push({ src, filename, originalName: filename, alt: alt?.value ?? '', decorative: alt?.value === '',
        renameable: Boolean(embedded) || isLocalImagePath(src), embedded: Boolean(embedded),
        start: node.sourceCodeLocation.startOffset, end: node.sourceCodeLocation.endOffset, node });
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  }
  visit(root); return result;
}
export function applyImageEdits(source: string, images: EditableImage[]): string {
  const names = new Map<string, string>();
  const edits = images.map(image => {
    const name = image.filename.trim();
    if (image.renameable) {
      const extension = image.originalName.split('.').pop()!;
      if (!/^[a-z0-9_-][a-z0-9._-]*$/i.test(name) || !name.toLowerCase().endsWith('.' + extension.toLowerCase())) throw new Error(`Use a filename ending in .${extension}, with letters, numbers, hyphens or underscores.`);
      const key = name.toLowerCase();
      if (names.has(key) && names.get(key) !== image.src) throw new Error('Different images need different filenames.');
      names.set(key, image.src);
      if (images.some(other => other.src === image.src && other.filename.trim() !== name)) throw new Error('Repeated uses of an image must share a filename.');
    }
    if (!image.decorative && !image.alt.trim()) throw new Error('Add alternative text for each image, or mark it as decorative.');
    const node = { ...image.node, attrs: image.node.attrs.map(a => ({ ...a })) };
    const set = (name: string, value: string) => { const attr = node.attrs.find(a => a.name === name); if (attr) attr.value = value; else node.attrs.push({ name, value }); };
    set('alt', image.decorative ? '' : image.alt.trim());
    if (image.embedded) set('data-maple-filename', name);
    else if (image.renameable && name !== image.originalName) set('src', image.src.slice(0, image.src.lastIndexOf('/') + 1) + name);
    return { start: image.start, end: image.end, text: serializeOuter(node) };
  });
  let html = source;
  for (const edit of edits.sort((a,b) => b.start - a.start)) html = html.slice(0,edit.start) + edit.text + html.slice(edit.end);
  return html;
}
