import { reviewDocument } from './review-model.ts';
import { getElement } from './dom.ts';

export function setupReview(options: {
  getSource: () => string;
  select: (start: number, end: number) => void;
  notify: (message: string) => void;
}) {
  const frame = getElement('preview', 'iframe');
  const toggle = getElement('select-preview', 'button');
  const filter = getElement('review-filter', 'select');
  let state: ReturnType<typeof reviewDocument> | undefined;
  let selecting = false;
  let highlighted: Element | undefined;
  let originalOutline = '';
  function jump(id?: string) {
    if (!state || options.getSource() !== state.source) {
      options.notify('The document changed. Wait for the preview to update, then select again.'); return;
    }
    const range = id ? state.ranges.get(id) : undefined;
    options.select(range?.start ?? 0, range?.end ?? 0);
    if (highlighted) (highlighted as HTMLElement).style.outline = originalOutline;
    const target = id ? frame.contentDocument?.querySelector(`[${state.attribute}="${id}"]`) : null;
    if (target) {
      highlighted = target;
      // iframe elements belong to another window, so use their style directly.
      const styled = target as HTMLElement;
      originalOutline = styled.style.outline;
      styled.style.outline = '3px solid #bd620c';
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    options.notify(range ? 'Matching HTML selected in the editor.' : 'Document-level finding: review the start of your HTML.');
  }
  function list() {
    if (!state) return;
    const warnings = state.findings.filter(f => f.level === 'warning').length;
    getElement('issue-count', 'span').textContent = String(state.findings.length);
    getElement('review-summary', 'p').textContent = `${warnings} potential issues · ${state.findings.length - warnings} review prompts`;
    const findings = state.findings.filter(f => filter.value === 'all' || f.level === filter.value);
    getElement('issues', 'ul').replaceChildren(...findings.map(f => {
      const li = document.createElement('li'); li.className = f.level;
      const label = document.createElement('span'); label.className = 'finding-label'; label.textContent = f.level === 'warning' ? 'Check' : 'Manual review';
      const button = document.createElement('button'); button.textContent = f.message; button.onclick = () => jump(f.target);
      li.append(label, button); return li;
    }));
    if (!findings.length) {
      const li = document.createElement('li'); li.textContent = state.findings.length ? 'No findings in this category.' : 'No issues detected by these checks. Complete a manual review before publishing.';
      getElement('issues', 'ul').append(li);
    }
  }
  toggle.onclick = () => {
    selecting = !selecting; toggle.setAttribute('aria-pressed', String(selecting));
    getElement('preview-help', 'span').textContent = selecting ? 'Select content to find its HTML. Tab and Enter also work.' : 'Links work normally. Turn on Select content to jump to HTML.';
    if (state) render(state.source, getElement('language', 'select').value);
  };
  filter.onchange = list;
  frame.onload = () => {
    const doc = frame.contentDocument;
    if (!doc || !state) return;
    const attr = state.attribute;
    if (!selecting) return;
    const style = doc.createElement('style');
    style.textContent = `[${attr}]:hover,[${attr}]:focus{outline:2px solid #136c60;outline-offset:2px;cursor:crosshair}`;
    doc.head.append(style);
    doc.querySelectorAll(`[${attr}]`).forEach(el => el.setAttribute('tabindex', '0'));
    const activate = (event: Event) => {
      const target = event.target as Element | null;
      const el = target?.closest?.(`[${attr}]`);
      if (!el) return;
      event.preventDefault(); event.stopPropagation(); jump(el.getAttribute(attr) ?? undefined);
    };
    doc.addEventListener('click', activate, true);
    doc.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') activate(event); }, true);
  };
  function render(source: string, language: string) {
    state = reviewDocument(source, language); highlighted = undefined;
    frame.srcdoc = state.page; list();
  }
  return { render };
}

