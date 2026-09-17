import { mergeNeighbour, splitCell } from './table-merge.ts';
import { editCellText, changeTableStructure, setCellHeader, associateCellHeaders } from './table-model.ts';
import { cleanHtml } from './converter.ts';
import { createTableDraft, setTableCaption, setTableHeaders, applyTableDraft, type TableDraft, type TableItem, type HeaderAxis } from './table-model.ts';
import { getElement } from './dom.ts';
import './table-editor.css';

interface TableEditorOptions {
  getSource: () => string;
  commit: (source: string, message: string) => void;
  notify: (message: string) => void;
}

export function setupTableEditor({getSource, commit, notify}: TableEditorOptions): void {
  const elements = {
    dialog: getElement('table-dialog', 'dialog'),
    status: getElement('table-status', 'p'),
    save: getElement('table-save', 'button'),
    visual: getElement('table-visual', 'div'),
    name: getElement('table-name', 'h3'),
    dimensions: getElement('table-dimensions', 'span'),
    picker: getElement('table-picker', 'select'),
    caption: getElement('table-caption', 'input'),
    prev: getElement('table-prev', 'button'),
    next: getElement('table-next', 'button'),
    headerRows: getElement('table-header-rows', 'div'),
    headerColumns: getElement('table-header-columns', 'div'),
    warning: getElement('table-warning', 'p'),
    open: getElement('edit-tables', 'button'),
    close: getElement('table-close', 'button'),
    cancel: getElement('table-cancel', 'button'),
  };
  let selectedRow = 0, selectedColumn = 0;
  let draft: TableDraft = { source: '', tables: [] }, active = 0;
  const label = (item: TableItem, i: number): string => `Table ${i + 1} — ${item.table.caption?.textContent?.trim() || 'Untitled table'}`;
  function currentItem(): TableItem {
    const item = draft.tables[active];
    if (!item) throw new Error('No table is selected.');
    return item;
  }
  function status(): void {
    const count = draft.tables.filter(item => item.dirty).length;
    elements.status.textContent = count ? `${count} table${count === 1 ? '' : 's'} changed · not yet applied` : 'Your document stays unchanged until you apply.';
    elements.save.disabled = !count;
  }
  function preview(): void {
    const item = currentItem();
    elements.visual.innerHTML = cleanHtml(item.table.outerHTML);
    // Keep internal header/ARIA relationships while isolating IDs from the app.
    elements.visual.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    elements.visual.querySelectorAll('a').forEach(node => node.removeAttribute('href'));
    elements.name.textContent = `Table ${active + 1}`;
    elements.dimensions.textContent = `${item.rows.length} rows · ${item.width} ${item.complex ? 'cells in widest row' : 'columns'}`;
    const option = elements.picker.options[active];
    if (option) option.textContent = label(item, active);
    const shown = elements.visual.querySelector('table');
    if (shown) [...shown.rows].forEach((row, r) => [...row.cells].forEach((cell, c) => {
      cell.tabIndex = 0; cell.setAttribute('aria-label', `Row ${r+1}, cell ${c+1}: ${cell.textContent}`);
      if (r === selectedRow && c === selectedColumn) cell.classList.add('selected-cell');
      const select = () => { selectedRow = r; selectedColumn = c; preview(); cellSettings(); };
      cell.onclick = event => { event.stopPropagation(); select(); };
      cell.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); select(); getElement('cell-text', 'textarea').focus(); } };
    }));
    status();
  }
  function cellSettings(): void {
    const item = currentItem(), cell = item.rows[selectedRow]?.cells[selectedColumn];
    const panel = getElement('cell-settings', 'div'); panel.hidden = !cell;
    if (!cell) return;
    getElement('cell-position', 'h3').textContent = `Row ${selectedRow+1} · Cell ${selectedColumn+1}`;
    const text = getElement('cell-text', 'textarea'); text.value = cell.textContent ?? ''; text.disabled = !!cell.querySelector('table');
    getElement('cell-kind', 'select').value = cell.tagName === 'TH' ? cell.scope || 'col' : '';
    const options = getElement('cell-headers', 'div'); options.replaceChildren();
    const chosen = (cell.getAttribute('headers') ?? '').split(/\s+/);
    const headers = [...item.table.querySelectorAll<HTMLTableCellElement>('th')].filter(h => h !== cell && h.closest('table') === item.table);
    for (const header of headers) {
      const label = document.createElement('label'), checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!header.id && chosen.includes(header.id);
      checkbox.onchange = () => { const selected = headers.filter((_, i) => options.querySelectorAll<HTMLInputElement>('input')[i]!.checked); associateCellHeaders(draft, item, selectedRow, selectedColumn, selected); preview(); };
      label.append(checkbox, header.textContent?.trim() || 'Empty header'); options.append(label);
    }
    if (!headers.length) options.textContent = 'Mark a cell as a header to make it available here.';
    for (const id of ['row-add','row-remove','column-add','column-remove']) getElement(id, 'button').disabled = item.complex || !!item.table.querySelector('table') || (id === 'row-remove' && item.rows.length <= 1) || (id === 'column-remove' && item.width <= 1);
  }
  for (const direction of ['right','down'] as const) getElement(`merge-${direction}`, 'button').onclick = () => {
    try { mergeNeighbour(currentItem(), selectedRow, selectedColumn, direction); show(active, true); getElement('merge-feedback','p').textContent = 'Cells merged. Both cells’ contents are kept.'; }
    catch(error) { getElement('merge-feedback','p').textContent = (error as Error).message; }
  };
  getElement('split-cell','button').onclick = () => {
    try { splitCell(currentItem(), selectedRow, selectedColumn); show(active, true); getElement('merge-feedback','p').textContent = 'Cell split. Content stays in the first cell; new cells are empty.'; }
    catch(error) { getElement('merge-feedback','p').textContent = (error as Error).message; }
  };
  getElement('cell-text-save','button').onclick = () => {
    try { editCellText(currentItem(), selectedRow, selectedColumn, getElement('cell-text','textarea').value); preview(); }
    catch (error) { elements.status.textContent = (error as Error).message; }
  };
  getElement('cell-kind','select').onchange = () => { setCellHeader(currentItem(), selectedRow, selectedColumn, getElement('cell-kind','select').value); show(active, true); };
  for (const axis of ['row','column'] as const) for (const action of ['add','remove']) getElement(`${axis}-${action}`, 'button').onclick = () => {
    try { changeTableStructure(currentItem(), axis, axis === 'row' ? selectedRow : selectedColumn, action === 'remove'); selectedRow = Math.min(selectedRow, currentItem().rows.length - 1); selectedColumn = Math.min(selectedColumn, currentItem().width - 1); show(active, true); }
    catch (error) { elements.status.textContent = (error as Error).message; }
  };
  function headerOptions(axis: HeaderAxis, target: HTMLElement, count: number, selected: ReadonlySet<number>): void {
    target.replaceChildren();
    const item = currentItem();
    for (let i = 0; i < count; i++) {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = selected.has(i); input.disabled = item.complex;
      input.addEventListener('change', () => { setTableHeaders(item, axis, i, input.checked); preview(); cellSettings(); });
      label.append(input, `${axis === 'row' ? 'Row' : 'Column'} ${i + 1}`); target.append(label);
    }
  }
  function show(index: number, keepSelection = false): void {
    if (!keepSelection) { selectedRow = 0; selectedColumn = 0; }
    active = index; const item = currentItem();
    getElement('merge-feedback','p').textContent = '';
    elements.picker.value = String(index);
    elements.caption.value = item.table.caption?.textContent || '';
    elements.prev.disabled = index === 0; elements.next.disabled = index === draft.tables.length - 1;
    headerOptions('row', elements.headerRows, item.rows.length, item.headerRows);
    headerOptions('column', elements.headerColumns, item.width, item.headerColumns);
    elements.warning.textContent = item.complex ? 'This table contains merged cells or uneven rows. Select individual cells to edit text and assign headers. Row and column insertion or removal is disabled to preserve merged structure.' : 'Header rows describe columns. Header columns describe rows. Highlighted cells are headers; verify that they describe the related data.';
    preview(); cellSettings();
  }
  elements.open.onclick = () => {
    draft = createTableDraft(getSource()); active = 0;
    if (!draft.tables.length) { notify('No tables found. Import a document with tables or insert an Accessible table first.'); return; }
    elements.picker.replaceChildren(...draft.tables.map((item, i) => new Option(label(item, i), String(i))));
    show(0); elements.dialog.showModal(); elements.picker.focus();
  };
  elements.picker.onchange = () => show(Number(elements.picker.value));
  elements.prev.onclick = () => show(active - 1);
  elements.next.onclick = () => show(active + 1);
  elements.caption.oninput = () => { setTableCaption(currentItem(), elements.caption.value); preview(); };
  elements.close.onclick = elements.cancel.onclick = () => elements.dialog.close();
  elements.save.onclick = () => {
    if (getSource() !== draft.source) { elements.status.textContent = 'The document changed while this window was open. Close and reopen the table editor to avoid overwriting those changes.'; return; }
    try { commit(applyTableDraft(draft), 'Table changes applied. Use Undo to restore the previous version.'); elements.dialog.close(); }
    catch { elements.status.textContent = 'Unable to apply these changes safely. Your document has not changed.'; }
  };
}

