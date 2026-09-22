import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main initializes the Heading Structure editor', async () => {
  const source = await readFile(new URL('../main.ts', import.meta.url), 'utf8');
  assert.match(source, /setupHeadingEditor\(\{\s*getSource:\s*\(\)\s*=>\s*editor\.value,\s*commit\s*\}\);/);
});
