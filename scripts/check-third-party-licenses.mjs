import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
const entries = Object.keys(lock.packages ?? {}).filter(key => key.startsWith('node_modules/'));
const problems = [];

const permissiveAlternative = /\b(?:MIT|ISC|BSD(?:-2-Clause|-3-Clause)?|Apache-2\.0|MPL-2\.0|0BSD|CC0-1\.0|Unlicense|W3C|Unicode-3\.0|BlueOak-1\.0\.0)\b/i;
const prohibited = /\b(?:AGPL(?:-[0-9.]+)?|SSPL(?:-[0-9.]+)?|BUSL(?:-[0-9.]+)?|Commons Clause)\b/i;
const copyleft = /\b(?:GPL|LGPL)(?:-[0-9.]+)?(?:-only|-or-later)?\b/i;

for (const packageKey of entries) {
  const packageDir = path.join(root, packageKey);
  let pkg;
  try {
    pkg = JSON.parse(await fs.readFile(path.join(packageDir, 'package.json'), 'utf8'));
  } catch {
    continue;
  }

  const name = pkg.name || packageKey.replace(/^node_modules\//, '');
  const version = pkg.version || lock.packages?.[packageKey]?.version || 'unknown';
  const expression = typeof pkg.license === 'string'
    ? pkg.license
    : Array.isArray(pkg.licenses)
      ? pkg.licenses.map(item => typeof item === 'string' ? item : item?.type).filter(Boolean).join(' OR ')
      : '';

  let hasPackagedNotice = false;
  try {
    const files = await fs.readdir(packageDir);
    hasPackagedNotice = files.some(file => /^(?:licen[cs]e|copying|notice)(?:\..+)?$/i.test(file));
  } catch {
    // The package may be optional for the current platform.
  }

  if (!expression && !hasPackagedNotice) {
    problems.push(`${name}@${version}: no declared license and no packaged license/notice file`);
    continue;
  }
  if (prohibited.test(expression)) {
    problems.push(`${name}@${version}: prohibited/review-required license expression "${expression}"`);
    continue;
  }
  if (copyleft.test(expression) && !permissiveAlternative.test(expression)) {
    problems.push(`${name}@${version}: copyleft-only license expression "${expression}" requires legal review`);
  }
}

if (problems.length) {
  console.error('Third-party license policy check failed:');
  problems.forEach(problem => console.error(` - ${problem}`));
  process.exit(1);
}

console.log(`Third-party license policy check passed for ${entries.length} installed package entries.`);
