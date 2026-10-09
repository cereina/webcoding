import type { TableItem } from './table-model.ts';
import { tableGrid } from './table-merge.ts';

export interface HeaderAnalysis { changed: number; issues: string[]; }
type TableComplexity = 'simple' | 'grouped' | 'complex';
type Position = ReturnType<typeof tableGrid>['positions'][number];

interface StructureAnalysis {
  complexity: TableComplexity;
  headerRows: number;
  rowHeaderColumns: number;
  mergedHeaderCells: number;
  mergedDataCells: number;
  existingHeadersAttributes: number;
  tbodyCount: number;
  irregularHeaders: number;
}

function detectHeaderRows(item: TableItem): number {
  if (item.table.tHead?.rows.length) return item.table.tHead.rows.length;
  let count = 0;
  for (const row of item.rows) {
    if (!row.cells.length || ![...row.cells].every(cell => cell.tagName === 'TH')) break;
    count++;
  }
  return count;
}

function detectRowHeaderColumns(item: TableItem, headerRows: number): number {
  const rows = item.rows.filter((row, index) =>
    index >= headerRows && !['THEAD', 'TFOOT'].includes(row.parentElement?.tagName ?? '')
  );
  let maximum = 0;
  for (const row of rows) {
    let count = 0;
    for (const cell of row.cells) {
      if (cell.tagName !== 'TH') break;
      count++;
    }
    maximum = Math.max(maximum, count);
  }
  return maximum;
}

function analyzeStructure(item: TableItem, positions: Position[]): StructureAnalysis {
  const headerRows = detectHeaderRows(item);
  const rowHeaderColumns = detectRowHeaderColumns(item, headerRows);
  const mergedHeaderCells = positions.filter(p => p.cell.tagName === 'TH' && (p.height > 1 || p.width > 1)).length;
  const mergedDataCells = positions.filter(p => p.cell.tagName === 'TD' && (p.height > 1 || p.width > 1)).length;
  const existingHeadersAttributes = item.table.querySelectorAll('td[headers], th[headers]').length;
  const tbodyCount = item.table.tBodies.length;
  const irregularHeaders = positions.filter(p => p.cell.tagName === 'TH' && p.row >= headerRows && p.col >= rowHeaderColumns).length;

  let complexity: TableComplexity = 'simple';
  if (
    mergedDataCells > 0 ||
    rowHeaderColumns > 1 ||
    tbodyCount > 1 ||
    existingHeadersAttributes > 0 ||
    irregularHeaders > 0 ||
    headerRows >= 3 ||
    (headerRows > 1 && mergedHeaderCells > 0)
  ) complexity = 'complex';
  else if (mergedHeaderCells > 0 || headerRows > 1) complexity = 'grouped';

  return {
    complexity,
    headerRows,
    rowHeaderColumns,
    mergedHeaderCells,
    mergedDataCells,
    existingHeadersAttributes,
    tbodyCount,
    irregularHeaders,
  };
}

function inferredScope(position: Position, structure: StructureAnalysis): string {
  const existing = position.cell.scope;
  if (['row', 'col', 'rowgroup', 'colgroup'].includes(existing)) return existing;
  if (position.row < structure.headerRows) return position.width > 1 ? 'colgroup' : 'col';
  if (position.col < structure.rowHeaderColumns) return position.height > 1 ? 'rowgroup' : 'row';
  return '';
}

function meaningfulLabel(cell: HTMLTableCellElement): boolean {
  return Boolean(
    (cell.getAttribute('aria-label') ?? '').trim() ||
    cell.textContent?.trim() ||
    cell.querySelector('img[alt]')?.getAttribute('alt')?.trim()
  );
}

/**
 * Apply the same table-accessibility rule used by the TinyMCE editor:
 * simple/grouped tables use semantic TH + scope, while complex tables also
 * receive explicit id/headers relationships. Existing valid relationships are
 * preserved and scope is never stripped merely because headers are added.
 */
export function assignTableHeaders(item: TableItem): HeaderAnalysis {
  const issues: string[] = [];
  if (item.table.querySelector('table')) return { changed: 0, issues: ['Select the nested table separately. Automatic analysis of tables containing other tables is not supported.'] };

  const cells = item.rows.flatMap(row => [...row.cells]);
  if (cells.length > 2500 || cells.reduce((n, cell) => n + Math.max(1, cell.rowSpan) * Math.max(1, cell.colSpan), 0) > 20000) {
    return { changed: 0, issues: ['This table is too large for automatic analysis. Assign headers manually.'] };
  }

  let layout: ReturnType<typeof tableGrid>;
  try { layout = tableGrid(item); }
  catch (error) { return { changed: 0, issues: [(error as Error).message] }; }

  const { positions, grid } = layout;
  const width = Math.max(0, ...grid.map(row => row.length));
  if (!width || grid.some(row => row.length !== width || Array.from({ length: width }, (_, column) => row[column]).some(cell => !cell))) {
    return { changed: 0, issues: ['The table has gaps or uneven rows. Repair its layout before assigning headers.'] };
  }

  const root = item.table.getRootNode() as DocumentFragment;
  const ids = new Map<string, Element[]>();
  root.querySelectorAll('[id]').forEach(element => ids.set(element.id, [...(ids.get(element.id) ?? []), element]));
  const headers = positions.filter(position => position.cell.tagName === 'TH');
  if (!headers.length) return { changed: 0, issues: ['No heading cells found. Mark the heading rows, columns, or individual cells first, then analyze again.'] };

  const structure = analyzeStructure(item, positions);
  const label = (position: Position) => `Row ${position.row + 1}, column ${position.col + 1}`;
  const scopes = new Map<HTMLTableCellElement, string>();

  for (const header of headers) {
    if (!meaningfulLabel(header.cell)) issues.push(`${label(header)}: give this heading a meaningful label.`);
    if (header.cell.id && ((ids.get(header.cell.id)?.length ?? 0) !== 1 || /\s/.test(header.cell.id))) {
      issues.push(`${label(header)}: its ID is duplicated or contains spaces. Give it a unique ID first.`);
    }
    const scope = header.cell.scope;
    if (scope && !['row', 'col', 'rowgroup', 'colgroup'].includes(scope)) issues.push(`${label(header)}: invalid heading scope.`);
    const inferred = inferredScope(header, structure);
    scopes.set(header.cell, inferred);
    if (!inferred) issues.push(`${label(header)}: choose Column header or Row header; its direction is unclear.`);
  }

  if (issues.length) return { changed: 0, issues: [...new Set(issues)] };

  // Simple and grouped tables should stay simple: TH + scope is sufficient.
  if (structure.complexity !== 'complex') {
    let changed = 0;
    for (const header of headers) {
      const scope = scopes.get(header.cell)!;
      if (header.cell.scope !== scope) {
        header.cell.scope = scope;
        changed++;
      }
    }
    if (changed) item.dirty = true;
    return { changed, issues: [] };
  }

  const plans = new Map<HTMLTableCellElement, HTMLTableCellElement[]>();
  for (const position of positions) {
    const existing = (position.cell.headers ?? '').trim();
    if (existing) {
      const targets: HTMLTableCellElement[] = [];
      for (const id of new Set(existing.split(/\s+/))) {
        const matches = ids.get(id) ?? [];
        const target = matches[0];
        if (matches.length !== 1 || target?.tagName !== 'TH' || target === position.cell || target.closest('table') !== item.table) {
          issues.push(`${label(position)}: header reference “${id}” is missing, duplicated, or not a heading in this table.`);
        } else targets.push(target as HTMLTableCellElement);
      }
      plans.set(position.cell, targets);
      continue;
    }

    if (position.cell.tagName !== 'TD') {
      plans.set(position.cell, []);
      continue;
    }

    if (headers.some(header => {
      const axis = scopes.get(header.cell);
      return (axis === 'col' || axis === 'colgroup') &&
        header.row + header.height <= position.row &&
        header.col < position.col + position.width &&
        header.col + header.width > position.col &&
        !(header.col <= position.col && header.col + header.width >= position.col + position.width);
    })) issues.push(`${label(position)}: this merged cell crosses column headings. Assign its relationships manually.`);

    const applicable = headers.filter(header => {
      const axis = scopes.get(header.cell);
      if (axis === 'col' || axis === 'colgroup') {
        return header.row + header.height <= position.row &&
          header.col <= position.col &&
          header.col + header.width >= position.col + position.width;
      }
      if (axis === 'rowgroup') {
        return header.cell.parentElement?.parentElement === position.cell.parentElement?.parentElement &&
          header.row <= position.row &&
          header.col + header.width <= position.col;
      }
      return axis === 'row' &&
        header.row <= position.row &&
        header.row + header.height >= position.row + position.height &&
        header.col + header.width <= position.col;
    }).map(header => header.cell);

    if (!applicable.length && position.cell.textContent?.trim()) issues.push(`${label(position)}: no clear heading applies. Select its headings manually.`);
    plans.set(position.cell, applicable);
  }

  const visiting = new Set<HTMLTableCellElement>();
  const visited = new Set<HTMLTableCellElement>();
  function cyclic(cell: HTMLTableCellElement): boolean {
    if (visiting.has(cell)) return true;
    if (visited.has(cell)) return false;
    visiting.add(cell);
    for (const header of plans.get(cell) ?? []) if (cyclic(header)) return true;
    visiting.delete(cell);
    visited.add(cell);
    return false;
  }
  if (headers.some(header => cyclic(header.cell))) issues.push('Header relationships contain a cycle. Remove circular references before analyzing.');
  if (issues.length) return { changed: 0, issues: [...new Set(issues)] };

  let changed = 0;
  for (const header of headers) {
    const scope = scopes.get(header.cell)!;
    if (header.cell.scope !== scope) {
      header.cell.scope = scope;
      changed++;
    }
  }

  const used = new Set(ids.keys());
  let next = 1;
  for (const header of headers) {
    if (header.cell.id) continue;
    while (used.has(`table-header-${next}`)) next++;
    header.cell.id = `table-header-${next++}`;
    used.add(header.cell.id);
    changed++;
  }

  for (const [cell, targets] of plans) {
    if (cell.tagName !== 'TD' || cell.headers.trim() || !targets.length) continue;
    cell.headers = targets.map(header => header.id).join(' ');
    changed++;
  }

  if (changed) item.dirty = true;
  return { changed, issues: [] };
}
