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
        grid[y] ??= [];
        if(grid[y]![x]) throw new Error('Overlapping cells need repair before merging.');
        grid[y]![x]=cell;
      }
      positions.push({cell,row:r,col,height,width});
      col+=width;
    }
  });
  return {grid,positions};
}

function preserveRemovedId(item: TableItem, target: HTMLTableCellElement, removed: HTMLTableCellElement): void {
  if (!removed.id || removed.id === target.id) return;
  if (removed.tagName === 'TH') {
    if (!target.id) target.id = removed.id;
    const replacementId = target.id;
    item.table.querySelectorAll('[headers]').forEach(el => {
      const refs = (el.getAttribute('headers') ?? '').split(/\s+/).filter(Boolean);
      if (!refs.includes(removed.id)) return;
      el.setAttribute('headers', [...new Set(refs.map(id => id === removed.id ? replacementId : id))].join(' '));
    });
    if (target.id === removed.id) return;
  }
  const anchor=document.createElement('span');
  anchor.id=removed.id;
  target.append(anchor);
}

export function mergeCells(item: TableItem, cells: Iterable<HTMLTableCellElement>): HTMLTableCellElement {
  const selected = new Set(cells);
  if (selected.size < 2) throw new Error('Select at least two cells to merge.');
  const {grid,positions}=tableGrid(item);
  const chosen = positions.filter(p=>selected.has(p.cell));
  if (chosen.length !== selected.size) throw new Error('The selection includes a cell outside this table.');

  const top=Math.min(...chosen.map(p=>p.row));
  const left=Math.min(...chosen.map(p=>p.col));
  const bottom=Math.max(...chosen.map(p=>p.row+p.height));
  const right=Math.max(...chosen.map(p=>p.col+p.width));
  const targetPosition=chosen.find(p=>p.row===top && p.col===left);
  if (!targetPosition) throw new Error('Select a complete rectangle of cells.');

  for(let y=top;y<bottom;y++) for(let x=left;x<right;x++) {
    const cell=grid[y]?.[x];
    if(!cell || !selected.has(cell)) throw new Error('Select a complete rectangle with no gaps before merging.');
  }
  for (const p of chosen) {
    if (p.row < top || p.col < left || p.row+p.height > bottom || p.col+p.width > right) {
      throw new Error('A merged cell crosses the edge of this selection. Select the whole cell.');
    }
  }

  const target=targetPosition.cell;
  const section=target.parentElement?.parentElement;
  if (chosen.some(p=>p.cell.parentElement?.parentElement!==section)) throw new Error('Cells in different table sections cannot be merged.');
  if (chosen.some(p=>p.cell.tagName!==target.tagName || p.cell.scope!==target.scope)) throw new Error('Choose cells with the same cell type before merging.');
  if (chosen.some(p=>p.cell.querySelector('table'))) throw new Error('Cells containing nested tables cannot be merged.');

  const ordered=[...chosen].sort((a,b)=>a.row-b.row || a.col-b.col);
  const headerRefs=new Set<string>();
  for (const p of ordered) {
    for (const id of p.cell.headers.split(/\s+/).filter(Boolean)) headerRefs.add(id);
  }
  for (const p of ordered) {
    if (p.cell===target) continue;
    preserveRemovedId(item,target,p.cell);
    if(target.childNodes.length && p.cell.childNodes.length) target.append(document.createElement('br'));
    target.append(...p.cell.childNodes);
  }
  if (headerRefs.size) target.headers=[...headerRefs].join(' ');
  for (const p of ordered) if(p.cell!==target) p.cell.remove();

  if (bottom-top===1) target.removeAttribute('rowspan'); else target.rowSpan=bottom-top;
  if (right-left===1) target.removeAttribute('colspan'); else target.colSpan=right-left;
  refreshTableShape(item);
  return target;
}

export function mergeNeighbour(item: TableItem, row: number, column: number, direction: 'right'|'down'): HTMLTableCellElement {
  const {grid,positions}=tableGrid(item), cell=item.rows[row]?.cells[column];
  const a=positions.find(p=>p.cell===cell);
  if(!a) throw new Error('Select a cell first.');
  const neighbour=direction==='right'?grid[a.row]?.[a.col+a.width]:grid[a.row+a.height]?.[a.col];
  if(!neighbour) throw new Error(`There is no cell ${direction==='right'?'to the right':'below'} to merge.`);
  return mergeCells(item,[a.cell,neighbour]);
}

export function splitCell(item: TableItem,row:number,column:number,rows?:number,columns?:number): void {
  const {positions}=tableGrid(item), cell=item.rows[row]?.cells[column];
  const p=positions.find(p=>p.cell===cell);
  if(!p) throw new Error('Select a cell first.');
  if(p.width===1 && p.height===1) throw new Error('This cell is already a single cell.');

  const rowParts=rows ?? p.height;
  const columnParts=columns ?? p.width;
  if(!Number.isInteger(rowParts) || !Number.isInteger(columnParts) || rowParts<1 || columnParts<1) {
    throw new Error('Choose whole numbers for rows and columns.');
  }
  if(rowParts>p.height || columnParts>p.width || p.height%rowParts || p.width%columnParts) {
    throw new Error(`Choose row and column counts that divide this ${p.height} × ${p.width} merged cell evenly.`);
  }
  if(rowParts===1 && columnParts===1) throw new Error('Choose more than one resulting cell.');

  const partHeight=p.height/rowParts, partWidth=p.width/columnParts;
  const original=p.cell;
  const copyAttributes=(target: HTMLTableCellElement) => {
    for(const attr of original.attributes) {
      if(['id','rowspan','colspan'].includes(attr.name)) continue;
      target.setAttribute(attr.name,attr.value);
    }
  };
  const setSpan=(target: HTMLTableCellElement) => {
    if(partHeight===1) target.removeAttribute('rowspan'); else target.rowSpan=partHeight;
    if(partWidth===1) target.removeAttribute('colspan'); else target.colSpan=partWidth;
  };

  setSpan(original);
  for(let ry=0;ry<rowParts;ry++) {
    const sourceRow=p.row+ry*partHeight;
    const row=item.rows[sourceRow];
    if(!row) throw new Error('This cell cannot be split across the current table structure.');
    const referencePositions=positions.filter(x=>x.row===sourceRow && x.cell!==original).sort((a,b)=>a.col-b.col);
    for(let cx=0;cx<columnParts;cx++) {
      if(ry===0 && cx===0) continue;
      const startCol=p.col+cx*partWidth;
      const added=document.createElement(original.tagName.toLowerCase()) as HTMLTableCellElement;
      copyAttributes(added);
      setSpan(added);
      const after=referencePositions.find(x=>x.col>startCol)?.cell ?? null;
      row.insertBefore(added,after);
    }
  }
  refreshTableShape(item);
}
