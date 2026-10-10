import { tableGrid } from './table-merge.ts';
import type { TableItem } from './table-model.ts';

export interface CellRelationships {
  headings: HTMLTableCellElement[];
  issues: string[];
  method: 'explicit' | 'scope';
}

/** Read-only inspection. Unscoped browser heuristics are deliberately not guessed. */
export function inspectTableRelationships(item: TableItem): Map<HTMLTableCellElement, CellRelationships> {
  const results = new Map<HTMLTableCellElement, CellRelationships>();
  const { positions } = tableGrid(item);
  if (positions.length > 2500) throw new Error('This table is too large to visualize. Inspect a smaller table.');
  const ids = new Map<string, Element[]>();
  (item.table.getRootNode() as ParentNode).querySelectorAll('[id]').forEach(node => {
    ids.set(node.id, [...(ids.get(node.id) ?? []), node]);
  });
  for (const p of positions) {
    const cell = p.cell;
    const result: CellRelationships = { headings: [], issues: [], method: cell.hasAttribute('headers') ? 'explicit' : 'scope' };
    results.set(cell, result);
    if (cell.id && (ids.get(cell.id)?.length ?? 0) > 1) result.issues.push(`Duplicate ID: ${cell.id}.`);
    if (result.method === 'explicit') {
      const expanded = new Set<Element>();
      const visit = (node: HTMLTableCellElement, path: Set<Element>): void => {
        if (expanded.has(node)) return;
        expanded.add(node);
        for (const id of new Set((node.getAttribute('headers') ?? '').split(/\s+/).filter(Boolean))) {
          const matches = ids.get(id) ?? [];
          const header = matches[0];
          if (matches.length !== 1) { result.issues.push(matches.length ? `Ambiguous header ID: ${id}.` : `Missing header: ${id}.`); continue; }
          if (header.tagName !== 'TH' || header.closest('table') !== item.table) { result.issues.push(`Reference ${id} must identify a heading in this table.`); continue; }
          if (path.has(header)) { result.issues.push(`Circular header reference: ${id}.`); continue; }
          const heading = header as HTMLTableCellElement;
          if (!result.headings.includes(heading)) result.headings.push(heading);
          visit(heading, new Set([...path, heading]));
        }
      };
      visit(cell, new Set([cell]));
    } else {
      for (const h of positions) {
        if (h.cell === cell || h.cell.tagName !== 'TH') continue;
        const overlapsColumn = h.col < p.col + p.width && p.col < h.col + h.width;
        const overlapsRow = h.row < p.row + p.height && p.row < h.row + h.height;
        if ((h.cell.scope === 'col' && overlapsColumn && h.row < p.row) ||
            (h.cell.scope === 'row' && overlapsRow && h.col < p.col) ||
            (h.cell.scope === 'rowgroup' && h.cell.parentElement?.parentElement === cell.parentElement?.parentElement && h.row <= p.row)) {
          result.headings.push(h.cell);
        }
      }
      if (positions.some(h => h.cell.scope === 'colgroup')) result.issues.push('Column-group scope needs manual review; use explicit header links to visualize it precisely.');
    }
    if (cell.tagName === 'TD' && !result.headings.length) result.issues.push('No explicit or supported scope-based headings found. Review the heading relationships.');
    result.issues = [...new Set(result.issues)];
  }
  return results;
}
