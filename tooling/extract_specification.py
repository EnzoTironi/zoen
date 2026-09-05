#!/usr/bin/env python3
"""Verify and extract the preserved v4 reading copy without third-party packages."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import stat
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent

def main() -> int:
    archive = ROOT / 'specification/zoen-execution-v4.zip'
    metadata = json.loads((ROOT / 'specification/input.json').read_text())
    if hashlib.sha256(archive.read_bytes()).hexdigest() != metadata['sha256']:
        raise ValueError('Preserved v4 ZIP hash differs from recorded input')
    target = ROOT / 'specification/v4'
    if target.exists():
        raise ValueError('Reading copy already exists; inspect it rather than silently overwrite it')
    with zipfile.ZipFile(archive) as zf:
        members = zf.infolist()
        if len(members) > 5000 or sum(item.file_size for item in members) > 128 * 1024**2:
            raise ValueError('Unexpected archive limits')
        seen: set[str] = set()
        for item in members:
            path = PurePosixPath(item.filename)
            if path.is_absolute() or '..' in path.parts or '\\' in item.filename or not path.parts:
                raise ValueError('Unsafe archive path')
            if path.parts[0] != 'zoen-execution-v4' or item.filename in seen:
                raise ValueError('Unexpected root or duplicate archive entry')
            if stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError('Symbolic link inside specification')
            seen.add(item.filename)
        with tempfile.TemporaryDirectory(prefix='zoen-spec-', dir=ROOT/'specification') as temporary:
            for item in members:
                destination = Path(temporary).joinpath(*PurePosixPath(item.filename).parts)
                if item.is_dir():
                    destination.mkdir(parents=True, exist_ok=True)
                else:
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(item) as source, destination.open('xb') as output:
                        shutil.copyfileobj(source, output)
            (Path(temporary)/'zoen-execution-v4').rename(target)
    print('Verified v4 reading copy: specification/v4/START-HERE.md')
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        print(f'FAILED: {error}', file=sys.stderr)
        sys.exit(1)
