#!/usr/bin/env python3
"""Package reviewed, committed workspace bytes plus a usable Git repository."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile
ROOT = Path(__file__).resolve().parents[1]

def git(*args: str) -> str:
    return subprocess.check_output(['git',*args],cwd=ROOT,text=True)

def main() -> int:
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True,type=Path);args=ap.parse_args()
    out=args.out.resolve()
    if out.is_relative_to(ROOT) or out.suffix!='.zip':
        raise ValueError('Choose a .zip destination outside the repository.')
    if not (ROOT/'.git').is_dir():raise ValueError('A self-contained .git directory is required, not an external worktree reference.')
    if git('status','--porcelain').strip():raise ValueError('Commit reviewed changes before packaging.')
    subprocess.run([sys.executable,str(ROOT/'tooling/seal-workspace.py'),'--check'],cwd=ROOT,check=True,stdout=subprocess.PIPE)
    tracked={p for p in git('ls-files','-z').split('\0') if p}
    manifest=json.loads((ROOT/'DELIVERY-MANIFEST.json').read_text())
    required=set(manifest['files'])|{'DELIVERY-MANIFEST.json','planning/state.json'}
    if required-tracked:raise ValueError('Sealed files missing from Git: '+str(sorted(required-tracked)))
    if not (ROOT/'.git/refs').is_dir():raise ValueError('Git refs directory is missing.')
    members={ROOT/p for p in tracked}|{ROOT/'.git'}|set((ROOT/'.git').rglob('*'))
    for p in members:
        if p.is_symlink() or not (p.is_file() or p.is_dir()):raise ValueError('Nonregular archive member: '+str(p))
        if p.name.endswith('.lock') and '.git' in p.parts:raise ValueError('Git operation in progress; lock file present.')
    out.parent.mkdir(parents=True,exist_ok=True)
    fd,temporary=tempfile.mkstemp(prefix=out.name+'.',suffix='.tmp',dir=out.parent);os.close(fd)
    try:
        with zipfile.ZipFile(temporary,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,strict_timestamps=False) as z:
            for p in sorted(members):z.write(p,ROOT.name+'/'+p.relative_to(ROOT).as_posix())
        with zipfile.ZipFile(temporary) as z:
            if z.testzip() is not None:raise ValueError('Archive CRC check failed.')
            if ROOT.name+'/.git/refs/' not in z.namelist():raise ValueError('Required empty Git directory omitted.')
        os.replace(temporary,out)
    finally:
        if os.path.exists(temporary):os.unlink(temporary)
    print(json.dumps({'status':'packaged','path':str(out),'bytes':out.stat().st_size,
                      'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'tracked_files':len(tracked),
                      'git_commit':git('rev-parse','HEAD').strip(),
                      'scope':'Committed bytes and Git metadata; clean-extraction tests are separate.'},indent=2))
    return 0
if __name__=='__main__':
    try:sys.exit(main())
    except (OSError,ValueError,subprocess.CalledProcessError) as e:
        print('FAILED: '+str(e),file=sys.stderr);sys.exit(1)
