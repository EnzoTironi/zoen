#!/usr/bin/env python3
"""Check delivery hashes; --record intentionally records the reviewed tracked tree.

Hashes detect changes relative to this bundle. They are not an independent signature,
code review, runtime qualification or proof against a dishonest artifact author.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'evidence/integrity.json'

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--record', action='store_true')
    args = parser.parse_args()
    if args.record:
        listed = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
        paths = sorted(path for path in listed if path and path != 'evidence/integrity.json')
        manifest = {'schemaVersion': 1, 'scope': 'tracked delivery files except this manifest and Git internals',
                    'files': {name: digest(ROOT/name) for name in paths}}
        MANIFEST.write_text(json.dumps(manifest, indent=2)+'\n')
        print(f'Recorded {len(paths)} delivery file hashes. This is not independent attestation.')
        return 0
    manifest = json.loads(MANIFEST.read_text())
    failures: list[str] = []
    for name, expected in manifest['files'].items():
        relative = PurePosixPath(name)
        if relative.is_absolute() or '..' in relative.parts or '\\' in name:
            failures.append('Unsafe manifest path')
            continue
        file = ROOT.joinpath(*relative.parts)
        if any(parent.is_symlink() for parent in [file, *file.parents] if parent != ROOT.parent):
            failures.append(f'Symbolic link not admitted: {name}')
        elif not file.is_file() or digest(file) != expected:
            failures.append(f'Missing or changed: {name}')
    result = {'status': 'failed' if failures else 'passed', 'checkedFiles': len(manifest['files']),
              'failures': failures, 'productionQualified': False}
    print(json.dumps(result, indent=2))
    return 1 if failures else 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, KeyError, ValueError, subprocess.CalledProcessError) as error:
        print(f'FAILED: {error}', file=sys.stderr)
        sys.exit(1)
