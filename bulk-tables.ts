import { getElement } from './dom.ts';
import { tableStyles } from './table-styles.ts';
import { createBulkTableDraft, generateTableIds, applyBulkTables } from './bulk-tables-model.ts';
import './bulk-tables.css';

export function setupBulkTables({getSource, commit}: {getSource:()=>string; commit:(html:string,message:string)=>void}) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary'; button.textContent = 'All tables';
  getElement('edit-tables','button').after(button);
  const dialog = document.createElement('dialog'); dialog.className = 'bulk-tables-dialog'; dialog.setAttribute('aria-labelledby','bulk-tables-title');
  dialog.innerHTML = `<div class="dialog-header"><div><h2 id="bulk-tables-title">Manage all tables</h2><p>Review captions, apply WET classes and create a linked list of tables.</p></div><button type="button" class="button ghost" data-action="close" aria-label="Close all tables">✕</button></div>
  <div class="bulk-settings"><fieldset><legend>WET classes for all tables</legend><p>Mixed means tables have different settings. Unchanged options preserve existing classes. Your website needs WET CSS.</p><div data-slot="classes"></div></fieldset><fieldset><legend>Table links</legend><button type="button" class="button secondary" data-action="ids">Generate all table IDs</button><p>Preserves unique IDs and creates missing or replacement IDs.</p><label><input type="checkbox" data-field="toc" checked> Create or update the list of tables</label><label for="bulk-toc-title">Heading for the list of tables</label><input id="bulk-toc-title" type="text" placeholder="e.g. List of tables"><p>Placed below the page table of contents, or at the beginning. IDs are generated automatically when creating the list.</p></fieldset></div>
  <p>For missing captions, Maple suggests text from the paragraph or heading immediately above the table. Check a suggestion to move it into the caption and remove the original paragraph or heading when you apply. Unchecked suggestions leave the original text in place.</p>
  <div class="bulk-table-list" data-slot="tables"></div><p role="status" data-slot="status"></p><div class="dialog-actions"><button type="button" class="button secondary" data-action="cancel">Cancel</button><button type="button" class="button primary" data-action="apply">Apply to document</button></div>`;
  document.body.append(dialog);
  const find = <T extends Element>(selector:string) => dialog.querySelector<T>(selector)!;
  const status=find<HTMLElement>('[data-slot=status]');
  let base='', draft=createBulkTableDraft('');
  let captions: HTMLInputElement[]=[];
  const acceptedSuggestions=new Set<number>();
  const changes=new Map<string,boolean>();
  const idLabels: HTMLElement[]=[];
  const refreshIds=()=>draft.entries.forEach(({table},i)=>idLabels[i]!.textContent=table.id ? `ID: ${table.id}` : 'No ID yet');
  button.onclick=()=>{
    base=getSource();draft=createBulkTableDraft(base);changes.clear();acceptedSuggestions.clear();captions=[];idLabels.length=0;status.textContent='';
    const existing=draft.root.content.querySelector('[data-maple-table-toc="true"] h2');
    find<HTMLInputElement>('#bulk-toc-title').value=existing?.textContent||'';
    find<HTMLInputElement>('[data-field=toc]').checked=true;
    const classes=find<HTMLElement>('[data-slot=classes]');classes.replaceChildren();
    for(const [name,title] of tableStyles){
      const label=document.createElement('label'), input=document.createElement('input');input.type='checkbox';
      const count=draft.entries.filter(({table})=>table.classList.contains(name)).length;
      input.checked=count>0&&count===draft.entries.length;input.indeterminate=count>0&&count<draft.entries.length;
      input.onchange=()=>{
        changes.set(name,input.checked);
        if(name!=='table'&&input.checked){ const baseInput=classes.querySelector<HTMLInputElement>('input[data-class="table"]')!;baseInput.checked=true;baseInput.indeterminate=false;changes.set('table',true); }
        if(name==='table'&&!input.checked) classes.querySelectorAll<HTMLInputElement>('input').forEach(other=>{other.checked=false;other.indeterminate=false;changes.set(other.dataset.class!,false);});
      };
      input.dataset.class=name;label.append(input,document.createTextNode(`${title} (${name})`));classes.append(label);
    }
    const list=find<HTMLElement>('[data-slot=tables]');list.replaceChildren();
    draft.entries.forEach(({index,caption,suggestion})=>{
      const row=document.createElement('div');row.className='bulk-table-row';
      const label=document.createElement('label');label.htmlFor=`bulk-caption-${index}`;label.textContent=`Table ${index+1} caption`;
      const input=document.createElement('input');input.type='text';input.id=label.htmlFor;input.value=caption;
      const note=document.createElement('p');note.id=`bulk-note-${index}`;note.textContent=caption?'Existing caption':suggestion?'Suggested from the text immediately above — please review.':'No caption found. Enter one to include this table in the list.';input.setAttribute('aria-describedby',note.id);
      const id=document.createElement('span');idLabels.push(id);captions.push(input);row.append(label,input,note,id);
      if(suggestion){
        const acceptLabel=document.createElement('label');acceptLabel.className='bulk-accept-caption';
        const accept=document.createElement('input');accept.type='checkbox';accept.dataset.acceptCaption=String(index);accept.setAttribute('aria-describedby',note.id);
        let manualCaption=input.value;
        accept.onchange=()=>{
          if(accept.checked){manualCaption=input.value;input.value=suggestion;acceptedSuggestions.add(index);}
          else {input.value=manualCaption;acceptedSuggestions.delete(index);}
        };
        acceptLabel.append(accept,document.createTextNode('Use suggested caption and remove the text above this table'));
        note.after(acceptLabel);
      }
      list.append(row);
    });
    refreshIds();find<HTMLButtonElement>('[data-action=apply]').disabled=!draft.entries.length;find<HTMLButtonElement>('[data-action=ids]').disabled=!draft.entries.length;
    if(!draft.entries.length)status.textContent='No tables found. Add or import a table first.';
    dialog.showModal();
  };
  for(const action of ['close','cancel'])find<HTMLButtonElement>(`[data-action=${action}]`).onclick=()=>dialog.close();
  find<HTMLButtonElement>('[data-action=ids]').onclick=()=>{generateTableIds(draft);refreshIds();status.textContent='Table IDs prepared. Apply to save them to the document.';};
  find<HTMLButtonElement>('[data-action=apply]').onclick=()=>{
    if(getSource()!==base){status.textContent='The document changed. Close and reopen this window before applying.';return;}
    try{
      const output=applyBulkTables(draft,captions.map(input=>input.value),changes,find<HTMLInputElement>('[data-field=toc]').checked,find<HTMLInputElement>('#bulk-toc-title').value,acceptedSuggestions);
      commit(output,'All-table changes applied. Document Undo is available.');dialog.close();
    }catch(error){status.textContent=(error as Error).message;}
  };
}
