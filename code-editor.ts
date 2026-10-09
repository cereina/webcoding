import * as monaco from 'monaco-editor';

import 'monaco-editor/language/html/monaco.contribution.js';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';

(self as typeof self & { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
  getWorker(_moduleId, label) {
    return label === 'html' ? new HtmlWorker() : new EditorWorker();
  },
};

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
    value, language: 'html', theme: 'vs-dark', automaticLayout: true,
    ariaLabel: 'HTML source code', accessibilitySupport: 'auto',
    minimap: { enabled: false }, fontSize: 14, lineHeight: 23,
    tabSize: 2, insertSpaces: true, wordWrap: 'on',
    lineNumbers: 'on', folding: true, scrollBeyondLastLine: false,
    padding: { top: 16, bottom: 16 }, fixedOverflowWidgets: true,
  });
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
