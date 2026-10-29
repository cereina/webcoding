// Container-only installer for this repository's audited lockfile.
// No resolution, lifecycle scripts, npm, Corepack or Yarn are used.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const requiredNative = new Set([
  '@esbuild/linux-x64', '@rollup/rollup-linux-x64-musl', '@typescript/typescript-linux-x64',
]);
const packagePath = /^(?:node_modules\/(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+\/)*node_modules\/(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i;
export function selectPackages(lock) {
  assert.equal(lock.lockfileVersion, 3, 'Expected package-lock v3');
  const selected = Object.entries(lock.packages).filter(([key, pkg]) => {
    if (!key) return false;
    assert(packagePath.test(key), `Unsupported package path: ${key}`);
    const name = key.split('node_modules/').at(-1);
    return (!pkg.optional || requiredNative.has(name))
      && (!pkg.os || pkg.os.includes('linux'))
      && (!pkg.cpu || pkg.cpu.includes('x64'))
      && (!pkg.libc || pkg.libc.includes('musl'));
  });
  for (const name of requiredNative) {
    assert(selected.some(([key]) => key === `node_modules/${name}`), `Missing native package: ${name}`);
  }
  for (const [key, pkg] of selected) {
    assert(!pkg.link, `Links unsupported: ${key}`);
    const url = new URL(pkg.resolved);
    assert(url.protocol === 'https:' && url.hostname === 'registry.npmjs.org'
      && !url.username && !url.password, `Unapproved registry: ${key}`);
    assert(/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(pkg.integrity), `Missing SHA512: ${key}`);
  }
  return selected.sort(([a], [b]) => a.split('/').length - b.split('/').length || a.localeCompare(b));
}
export function verifyIntegrity(data, integrity) {
  assert.equal(`sha512-${createHash('sha512').update(data).digest('base64')}`, integrity, 'Package checksum mismatch');
}
export function validateArchive(names, details) {
  const entries = names.trim().split('\n');
  assert(entries.length && entries[0], 'Empty archive');
  const root = entries[0].split('/')[0];
  assert(/^[a-zA-Z0-9_.-]+$/.test(root) && root !== '.' && root !== '..', 'Invalid archive root');
  for (const name of entries) {
    assert(name === root || name.startsWith(root + '/'), 'Unexpected archive root');
    assert(!name.includes('\\') && !name.includes('\r') && !name.split('/').includes('..'), 'Unsafe archive path');
    assert(!name.split('/').includes('node_modules'), 'Unreviewed bundled dependencies');
  }
  for (const line of details.trim().split('\n')) {
    assert(line.startsWith('-') || line.startsWith('d'), 'Archive links/special files are unsupported');
  }
}
function tar(args) {
  const result = spawnSync('tar', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || 'tar failed');
  return result.stdout;
}
async function install() {
  assert.equal(process.platform, 'linux', 'Container-only installer');
  assert.equal(process.arch, 'x64');
  assert(!process.report.getReport().header.glibcVersionRuntime, 'Expected musl');
  const root = process.cwd();
  const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'));
  const selected = selectPackages(lock);
  assert(!(await fs.stat('node_modules').catch(() => null)), 'Install requires a clean node_modules directory');
  const cache = await fs.mkdtemp('/tmp/maple-locked-');
  const bins = new Map();
  try {
    for (let i = 0; i < selected.length; i++) {
      const [key, pkg] = selected[i];
      const response = await fetch(pkg.resolved, { signal: AbortSignal.timeout(120000) });
      assert(response.ok, `Download failed: ${key}: ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      verifyIntegrity(data, pkg.integrity);
      const archive = path.join(cache, `${i}.tgz`);
      await fs.writeFile(archive, data);
      validateArchive(tar(['-tzf', archive]), tar(['-tvzf', archive]));
      const destination = path.join(root, key);
      await fs.mkdir(destination, { recursive: true });
      tar(['-xzf', archive, '-C', destination, '--strip-components=1', '--no-same-owner']);
      const manifest = JSON.parse(await fs.readFile(path.join(destination, 'package.json'), 'utf8'));
      assert.equal(manifest.version, pkg.version, `Version mismatch: ${key}`);
      assert.equal(manifest.name, key.split('node_modules/').at(-1), `Name mismatch: ${key}`);
      const bin = typeof manifest.bin === 'string'
        ? { [manifest.name.split('/').at(-1)]: manifest.bin } : manifest.bin || {};
      for (const [name, target] of Object.entries(bin)) {
        assert(/^[a-zA-Z0-9_.-]+$/.test(name));
        const absolute = path.resolve(destination, target);
        assert(absolute.startsWith(destination + path.sep), `Unsafe bin: ${key}`);
        await fs.access(absolute);
        const binDir = path.join(path.dirname(destination), '.bin');
        // Scoped packages' bin links belong in the enclosing node_modules/.bin.
        const actualBinDir = manifest.name.startsWith('@') ? path.join(path.dirname(path.dirname(destination)), '.bin') : binDir;
        const binPath = path.join(actualBinDir, name);
        assert(!bins.has(binPath), `Ambiguous binary: ${binPath}`);
        bins.set(binPath, absolute);
      }
    }
    for (const [bin, target] of bins) {
      await fs.mkdir(path.dirname(bin), { recursive: true });
      await fs.chmod(target, 0o755);
      await fs.symlink(path.relative(path.dirname(bin), target), bin);
    }
    console.log(`Installed ${selected.length} exact SHA512-verified packages; no lifecycle scripts or package-manager toolchain.`);
  } finally {
    await fs.rm(cache, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await install();
