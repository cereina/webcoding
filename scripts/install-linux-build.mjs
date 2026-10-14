import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

assert.equal(process.platform, 'linux', 'This installer is for the Linux container only');
assert.equal(process.arch, 'x64', 'Only Linux x64 has been configured');
const original = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const libc = process.report.getReport().header.glibcVersionRuntime ? 'gnu' : 'musl';
const names = ['@esbuild/linux-x64', `@rollup/rollup-linux-x64-${libc}`, '@typescript/typescript-linux-x64'];
const packages = names.map(name => {
  const version = original.packages[`node_modules/${name}`]?.version;
  assert(version, `Missing locked binary: ${name}`);
  return `${name}@${version}`;
});
function npm(args) {
  const result = spawnSync('npm', args, { stdio: 'inherit' });
  assert.equal(result.status, 0, `npm ${args.join(' ')} failed`);
}
npm(['install', '--save-dev', '--save-exact', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', ...packages]);
const updated = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
for (const [key, value] of Object.entries(original.packages)) {
  if (key && updated.packages[key]) assert.equal(updated.packages[key].version, value.version, `Unexpected version change: ${key}`);
}
npm(['ci', '--omit=optional', '--ignore-scripts', '--no-audit', '--no-fund']);
assert(!fs.existsSync('node_modules/@napi-rs/lzma-linux-x64-gnu/package.json'), 'LZMA must not be installed');
for (const name of names) assert(fs.existsSync(`node_modules/${name}/package.json`), `Required binary missing: ${name}`);
console.log(`Linux ${libc} dependency verification passed; LZMA excluded, locked versions retained.`);
