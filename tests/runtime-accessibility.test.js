import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../code-editor.ts', import.meta.url), 'utf8');

test('Monaco IME helper receives an accessible name', () => {
  assert.match(source, /textarea\.ime-text-area/);
  assert.match(source, /aria-label', 'HTML editor input helper'/);
});

test('table preview heading is never left empty at runtime', () => {
  assert.match(source, /getElementById\('table-name'\)/);
  assert.match(source, /tableName\.textContent = 'Table preview'/);
});

test('dynamic image file input receives an accessible name', () => {
  assert.match(source, /input\[type="file"\]\[accept\*="image\/"\]/);
  assert.match(source, /aria-label', 'Choose an image for the figure'/);
});
