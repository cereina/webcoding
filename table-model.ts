import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { formatHtml } from './formatter.ts';

export type HeaderAxis = 'row' | 'column';
interface TableRange { startOffset: number; endOffset: number }
export interface TableItem {
  table: HTMLTableElement;
  range: TableRange | undefined;
  rows: HTMLTableRowElement[];
  width: number;
  complex: boolean;
  headerRows: Set<number>;
  headerColumns: Set<number>;
  dirty: boolean;
}
export interface TableDraft { source: string; tables: TableItem[] }

export function createTableDraft(source: string): TableDraft {
  const template = document.createElement('template');
  template.innerHTML = source;
  const ranges: TableRange[] = [];
  function walk(node: DefaultTreeAdapterMap['node']): void {
    if ('tagName' in node && node.tagName === 'table' && node.sourceCodeLocation) ranges.push(node.sourceCodeLocation);
    if ('childNodes' in node) for (const child of node.childNodes) walk(child);
  }
  walk(parseFragment(source, { sourceCodeLocationInfo: true }));
  const tables: TableItem[] = [...template.content.querySelectorAll('table')].map((table, index) => {
    const rows = [...table.rows];
    const width = Math.max(0, ...rows.map(row => row.cells.length));
    const complex = rows.some(row => row.cells.length !== width || [...row.cells].some(cell => cell.colSpan !== 1 || cell.rowSpan !== 1));
    const headerRows = new Set(rows.flatMap((row, i) => row.cells.length && [...row.cells].every(c => c.tagName === 'TH' && c.scope !== 'row') ? [i] : []));
    const headerColumns = new Set(Array.from({length: width}, (_, col) => col).filter(col => rows.some((row, r) => !headerRows.has(r)) && rows.every((row, r) => headerRows.has(r) || (row.cells[col]?.tagName === 'TH' && row.cells[col]?.scope === 'row'))));
    return { table, range: ranges[index], rows, width, complex, headerRows, headerColumns, dirty: false };
  });
  return { source, tables };
}
export function setTableCaption(item: TableItem, text: string): void {
  if (!text.trim()) item.table.caption?.remove();
  else { const caption = item.table.caption || item.table.createCaption(); caption.textContent = text; }
  item.dirty = true;
}
/** Move only a leading band of column headings; never reorder data or split spans. */
export function syncTableHead(item: TableItem): void {
  const rows = [...item.table.rows];
  let count = 0;
  for (const row of rows) {
    if (row.parentElement?.tagName === 'TFOOT' || !row.cells.length ||
        ![...row.cells].every(cell => cell.tagName === 'TH' && ['col', 'colgroup', ''].includes(cell.scope))) break;
    count++;
  }
  // A rowspan cannot cross the new thead/tbody boundary. Keep the current
  // grouping while the user finishes assigning the remaining heading cells.
  for (let r = 0; r < count; r++) {
    for (const cell of rows[r]!.cells) {
      const remaining = rows.slice(r).filter(row => row.parentElement === rows[r]!.parentElement).length;
      const height = cell.rowSpan || remaining;
      if (r + height > count) return;
    }
  }
  // Preserve rowspan="0" coverage when a row changes its row group.
  const zeroSpans = rows.flatMap((row, r) => [...row.cells].filter(cell => cell.rowSpan === 0).map(cell => ({
    cell, row, r, height: rows.slice(r).filter(other => other.parentElement === row.parentElement).length,
  })));
  const oldHead = item.table.tHead;
  const demoted = oldHead ? [...oldHead.rows].filter(row => rows.indexOf(row) >= count) : [];
  if (demoted.length) {
    let body = item.table.tBodies[0];
    if (!body) {
      body = document.createElement('tbody');
      item.table.insertBefore(body, item.table.tFoot);
    }
    const first = body.firstChild;
    for (const row of demoted) body.insertBefore(row, first);
  }
  if (count) {
    const head = oldHead || item.table.createTHead();
    for (const row of rows.slice(0, count)) head.append(row);
  } else if (oldHead && !oldHead.rows.length) oldHead.remove();
  for (const entry of zeroSpans) {
    const remaining = rows.slice(entry.r).filter(row => row.parentElement === entry.row.parentElement).length;
    if (remaining !== entry.height) entry.cell.rowSpan = entry.height;
  }
}
export function setTableHeaders(item: TableItem, axis: HeaderAxis, index: number, enabled: boolean): void {
  if (item.complex) throw new Error('Merged or uneven tables need individual header associations.');
  const selected = axis === 'row' ? item.headerRows : item.headerColumns;
  enabled ? selected.add(index) : selected.delete(index);
  item.rows.forEach((row, r) => [...row.cells].forEach((cell, c) => {
    const scope = item.headerRows.has(r) ? 'col' : item.headerColumns.has(c) ? 'row' : '';
    const replacement = document.createElement(scope ? 'th' : 'td');
    for (const attr of cell.attributes) replacement.setAttribute(attr.name, attr.value);
    replacement.removeAttribute('scope');
    if (scope) replacement.setAttribute('scope', scope);
    replacement.append(...cell.childNodes); cell.replaceWith(replacement);
  }));
  syncTableHead(item);
  refreshTableShape(item);
}
export function applyTableDraft(draft: TableDraft): string {
  const changed = draft.tables.filter(item => item.dirty);
  const patches = changed.filter(item => !changed.some(parent => parent !== item && parent.table.contains(item.table)))
    .map(item => {
      if (!item.range) throw new Error('This table could not be mapped to the original document.');
      return { table: item.table, range: item.range };
    });
  let result = draft.source;
  for (const item of patches.sort((a,b) => b.range.startOffset - a.range.startOffset)) {
    result = result.slice(0, item.range.startOffset) + formatHtml(item.table.outerHTML).trimEnd() + result.slice(item.range.endOffset);
  }
  return result;
}

export function refreshTableShape(item: TableItem): void {
  item.rows = [...item.table.rows];
  item.width = Math.max(0, ...item.rows.map(row => row.cells.length));
  item.complex = item.rows.some(row => row.cells.length !== item.width || [...row.cells].some(cell => cell.colSpan !== 1 || cell.rowSpan !== 1));
  item.headerRows = new Set(item.rows.flatMap((row, i) => row.cells.length && [...row.cells].every(c => c.tagName === 'TH' && c.scope !== 'row') ? [i] : []));
  item.headerColumns = new Set(Array.from({ length: item.width }, (_, c) => c).filter(c => item.rows.some((_, r) => !item.headerRows.has(r)) && item.rows.every((row,r) => item.headerRows.has(r) || (row.cells[c]?.tagName === 'TH' && row.cells[c]?.scope === 'row'))));
  item.dirty = true;
}
export function editCellText(item: TableItem, row: number, column: number, text: string): void {
  const cell = item.rows[row]?.cells[column];
  if (!cell || cell.querySelector('table')) throw new Error('Choose a cell without a nested table.');
  if (cell.textContent === text) return;
  cell.textContent = text; item.dirty = true;
}
export function changeTableStructure(item: TableItem, axis: HeaderAxis, index: number, remove: boolean): void {
  if (item.complex || item.table.querySelector('table')) throw new Error('Structure changes require a regular table without nested tables.');
  const count = axis === 'row' ? item.rows.length : item.width;
  if (!Number.isInteger(index) || index < 0 || index >= count || (remove && count <= 1)) throw new Error('Keep at least one row and column.');
  if (axis === 'row') {
    const row = item.rows[index]!;
    if (remove) row.remove();
    else {
      const added = document.createElement('tr');
      for (const cell of row.cells) {
        const next = document.createElement(cell.scope === 'row' ? 'th' : 'td');
        if (cell.scope === 'row') next.setAttribute('scope', 'row');
        added.append(next);
      }
      row.after(added);
    }
  } else for (const row of item.rows) {
    const cell = row.cells[index]!;
    if (remove) cell.remove();
    else {
      const next = document.createElement(cell.scope === 'col' ? 'th' : 'td');
      if (cell.scope === 'col') next.setAttribute('scope', 'col');
      cell.after(next);
    }
  }
  // Remove references to deleted headers without disturbing references outside this table.
  const ids = new Set([...item.table.querySelectorAll('[id]')].map(el => el.id));
  item.table.querySelectorAll('[headers]').forEach(el => {
    const headers = (el.getAttribute('headers') ?? '').split(/\s+/).filter(id => ids.has(id));
    if (headers.length) el.setAttribute('headers', headers.join(' ')); else el.removeAttribute('headers');
  });
  refreshTableShape(item);
}
export function setCellHeader(item: TableItem, row: number, column: number, scope: string): void {
  if (!['', 'col', 'row', 'colgroup', 'rowgroup'].includes(scope)) throw new Error('Invalid header type.');
  const cell = item.rows[row]?.cells[column];
  if (!cell) throw new Error('Select a cell.');
  const replacement = document.createElement(scope ? 'th' : 'td');
  for (const attr of cell.attributes) replacement.setAttribute(attr.name, attr.value);
  replacement.removeAttribute('scope');
  if (scope) replacement.setAttribute('scope', scope);
  replacement.append(...cell.childNodes); cell.replaceWith(replacement);
  if (!scope && replacement.id) item.table.querySelectorAll('[headers]').forEach(el => {
    const refs = el.getAttribute('headers')!.split(/\s+/).filter(id => id !== replacement.id);
    if (refs.length) el.setAttribute('headers', refs.join(' ')); else el.removeAttribute('headers');
  });
  syncTableHead(item);
  refreshTableShape(item);
}
export function associateCellHeaders(draft: TableDraft, item: TableItem, row: number, column: number, headers: HTMLTableCellElement[]): void {
  const cell = item.rows[row]?.cells[column];
  if (!cell) throw new Error('Select a cell.');
  const root = document.createElement('template'); root.innerHTML = draft.source;
  const used = new Set([...root.content.querySelectorAll('[id]'), ...draft.tables.flatMap(t => [...t.table.querySelectorAll('[id]')])].map(el => el.id));
  for (const header of headers) {
    if (header === cell || header.tagName !== 'TH' || header.closest('table') !== item.table) throw new Error('Choose headers from this table.');
  }
  for (const header of headers) {
    if (!header.id) { let n = 1; while (used.has(`table-header-${n}`)) n++; header.id = `table-header-${n}`; used.add(header.id); }
  }
  if (headers.length) {
    cell.setAttribute('headers', headers.map(h => h.id).join(' '));
    cell.removeAttribute('scope');
    for (const header of headers) header.removeAttribute('scope');
  } else cell.removeAttribute('headers');
  item.dirty = true;
}
