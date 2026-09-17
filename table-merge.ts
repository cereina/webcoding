import { refreshTableShape, type TableItem } from './table-model.ts';
interface Position { cell: HTMLTableCellElement; row: number; col: number; height: number; width: number }
export function tableGrid(item: TableItem) {
  const grid: HTMLTableCellElement[][] = [], positions: Position[] = [];
  item.rows.forEach((row,r) => {
    grid[r] ??= [];
    let col=0;
    for (const cell of row.cells) {
      while (grid[r]![col]) col++;
      const remaining = item.rows.slice(r).filter(x=>x.parentElement===row.parentElement).length;
      const height=cell.rowSpan===0 ? remaining : cell.rowSpan, width=cell.colSpan;
      if (height>remaining || height*width>10000) throw new Error('This table has unsupported spans. Review its structure first.');
      for(let y=r;y<r+height;y++) for(let x=col;x<col+width;x++) {
        grid[y] ??= []; if(grid[y]![x]) throw new Error('Overlapping cells need repair before merging.'); grid[y]![x]=cell;
      }
      positions.push({cell,row:r,col,height,width});col+=width;
    }
  });
  return {grid,positions};
}
export function mergeNeighbour(item: TableItem, row: number, column: number, direction: 'right'|'down'): HTMLTableCellElement {
  const {grid,positions}=tableGrid(item), cell=item.rows[row]?.cells[column];
  const a=positions.find(p=>p.cell===cell); if(!a) throw new Error('Select a cell first.');
  const neighbour=direction==='right'?grid[a.row]?.[a.col+a.width]:grid[a.row+a.height]?.[a.col];
  const b=positions.find(p=>p.cell===neighbour);
  if(!b) throw new Error(`There is no cell ${direction==='right'?'to the right':'below'} to merge.`);
  if(a.cell.parentElement?.parentElement!==b.cell.parentElement?.parentElement) throw new Error('Cells in different table sections cannot be merged.');
  if(direction==='right' ? a.row!==b.row || a.height!==b.height : a.col!==b.col || a.width!==b.width) throw new Error('These cells do not line up. Split the neighbouring merged cell first.');
  if(a.cell.tagName!==b.cell.tagName || a.cell.scope!==b.cell.scope) throw new Error('Choose cells with the same cell type before merging.');
  if(a.cell.querySelector('table') || b.cell.querySelector('table')) throw new Error('Cells containing nested tables cannot be merged.');
  // Preserve removed cell destinations and rich content rather than discarding them.
  if(b.cell.id && !(b.cell.tagName==='TH' && !a.cell.id)) { const anchor=document.createElement('span');anchor.id=b.cell.id;a.cell.append(anchor); }
  if(a.cell.childNodes.length && b.cell.childNodes.length) a.cell.append(document.createElement('br'));
  a.cell.append(...b.cell.childNodes);
  const refs=new Set(`${a.cell.headers} ${b.cell.headers}`.split(/\s+/).filter(Boolean));
  if(refs.size) a.cell.headers=[...refs].join(' ');
  if(b.cell.id && b.cell.tagName==='TH') {
    if(!a.cell.id) { a.cell.id=b.cell.id; }
    item.table.querySelectorAll('[headers]').forEach(el=>el.setAttribute('headers',[...new Set(el.getAttribute('headers')!.split(/\s+/).map(id=>id===b.cell.id?a.cell.id:id))].join(' ')));
  }
  if(direction==='right') a.cell.colSpan=a.width+b.width; else a.cell.rowSpan=a.height+b.height;
  b.cell.remove();refreshTableShape(item);return a.cell;
}
export function splitCell(item: TableItem,row:number,column:number): void {
  const {positions}=tableGrid(item), cell=item.rows[row]?.cells[column];
  const p=positions.find(p=>p.cell===cell);if(!p) throw new Error('Select a cell first.');
  if(p.width===1 && p.height===1) throw new Error('This cell is already unmerged.');
  for(let r=p.row;r<p.row+p.height;r++) for(let c=p.col;c<p.col+p.width;c++) {
    if(r===p.row && c===p.col) continue;
    const added=document.createElement(p.cell.tagName.toLowerCase()) as HTMLTableCellElement;
    if(p.cell.scope) added.scope=p.cell.scope;
    if(p.cell.headers) added.headers=p.cell.headers;
    const after=positions.find(x=>x.row===r && x.col>c)?.cell;
    item.rows[r]!.insertBefore(added,after??null);
  }
  p.cell.removeAttribute('rowspan');p.cell.removeAttribute('colspan');refreshTableShape(item);
}

