import { collectExportImages, prepareImageExport, type ExportImage } from './image-export-model.ts';
import './image-export.css';

export function setupImageExport(options: { getSource: () => string; commit: (html: string, message: string) => void }): void {
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'button secondary'; trigger.textContent = 'Export images';
  document.getElementById('download')!.before(trigger);
  const dialog = document.createElement('dialog');
  dialog.className = 'image-export-dialog'; dialog.setAttribute('aria-labelledby', 'image-export-title');
  dialog.innerHTML = `<header><div><h2 id="image-export-title">Export images</h2><p>Download embedded images and replace their HTML sources with your website paths.</p></div><button type="button" class="button ghost" data-close aria-label="Close image export">✕</button></header>
    <div class="image-export-body"><label for="image-folder">Website image folder</label><input id="image-folder" placeholder="/en/team/images/" value="/images/" aria-describedby="image-folder-help"><p id="image-folder-help">Use /en/team/images/ or images/. Upload the extracted ZIP files to that folder on your website. Images may appear missing in the preview until those files are hosted.</p><p data-count></p><div data-images></div></div>
    <footer><p role="status" data-status>Alternative text stays unchanged. Document Undo restores embedded images.</p><div><button type="button" class="button secondary" data-close>Cancel</button><button type="button" class="button primary" data-export>Download ZIP &amp; update HTML</button></div></footer>`;
  document.body.append(dialog);
  const folder = dialog.querySelector<HTMLInputElement>('#image-folder')!;
  const list = dialog.querySelector<HTMLElement>('[data-images]')!;
  const status = dialog.querySelector<HTMLElement>('[data-status]')!;
  const apply = dialog.querySelector<HTMLButtonElement>('[data-export]')!;
  let source = '', images: ExportImage[] = [], busy = false;
  const previews: HTMLElement[] = [];
  const validate = (): boolean => {
    try {
      const result = prepareImageExport(source, images, folder.value);
      previews.forEach((preview, i) => { preview.textContent = result.directory + images[i]!.filename.trim(); });
      status.textContent = images.length ? 'Alternative text stays unchanged. Document Undo restores embedded images.' : 'No embedded PNG, JPEG, GIF or WebP images found. Import a Word document or insert an image first.';
      apply.disabled = busy || !images.length;
      return true;
    } catch (error) {
      apply.disabled = true; status.textContent = (error as Error).message;
      previews.forEach(preview => { preview.textContent = 'Correct the folder or filenames to preview the URL.'; });
      return false;
    }
  };
  folder.addEventListener('input', validate);
  trigger.onclick = () => {
    source = options.getSource(); list.replaceChildren(); previews.length = 0;
    try { images = collectExportImages(source); }
    catch(error) { images = []; status.textContent = (error as Error).message; apply.disabled = true; dialog.showModal(); return; }
    dialog.querySelector('[data-count]')!.textContent = `${images.length} unique image${images.length === 1 ? '' : 's'}. Repeated copies share one file. Existing website image links are unchanged.`;
    images.forEach((image, i) => {
      const row = document.createElement('div'); row.className = 'image-export-row';
      const thumbnail = document.createElement('img'); thumbnail.src = image.dataUrl; thumbnail.alt = image.alt || `Image ${i + 1} preview`;
      const fields = document.createElement('div');
      const label = document.createElement('label'); label.htmlFor = `image-name-${i}`; label.textContent = `Image ${i + 1} filename (${image.occurrences.length} use${image.occurrences.length === 1 ? '' : 's'})`;
      const input = document.createElement('input'); input.id = label.htmlFor; input.value = image.filename;
      const url = document.createElement('p'); url.className = 'image-export-url'; previews.push(url);
      input.oninput = () => { image.filename = input.value; validate(); };
      fields.append(label, input, url); row.append(thumbnail, fields); list.append(row);
    });
    validate(); dialog.showModal(); folder.focus();
  };
  dialog.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => { button.onclick = () => { if (!busy) dialog.close(); }; });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  apply.onclick = async () => {
    if (busy || !images.length || !validate()) return;
    if (options.getSource() !== source) { status.textContent = 'The document changed. Close and reopen Export images to use the latest HTML.'; return; }
    const files = images.map(image => ({ filename: image.filename.trim(), base64: image.base64 }));
    const result = prepareImageExport(source, images, folder.value);
    busy = true; apply.disabled = true;
    dialog.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = true; });
    status.textContent = 'Preparing your image ZIP…';
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (const file of files) zip.file(file.filename, file.base64, { base64: true });
      const blob = await zip.generateAsync({ type: 'blob' });
      if (options.getSource() !== source) throw new Error('The document changed. Close and reopen Export images before trying again.');
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a'); link.href = url; link.download = 'maple-images.zip'; document.body.append(link); link.click(); link.remove();
        options.commit(result.html, `Image ZIP download started. HTML paths updated to ${result.directory}. Upload the images there before publishing. Undo restores embedded images.`);
      } finally { setTimeout(() => URL.revokeObjectURL(url), 30000); }
      dialog.close(); trigger.focus();
    } catch(error) { status.textContent = `Export failed: ${(error as Error).message}`; }
    finally { busy = false; apply.disabled = !images.length; dialog.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = false; }); }
  };
}
