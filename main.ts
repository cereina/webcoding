import { wrapHeadingSections } from './section-model.ts';
import { extraBlocks, makeBlock } from './building-blocks.ts';
import { setupWorkspace } from './workspace.ts';
import { setupReview } from './review-panel.ts';
import mammoth from 'mammoth/mammoth.browser.js';
import { cleanHtml, analyzeCleanup, plainTextToHtml, inspectHtml, buildPage, type CleanupReportItem } from './converter.ts';
import './styles.css';
import { formatHtml } from './formatter.ts';
import { createCodeEditor } from './code-editor.ts';
import { setupTableEditor } from './table-editor.ts';
import { setupTocEditor } from './toc-editor.ts';
import { setupHeadingEditor } from './heading-editor.ts';
import { linkFootnotes } from './footnotes.ts';

import { getElement } from './dom.ts';
document.documentElement.dataset.mapleBuild = 'maple-heading-runtime-v3';
const example = `<h1>Getting started with your project</h1>
<p>A simple guide to planning, building, and sharing your next idea.</p>

<section>
  <h2>Before you begin</h2>
  <p>Define your goals, audience, and the problem you want to solve.</p>
</section>

<h2>Plan your work</h2>
<ul>
  <li>List the features your audience needs</li>
  <li>Choose the tools that suit your project</li>
  <li>Break the work into manageable steps</li>
</ul>

<h2>Build and review</h2>
<ol>
  <li>Create a working first version.</li>
  <li>Test it on different screen sizes and with a keyboard.</li>
  <li>Collect feedback and improve your content.</li>
</ol>`;
const components = {
  note: '<section>\n  <h2>Information</h2>\n  <p>Add your helpful note here.</p>\n</section>',
  table: '<table>\n  <caption>Replace with a descriptive table title</caption>\n  <thead><tr><th scope="col">Item</th><th scope="col">Details</th></tr></thead>\n  <tbody><tr><td>First item</td><td>Description</td></tr></tbody>\n</table>',
  details: '<details>\n  <summary>More information</summary>\n  <p>Add supporting information here.</p>\n</details>',
  section: '<section>\n  <h2>Section heading</h2>\n  <p>Add your content here.</p>\n</section>',
};
const editor = createCodeEditor(getElement('editor', 'div'), example);
let renderTimer: ReturnType<typeof setTimeout> | undefined;
let importing = false;
const notify = (message: string) => { getElement('status', 'p').textContent = message; };
const workspace = setupWorkspace();
const review = setupReview({ getSource: () => editor.value, select: (start, end) => { workspace.revealEditor(); editor.setSelectionRange(start, end); editor.focus(); }, notify });
function refresh() {
  clearTimeout(renderTimer);
  const html = editor.value;
  const tableDocument = document.createElement('template'); tableDocument.innerHTML = html;
  getElement('table-count', 'span').textContent = String(tableDocument.content.querySelectorAll('table').length);
  review.render(html, getElement('language', 'select').value);
  getElement('code-size', 'span').textContent = `${html.split('\n').length} lines`;
  getElement('undo', 'button').disabled = !editor.canUndo(); getElement('redo', 'button').disabled = !editor.canRedo();
}
function commit(value: string, message?: string) { editor.replace(value); refresh(); if (message) notify(message); }
setupTableEditor({ getSource: () => editor.value, commit, notify });
setupTocEditor({ getSource: () => editor.value, getLanguage: () => getElement('language', 'select').value, commit });
refresh();
getElement('wrap-sections', 'button').onclick = () => {
  const source = editor.value, result = wrapHeadingSections(source);
  if (result === source) { notify('No new sections needed. Existing sections and component boundaries are preserved.'); return; }
  commit(result, 'Headings and their content grouped into nested sections. Undo is available.');
};
getElement('format', 'button').onclick = () => commit(formatHtml(editor.value), 'Code formatted. Undo is available.');
const changeListener = editor.onChange(() => {
  clearTimeout(renderTimer); renderTimer = setTimeout(refresh, 300);
  getElement('undo', 'button').disabled = !editor.canUndo(); getElement('redo', 'button').disabled = !editor.canRedo();
});
getElement('undo', 'button').onclick = () => { editor.undo(); refresh(); editor.focus(); };
getElement('redo', 'button').onclick = () => { editor.redo(); refresh(); editor.focus(); };
document.querySelector<HTMLAnchorElement>('.skip-link')?.addEventListener('click', event => { event.preventDefault(); editor.focus(); });
if (import.meta.hot) import.meta.hot.dispose(() => { clearTimeout(renderTimer); changeListener.dispose(); editor.dispose(); });
getElement('load-example', 'button').onclick = () => commit(example, 'Example loaded. Use Undo to restore your previous document.');
const cleanupDialog = getElement('cleanup-dialog', 'dialog');
let cleanupSource = '';
let cleanupResult: ReturnType<typeof analyzeCleanup> | undefined;
function renderCleanupItems(id: string, items: CleanupReportItem[], warning = false): void {
  const container = getElement(id, 'div');
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'cleanup-report-empty';
    empty.textContent = warning ? 'No review items found.' : 'No automatic cleanup changes found.';
    container.replaceChildren(empty);
    return;
  }
  const nodes = items.map(item => {
    const details = document.createElement('details');
    details.className = 'cleanup-report-item' + (warning ? ' cleanup-report-warning' : '');
    const summary = document.createElement('summary');
    summary.textContent = `${item.label} · ${item.count}`;
    details.append(summary);
    if (item.details.length) {
      const list = document.createElement('ul');
      item.details.forEach(detail => {
        const li = document.createElement('li');
        li.textContent = detail;
        list.append(li);
      });
      details.append(list);
    }
    return details;
  });
  container.replaceChildren(...nodes);
}
getElement('clean', 'button').onclick = () => {
  cleanupSource = editor.value;
  cleanupResult = analyzeCleanup(cleanupSource);
  const summary = getElement('cleanup-summary', 'div');
  const changes = document.createElement('span');
  changes.textContent = `${cleanupResult.totalChanges} automatic change${cleanupResult.totalChanges === 1 ? '' : 's'}`;
  const warnings = document.createElement('span');
  const warningCount = cleanupResult.warnings.reduce((sum, item) => sum + item.count, 0);
  warnings.textContent = `${warningCount} review item${warningCount === 1 ? '' : 's'}`;
  summary.replaceChildren(changes, warnings);
  renderCleanupItems('cleanup-changes', cleanupResult.changes);
  renderCleanupItems('cleanup-warnings', cleanupResult.warnings, true);
  getElement('cleanup-status', 'p').textContent = cleanupResult.totalChanges
    ? 'Review the changes below, then apply when ready.'
    : 'Maple found no automatic cleanup changes. You can still review any warnings below.';
  getElement('cleanup-apply', 'button').disabled = cleanupResult.cleanedHtml === cleanupSource;
  cleanupDialog.showModal();
};
for (const id of ['cleanup-close','cleanup-cancel']) getElement(id, 'button').onclick = () => cleanupDialog.close();
getElement('cleanup-apply', 'button').onclick = () => {
  if (!cleanupResult) return;
  if (editor.value !== cleanupSource) {
    getElement('cleanup-status', 'p').textContent = 'The document changed after this report was created. Close the report and run Clean HTML again.';
    return;
  }
  const warningCount = cleanupResult.warnings.reduce((sum, item) => sum + item.count, 0);
  commit(formatHtml(cleanupResult.cleanedHtml), `Cleanup complete: ${cleanupResult.totalChanges} change${cleanupResult.totalChanges === 1 ? '' : 's'} applied.${warningCount ? ` ${warningCount} item${warningCount === 1 ? '' : 's'} still need review.` : ''} Undo is available.`);
  cleanupDialog.close();
};
getElement('language', 'select').onchange = refresh;

getElement('open-paste', 'button').onclick = () => { getElement('paste-area', 'div').replaceChildren(); getElement('import-dialog', 'dialog').showModal(); getElement('paste-area', 'div').focus(); };
for (const id of ['close-paste', 'cancel-paste']) getElement(id, 'button').onclick = () => getElement('import-dialog', 'dialog').close();
getElement('paste-area', 'div').addEventListener('paste', event => {
  event.preventDefault();
  const html = event.clipboardData?.getData('text/html');
  const safe = cleanHtml(html || plainTextToHtml(event.clipboardData?.getData('text/plain') ?? ''));
  const selection = window.getSelection();
  if (selection && selection.rangeCount && getElement('paste-area', 'div').contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0); range.deleteContents(); const fragment = range.createContextualFragment(safe); const last = fragment.lastChild; range.insertNode(fragment);
    if (last) { range.setStartAfter(last); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
  } else getElement('paste-area', 'div').innerHTML = safe;
});
getElement('paste-area', 'div').addEventListener('drop', event => event.preventDefault());
getElement('convert-paste', 'button').onclick = () => {
  const html = cleanHtml(getElement('paste-area', 'div').innerHTML);
  if (!html.trim()) { notify('Paste some document content first.'); return; }
  commit(formatHtml(linkFootnotes(html, getElement('language', 'select').value)), 'Pasted document converted and formatted. Review the preview and document checks.'); getElement('import-dialog', 'dialog').close(); editor.focus();
};
getElement('upload', 'button').onclick = () => getElement('file', 'input').click();
getElement('file', 'input').onchange = async () => { const file = getElement('file', 'input').files?.[0]; if (file) await importFile(file); getElement('file', 'input').value = ''; };
async function importFile(file: File) {
  if (importing) return;
  if (!/\.docx$/i.test(file.name)) return notify('Choose a .docx file. Save older .doc files as .docx in Word first.');
  if (file.size > 10 * 1024 * 1024) return notify('This file exceeds 10 MB. Choose a smaller document.');
  importing = true; getElement('upload', 'button').disabled = true;
  const previous = editor.value; notify(`Converting ${file.name}Ã¢â‚¬Â¦`);
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    if (editor.value !== previous) { notify('Import stopped because you edited the document during conversion. Upload again when ready.'); return; }
    commit(formatHtml(linkFootnotes(cleanHtml(result.value), getElement('language', 'select').value)), `${file.name} converted.${result.messages.length ? ' Conversion notes: ' + result.messages.map(m => m.message).join(' Ã‚Â· ') : ' Review headings, images, and tables before exporting.'}`);
  } catch { notify('This document could not be read. Check that it is a valid, unencrypted .docx file. Your current HTML is unchanged.'); }
  finally { importing = false; getElement('upload', 'button').disabled = false; }
}
const dropZone = document.querySelector<HTMLElement>('.import-bar');
if (!dropZone) throw new Error('Missing import area.');
dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', event => { event.preventDefault(); dropZone.classList.remove('drag-over'); const file = event.dataTransfer?.files[0]; if (file) void importFile(file); });

const blockGrid = document.querySelector('.component-grid')!;
for (const [key, title, description] of extraBlocks) {
  const button = document.createElement('button'); button.className = 'component-card'; button.dataset.component = key;
  const heading = document.createElement('strong'); heading.textContent = title + ' ＋';
  const detail = document.createElement('small'); detail.textContent = description;
  button.append(heading, detail); blockGrid.append(button);
}
const imageInput = document.createElement('input'); imageInput.type = 'file'; imageInput.accept = 'image/png,image/jpeg,image/gif,image/webp'; imageInput.hidden = true; document.body.append(imageInput);
let imageInsertion: { source: string; start: number; end: number } | undefined;
imageInput.onchange = async () => {
  const file = imageInput.files?.[0], insertion = imageInsertion; imageInput.value = '';
  if (!file || !insertion) return;
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) { notify('Choose a PNG, JPEG, GIF, or WebP image up to 10 MB.'); return; }
  const reader = new FileReader();
  reader.onerror = () => notify('The image could not be read. Your document is unchanged.');
  reader.onload = () => {
    if (editor.value !== insertion.source) { notify('The document changed. Select Figure with caption again to insert the image.'); return; }
    const snippet = formatHtml(`<figure><img src="${reader.result}" alt="Describe the image’s purpose"><figcaption>Replace with your image caption.</figcaption></figure>`);
    commit(insertion.source.slice(0,insertion.start) + '\n' + snippet + '\n' + insertion.source.slice(insertion.end), 'Figure inserted. Replace the alternative text and caption with descriptions of your image.');
    workspace.revealEditor(); editor.focus(); editor.setSelectionRange(insertion.start, insertion.start + snippet.length + 2);
  };
  reader.readAsDataURL(file);
};
document.querySelectorAll<HTMLButtonElement>('[data-component]').forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.component;
  if (!key) return;
  if (key === 'figure') { imageInsertion = { source: editor.value, start: editor.selectionStart, end: editor.selectionEnd }; imageInput.click(); return; }
  const block = key in components ? components[key as keyof typeof components] : makeBlock(key, editor.value, getElement('language','select').value);
  if (!block) return;
  const start = editor.selectionStart, end = editor.selectionEnd, snippet = '\n' + formatHtml(block) + '\n';
  commit(editor.value.slice(0, start) + snippet + editor.value.slice(end), 'Building block inserted at your cursor. Undo is available.');
  workspace.revealEditor(); editor.focus(); editor.setSelectionRange(start, start + snippet.length);
}));

function exported() { return formatHtml(getElement('export-type', 'select').value === 'page' ? buildPage(editor.value, { language: getElement('language', 'select').value }) : cleanHtml(editor.value)); }
getElement('copy', 'button').onclick = async () => { try { await navigator.clipboard.writeText(exported()); notify('Formatted HTML copied to your clipboard.'); } catch { notify('Clipboard access is unavailable. Use Download HTML instead.'); } };
getElement('download', 'button').onclick = () => {
  const url = URL.createObjectURL(new Blob([exported()], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'document.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('Clean HTML downloaded. Embedded document images are included.');
};


