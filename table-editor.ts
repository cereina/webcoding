import { assignTableHeaders } from './table-auto-headers.ts';
import { mergeCells, splitCell, tableGrid } from './table-merge.ts';
import { editCellText, changeTableStructure, setCellHeader, associateCellHeaders, removeTableParagraphs, keepOnlyTableTags, removeUnnecessaryTableAttributes } from './table-model.ts';
import { cleanHtml } from './converter.ts';
import { createTableDraft, setTableCaption, setTableHeaders, applyTableDraft, type TableDraft, type TableItem, type HeaderAxis } from './table-model.ts';
import { getElement } from './dom.ts';
import './table-editor.css';

interface TableEditorOptions {
  getSource: () => string;
  commit: (source: string, message: string) => void;
  notify: (message: string) => void;
}

const templates: Record<string,string> = {
  simple: `<table>
  <caption>Table title</caption>
  <thead>
    <tr><th scope="col">Column 1</th><th scope="col">Column 2</th><th scope="col">Column 3</th></tr>
  </thead>
  <tbody>
    <tr><td>Value</td><td>Value</td><td>Value</td></tr>
    <tr><td>Value</td><td>Value</td><td>Value</td></tr>
  </tbody>
</table>`,
  columns: `<table>
  <caption>Grouped column headings</caption>
  <thead>
    <tr><th rowspan="2" scope="col">Item</th><th colspan="2" scope="colgroup">Current period</th></tr>
    <tr><th scope="col">Planned</th><th scope="col">Actual</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Example A</th><td>0</td><td>0</td></tr>
    <tr><th scope="row">Example B</th><td>0</td><td>0</td></tr>
  </tbody>
</table>`,
  rows: `<table>
  <caption>Grouped row headings</caption>
  <thead>
    <tr><th scope="col">Group</th><th scope="col">Item</th><th scope="col">Value</th></tr>
  </thead>
  <tbody>
    <tr><th rowspan="2" scope="rowgroup">Group A</th><th scope="row">Item 1</th><td>0</td></tr>
    <tr><th scope="row">Item 2</th><td>0</td></tr>
    <tr><th rowspan="2" scope="rowgroup">Group B</th><th scope="row">Item 3</th><td>0</td></tr>
    <tr><th scope="row">Item 4</th><td>0</td></tr>
  </tbody>
</table>`,
};

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
    analysis: getElement('table-analysis', 'div'),
    mergeFeedback: getElement('merge-feedback', 'p'),
    guide: getElement('guide-headers', 'button'),
    undoDraft: getElement('table-undo-draft', 'button'),
    open: getElement('edit-tables', 'button'),
    close: getElement('table-close', 'button'),
    cancel: getElement('table-cancel', 'button'),
    splitDialog: getElement('split-dialog', 'dialog'),
  };

  let selectedRow = 0, selectedColumn = 0;
  let selectedCells = new Set<HTMLTableCellElement>();
  let anchorCell: HTMLTableCellElement | undefined;
  let guidedHeaders = false;
  let draft: TableDraft = { source: '', tables: [] }, active = 0, baseSource = '';
  const undoStack: string[] = [];

  const label = (item: TableItem, i: number): string => `Table ${i + 1} — ${item.table.caption?.textContent?.trim() || 'Untitled table'}`;

  function currentItem(): TableItem {
    const item = draft.tables[active];
    if (!item) throw new Error('No table is selected.');
    return item;
  }

  function serializeDraft(): string {
    return applyTableDraft(draft);
  }

  function updateStatus(message?: string): void {
    let changed = false;
    try { changed = serializeDraft() !== baseSource; } catch { changed = true; }
    elements.status.textContent = message ?? (changed ? 'Draft changes are not yet applied to the document.' : 'Your document stays unchanged until you apply.');
    elements.save.disabled = !changed;
    elements.undoDraft.disabled = undoStack.length === 0;
  }

  function rememberMutation(action: () => void): boolean {
    const before = serializeDraft();
    action();
    const after = serializeDraft();
    if (after === before) return false;
    undoStack.push(before);
    if (undoStack.length > 50) undoStack.shift();
    updateStatus();
    return true;
  }

  function refreshPicker(): void {
    elements.picker.replaceChildren(...draft.tables.map((item, i) => new Option(label(item, i), String(i))));
    elements.picker.disabled = !draft.tables.length;
    elements.prev.disabled = !draft.tables.length || active <= 0;
    elements.next.disabled = !draft.tables.length || active >= draft.tables.length - 1;
  }

  function setPrimary(cell: HTMLTableCellElement): void {
    const item = currentItem();
    for (let r=0;r<item.rows.length;r++) {
      const c=[...item.rows[r]!.cells].indexOf(cell);
      if(c>=0) { selectedRow=r; selectedColumn=c; return; }
    }
  }

  function primaryCell(): HTMLTableCellElement | undefined {
    return draft.tables[active]?.rows[selectedRow]?.cells[selectedColumn];
  }

  function selectSingle(cell: HTMLTableCellElement): void {
    selectedCells = new Set([cell]);
    anchorCell = cell;
    setPrimary(cell);
  }

  function selectRectangle(to: HTMLTableCellElement): void {
    const item=currentItem();
    if(!anchorCell) { selectSingle(to); return; }
    const {grid,positions}=tableGrid(item);
    const a=positions.find(p=>p.cell===anchorCell), b=positions.find(p=>p.cell===to);
    if(!a || !b) { selectSingle(to); return; }
    const top=Math.min(a.row,b.row), left=Math.min(a.col,b.col);
    const bottom=Math.max(a.row+a.height,b.row+b.height), right=Math.max(a.col+a.width,b.col+b.width);
    const cells=new Set<HTMLTableCellElement>();
    for(let r=top;r<bottom;r++) for(let c=left;c<right;c++) if(grid[r]?.[c]) cells.add(grid[r]![c]!);
    selectedCells=cells;
    setPrimary(to);
  }

  function relationshipHeaders(item: TableItem, cell: HTMLTableCellElement): HTMLTableCellElement[] {
    const ids=new Set((cell.getAttribute('headers') ?? '').split(/\s+/).filter(Boolean));
    return [...item.table.querySelectorAll<HTMLTableCellElement>('th')].filter(h=>h.closest('table')===item.table && !!h.id && ids.has(h.id));
  }

  function toggleRelationship(header: HTMLTableCellElement): void {
    const item=currentItem(), target=primaryCell();
    if(!target || target.tagName==='TH') {
      elements.mergeFeedback.textContent='Select a data cell first, then choose the headings that describe it.';
      return;
    }
    const current=relationshipHeaders(item,target);
    const next=current.includes(header) ? current.filter(h=>h!==header) : [...current,header];
    try {
      rememberMutation(()=>associateCellHeaders(draft,item,selectedRow,selectedColumn,next));
      preview(); cellSettings();
      elements.mergeFeedback.textContent=next.length ? `${next.length} heading${next.length===1?'':'s'} linked to this data cell.` : 'Header relationships cleared for this data cell.';
    } catch(error) { elements.mergeFeedback.textContent=(error as Error).message; }
  }

  function beginInlineEdit(shownCell: HTMLTableCellElement, sourceCell: HTMLTableCellElement): void {
    if(sourceCell.querySelector('table')) {
      elements.mergeFeedback.textContent='Cells containing nested tables cannot be edited as plain text.';
      return;
    }
    const original=sourceCell.textContent ?? '';
    shownCell.textContent=original;
    shownCell.contentEditable='true';
    shownCell.classList.add('inline-edit');
    shownCell.focus();
    const range=document.createRange(); range.selectNodeContents(shownCell);
    const selection=window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    let finished=false;
    const finish=(save:boolean) => {
      if(finished) return; finished=true;
      const next=shownCell.textContent ?? '';
      shownCell.contentEditable='false';
      if(save && next!==original) {
        try {
          rememberMutation(()=>{ setPrimary(sourceCell); editCellText(currentItem(),selectedRow,selectedColumn,next); });
          elements.mergeFeedback.textContent='Cell text updated in this draft.';
        } catch(error) { elements.mergeFeedback.textContent=(error as Error).message; }
      }
      preview(); cellSettings();
    };
    shownCell.onblur=()=>finish(true);
    shownCell.onkeydown=event=>{
      if(event.key==='Escape'){ event.preventDefault(); finish(false); }
      else if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); finish(true); }
    };
  }

  function preview(): void {
    const item=draft.tables[active];
    if(!item) {
      elements.visual.innerHTML='<div class="table-empty-state"><strong>No table yet.</strong><span>Choose one of the starting templates to add a table to this draft.</span></div>';
      elements.name.textContent='No table selected';
      elements.dimensions.textContent='';
      elements.analysis.replaceChildren();
      elements.mergeFeedback.textContent='';
      updateStatus();
      return;
    }

    elements.visual.innerHTML=cleanHtml(item.table.outerHTML);
    const prefix=`table-preview-${active}-`;
    const mapped=new Map<string,string>();
    elements.visual.querySelectorAll('[id]').forEach((node,i)=>{const id=prefix+i;if(!mapped.has(node.id))mapped.set(node.id,id);node.id=id;});
    elements.visual.querySelectorAll('[headers],[aria-labelledby],[aria-describedby]').forEach(node=>{
      for(const attr of ['headers','aria-labelledby','aria-describedby']) if(node.hasAttribute(attr)) node.setAttribute(attr,node.getAttribute(attr)!.split(/\s+/).map(id=>mapped.get(id)??`${prefix}missing-${id}`).join(' '));
    });
    elements.visual.querySelectorAll('a').forEach(node=>node.removeAttribute('href'));
    elements.name.textContent=`Table ${active+1}`;
    elements.dimensions.textContent=`${item.rows.length} rows · ${item.width} ${item.complex?'cells in widest row':'columns'}`;
    const option=elements.picker.options[active]; if(option) option.textContent=label(item,active);

    const target=primaryCell();
    const related=target ? new Set(relationshipHeaders(item,target)) : new Set<HTMLTableCellElement>();
    const shown=elements.visual.querySelector('table');
    if(shown) [...shown.rows].forEach((row,r)=>[...row.cells].forEach((shownCell,c)=>{
      const sourceCell=item.rows[r]?.cells[c];
      if(!sourceCell) return;
      shownCell.tabIndex=0;
      shownCell.setAttribute('aria-label',`Row ${r+1}, cell ${c+1}: ${shownCell.textContent}`);
      if(selectedCells.has(sourceCell)) shownCell.classList.add('selected-cell');
      if(guidedHeaders && sourceCell===target) shownCell.classList.add('header-target');
      if(guidedHeaders && related.has(sourceCell)) shownCell.classList.add('related-header');
      const choose=(event?:MouseEvent)=>{
        if(guidedHeaders && sourceCell.tagName==='TH' && sourceCell!==target) { toggleRelationship(sourceCell); return; }
        if(event?.shiftKey && anchorCell) selectRectangle(sourceCell); else selectSingle(sourceCell);
        preview(); cellSettings();
      };
      shownCell.onclick=event=>{event.stopPropagation();choose(event);};
      shownCell.ondblclick=event=>{event.preventDefault();event.stopPropagation();selectSingle(sourceCell);cellSettings();beginInlineEdit(shownCell,sourceCell);};
      shownCell.onkeydown=event=>{
        if(event.key==='Enter' || event.key===' ') {
          event.preventDefault();event.stopPropagation();
          if(guidedHeaders && sourceCell.tagName==='TH' && sourceCell!==target) toggleRelationship(sourceCell);
          else { selectSingle(sourceCell); preview(); cellSettings(); }
        }
      };
    }));
    updateStatus();
  }

  function cellSettings(): void {
    const item=draft.tables[active], panel=getElement('cell-settings','div');
    if(!item){panel.hidden=true;return;}
    const cell=primaryCell(); panel.hidden=!cell;
    if(!cell) return;
    getElement('cell-position','h3').textContent=`Row ${selectedRow+1} · Cell ${selectedColumn+1}${selectedCells.size>1 ? ` · ${selectedCells.size} cells selected` : ''}`;
    const text=getElement('cell-text','textarea'); text.value=cell.textContent??''; text.disabled=!!cell.querySelector('table');
    getElement('cell-kind','select').value=cell.tagName==='TH' ? cell.scope||'col' : '';

    const options=getElement('cell-headers','div'); options.replaceChildren();
    const chosen=new Set((cell.getAttribute('headers')??'').split(/\s+/).filter(Boolean));
    const headers=[...item.table.querySelectorAll<HTMLTableCellElement>('th')].filter(h=>h!==cell && h.closest('table')===item.table);
    for(const header of headers){
      const label=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!!header.id&&chosen.has(header.id);
      checkbox.onchange=()=>{
        const inputs=[...options.querySelectorAll<HTMLInputElement>('input')];
        const selected=headers.filter((_,i)=>inputs[i]!.checked);
        try{rememberMutation(()=>associateCellHeaders(draft,item,selectedRow,selectedColumn,selected));preview();cellSettings();}
        catch(error){elements.mergeFeedback.textContent=(error as Error).message;}
      };
      label.append(checkbox,header.textContent?.trim()||'Empty heading');options.append(label);
    }
    if(!headers.length) options.textContent='Mark a cell as a heading to make it available here.';

    elements.guide.disabled=cell.tagName==='TH';
    elements.guide.setAttribute('aria-pressed',String(guidedHeaders && cell.tagName!=='TH'));
    elements.guide.textContent=guidedHeaders && cell.tagName!=='TH' ? 'Done choosing headings' : 'Choose headings for this cell';

    for(const id of ['row-add','row-remove','column-add','column-remove']) getElement(id,'button').disabled=item.complex||!!item.table.querySelector('table')||(id==='row-remove'&&item.rows.length<=1)||(id==='column-remove'&&item.width<=1);
  }

  const cleanupActions = [
    ['remove-table-paragraphs', removeTableParagraphs, (count:number) => count ? `Removed ${count} paragraph tag${count===1?'':'s'} from this table. Text was kept.` : 'No paragraph tags found in this table.'],
    ['keep-table-tags', keepOnlyTableTags, (count:number) => count ? `Removed ${count} non-table tag${count===1?'':'s'} while keeping readable content.` : 'This table already uses table tags only.'],
    ['clean-table-attributes', removeUnnecessaryTableAttributes, (count:number) => count ? `Removed ${count} unnecessary attribute${count===1?'':'s'}. Table structure and accessibility relationships were kept.` : 'No unnecessary attributes found in this table.'],
  ] as const;
  for (const [id, action, message] of cleanupActions) getElement(id,'button').onclick=()=>{
    if(!draft.tables.length)return;
    try{
      let count=0;
      rememberMutation(()=>{count=action(currentItem());});
      show(active,true);
      getElement('cleanup-feedback','p').textContent=message(count);
    }catch(error){getElement('cleanup-feedback','p').textContent=(error as Error).message;}
  };

  getElement('analyze-table-headers','button').onclick=()=>{
    if(!draft.tables.length) return;
    const report=elements.analysis; report.replaceChildren();
    try{
      let result!: ReturnType<typeof assignTableHeaders>;
      rememberMutation(()=>{result=assignTableHeaders(currentItem());});
      preview();cellSettings();
      const summary=document.createElement('p');
      summary.textContent=result.issues.length?'No changes made. Review these items, then analyze again:':result.changed?'Header IDs and relationships added to this draft. Review them, then Apply changes.':'Existing header relationships retained. Review their meaning before publishing.';
      report.append(summary);
      if(result.issues.length){const list=document.createElement('ul');for(const issue of result.issues){const li=document.createElement('li');li.textContent=issue;list.append(li);}report.append(list);}
    }catch(error){elements.mergeFeedback.textContent=(error as Error).message;}
  };

  getElement('merge-selection','button').onclick=()=>{
    if(!draft.tables.length)return;
    try{
      let merged!:HTMLTableCellElement;
      rememberMutation(()=>{merged=mergeCells(currentItem(),selectedCells);});
      selectedCells=new Set([merged]);anchorCell=merged;setPrimary(merged);
      show(active,true);
      elements.mergeFeedback.textContent='Selected cells merged. Their contents were kept in reading order.';
    }catch(error){elements.mergeFeedback.textContent=(error as Error).message;}
  };

  getElement('split-cell','button').onclick=()=>{
    if(!draft.tables.length)return;
    try{
      const item=currentItem(),cell=primaryCell(); if(!cell)throw new Error('Select a cell first.');
      const position=tableGrid(item).positions.find(p=>p.cell===cell); if(!position)throw new Error('Select a cell first.');
      if(position.width===1&&position.height===1)throw new Error('This cell is already a single cell.');
      const rows=getElement('split-rows','input'),cols=getElement('split-columns','input');
      rows.value=String(position.height);rows.max=String(position.height);
      cols.value=String(position.width);cols.max=String(position.width);
      getElement('split-status','p').textContent=`This merged cell covers ${position.height} row${position.height===1?'':'s'} × ${position.width} column${position.width===1?'':'s'}.`;
      elements.splitDialog.showModal();rows.focus();
    }catch(error){elements.mergeFeedback.textContent=(error as Error).message;}
  };

  getElement('split-confirm','button').onclick=()=>{
    try{
      const rowParts=Number(getElement('split-rows','input').value),columnParts=Number(getElement('split-columns','input').value);
      rememberMutation(()=>splitCell(currentItem(),selectedRow,selectedColumn,rowParts,columnParts));
      const cell=primaryCell(); if(cell){selectedCells=new Set([cell]);anchorCell=cell;}
      elements.splitDialog.close();show(active,true);
      elements.mergeFeedback.textContent='Cell split. Its content remains in the top-left resulting cell; new cells are empty.';
    }catch(error){getElement('split-status','p').textContent=(error as Error).message;}
  };
  getElement('split-close','button').onclick=getElement('split-cancel','button').onclick=()=>elements.splitDialog.close();

  getElement('cell-text-save','button').onclick=()=>{
    if(!draft.tables.length)return;
    try{rememberMutation(()=>editCellText(currentItem(),selectedRow,selectedColumn,getElement('cell-text','textarea').value));preview();cellSettings();}
    catch(error){elements.mergeFeedback.textContent=(error as Error).message;}
  };

  getElement('cell-kind','select').onchange=()=>{
    if(!draft.tables.length)return;
    try{rememberMutation(()=>setCellHeader(currentItem(),selectedRow,selectedColumn,getElement('cell-kind','select').value));show(active,true);}
    catch(error){elements.mergeFeedback.textContent=(error as Error).message;}
  };

  elements.guide.onclick=()=>{
    const cell=primaryCell();
    if(!cell||cell.tagName==='TH'){elements.mergeFeedback.textContent='Select a data cell first.';return;}
    guidedHeaders=!guidedHeaders;
    selectedCells=new Set([cell]);anchorCell=cell;
    elements.mergeFeedback.textContent=guidedHeaders?'Guided relationships are on. Click each heading that describes the selected data cell.':'Guided relationships are off.';
    preview();cellSettings();
  };

  for(const axis of ['row','column'] as const) for(const action of ['add','remove']) getElement(`${axis}-${action}`,'button').onclick=()=>{
    try{
      rememberMutation(()=>changeTableStructure(currentItem(),axis,axis==='row'?selectedRow:selectedColumn,action==='remove'));
      selectedRow=Math.min(selectedRow,currentItem().rows.length-1);selectedColumn=Math.min(selectedColumn,currentItem().width-1);
      const cell=primaryCell(); selectedCells=cell?new Set([cell]):new Set();anchorCell=cell;
      show(active,true);
    }catch(error){elements.mergeFeedback.textContent=(error as Error).message;}
  };

  function headerOptions(axis:HeaderAxis,target:HTMLElement,count:number,selected:ReadonlySet<number>):void{
    target.replaceChildren();const item=currentItem();
    for(let i=0;i<count;i++){
      const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=selected.has(i);input.disabled=item.complex;
      input.addEventListener('change',()=>{try{rememberMutation(()=>setTableHeaders(item,axis,i,input.checked));show(active,true);}catch(error){elements.mergeFeedback.textContent=(error as Error).message;}});
      label.append(input,`${axis==='row'?'Row':'Column'} ${i+1}`);target.append(label);
    }
  }

  function show(index:number,keepSelection=false):void{
    if(!draft.tables.length){renderEmpty();return;}
    active=Math.max(0,Math.min(index,draft.tables.length-1));
    const item=currentItem();
    if(!keepSelection){
      selectedRow=0;selectedColumn=0;
      const first=item.rows[0]?.cells[0];selectedCells=first?new Set([first]):new Set();anchorCell=first;guidedHeaders=false;
    }else{
      const valid=new Set([...selectedCells].filter(cell=>item.table.contains(cell)));
      selectedCells=valid;
      if(anchorCell&&!item.table.contains(anchorCell))anchorCell=undefined;
      if(!selectedCells.size){const cell=primaryCell();if(cell){selectedCells=new Set([cell]);anchorCell=cell;}}
    }
    refreshPicker();elements.picker.value=String(active);
    elements.caption.value=item.table.caption?.textContent||'';
    headerOptions('row',elements.headerRows,item.rows.length,item.headerRows);
    headerOptions('column',elements.headerColumns,item.width,item.headerColumns);
    elements.warning.textContent=item.complex?'This table contains merged cells or uneven rows. Use individual cell roles, guided header relationships, merge selection, and split controls. Row and column insertion or removal stays disabled to protect the structure.':'Leading column-heading rows move into the table head. Heading columns stay in the table body. Review the relationships before publishing.';
    elements.analysis.replaceChildren();
    preview();cellSettings();
  }

  function renderEmpty():void{
    active=0;selectedCells.clear();anchorCell=undefined;guidedHeaders=false;
    refreshPicker();elements.caption.value='';elements.caption.disabled=true;
    elements.headerRows.replaceChildren();elements.headerColumns.replaceChildren();getElement('cell-settings','div').hidden=true;
    elements.warning.textContent='Choose a starting template to create the first table. Nothing is added to the document until you Apply changes.';
    preview();
  }

  elements.undoDraft.onclick=()=>{
    const previous=undoStack.pop();if(previous===undefined)return;
    draft=createTableDraft(previous);
    active=Math.min(active,Math.max(0,draft.tables.length-1));
    elements.caption.disabled=false;
    if(draft.tables.length)show(active);else renderEmpty();
    updateStatus('Last draft change undone. The document is still unchanged.');
  };

  document.querySelectorAll<HTMLButtonElement>('[data-table-template]').forEach(button=>button.onclick=()=>{
    const key=button.dataset.tableTemplate??'',template=templates[key];if(!template)return;
    const before=serializeDraft();
    const next=(before.trim()?before.trimEnd()+'\n\n':'')+template+'\n';
    undoStack.push(before);if(undoStack.length>50)undoStack.shift();
    draft=createTableDraft(next);active=draft.tables.length-1;elements.caption.disabled=false;
    refreshPicker();show(active);
    elements.mergeFeedback.textContent='Template added to this draft. Replace its sample text before publishing.';
    updateStatus();
  });

  elements.open.onclick=()=>{
    baseSource=getSource();draft=createTableDraft(baseSource);active=0;undoStack.length=0;elements.caption.disabled=false;
    refreshPicker();
    if(draft.tables.length)show(0);else renderEmpty();
    elements.dialog.showModal();
    (draft.tables.length?elements.picker:document.querySelector<HTMLButtonElement>('[data-table-template]'))?.focus();
  };
  elements.picker.onchange=()=>show(Number(elements.picker.value));
  elements.prev.onclick=()=>show(active-1);
  elements.next.onclick=()=>show(active+1);
  elements.caption.onchange=()=>{
    if(!draft.tables.length)return;
    try{rememberMutation(()=>setTableCaption(currentItem(),elements.caption.value));preview();}
    catch(error){elements.mergeFeedback.textContent=(error as Error).message;}
  };
  elements.close.onclick=elements.cancel.onclick=()=>elements.dialog.close();
  elements.save.onclick=()=>{
    if(getSource()!==baseSource){elements.status.textContent='The document changed while this window was open. Close and reopen the table editor to avoid overwriting those changes.';return;}
    try{
      const output=serializeDraft();
      commit(output,'Table changes applied. Use document Undo to restore the previous version.');
      elements.dialog.close();
    }catch{elements.status.textContent='Unable to apply these changes safely. Your document has not changed.';}
  };
}
