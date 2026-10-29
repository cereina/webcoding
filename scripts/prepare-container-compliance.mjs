// Retain exact third-party source inputs alongside the hosted application.
// No downloaded sources or patches are executed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const manifest = JSON.parse(await fs.readFile('licenses/container/sources.json', 'utf8'));
const dockerfile = await fs.readFile('Dockerfile', 'utf8');
const runtimeFrom = dockerfile.trim().split('\n').filter(line => line.startsWith('FROM ')).at(-1);
assert(runtimeFrom.includes('@' + manifest.reviewedRuntimeDigest), 'Runtime image changed: refresh license/source evidence');
const output = path.join(root, 'public', 'compliance');
await fs.mkdir(output, { recursive: true });
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'maple-sources-'));
const sha512 = data => createHash('sha512').update(data).digest('hex');
try {
  const jobs = [];
  for (const origin of manifest.origins) {
    assert(/^[a-zA-Z0-9_.+-]+$/.test(origin.origin));
    const dir = path.join(temp, origin.origin);
    await fs.mkdir(dir);
    await fs.writeFile(path.join(dir, 'APKBUILD'), origin.recipe);
    for (const input of origin.inputs) jobs.push({ input, dir, origin: origin.origin });
  }
  let next = 0;
  let completed = 0;
  async function worker() {
    while (next < jobs.length) {
      const { input, dir, origin } = jobs[next++];
      assert(/^[a-zA-Z0-9_@.+-]+$/.test(input.file) && !['.', '..'].includes(input.file), `Unsafe source filename: ${input.file}`);
      let data;
      // Optional local cache is still checked against the pinned checksum.
      const cache = process.env.MAPLE_SOURCE_CACHE;
      if (cache) data = await fs.readFile(path.join(cache, `${origin}--${input.file}`)).catch(() => null);
      if (!data && input.local) {
        assert(input.local.startsWith('licenses/container/') && !input.local.includes('..'));
        data = await fs.readFile(input.local);
      }
      if (!data) {
        const url = new URL(input.url);
        assert(url.protocol === 'https:' && ['distfiles.alpinelinux.org', 'raw.githubusercontent.com'].includes(url.hostname));
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
            assert(response.ok, `HTTP ${response.status}: ${input.file}`);
            data = Buffer.from(await response.arrayBuffer());
            break;
          } catch (error) {
            if (attempt === 2) throw error;
          }
        }
      }
      assert.equal(data.length, input.size, `Source size mismatch: ${input.file}`);
      assert.equal(sha512(data), input.sha512, `Source checksum mismatch: ${input.file}`);
      await fs.writeFile(path.join(dir, input.file), data);
      if (++completed % 40 === 0) console.log(`Verified ${completed}/${jobs.length} source inputs`);
    }
  }
  // allSettled ensures cleanup cannot race an outstanding download/write.
  const results = await Promise.allSettled(Array.from({ length: 4 }, worker));
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  await fs.writeFile(path.join(temp, 'SOURCE_MANIFEST.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(temp, 'README.txt'),
    'Third-party runtime sources for Maple\n\n' +
    'Includes the exact Alpine source inputs, patches and APKBUILD recipes listed in SOURCE_MANIFEST.json.\n' +
    'Each origin retains its upstream licenses; Maple\'s proprietary license does not apply to these files.\n' +
    'Recipe URLs identify the matching Alpine packaging revisions. Building requires the appropriate Alpine abuild toolchain.\n' +
    'No upstream source changes were made by Maple. Source patches supplied by Alpine are retained.\n');
  const archive = path.join(output, 'runtime-sources.tar.gz');
  const result = spawnSync('tar', ['-czf', archive, '-C', temp, '.'], { stdio: 'inherit' });
  assert.equal(result.status, 0, 'Source archive creation failed');
  const digest = sha512(await fs.readFile(archive));
  await fs.writeFile(path.join(output, 'runtime-sources.sha512'), `${digest}  runtime-sources.tar.gz\n`);
  await fs.writeFile(path.join(output, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
  const notices = await fs.readFile('licenses/container/UPSTREAM_NOTICES.txt', 'utf8');
  const scriptNotices = await fs.readFile('licenses/container/IMAGE_SCRIPT_LICENSES.txt', 'utf8');
  const packagedNotices = await fs.readFile('public/CONTAINER_THIRD_PARTY_NOTICES.txt', 'utf8');
  await fs.writeFile(path.join(output, 'SERVER_NOTICES.txt'),
    'MAPLE SERVER THIRD-PARTY LICENSE MATERIAL\n\n' +
    'This distribution supplies source-tree notices and matching sources, including additional build/test notices.\n' +
    'Their inclusion does not mean every source-tree license applies to every runtime binary.\n' +
    'This software includes FreeType (https://freetype.org). See its FTL and contributor notices below.\n\n' +
    packagedNotices + '\n\n' + scriptNotices + '\n\n' + notices);
  await fs.writeFile(path.join(output, 'index.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maple — Third-party licenses and sources</title>
<main><h1>Third-party licenses and sources</h1>
<p>Maple includes software licensed by its respective authors. These materials preserve those terms.</p>
<ul><li><a href="/THIRD_PARTY_LICENSES.txt">Application library licenses</a></li>
<li><a href="SERVER_NOTICES.txt">Server licenses, copyright notices and acknowledgements</a></li>
<li><a href="runtime-sources.tar.gz">Download matching Alpine source archives, patches and build recipes (${Math.ceil((await fs.stat(archive)).size / 1048576)} MB)</a></li>
<li><a href="runtime-sources.sha512">Source archive SHA512 checksum</a></li>
<li><a href="source-manifest.json">Package and source inventory</a></li>
<li><a href="NODE_BUILD_LICENSES.txt">Node build-tool licenses</a></li></ul>
<p>The sources are third-party server components, not Maple's original application code. Their own licenses apply.</p>
<p>Runtime image reviewed: <code>${manifest.reviewedRuntimeDigest}</code>.</p>
<p><a href="/">Return to Maple</a></p></main></html>`);
  console.log(`Prepared server notices and ${jobs.length} verified source inputs.`);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
