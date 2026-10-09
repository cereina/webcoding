import * as monaco from 'monaco-editor';
import './contrast.css';

import 'monaco-editor/language/html/monaco.contribution.js';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';

(self as typeof self & { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
  getWorker(_moduleId, label) {
    return label === 'html' ? new HtmlWorker() : new EditorWorker();
  },
};

const MAPLE_ACCESSIBLE_THEME = 'maple-accessible-dark';
monaco.editor.defineTheme(MAPLE_ACCESSIBLE_THEME, {
  base: 'vs-dark',
  // Do not inherit token colours from Monaco's built-in dark theme. HTML uses
  // language-specific scopes such as delimiter.html and tag.html; inherited
  // values can otherwise reintroduce low-contrast colours.
  inherit: false,
  rules: [
    { token: '', foreground: 'E6EEF1', background: '142B36' },

    // HTML text and markup. Every foreground below is at least 4.5:1 against
    // Maple's #142B36 editor background.
    { token: 'delimiter', foreground: 'F4FAFC' },
    { token: 'delimiter.html', foreground: 'F4FAFC' },
    { token: 'tag', foreground: '8CCBFF' },
    { token: 'tag.html', foreground: '8CCBFF' },
    { token: 'metatag', foreground: 'B8D9FF' },
    { token: 'metatag.html', foreground: 'B8D9FF' },
    { token: 'attribute.name', foreground: 'FFD28A' },
    { token: 'attribute.name.html', foreground: 'FFD28A' },
    { token: 'attribute.value', foreground: 'B7E7A7' },
    { token: 'attribute.value.html', foreground: 'B7E7A7' },
    { token: 'string', foreground: 'B7E7A7' },
    { token: 'string.html', foreground: 'B7E7A7' },
    { token: 'number', foreground: 'FFD28A' },
    { token: 'keyword', foreground: '8CCBFF' },
    { token: 'comment', foreground: 'A9C7B7' },
    { token: 'comment.html', foreground: 'A9C7B7' },
    { token: 'comment.content.html', foreground: 'A9C7B7' },
  ],
  colors: {
    'editor.background': '#142B36',
    'editor.foreground': '#E6EEF1',
    'editorGutter.background': '#142B36',
    'editorLineNumber.foreground': '#A9BCC4',
    'editorLineNumber.activeForeground': '#F4FAFC',
    'editorCursor.foreground': '#8CE1C3',
    'editorWhitespace.foreground': '#748A81',
    'editorIndentGuide.background1': '#748A81',
    'editorIndentGuide.activeBackground1': '#A9BCC4',
  },
});

function nameGeneratedAccessibilityElements(editorElement: HTMLElement): void {
  const applyNames = () => {
    // Monaco creates this helper textarea internally for IME/input handling.
    // Some automated accessibility checkers still inspect it even though
    // Monaco marks it aria-hidden and removes it from the tab order.
    const imeTextArea = editorElement.querySelector<HTMLTextAreaElement>('textarea.ime-text-area');
    if (imeTextArea && !imeTextArea.hasAttribute('aria-label')) {
      imeTextArea.setAttribute('aria-label', 'HTML editor input helper');
    }

    // The table editor heading is populated when a table is previewed. Give
    // it meaningful text immediately so the initial DOM never contains an
    // empty heading.
    const tableName = document.getElementById('table-name');
    if (tableName && !(tableName.textContent ?? '').trim()) {
      tableName.textContent = 'Table preview';
    }

    // The figure picker is created dynamically by main.ts and opened from a
    // visible building-block button. Give the hidden native input an explicit
    // accessible name for scanners that inspect hidden form controls.
    const imageInput = document.querySelector<HTMLInputElement>('input[type="file"][accept*="image/"]');
    if (imageInput && !imageInput.hasAttribute('aria-label')) {
      imageInput.setAttribute('aria-label', 'Choose an image for the figure');
    }
  };

  applyNames();
  // main.ts creates the figure input later in the same module evaluation, and
  // Monaco may finish wiring its helper textarea after editor creation.
  queueMicrotask(applyNames);
}

export interface MapleCodeEditor {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  replace(value: string): void;
  focus(): void;
  setSelectionRange(start: number, end: number): void;
  onChange(callback: () => void): monaco.IDisposable;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  dispose(): void;
}

declare global {
  interface Window {
    __mapleEditor?: MapleCodeEditor;
  }
}

export function createCodeEditor(element: HTMLElement, value: string): MapleCodeEditor {
  const instance = monaco.editor.create(element, {
    value, language: 'html', theme: MAPLE_ACCESSIBLE_THEME, automaticLayout: true,
    ariaLabel: 'HTML source code', accessibilitySupport: 'auto',
    minimap: { enabled: false }, fontSize: 14, lineHeight: 23,
    tabSize: 2, insertSpaces: true, wordWrap: 'on',
    lineNumbers: 'on', folding: true, scrollBeyondLastLine: false,
    padding: { top: 16, bottom: 16 }, fixedOverflowWidgets: true,
  });
  nameGeneratedAccessibilityElements(element);
  const model = instance.getModel()!;
  let api!: MapleCodeEditor;
  api = {
    get value() { return model.getValue(); },
    get selectionStart() { return model.getOffsetAt(instance.getSelection()!.getStartPosition()); },
    get selectionEnd() { return model.getOffsetAt(instance.getSelection()!.getEndPosition()); },
    replace(value: string) {
      if (value === model.getValue()) return;
      instance.pushUndoStop();
      instance.executeEdits('document-action', [{ range: model.getFullModelRange(), text: value }]);
      instance.pushUndoStop();
    },
    focus() { instance.focus(); },
    setSelectionRange(start: number, end: number) {
      const first = model.getPositionAt(start), last = model.getPositionAt(end);
      instance.setSelection(new monaco.Range(first.lineNumber, first.column, last.lineNumber, last.column));
      instance.revealPositionInCenterIfOutsideViewport(last);
    },
    onChange(callback: () => void) { return instance.onDidChangeModelContent(callback); },
    canUndo() { return model.canUndo(); },
    canRedo() { return model.canRedo(); },
    undo() { instance.trigger('toolbar', 'undo', null); },
    redo() { instance.trigger('toolbar', 'redo', null); },
    dispose() {
      if (window.__mapleEditor === api) delete window.__mapleEditor;
      instance.dispose(); model.dispose();
    },
  };
  window.__mapleEditor = api;
  return api;
}
