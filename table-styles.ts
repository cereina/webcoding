import type { TableItem } from './table-model.ts';

/** Table-element styles documented in the WET design guide. */
export const tableStyles = [
  ['table', 'Basic table styling'],
  ['table-striped', 'Striped rows'],
  ['table-hover', 'Highlight rows on hover'],
  ['table-bordered', 'Cell borders'],
  ['table-condensed', 'Compact spacing'],
] as const;

export function setTableStyle(item: TableItem, name: string, enabled: boolean): void {
  if (!tableStyles.some(([value]) => value === name)) throw new Error('Unknown table style.');
  item.table.classList.toggle(name, enabled);
  if (enabled && name !== 'table') item.table.classList.add('table');
  if (!enabled && name === 'table') {
    for (const [value] of tableStyles) item.table.classList.remove(value);
  }
  if (!item.table.className) item.table.removeAttribute('class');
  item.dirty = true;
}

export function createTableStyleChecklist(container: HTMLElement, change: (name: string, enabled: boolean) => void): (item?: TableItem) => void {
  const fieldset = document.createElement('fieldset'); fieldset.className = 'table-style-checklist';
  const legend = document.createElement('legend'); legend.textContent = 'WET table classes';
  const help = document.createElement('p'); help.className = 'table-help'; help.id = 'table-style-help';
  help.textContent = 'Applies to this table only. Extra styles automatically include “table”. Unchecking basic styling removes these extra styles. Your website needs WET CSS; Maple’s preview uses its own styling.';
  fieldset.setAttribute('aria-describedby', help.id); fieldset.append(legend, help);
  const inputs = tableStyles.map(([name, title]) => {
    const label = document.createElement('label');
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = name;
    const code = document.createElement('code'); code.textContent = name;
    input.onchange = () => change(name, input.checked);
    label.append(input, document.createTextNode(title + ' '), code); fieldset.append(label);
    return input;
  });
  container.prepend(fieldset);
  return (item) => { fieldset.disabled = !item; inputs.forEach(input => { input.checked = Boolean(item?.table.classList.contains(input.value)); }); };
}
