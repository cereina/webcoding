"""Collect declared package licenses for the current Dockerfile's public bases.

Tag resolution describes this run, not an already deployed Railway image.
Use inventory-container.py --digest with Railway build-log digests for that.
"""
import pathlib
import re
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
images = []
for line in (root / 'Dockerfile').read_text().splitlines():
    if re.match(r'^FROM\s', line, re.I):
        match = re.fullmatch(
            r'FROM\s+(node|nginx):([A-Za-z0-9_.-]+)(?:@(sha256:[a-f0-9]{64}))?(?:\s+AS\s+\w+)?',
            line, re.I)
        if not match:
            raise SystemExit('Unsupported FROM; extend inventory coverage explicitly: ' + line)
        images.append(match.groups())
if not images:
    raise SystemExit('No image stages found')
for name, tag, digest in images:
    subprocess.run([sys.executable, str(root / 'scripts/inventory-container.py'),
                    '--repository', 'library/' + name,
                    '--digest' if digest else '--tag', digest or tag,
                    '--output', str(root / 'artifacts/container-licenses' / (name + '.json'))],
                   check=True)
