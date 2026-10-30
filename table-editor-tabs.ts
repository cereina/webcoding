/** Accessible automatic-activation tabs; panel switches never recreate table controls. */
export function setupTableEditorTabs(dialog: HTMLElement): (name: string) => void {
  const tabs = [...dialog.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const activate = (name: string): void => {
    const selected = tabs.find(tab => tab.id === `table-tab-${name}`);
    if (!selected) return;
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = dialog.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`);
      if (panel) panel.hidden = !active;
    }
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.id.replace('table-tab-', '')));
    tab.addEventListener('keydown', event => {
      let next: number;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[next]!.click();
      tabs[next]!.focus();
    });
  });
  return activate;
}
