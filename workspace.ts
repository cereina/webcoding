import { getElement } from './dom.ts';
export function setupWorkspace() {
  const workspace = getElement('workspace', 'section');
  const divider = getElement('workspace-divider', 'div');
  const layout = getElement('workspace-layout', 'select');
  const size = getElement('preview-size', 'select');
  const frame = getElement('preview', 'iframe');
  let ratio = 50;
  const setRatio = (value: number) => {
    ratio = Math.max(25, Math.min(75, value));
    workspace.style.setProperty('--editor-share', `${ratio}%`);
    divider.setAttribute('aria-valuenow', String(Math.round(ratio)));
    divider.setAttribute('aria-valuetext', `Editor ${Math.round(ratio)} percent, preview ${100-Math.round(ratio)} percent`);
  };
  const setLayout = () => { workspace.dataset.layout = layout.value; };
  layout.onchange = setLayout;
  size.onchange = () => {
    const width = size.value === 'tablet' ? '768px' : size.value === 'phone' ? '375px' : '100%';
    frame.style.width = width; frame.style.minWidth = width; frame.style.flex = size.value === 'desktop' ? '1 0 100%' : `0 0 ${width}`;
    getElement('preview-size-note', 'span').textContent = size.value === 'desktop' ? 'Desktop · fits available space' : `${size.value === 'tablet' ? 'Tablet · 768' : 'Phone · 375'} px · scroll horizontally if needed`;
  };
  divider.onkeydown = event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    setRatio(event.key === 'Home' ? 25 : event.key === 'End' ? 75 : ratio + (event.key === 'ArrowLeft' ? -2 : 2));
  };
  divider.onpointerdown = event => {
    if (event.button !== 0) return;
    event.preventDefault(); divider.focus(); divider.setPointerCapture(event.pointerId); workspace.classList.add('resizing');
  };
  divider.onpointermove = event => {
    if (!divider.hasPointerCapture(event.pointerId)) return;
    const rect = workspace.getBoundingClientRect(); setRatio((event.clientX - rect.left) / rect.width * 100);
  };
  const stop = () => workspace.classList.remove('resizing');
  divider.onpointerup = event => { if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId); stop(); };
  divider.onpointercancel = stop; divider.onlostpointercapture = stop;
  getElement('workspace-reset', 'button').onclick = () => { setRatio(50); layout.value = 'split'; setLayout(); size.value = 'desktop'; size.dispatchEvent(new Event('change')); };
  setRatio(50); setLayout();
  return { revealEditor() { if (layout.value === 'preview') { layout.value = 'split'; setLayout(); } } };
}

