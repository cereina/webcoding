import { getElement } from './dom.ts';
import { applyHeadingDraft, createHeadingDraft, headingWarnings, type HeadingDraft } from './heading-model.ts';
import './heading-editor.css';

interface HeadingEditorOptions {
  getSource: () => string;
  commit: (source: string, message: string) => void;
}
export function setupHeadingEditor({ getSource, commit }: HeadingEditorOptions): void {
  const dialog = getElement('heading-dialog', 'dialog');
  let draft: HeadingDraft;

  function render(): void {
    const rows = draft.headings.map(heading => {
      const row = document.createElement('div');
      row.className = 'heading-editor-row';
      row.style.setProperty('--heading-depth', String(Math.max(0, heading.level - 1)));

      const badge = document.createElement('span');
      badge.className = 'heading-level-badge';
      badge.textContent = `H${heading.level}`;

      const text = document.createElement('span');
      text.className = 'heading-editor-text';
      text.textContent = heading.text;

      const label = document.createElement('label');
      label.className = 'heading-level-control';
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = `Heading level for ${heading.text}`;
      const select = document.createElement('select');
      for (let level = 1; level <= 6; level++) {
        const option = document.createElement('option');
        option.value = String(level);
        option.textContent = `H${level}`;
        option.selected = level === heading.level;
        select.append(option);
      }
      select.addEventListener('change', () => {
        heading.level = Number(select.value);
        render();
      });
      label.append(sr, select);
      row.append(badge, text, label);
      return row;
    });
    getElement('heading-list', 'div').replaceChildren(...rows);

    const warnings = headingWarnings(draft);
    const warningBox = getElement('heading-warnings', 'div');
    if (!warnings.length) {
      warningBox.className = 'heading-editor-ok';
      warningBox.textContent = 'Heading structure looks consistent.';
    } else {
      warningBox.className = 'heading-editor-warnings';
      const title = document.createElement('strong');
      title.textContent = `${warnings.length} structure warning${warnings.length === 1 ? '' : 's'}`;
      const list = document.createElement('ul');
      warnings.forEach(warning => {
        const li = document.createElement('li');
        li.textContent = warning.message;
        list.append(li);
      });
      warningBox.replaceChildren(title, list);
    }

    getElement('heading-empty', 'p').hidden = draft.headings.length > 0;
    const changed = draft.headings.filter(heading => heading.level !== heading.originalLevel).length;
    getElement('heading-status', 'p').textContent = changed
      ? `${changed} heading level${changed === 1 ? '' : 's'} will change when you apply.`
      : 'No heading level changes yet.';
    getElement('heading-apply', 'button').disabled = changed === 0;
    getElement('heading-toc-note', 'p').hidden = !draft.hasManagedToc;
  }

  getElement('edit-headings', 'button').onclick = () => {
    draft = createHeadingDraft(getSource());
    render();
    dialog.showModal();
  };
  getElement('heading-close', 'button').onclick = getElement('heading-cancel', 'button').onclick = () => dialog.close();
  getElement('heading-reset', 'button').onclick = () => {
    draft.headings.forEach(heading => { heading.level = heading.originalLevel; });
    render();
  };
  getElement('heading-apply', 'button').onclick = () => {
    if (getSource() !== draft.source) {
      getElement('heading-status', 'p').textContent = 'The document changed. Close and reopen this editor before applying heading changes.';
      return;
    }
    try {
      const output = applyHeadingDraft(draft);
      commit(output, 'Heading structure updated. IDs, bookmarks and links were preserved. Use Undo to restore the previous document.');
      dialog.close();
    } catch {
      getElement('heading-status', 'p').textContent = 'The heading structure could not be updated safely. Your document is unchanged.';
    }
  };
}
