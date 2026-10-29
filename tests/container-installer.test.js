import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectPackages, verifyIntegrity, validateArchive } from '../scripts/install-locked-container.mjs';

test('container selection retains exact reviewed packages and native musl binaries', () => {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const entries = selectPackages(lock);
  assert.equal(entries.length, 87);
  assert(!entries.some(([key]) => /lzma|win32|darwin|linux-x64-gnu/.test(key)));
  assert(entries.some(([key]) => key === 'node_modules/@rollup/rollup-linux-x64-musl'));
  for (const [key, pkg] of entries) assert.equal(pkg.version, lock.packages[key].version);
});
test('installer rejects changed tarball content', () => {
  assert.throws(() => verifyIntegrity(Buffer.from('tampered'), 'sha512-invalid'), /checksum/);
});
test('installer rejects traversal, links and bundled unlocked modules', () => {
  assert.throws(() => validateArchive('package/../../escape', '-rw-r--r-- entry'), /Unsafe/);
  assert.throws(() => validateArchive('package/link', 'lrwxrwxrwx link'), /links/);
  assert.throws(() => validateArchive('package/node_modules/surprise/index.js', '-rw-r--r-- entry'), /bundled/);
  validateArchive('package/package.json\npackage/lib/index.js\n', '-rw-r--r-- entry\n-rw-r--r-- entry');
  validateArchive('node v22.20/package.json\nnode v22.20/index.d.ts\n', '-rw-r--r-- entry\n-rw-r--r-- entry');
});
