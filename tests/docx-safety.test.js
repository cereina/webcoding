import test from 'node:test';
import assert from 'node:assert/strict';
const { validateDocxArchive, MAX_DOCX_ENTRY_BYTES } = await import('../docx-safety.ts');

function makeArchive(entries) {
  const encoder = new TextEncoder();
  const chunks = entries.map(entry => {
    const name = encoder.encode(entry.name);
    const bytes = new Uint8Array(46 + name.length);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(8, entry.flags ?? 0, true);
    view.setUint16(10, entry.method ?? 8, true);
    view.setUint32(20, entry.compressed ?? 100, true);
    view.setUint32(24, entry.uncompressed ?? 200, true);
    view.setUint16(28, name.length, true);
    bytes.set(name, 46);
    return bytes;
  });
  const directorySize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(directorySize + 22);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  const end = new DataView(output.buffer, directorySize, 22);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, 0, true);
  return output.buffer;
}

const required = [
  { name: '[Content_Types].xml' },
  { name: 'word/document.xml' },
];

test('accepts a bounded DOCX-like archive', () => {
  const result = validateDocxArchive(makeArchive(required));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.stats.entries, 2);
});

test('rejects archives missing required Word parts', () => {
  const result = validateDocxArchive(makeArchive([{ name: 'notes.txt' }]));
  assert.equal(result.ok, false);
  assert.match(result.message, /does not appear to be a valid Word/i);
});

test('rejects encrypted archive entries', () => {
  const result = validateDocxArchive(makeArchive([
    { name: '[Content_Types].xml', flags: 1 },
    { name: 'word/document.xml' },
  ]));
  assert.equal(result.ok, false);
  assert.match(result.message, /Encrypted\/password-protected/i);
});

test('rejects an oversized internal file', () => {
  const result = validateDocxArchive(makeArchive([
    { name: '[Content_Types].xml' },
    { name: 'word/document.xml', compressed: 2 * 1024 * 1024, uncompressed: MAX_DOCX_ENTRY_BYTES + 1 },
  ]));
  assert.equal(result.ok, false);
  assert.match(result.message, /internal file.*too large/i);
});

test('rejects suspicious compression ratios', () => {
  const result = validateDocxArchive(makeArchive([
    { name: '[Content_Types].xml' },
    { name: 'word/document.xml', compressed: 4096, uncompressed: 2 * 1024 * 1024 },
  ]));
  assert.equal(result.ok, false);
  assert.match(result.message, /unsafe compression ratio/i);
});
