"""Inventory a digest-pinned Docker Hub Alpine image without running its code.

Uses only Python's standard library. Keeps the final APK database and packaged
license files in JSON, never extracts archive paths onto the host filesystem.
This is package metadata evidence, not a complete SBOM or legal clearance.
"""
import argparse
import hashlib
import io
import json
import pathlib
import re
import tarfile
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository', default='library/nginx')
    reference = parser.add_mutually_exclusive_group(required=True)
    reference.add_argument('--digest', help='Exact deployed image digest (preferred for audits)')
    reference.add_argument('--tag', help='Resolve a tag now; records its digest, not deployment evidence')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    if args.digest and not re.fullmatch(r'sha256:[a-f0-9]{64}', args.digest):
        parser.error('An exact sha256 digest is required')
    if args.tag and not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}', args.tag):
        parser.error('Invalid image tag')
    if not re.fullmatch(r'[a-z0-9._-]+/[a-z0-9._-]+', args.repository):
        parser.error('Expected a Docker Hub namespace/repository')
    token_url = 'https://auth.docker.io/token?service=registry.docker.io&scope=repository:' + args.repository + ':pull'
    with urllib.request.urlopen(token_url, timeout=60) as response:
        token = json.load(response)['token']

    def fetch(kind, digest):
        request = urllib.request.Request(
            'https://registry-1.docker.io/v2/' + args.repository + '/' + kind + '/' + digest,
            headers={'Authorization': 'Bearer ' + token,
                     'Accept': ', '.join(['application/vnd.oci.image.index.v1+json',
                                         'application/vnd.oci.image.manifest.v1+json',
                                         'application/vnd.docker.distribution.manifest.list.v2+json',
                                         'application/vnd.docker.distribution.manifest.v2+json'])})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        if digest.startswith('sha256:') and 'sha256:' + hashlib.sha256(data).hexdigest() != digest:
            raise ValueError('Digest mismatch: ' + digest)
        return data

    manifest_bytes = fetch('manifests', args.digest or args.tag)
    resolved_digest = 'sha256:' + hashlib.sha256(manifest_bytes).hexdigest()
    manifest = json.loads(manifest_bytes)
    platform_digest = resolved_digest
    if 'manifests' in manifest:
        matches = [m for m in manifest['manifests']
                   if m.get('platform', {}).get('os') == 'linux'
                   and m.get('platform', {}).get('architecture') == 'amd64']
        if len(matches) != 1:
            raise ValueError('Expected exactly one Linux amd64 manifest')
        platform_digest = matches[0]['digest']
        manifest = json.loads(fetch('manifests', platform_digest))
    config = json.loads(fetch('blobs', manifest['config']['digest']))
    retained = {}
    for layer in manifest['layers']:
        data = fetch('blobs', layer['digest'])
        print('Verified layer ' + layer['digest'], flush=True)
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:*') as archive:
            # Process whiteouts before additions (OCI layer semantics).
            members = archive.getmembers()
            for member in members:
                name = member.name.removeprefix('./').lstrip('/')
                path = pathlib.PurePosixPath(name)
                if path.name == '.wh..wh..opq':
                    prefix = str(path.parent) + '/'
                    retained = {k: v for k, v in retained.items() if not k.startswith(prefix)}
                elif path.name.startswith('.wh.'):
                    target = str(path.parent / path.name[4:])
                    retained = {k: v for k, v in retained.items()
                                if k != target and not k.startswith(target + '/')}
            for member in members:
                name = member.name.removeprefix('./').lstrip('/')
                if not member.isfile():
                    continue
                if name in ('lib/apk/db/installed', 'etc/alpine-release', 'etc/apk/repositories') or re.search(
                        r'(^|/)(licenses?|copying|copyright|notice)([./_-]|$)', name, re.I):
                    if member.size > 8_000_000:
                        raise ValueError('Unexpectedly large evidence file: ' + name)
                    retained[name] = archive.extractfile(member).read().decode('utf-8', errors='replace')
    database = retained.get('lib/apk/db/installed')
    if not database:
        raise ValueError('No Alpine installed package database found')
    packages = []
    for record in database.strip().split('\n\n'):
        fields = {}
        for line in record.splitlines():
            if len(line) > 1 and line[1] == ':' and line[0] not in fields:
                fields[line[0]] = line[2:]
        packages.append({key: fields.get(code, '') for key, code in
                         [('name', 'P'), ('version', 'V'), ('architecture', 'A'),
                          ('license', 'L'), ('origin', 'o'), ('url', 'U'),
                          ('sourceCommit', 'c')]})
    if any(not p['name'] or not p['license'] for p in packages):
        raise ValueError('Incomplete package metadata')
    report = {'repository': args.repository, 'requestedReference': args.digest or args.tag,
              'resolvedDigest': resolved_digest,
              'platformDigest': platform_digest, 'manifest': manifest,
              'config': config, 'packages': sorted(packages, key=lambda p: p['name']),
              'evidenceFiles': retained,
              'limitations': ['APK metadata is declared licensing, not a source-code audit.',
                              'Unpackaged components and source availability require separate review.']}
    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(str(len(packages)) + ' packages; evidence saved to ' + str(output))


if __name__ == '__main__':
    main()
