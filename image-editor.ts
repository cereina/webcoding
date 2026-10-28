import { collectEditableImages, applyImageEdits, type EditableImage } from './image-editor-model.ts';
import './image-export.css';

export function setupImageEditor(options: { getSource: () => string; commit: (html: string, message: string) => void }): void {
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'button secondary'; trigger.textContent = 'Edit images';
  document.getElementById('download')!.before(trigger);
  const dialog = document.createElement('dialog');
  dialog.className = 'image-export-dialog image-editor-dialog'; dialog.setAttribute('aria-labelledby', 'image-editor-title');
  dialog.innerHTML = `<header><div><h2 id="image-editor-title">Edit image descriptions</h2><p>Give each image a useful description, or mark it as decorative.</p></div><button type="button" class="button ghost" data-close aria-label="Close image editor">✕</button></header>
    <div class="image-export-body"><p>Names are used in the image ZIP. Repeated images share a filename, but can have different descriptions. Renaming an existing website image also requires renaming the actual file.</p><p data-count></p><div data-list></div></div>
    <footer><p role="status" data-status></p><div><button type="button" class="button secondary" data-close>Cancel</button><button type="button" class="button primary" data-apply>Apply image changes</button></div></footer>`;
  document.body.append(dialog);
  const list = dialog.querySelector<HTMLElement>('[data-list]')!;
  const status = dialog.querySelector<HTMLElement>('[data-status]')!;
  const apply = dialog.querySelector<HTMLButtonElement>('[data-apply]')!;
  let source = '', images: EditableImage[] = [];
  const names: HTMLInputElement[] = [];
  trigger.onclick = () => {
    source = options.getSource(); list.replaceChildren(); names.length = 0;
    try { images = collectEditableImages(source); }
    catch (error) { images = []; status.textContent = (error as Error).message; apply.disabled = true; dialog.showModal(); return; }
    dialog.querySelector('[data-count]')!.textContent = `${images.length} image${images.length === 1 ? '' : 's'}, in document order.`;
    status.textContent = images.length ? 'Changes stay in this window until you apply them. Document Undo restores previous values.' : 'No images found. Import a document or insert images first.';
    apply.disabled = !images.length;
    images.forEach((image, index) => {
      const row = document.createElement('fieldset'); row.className = 'image-editor-row';
      const legend = document.createElement('legend'); legend.textContent = `Image ${index + 1}`;
      const label = document.createElement('label'); label.htmlFor = `edit-image-name-${index}`; label.textContent = 'Filename';
      const name = document.createElement('input'); name.id = label.htmlFor; name.value = image.filename; name.readOnly = !image.renameable; names.push(name);
      name.oninput = () => { images.forEach((other, i) => { if (other.src === image.src) { other.filename = name.value; names[i]!.value = name.value; } }); };
      const decorativeLabel = document.createElement('label'); decorativeLabel.className = 'image-decorative';
      const decorative = document.createElement('input'); decorative.type = 'checkbox'; decorative.checked = image.decorative;
      decorativeLabel.append(decorative, document.createTextNode('Decorative image (no information to describe)'));
      const altLabel = document.createElement('label'); altLabel.htmlFor = `edit-image-alt-${index}`; altLabel.textContent = 'Alternative text';
      const alt = document.createElement('textarea'); alt.id = altLabel.htmlFor; alt.rows = 3; alt.value = image.alt; alt.disabled = image.decorative;
      const help = document.createElement('p'); help.id = `edit-image-help-${index}`; help.textContent = 'Describe the image’s purpose in this context. Decorative images receive an empty alt attribute.'; alt.setAttribute('aria-describedby', help.id);
      alt.oninput = () => { image.alt = alt.value; alt.removeAttribute('aria-invalid'); };
      decorative.onchange = () => { image.decorative = decorative.checked; alt.disabled = decorative.checked; alt.removeAttribute('aria-invalid'); };
      row.append(legend, label, name, decorativeLabel, altLabel, alt, help); list.append(row);
    });
    dialog.showModal(); (names[0] ?? dialog.querySelector<HTMLButtonElement>('[data-close]')!).focus();
  };
  dialog.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => { button.onclick = () => dialog.close(); });
  dialog.addEventListener('close', () => trigger.focus());
  apply.onclick = () => {
    if (options.getSource() !== source) { status.textContent = 'The document changed. Close and reopen this window to edit the latest images.'; return; }
    try {
      const html = applyImageEdits(source, images);
      options.commit(html, 'Image filenames and alternative text updated. Use Undo to restore previous values.'); dialog.close();
    } catch (error) {
      status.textContent = (error as Error).message;
      const missing = images.findIndex(image => !image.decorative && !image.alt.trim());
      if (missing >= 0) { const field = dialog.querySelector<HTMLTextAreaElement>(`#edit-image-alt-${missing}`)!; field.setAttribute('aria-invalid', 'true'); field.focus(); }
    }
  };
}
