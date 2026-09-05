"""Structural execution controls. They cannot establish truth of external evidence."""
from __future__ import annotations
import hashlib,json,re
from datetime import date
from pathlib import Path,PurePosixPath
from graphlib import TopologicalSorter,CycleError
from typing import Any

class PlanError(ValueError):pass

def read_json(path:Path)->Any:
 try:return json.loads(path.read_text(encoding='utf8'))
 except (OSError,json.JSONDecodeError) as e:raise PlanError(f'Cannot read {path}: {e}') from e

def safe_path(value:str)->bool:
 p=PurePosixPath(value)
 return bool(value) and not p.is_absolute() and '\\' not in value and '..' not in p.parts and not value.startswith('~') and not re.match(r'^[A-Za-z]:',value)

def contained_file(root:Path,value:str)->Path:
 if not safe_path(value):raise PlanError(f'Unsafe artifact path: {value}')
 p=root/value
 if p.is_symlink() or any(a.is_symlink() for a in p.parents if a!=root.parent):raise PlanError(f'Symlink artifact not accepted: {value}')
 try:p.resolve().relative_to(root.resolve())
 except ValueError as e:raise PlanError(f'Artifact escapes evidence root: {value}') from e
 if not p.is_file():raise PlanError(f'Missing artifact: {value}')
 return p

def validate_catalog(backlog:dict)->None:
 tickets=backlog.get('tickets',[])
 if not tickets:raise PlanError('Empty ticket catalog')
 ids=[t['id'] for t in tickets]
 if len(set(ids))!=len(ids):raise PlanError('Duplicate ticket ID')
 specs={s['id'] for s in backlog['specs']};gates=set(backlog['gates'])
 for t in tickets:
  if t['spec_id'] not in specs:raise PlanError(f"Unknown spec in {t['id']}")
  if not t.get('steps') or not all(t.get('acceptance',{}).get(k) for k in ('given','when','then')):raise PlanError(f"Empty procedure/oracle: {t['id']}")
  for d in t['depends_on']:
   if d not in ids:raise PlanError(f"Unknown dependency {d}")
  if t.get('external_gate') and t['external_gate'] not in gates:raise PlanError('Unknown gate')
  if not t['checks'] or len({c['id'] for c in t['checks']})!=len(t['checks']):raise PlanError('Missing/duplicate checks')
  if not t['allowed_paths'] or not all(safe_path(x) for x in t['allowed_paths']):raise PlanError('Unsafe write allowlist')
  if t['primary_artifact'] not in t['allowed_paths'] or t['test_file'] not in t['allowed_paths']:raise PlanError('Required output outside allowlist')
 try:list(TopologicalSorter({t['id']:set(t['depends_on']) for t in tickets}).static_order())
 except CycleError as e:raise PlanError('Cyclic ticket dependencies') from e

def validate_coverage(backlog:dict,coverage:list)->None:
 caps={c['id'] for c in coverage}
 if caps!={f'C{i:03d}' for i in range(1,158)}:raise PlanError('Capability inventory must retain C001-C157')
 idx={t['id']:t for t in backlog['tickets']}
 for c in coverage:
  expected=[t for t in backlog['tickets'] if c['id'] in t['capabilities']]
  if not expected:raise PlanError(f"Uncovered capability {c['id']}")
  if set(c['ticket_ids'])!={t['id'] for t in expected}:raise PlanError(f"Wrong capability trace {c['id']}")
  checks={k['id'] for t in expected for k in t['checks']}
  if set(c['check_ids'])!=checks:raise PlanError(f"Wrong check trace {c['id']}")
 for t in idx.values():
  if not set(t['capabilities'])<=caps:raise PlanError('Unknown capability on ticket')

def gate_approved(gate:dict,today:date|None=None)->bool:
 today=today or date.today()
 if gate.get('status')!='approved':return False
 if not all(gate.get(x) for x in ('owner','scope','evidence_refs','valid_until')):return False
 try:return date.fromisoformat(gate['valid_until'])>=today
 except (ValueError,TypeError):return False

def validate_evidence(ticket:dict,evidence:dict,root:Path,gates:dict,*,today:date|None=None,check_current_gate:bool=True)->None:
 if evidence.get('ticket_id')!=ticket['id']:raise PlanError('Evidence ticket mismatch')
 commit=evidence.get('source_commit','');lock=evidence.get('lock_digest','')
 if not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})',commit):raise PlanError('Missing/invalid source commit')
 if not re.fullmatch(r'[0-9a-f]{64}',lock):raise PlanError('Missing/invalid lock digest')
 if not evidence.get('profile') or evidence.get('outcome')!='passed':raise PlanError('Missing profile or passing outcome')
 review=evidence.get('review',{})
 if not evidence.get('author') or not review.get('reviewer') or review.get('reviewer')==evidence['author']:raise PlanError('Independent reviewer required')
 if review.get('decision')!='approved' or review.get('source_commit')!=commit or review.get('lock_digest')!=lock:raise PlanError('Review is stale or not approved')
 observed=evidence.get('checks',[])
 if len({c.get('id') for c in observed})!=len(observed):raise PlanError('Duplicate check evidence')
 actual={c['id']:c for c in observed};required={c['id']:c for c in ticket['checks']}
 if set(actual)!=set(required):raise PlanError('Missing or extra required check IDs')
 for cid,expected in required.items():
  c=actual[cid]
  if c.get('status')!='passed' or c.get('executed_count',0)<=0 or c.get('skipped_count',0)!=0:raise PlanError(f'Empty, skipped or failed check: {cid}')
  if c.get('layer')!=expected['layer']:raise PlanError(f'Wrong evidence layer: {cid}')
  if c.get('source_commit')!=commit or c.get('lock_digest')!=lock:raise PlanError(f'Mixed-commit/lock check: {cid}')
  p=contained_file(root,c.get('artifact',''))
  if hashlib.sha256(p.read_bytes()).hexdigest()!=c.get('sha256'):raise PlanError(f'Tampered artifact: {cid}')
 if check_current_gate and ticket.get('external_gate'):
  g=gates.get(ticket['external_gate'],{})
  if not gate_approved(g,today):raise PlanError('External gate is not currently approved for admission')
  if evidence.get('gate_scope')!=g.get('scope'):raise PlanError('Gate scope mismatch')
  if ticket['external_gate']=='G-FINAL' and any(not gate_approved(v,today) for v in gates.values()):raise PlanError('Final admission requires all intended gates currently approved')

def validate_state(backlog:dict,state:dict,root:Path,*,today:date|None=None)->None:
 idx={t['id']:t for t in backlog['tickets']};entries=state.get('tickets',{})
 for tid,entry in entries.items():
  if tid not in idx:raise PlanError(f'Unknown ticket in state: {tid}')
  if entry.get('status') not in ('planned','in-progress','blocked','accepted'):raise PlanError(f'Invalid state: {tid}')
  if entry.get('status')=='accepted':
   validate_evidence(idx[tid],entry.get('evidence',{}),root,state.get('gates',{}),today=today,check_current_gate=False)
   for d in idx[tid]['depends_on']:
    if entries.get(d,{}).get('status')!='accepted':raise PlanError(f'Accepted ticket has unmet prerequisite: {tid} -> {d}')

def check_scope(ticket:dict,changed:list[str])->None:
 if not changed:raise PlanError('No changed files supplied')
 for p in changed:
  if not safe_path(p) or p not in ticket['allowed_paths']:raise PlanError(f'Out-of-scope change: {p}')

def conflict(a:dict,b:dict)->bool:
 return bool(set(a['resource_locks'])&set(b['resource_locks']) or set(a['allowed_paths'])&set(b['allowed_paths']))

def ready(backlog:dict,state:dict,limit:int=5,include_admission:bool=False)->list[dict]:
 if limit<1:raise PlanError('limit must be positive')
 entries=state.get('tickets',{});done={x for x,e in entries.items() if e.get('status')=='accepted'}
 active=[t for t in backlog['tickets'] if entries.get(t['id'],{}).get('status')=='in-progress']
 chosen=[]
 for t in sorted(backlog['tickets'],key=lambda x:(int(x['slice'][1:]),x['id'])):
  status=entries.get(t['id'],{}).get('status','planned')
  if status not in ('planned','blocked') or not set(t['depends_on'])<=done:continue
  if status=='blocked':continue # explicit owner disposition, not silent automatic reopening
  if t.get('external_gate'):
   gs=state.get('gates',{}).get(t['external_gate'],{}).get('status')
   if not include_admission or gs not in ('resources-available','approved'):continue
  if any(conflict(t,other) for other in chosen+active):continue
  chosen.append(t)
  if len(chosen)>=limit:break
 return chosen

def packet(root:Path,backlog:dict,state:dict,tid:str)->str:
 idx={t['id']:t for t in backlog['tickets']}
 if tid not in idx:raise PlanError('Unknown ticket')
 t=idx[tid]
 sections=[f'# Context packet: {tid}\n\nThis packet authorizes no deployment or external write. Execute one ticket only.\n']
 paths=['docs/prompts/implement-one-ticket.md',f'docs/tickets/{tid.lower()}.md']+t['required_read']
 for p in dict.fromkeys(paths):
  source=contained_file(root,p)
  sections.append(f'\n---\n\n## Included source: {p}\n\n'+source.read_text(encoding='utf8'))
 deps=[]
 for dep in t['depends_on']:
  d=idx[dep];e=state.get('tickets',{}).get(dep,{})
  deps.append(f"- {dep}: {d['title']} — state {e.get('status','planned')}; required result: {d['acceptance']['then']}")
 sections.append('\n## Dependency outcomes\n\n'+('\n'.join(deps) or 'No ticket prerequisites.'))
 text='\n'.join(sections)
 if len(text.encode('utf8'))>160_000:raise PlanError('Context packet exceeds 160 KB; split/review the ticket rather than drop constraints')
 return text+'\n'
