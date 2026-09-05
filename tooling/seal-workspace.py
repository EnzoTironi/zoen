#!/usr/bin/env python3
"""Seal/check delivery files; not product execution or authenticity of third-party evidence."""
from __future__ import annotations
import argparse, hashlib, json, os, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EXCLUDED_ROOT_DIRS=['.git','.core-build','dist','node_modules','artifacts','packets','.work']
EXCLUDED_PREFIXES=['evidence/workspace-v5/']
EXCLUDED_EXACT=['DELIVERY-MANIFEST.json','planning/state.json']

def files(root:Path):
 result={}
 for base,dirs,names in os.walk(root):
  rel=Path(base).relative_to(root)
  dirs[:]=sorted(d for d in dirs if d!='__pycache__' and not (rel==Path('.') and d in EXCLUDED_ROOT_DIRS))
  for d in dirs:
   if (Path(base)/d).is_symlink():raise ValueError('Symlink directory prohibited')
  for name in sorted(names):
   p=Path(base)/name;key=p.relative_to(root).as_posix()
   if key in EXCLUDED_EXACT or any(key.startswith(pre) for pre in EXCLUDED_PREFIXES) or name.endswith('.pyc'):continue
   if p.is_symlink():raise ValueError('Symlink file prohibited')
   result[key]=hashlib.sha256(p.read_bytes()).hexdigest()
 return result

def make(root):return {'version':1,'excluded_root_dirs':EXCLUDED_ROOT_DIRS,'excluded_prefixes':EXCLUDED_PREFIXES,'excluded_exact':EXCLUDED_EXACT,'files':files(root),'scope':'Static delivery integrity only; Git and mutable evidence/acceptance are checked separately.'}
def check(root):
 doc=json.loads((root/'DELIVERY-MANIFEST.json').read_text())
 for k,v in [('excluded_root_dirs',EXCLUDED_ROOT_DIRS),('excluded_prefixes',EXCLUDED_PREFIXES),('excluded_exact',EXCLUDED_EXACT)]:
  if doc.get(k)!=v:raise ValueError('Exclusion policy changed')
 actual=files(root)
 if actual!=doc['files']:
  expected=doc['files'];added=sorted(set(actual)-set(expected));missing=sorted(set(expected)-set(actual));changed=sorted(p for p in actual.keys()&expected.keys() if actual[p]!=expected[p]);raise ValueError(json.dumps({'added':added[:30],'missing':missing[:30],'changed':changed[:30]}))
 return {'status':'passed','static_files':len(actual),'scope':doc['scope']}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');a=ap.parse_args()
 if a.check:print(json.dumps(check(ROOT),indent=2))
 else:
  manifest=make(ROOT);(ROOT/'DELIVERY-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'status':'sealed','static_files':len(manifest['files'])}))
 return 0
if __name__=='__main__':
 try:sys.exit(main())
 except (OSError,ValueError) as e:print('FAILED: '+str(e),file=sys.stderr);sys.exit(1)
