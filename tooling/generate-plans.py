#!/usr/bin/env python3
"""Deterministic, non-runtime plans. --check detects drift; does not test Zoen features."""
from __future__ import annotations
import argparse, json, os, posixpath, re, sys
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]

def load(p):return json.loads((ROOT/p).read_text())
def rel_link(source,target,label=None):
 return '['+(label or target)+']('+posixpath.relpath(target,posixpath.dirname(source) or '.')+')'
def table_cell(x):return str(x).replace('|','\\|').replace('\n',' ')
def render_all():
 b=load('planning/catalog.json'); recipes=load('planning/module-recipes.json'); fs=load('planning/files.json')['files']
 specs={s['id']:s for s in b['specs']}; tickets={t['id']:t for t in b['tickets']}; files={r['target']:r for r in fs}
 faults=load('docs/testing/fault-matrix.json'); results={}
 def add(p,t):
  if p in results:raise ValueError('Duplicate generated path '+p)
  results[p]=t.rstrip()+'\n'
 def reference(p,sp):return rel_link(p,'docs/specs/'+sp.lower()+'.md',sp)
 def recipe_ref(p,sp):return rel_link(p,'docs/algorithms/'+sp.lower()+'.md','algorithm '+sp)
 def task_ref(p,tid):return rel_link(p,'docs/tickets/'+tid.lower()+'.md',tid)
 def ticket_code(t, include_recipe=True):
  a=t['acceptance'];sp=t['spec_id']; rows=[f"PROCEDURE {t['id'].replace('-','_')} /* planning label, not a public API */",f"  OWNER := {sp}; TARGET := {t['primary_artifact']}",f"  REQUIRE accepted dependencies: {', '.join(t['depends_on']) or 'none'}",f"  REQUIRE evidence layer: {t['kind']}; actual admitted services when needed",'  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.', '  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.']
  if include_recipe:
   rows+=['  USE the shared module protocol below; implement ONLY this ticket\'s segment, not a duplicate engine.']
   rows+=['    '+x for x in recipes[sp]['steps']]
  rows+=['  TICKET-SPECIFIC SEGMENT:']
  for i,step in enumerate(t['steps'],1):rows.append(f'    {i:02d}. {step.rstrip(".")}.')
  rows+=['  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:', '    GIVEN '+a['given'],'    WHEN '+a['when'],'    THEN '+a['then'],'  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.', '  RETURN only the owning spec\'s tagged result / recorded test evidence for the exact ticket.']
  return '\n'.join(rows)
 def tests_code(t):
  a=t['acceptance']; rows=[f"SUITE {t['id']} [required layer={t['kind']}; currently NOT IMPLEMENTED]",'  REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.','  USE synthetic input records, not synthetic services, fake credentials or canned provider responses.']
  for c in t['checks']:
   rows += ['',f"  TEST {c['id']}:"]
   if c['id'].endswith('-AC'):rows += ['    ARRANGE '+a['given'],'    ACT '+a['when']]
   elif c['id'].endswith('-NEG'):rows += ['    ARRANGE the same ticket component with the stated invalid/denied input.','    ACT only through its real supported boundary; inspect denial and lack of side effects.']
   else:rows += ['    ARRANGE the same component at its named failure/replay/resource boundary.','    ACT with independently controlled real connection/process barriers when I/O is involved.']
   rows += ['    ASSERT '+c['oracle'],'    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.']
  specfaults=[x for x in faults if x['spec_id']==t['spec_id']]
  if specfaults:
   rows += ['','  AVAILABLE SPEC-LOCAL FAULT BOUNDARIES (apply only when owned by this ticket):']
   for f in specfaults:rows += [f"    {f['id']}: barrier={f['barrier']}; inject={f['injection']}; assert={f['oracle']}."]
  rows += ['','  ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.','  CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.','  NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.']
  return '\n'.join(rows)
 # One module algorithm per spec: shared ownership and actual candidate reuse is explicit.
 for s in b['specs']:
  sp=s['id'];p='docs/algorithms/'+sp.lower()+'.md';members=[t for t in b['tickets'] if t['spec_id']==sp]
  rows=[f'# {sp} — implementation algorithm', '', '**Status: pseudocode, not an implemented service or evidence of acceptance.**','',reference(p,sp)+' · '+rel_link(p,'docs/architecture/assembly-contract.md','assembly rules'),'', '## Boundary and ownership','',f"Owner: **{s['owner']}**. Module: `{s['module']}`. Milestone: **{s['slice']}**.",'','## Normative operation signatures','','```text',s['operations'],'```','','## State and transaction contract','',s['storage'],'','## Shared algorithm','','```text']
  rows+=recipes[sp]['steps'];rows+=['```','','## Ticket segments — do not reimplement the whole algorithm per file','','| Ticket | Segment | Primary implementation or plan |','|---|---|---|']
  for t in members:rows.append('| '+task_ref(p,t['id'])+' | '+table_cell(t['title'])+' | '+rel_link(p,files[t['primary_artifact']]['plan_path'],t['primary_artifact'])+' |')
  rows+=['','## Required proof boundaries','',s['protocol'],'','No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.']
  add(p,'\n'.join(rows))
 # Generated specs retain full current catalog contracts without bringing old architecture copies into context.
 for s in b['specs']:
  sp=s['id'];p='docs/specs/'+sp.lower()+'.md'
  rows=[f"# {sp} — {s['title']}",'',f"**Milestone:** {s['slice']} · **Owner:** {s['owner']} · **Root:** `{s['module']}`",'', '**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.','', '## Decision',s['decision'],'','## Owned state and storage contract',s['storage'],'','## Operations','','```text',s['operations'],'```','','## Execution protocol',s['protocol'],'']
  if s.get('extra'):rows += [s['extra'].strip(),'']
  rows+=['## Pseudocode and file ownership','',recipe_ref(p,sp)+'. All typed source plans, test plans and conditional artifacts are mapped in '+rel_link(p,'planning/files.json','the file registry')+'.','', '## Work items','','| Ticket | Scope | Layer | Dependencies |','|---|---|---|---|']
  for tid in s['tickets']:
   t=tickets[tid];rows.append('| '+task_ref(p,tid)+' | '+table_cell(t['title'])+' | '+t['kind']+' | '+(', '.join(task_ref(p,d) for d in t['depends_on']) or 'None')+' |')
  rows += ['', '## Contract precedence and limits','',rel_link(p,'docs/architecture/constitution.md','Constitution')+' → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.', '', '## Historical sources','',rel_link(p,'docs/lineage/source-ledger.md','Archived source locators')+': '+', '.join('`'+x.strip()+'`' for x in s['source'].split(';'))+'. Read a named historical reference only when needed; it cannot override current contracts.']
  add(p,'\n'.join(rows))
 # Fully bounded tickets and all 975 test descriptions.
 for t in b['tickets']:
  tid=t['id'];sp=t['spec_id'];p='docs/tickets/'+tid.lower()+'.md'
  rows=[f"# {tid} — {t['title']}",'',f"**Status:** planned/unaccepted · **Spec:** {reference(p,sp)} · **Milestone:** {t['slice']} · **Layer:** {t['kind']} · **Risk:** {t['risk']}",'','## Read set','']
  rows += ['- '+rel_link(p,x) for x in t['required_read']]
  rows += ['- '+recipe_ref(p,sp), '', '## Prerequisites and stop conditions','', 'Accepted dependencies: '+(', '.join(task_ref(p,d) for d in t['depends_on']) or 'None')+'.',f"External gate: `{t['external_gate'] or 'none on this ticket'}`. Resource locks: "+', '.join('`'+x+'`' for x in t['resource_locks'])+'.','', 'Do not infer acceptance from inherited candidate code. Missing actual services or unresolved schemas block the applicable check. No mock provider, offline success branch or broadened permission is allowed.','', '## Bounded pseudocode','','```text',ticket_code(t,False),'```','','## Exact file map','','| Artifact | Plan / existing file | Role |','|---|---|---|']
  for k,label in [('primary_artifact','Primary'),('test_file','Required tests'),('runbook','Repair runbook')]:
   a=t[k];r=files[a];rows.append('| `'+a+'` | '+rel_link(p,r['plan_path'],r['representation'])+' | '+label+' |')
  rows+=['','## Write allowlist','', 'Conditional support paths are reserved, not a command to create unused schemas/migrations. A `.plan.md` is not the corresponding executable JSON/SQL/config. Promote only required artifacts under this ticket and review.','']
  rows += ['- `'+a+'` — '+rel_link(p,files[a]['plan_path'],'plan') for a in t['allowed_paths']]
  rows += ['', '## Required tests','','```text',tests_code(t),'```','','## Verification and acceptance','','```sh',t['product_test_command'],'```','', 'This target verification command is itself delivered by SPEC-000; it is not silently mapped to the existing 72 core tests. Preserve all three required check IDs. Report exact commit, genuine lock, fixture/version/seed, actual dependency profile, raw observations, no skipped checks, failure reproduction and independent review.','', '## Failure and repair','', 'Preserve committed state. Retain unknown external outcomes; retry only under the owning idempotency contract. Keep new capabilities disabled until qualified. Schema repair is a reviewed forward transition where rollback would lose data. Do not mark this ticket accepted until the existing evidence validator verifies its evidence and prerequisites.']
  add(p,'\n'.join(rows))
 # Co-located plans for every explicit artifact and inherited source file.
 for f in fs:
  target=f['target'];p=f['plan_path'];ss=[specs[x] for x in f['specs']];ts=[tickets[x] for x in f['tickets']]
  title=f'# File plan — `{target}`'
  rows=[title,'','**Status:** '+f['status']+'; no product acceptance implied.','', 'Target: `'+target+'`. Representation: **'+f['representation']+'**. Allocation: **'+f['allocation']+'**.','', 'Specs: '+', '.join(reference(p,x) for x in f['specs'])+'.','Tickets: '+(', '.join(task_ref(p,x) for x in f['tickets']) or 'Existing candidate support; ticket ownership is in the spec, not implied acceptance.')+'.','', '## Responsibility and reuse','']
  if f['representation']=='existing-with-sidecar':rows+=['The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket\'s required layer. Do not replace it with this plan or create a duplicate primitive.','']
  if f['test_for']:
   for tid in f['test_for']:rows+=['```text',tests_code(tickets[tid]),'```','']
  elif f['primary_for']:
   for tid in f['primary_for']:rows+=['```text',ticket_code(tickets[tid]),'```','']
  elif f['runbook_for']:
   for tid in f['runbook_for']:
    t=tickets[tid];rows += [f"## {tid} operational/repair procedure",'',f"Scope: {t['title']}. This is a plan; deployments and commands not yet qualified remain blocked.",'','```text','PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.','STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.','OBSERVE actual durable state and raw error at this ticket boundary:',t['acceptance']['when'], 'PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.', 'REPAIR under the owning module protocol:',*recipes[t['spec_id']]['steps'],'VERIFY the original oracle plus negative and boundary cases on real admitted components:',t['acceptance']['then'],'RESUME only with current approval and intact unrelated tenant scopes.','```','']
  else:
   base=Path(target).name
   if target.endswith('.sql'):
    rows += ['```text','CONDITIONAL MIGRATION PLAN — never feed this Markdown to a migrator.','IF no durable invariant is introduced by the owning ticket: do not create a no-op SQL migration.','OTHERWISE acquire the global schema lock; inspect existing catalog and table owner before adding DDL.','DECLARE explicit types, primary/unique keys, World+realm composite foreign references and indexes.','SEPARATE migrator DDL from runtime roles; parameterize values and retain source/rights/retention lineage.','ORDER expand → backfill → validate → contract, with restartable bounded backfill.','TEST empty database, prior-schema upgrade, role denials, crash boundary and forward repair using real PostgreSQL.','ASSIGN final monotonic migration number only when the genuine SQL is reviewed; never pre-record a planned migration as applied.','```','']
   elif target.endswith('.schema.json'):
    rows += ['```text','CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.','RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.','REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.','REJECT additional or authority-bearing client fields; money/counters stay strings where required.','GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.','TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.','```','']
   elif '/fixtures/' in target:
    rows += ['```text','CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.','USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.','INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.','COMPUTE fixed expected values from the owning oracle, not from the implementation under test.','LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.','VERSION seed, units, rights and cleanup scope.','```','']
   elif target.startswith('admissions/') or target in ['execution-lock.json','pnpm-lock.yaml']:
    rows += ['```text','EVIDENCE-REQUIRES-EXECUTION — deliberately no fabricated target artifact.','RUN the actual registry/package-manager/provider/infrastructure qualification for this ticket.','RECORD observed identities, exact versions/integrity, supported API/profile, commands and failed or blocked results.','REQUIRE independent approval and current expiry/scope where applicable.','ONLY produce a lock using the real package manager; only produce a certificate from actual evidence.','NEVER rename this plan into a passing report.','```','']
   elif target.startswith('packs/'):
    rows += ['```text','DATA-ONLY PACK PLAN.','DECLARE stable semantic IDs, typed objects/links, meanings, units, rules, views/actions and dependency closure.','COMPOSE existing kernel operators; no per-customer TypeScript or source credentials in reusable pack data.','COMPILE/evaluate/publish through normal definition governance.','KEEP instance secrets/cursors/private records out of reusable artifacts; rights requests are not grants.','```','']
   elif target.startswith('infra/') or target.startswith('.github/') or 'Dockerfile' in target or Path(target).suffix in ['.yaml','.yml','.cjs','.mjs'] or target.count('/')==0:
    rows += ['```text','EXECUTION CONFIGURATION PLAN — not an active deployment/CI configuration.','WAIT for the actual dependency/profile admission; use genuine immutable images/actions/packages and secret references.','WIRE only already-declared processes/ports and least-privilege identities.','KEEP real provider routes disabled until qualified; no placeholder jobs returning success.','TEST plan validation and actual admitted deployment separately; no invented hashes/account IDs/certificates.','```','']
   elif '/registrations/' in target or base in ['index.ts','composition.ts','main.ts']:
    rows += ['```text','COMPOSITION/REGISTRATION PLAN.','IMPORT only reviewed implemented ports and adapters under the existing dependency direction.','BIND the existing semantic executor once; register this module\'s released operation descriptors.', 'DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.','GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.','KEEP shared composition edits under the named exclusive lock.','```','']
   elif base in ['ports.ts','types.ts']:
    rows += ['```text','CONTRACT SURFACE PLAN.','DEFINE only the owning module\'s input/output/error/state and dependency-port types.','REUSE branded kernel values, verified context, common semantic envelope and typed results.','DO NOT export repositories or broad credentials to clients; authority context is server verified.','SEPARATE versioned semantic meaning from transport metadata and immutable artifacts from mutable runtime state.','VERIFY consumers use the same contracts and exhaustive tagged outcomes; unsupported shapes fail closed.','```','']
   else:
    rows += ['```text','CONDITIONAL SUPPORT SEGMENT.','FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.','READ the current implementation and shared module algorithm; select only the missing support responsibility.','KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.','WIRE into the owning ticket\'s declared entry and prove its exact tests.','```','']
  if not f['primary_for'] and not f['test_for']:
   rows+=['## Owning state / operation contracts','']
   for s in ss:rows += [f"### {s['id']}",s['operations'],'',s['storage'],'',recipe_ref(p,s['id']), '']
  rows += ['## Acceptance boundary','', 'A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.','']
  text='\n'.join(rows)
  if f['representation']=='comment-only-source':
   comment='#' if Path(target).suffix in ['.py','.R'] else '//'
   # Keep placeholders entirely comments, with machine-verifiable marker and no runtime stubs.
   text=comment+' @zoen-plan '+target+'\n'+comment+' NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.\n'+'\n'.join(comment+(' '+line if line else '') for line in text.splitlines())
  add(p,text)
 # Indexes and module README files.
 for category,items,key in [('specs',b['specs'],'id'),('tickets',b['tickets'],'id')]:
  p=f'docs/{category}/README.md';rows=[f'# {category.title()} index','', 'Generated from `planning/catalog.json`; stable IDs retained. No accepted product tickets.','', '| ID | Milestone | Title |','|---|---|---|']
  for x in items:rows.append('| '+rel_link(p,f"docs/{category}/{x['id'].lower()}.md",x['id'])+' | '+x['slice']+' | '+table_cell(x['title'])+' |')
  add(p,'\n'.join(rows))
 p='docs/algorithms/README.md';add(p,'# Module algorithms\n\nNon-executable module protocols. Follow the linked ticket segment, not the whole module at once.\n\n'+'\n'.join('- '+recipe_ref(p,s['id'])+' — '+s['title'] for s in b['specs']))
 p='docs/FILE-MAP.md';rows=['# Full planned file map','', 'All explicit active-v4 write paths plus inherited candidate files. **Conditional support is not mandatory dead code.** JSON/config/SQL/evidence artifacts are sidecar plans until safely created from real implementation or execution.','', '| Intended path | Existing / plan | State | Specs |','|---|---|---|---|']
 for f in fs:rows.append('| `'+f['target']+'` | '+rel_link(p,f['plan_path'],f['representation'])+' | '+f['status']+' | '+', '.join(f['specs'])+' |')
 add(p,'\n'.join(rows))
 roots=sorted({s['module'] for s in b['specs']})
 for root in roots:
  p=root+'/README.md'
  if p in results:continue
  ss=[s for s in b['specs'] if s['module']==root]
  rows=['# '+root,'', '**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.','', '## Owned contracts','']
  for s in ss:rows+=['- '+reference(p,s['id'])+' — '+s['title']+'; '+recipe_ref(p,s['id'])]
  rows+=['','## Local file map','', '| Target | Role | Plan |','|---|---|---|']
  for f in fs:
   if f['target'].startswith(root+'/') and Path(f['target']).parent.as_posix()==root:rows.append('| `'+Path(f['target']).name+'` | '+f['allocation']+' | '+rel_link(p,f['plan_path'],'read')+' |')
  rows+=['','Shared invariants and dependencies: '+rel_link(p,'docs/architecture/repository-contract.md','repository contract')+'. Do not add another data/authorization path.']
  add(p,'\n'.join(rows))
 # One check registry records the actual target test source and the plan; not duplicated test passes.
 checks=[]
 for t in b['tickets']:
  for c in t['checks']:checks.append({**c,'ticket_id':t['id'],'spec_id':t['spec_id'],'test_file':t['test_file'],'plan_path':files[t['test_file']]['plan_path'],'status':'not-executed'})
 add('planning/check-map.json',json.dumps(checks,indent=2,ensure_ascii=False))
 ui={'specs':[{'id':s['id'],'title':s['title']} for s in b['specs']],'tickets':[],'files':[]}
 for t in b['tickets']:
  ui['tickets'].append({'title':t['title'],'subtitle':t['id']+' · '+t['slice']+' · '+t['kind'],'search':' '.join([t['id'],t['title'],t['spec_id'],t['primary_artifact']]),'specs':[t['spec_id']],'stages':[t['slice']],'note':t['acceptance']['then'],'links':[{'label':'Ticket','path':'docs/tickets/'+t['id'].lower()+'.md'},{'label':'Spec','path':'docs/specs/'+t['spec_id'].lower()+'.md'},{'label':'Plano principal','path':files[t['primary_artifact']]['plan_path']}]})
 for f in fs:
  ui['files'].append({'title':f['target'],'subtitle':f['representation']+' · '+f['allocation'],'search':' '.join([f['target'],*f['specs'],*f['tickets']]),'specs':f['specs'],'stages':sorted({tickets[t]['slice'] for t in f['tickets']}),'note':'Status: '+f['status']+'. '+', '.join(f['specs'])+'; '+', '.join(f['tickets']),'links':[{'label':'Ler plano','path':f['plan_path']}]+([{'label':'Arquivo existente','path':f['target']}] if f['representation']=='existing-with-sidecar' else [])})
 template=(ROOT/'tooling/templates/backlog.html').read_text()
 add('backlog.html',template.replace('__DATA__',json.dumps(ui,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')))
 stats={'specs':len(b['specs']),'tickets':len(tickets),'required_product_checks':len(checks),'capabilities':len(load('planning/capability-coverage.json')),'planned_file_records':len(fs),'representations':dict(Counter(f['representation'] for f in fs)),'allocations':dict(Counter(f['allocation'] for f in fs)),'generated_outputs':len(results)+1,'module_algorithms':len(recipes),'product_accepted_tickets':0,'runtime_mocks_added':0}
 add('planning/statistics.json',json.dumps(stats,indent=2))
 return results

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args();expected=render_all();changed=[]
 manifest=load('planning/files.json')['files']
 for record in manifest:
  if record['representation']!='comment-only-source': continue
  target=ROOT/record['plan_path']
  if target.exists():
   prefix='#' if target.suffix in {'.py','.R'} else '//'
   current=target.read_text()
   if not current.startswith(prefix+' @zoen-plan') or any(line.strip() and not line.lstrip().startswith(prefix) for line in current.splitlines()):
    print('BLOCKED: refusing to overwrite implementation; promote the registry entry to existing-with-sidecar: '+record['target'],file=sys.stderr)
    return 2
 for name,text in expected.items():
  target=ROOT/name
  if not target.exists() or target.read_text(encoding='utf8')!=text:
   changed.append(name)
   if not args.check:target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text,encoding='utf8')
 if args.check and changed:print(json.dumps({'status':'failed','drift':changed[:50],'count':len(changed)},indent=2));return 1
 print(json.dumps({'status':'passed','generated_outputs':len(expected),'changed':len(changed),'scope':'documentation and non-executable plans; not product tests'},indent=2));return 0
if __name__=='__main__':sys.exit(main())
