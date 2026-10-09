import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../contrast.css', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../code-editor.ts', import.meta.url), 'utf8');

function luminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map(value => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function cssVariable(name) {
  const match = css.match(new RegExp(`--${name}:(#[0-9a-f]{6})`, 'i'));
  assert.ok(match, `Missing --${name}`);
  return match[1];
}

function editorColor(key) {
  const match = editorSource.match(new RegExp(`['\"]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]:\\s*['\"](#[0-9a-f]{6})['\"]`, 'i'));
  assert.ok(match, `Missing Monaco color ${key}`);
  return match[1];
}

function tokenColor(token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = editorSource.match(new RegExp(`token:\\s*['\"]${escaped}['\"]\\s*,\\s*foreground:\\s*['\"]([0-9a-f]{6})['\"]`, 'i'));
  assert.ok(match, `Missing Monaco token colour for ${token || 'default text'}`);
  return `#${match[1]}`;
}

test('placeholder text meets WCAG AA normal-text contrast', () => {
  const placeholder = cssVariable('maple-placeholder');
  assert.ok(contrast(placeholder, '#fafcf9') >= 4.5);
  assert.ok(contrast(placeholder, '#ffffff') >= 4.5);
});

test('light control boundaries meet WCAG non-text contrast', () => {
  const border = cssVariable('maple-control-border');
  for (const background of ['#ffffff', '#f5f8f4', '#dff0e9', '#e4ece7']) {
    assert.ok(contrast(border, background) >= 3, `${border} on ${background} is below 3:1`);
  }
});

test('dark toolbar boundaries meet WCAG non-text contrast', () => {
  const border = cssVariable('maple-control-border-dark');
  assert.ok(contrast(border, '#223d48') >= 3);
});

test('Monaco primary text and line numbers meet WCAG AA', () => {
  const background = editorColor('editor.background');
  for (const key of ['editor.foreground', 'editorLineNumber.foreground', 'editorLineNumber.activeForeground']) {
    const foreground = editorColor(key);
    assert.ok(contrast(foreground, background) >= 4.5, `${key} is below 4.5:1`);
  }
  assert.ok(contrast(editorColor('editorWhitespace.foreground'), background) >= 3);
});

test('Monaco does not inherit low-contrast HTML token colours', () => {
  assert.match(editorSource, /inherit:\s*false/);
});

test('Monaco HTML text, delimiters and syntax tokens meet WCAG AA', () => {
  const background = editorColor('editor.background');
  for (const token of [
    '',
    'delimiter.html',
    'tag.html',
    'metatag.html',
    'attribute.name.html',
    'attribute.value.html',
    'string.html',
    'comment.html',
    'comment.content.html',
  ]) {
    const foreground = tokenColor(token);
    assert.ok(contrast(foreground, background) >= 4.5, `${token || 'default text'} is below 4.5:1`);
  }
});
