import type { TableItem } from './table-model.ts';
import { tableGrid } from './table-merge.ts';

export interface HeaderAnalysis { changed: number; issues: string[]; }
/** Conservative geometric inference. Explicit valid associations always take precedence. */
export function assignTableHeaders(item: TableItem): HeaderAnalysis {
  const issues: string[] = [];
  if (item.table.querySelector('table')) return {changed:0,issues:['Select the nested table separately. Automatic analysis of tables containing other tables is not supported.']};
  const cells = item.rows.flatMap(r => [...r.cells]);
  if (cells.length > 2500 || cells.reduce((n,c)=>n+(c.rowSpan || item.rows.filter(r=>r.parentElement===c.parentElement?.parentElement).length)*c.colSpan,0)>20000) return {changed:0,issues:['This table is too large for automatic analysis. Assign headers manually.']};
  let layout: ReturnType<typeof tableGrid>;
  try { layout = tableGrid(item); } catch(error) { return {changed:0,issues:[(error as Error).message]}; }
  const {positions,grid}=layout;
  const width=Math.max(0,...grid.map(r=>r.length));
  if (!width || grid.some(r=>r.length!==width || Array.from({length:width},(_,c)=>r[c]).some(c=>!c))) return {changed:0,issues:['The table has gaps or uneven rows. Repair its layout before assigning headers.']};
  const root=item.table.getRootNode() as DocumentFragment;
  const ids=new Map<string,Element[]>();
  root.querySelectorAll('[id]').forEach(el=>ids.set(el.id,[...(ids.get(el.id)??[]),el]));
  const headers=positions.filter(p=>p.cell.tagName==='TH');
  if(!headers.length) return {changed:0,issues:['No heading cells found. Mark the heading rows, columns, or individual cells first, then analyze again.']};
  const firstData=positions.filter(p=>p.cell.tagName==='TD' && p.cell.textContent?.trim()).reduce((n,p)=>Math.min(n,p.row),item.rows.length);
  const label=(p:typeof positions[number])=>`Row ${p.row+1}, column ${p.col+1}`;
  const orientation=new Map<HTMLTableCellElement,string>();
  for(const h of headers) {
    if(!((h.cell.getAttribute('aria-label')??'').trim() || h.cell.textContent?.trim() || h.cell.querySelector('img[alt]')?.getAttribute('alt')?.trim())) issues.push(`${label(h)}: give this heading a meaningful label.`);
    if(h.cell.id && ((ids.get(h.cell.id)?.length??0)!==1 || /\s/.test(h.cell.id))) issues.push(`${label(h)}: its ID is duplicated or contains spaces. Give it a unique ID first.`);
    const scope=h.cell.scope;
    if(scope && !['row','col','rowgroup','colgroup'].includes(scope)) issues.push(`${label(h)}: invalid heading scope.`);
    const top=h.row<firstData;
    const rowLeading=positions.filter(p=>p.row===h.row && p.col<h.col).every(p=>p.cell.tagName==='TH');
    const axis=scope || (top?'col':rowLeading && positions.some(p=>p.row===h.row && p.col>h.col && p.cell.tagName==='TD')?'row':'');
    orientation.set(h.cell,axis);
    if(!axis) issues.push(`${label(h)}: choose Column header or Row header; its direction is unclear.`);
    if((axis==='col'||axis==='colgroup') && !top) issues.push(`${label(h)}: repeated or mid-table column headings need manual relationships.`);
    if(axis==='rowgroup' && headers.some(other=>other!==h && other.cell.scope==='rowgroup' && other.cell.parentElement?.parentElement===h.cell.parentElement?.parentElement)) issues.push(`${label(h)}: multiple group headings share a row group. Assign relationships manually.`);
  }
  const plans=new Map<HTMLTableCellElement,HTMLTableCellElement[]>();
  for(const p of positions) {
    const existing=(p.cell.headers??'').trim();
    if(existing) {
      const targets:HTMLTableCellElement[]=[];
      for(const id of new Set(existing.split(/\s+/))) {
        const matches=ids.get(id)??[];const target=matches[0];
        if(matches.length!==1 || target?.tagName!=='TH' || target===p.cell || target.closest('table')!==item.table) issues.push(`${label(p)}: header reference “${id}” is missing, duplicated, or not a heading in this table.`);
        else targets.push(target as HTMLTableCellElement);
      }
      plans.set(p.cell,targets);continue;
    }
    if (p.cell.tagName==='TD' && headers.some(h => {
      const axis=orientation.get(h.cell);
      return (axis==='col'||axis==='colgroup') && h.row+h.height<=p.row && h.col<p.col+p.width && h.col+h.width>p.col && !(h.col<=p.col && h.col+h.width>=p.col+p.width);
    })) issues.push(`${label(p)}: this merged cell crosses column headings. Assign its relationships manually.`);
    const applicable=headers.filter(h=> {
      if(h===p) return false;
      const axis=orientation.get(h.cell);
      if(axis==='col'||axis==='colgroup') return h.row+h.height<=p.row && h.col<=p.col && h.col+h.width>=p.col+p.width;
      if(axis==='rowgroup') return h.cell.parentElement?.parentElement===p.cell.parentElement?.parentElement && h.row<=p.row && h.col+h.width<=p.col;
      return axis==='row' && h.row<=p.row && h.row+h.height>=p.row+p.height && h.col+h.width<=p.col;
    }).map(h=>h.cell);
    if(p.cell.tagName==='TD' && !applicable.length && p.cell.textContent?.trim()) issues.push(`${label(p)}: no clear heading applies. Select its headings manually.`);
    plans.set(p.cell,applicable);
  }
  const visiting=new Set<HTMLTableCellElement>(),visited=new Set<HTMLTableCellElement>();
  function cyclic(cell:HTMLTableCellElement):boolean {
    if(visiting.has(cell)) return true;if(visited.has(cell))return false;
    visiting.add(cell);for(const h of plans.get(cell)??[]) if(cyclic(h))return true;
    visiting.delete(cell);visited.add(cell);return false;
  }
  if(headers.some(h=>cyclic(h.cell))) issues.push('Header relationships contain a cycle. Remove circular references before analyzing.');
  if(issues.length) return {changed:0,issues:[...new Set(issues)]};
  const used=new Set(ids.keys());let next=1,changed=0;
  for(const h of headers) if(!h.cell.id) {while(used.has(`table-header-${next}`))next++;h.cell.id=`table-header-${next++}`;used.add(h.cell.id);changed++;}
  for(const [cell,targets] of plans) if(!cell.headers.trim() && targets.length) {cell.headers=targets.map(h=>h.id).join(' ');changed++;}
  // Remove scope only after inference and validation succeed.
  for (const cell of cells) if (cell.hasAttribute('scope')) {
    cell.removeAttribute('scope'); changed++;
  }
  if(changed)item.dirty=true;
  return {changed,issues:[]};
}
