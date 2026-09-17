import { getElement } from './dom.ts';
import { createTocDraft, renderToc, applyToc } from './toc-model.ts';
import './toc-editor.css';

interface TocEditorOptions {
  getSource: () => string;
  getLanguage: () => string;
  commit: (source: string, message: string) => void;
}
export function setupTocEditor({ getSource, getLanguage, commit }: TocEditorOptions): void {
  const dialog = getElement('toc-dialog', 'dialog');
  let draft: ReturnType<typeof createTocDraft>;
  let language = 'en';
  function update(): void {
    const count = draft.headings.filter(heading => heading.selected).length;
    getElement('toc-preview', 'div').innerHTML = count ? renderToc(draft, language) : '<p>Select at least one heading to preview your table of contents.</p>';
    // Links are illustrative while the dialog is open.
    getElement('toc-preview', 'div').querySelectorAll('a').forEach(link => link.addEventListener('click', event => event.preventDefault()));
    getElement('toc-insert', 'button').disabled = count === 0;
    getElement('toc-status', 'p').textContent = `${count} heading${count === 1 ? '' : 's'} selected · changes apply when you save`;
  }
  function choices(): void {
    const rows = draft.headings.map(heading => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = heading.selected;
      const level = document.createElement('span'); level.className = 'level-badge'; level.textContent = `H${heading.level}`;
      const text = document.createElement('span'); text.textContent = heading.text;
      checkbox.addEventListener('change', () => { heading.selected = checkbox.checked; update(); });
      label.append(checkbox, level, text); return label;
    });
    getElement('toc-headings', 'div').replaceChildren(...rows); update();
  }
  getElement('edit-toc', 'button').onclick = () => {
    draft = createTocDraft(getSource()); language = getLanguage();
    getElement('toc-language', 'span').textContent = language === 'fr' ? 'Français · On this page' : 'English · On this page';
    getElement('toc-placement', 'p').textContent = draft.placement;
    getElement('toc-empty', 'p').hidden = draft.headings.length > 0;
    choices(); dialog.showModal();
  };
  getElement('toc-all', 'button').onclick = () => { draft.headings.forEach(h => { h.selected = true; }); choices(); };
  getElement('toc-none', 'button').onclick = () => { draft.headings.forEach(h => { h.selected = false; }); choices(); };
  getElement('toc-h2', 'button').onclick = () => { draft.headings.forEach(h => { h.selected = h.level === 2; }); choices(); };
  getElement('toc-close', 'button').onclick = getElement('toc-cancel', 'button').onclick = () => dialog.close();
  getElement('toc-insert', 'button').onclick = () => {
    if (getSource() !== draft.source) { getElement('toc-status', 'p').textContent = 'The document changed. Close and reopen this dialog before saving.'; return; }
    try { commit(applyToc(draft, language), 'Table of contents saved. Use Undo to restore the previous document.'); dialog.close(); }
    catch { getElement('toc-status', 'p').textContent = 'The table of contents could not be saved safely. Your document is unchanged.'; }
  };
}

