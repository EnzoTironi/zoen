import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256 } from './files.mjs';
// Deliberate defects in isolated copies of the actual compiled artifact. No service
// simulation, runtime fallback, monkey-patched provider, or replacement database.
const mutants=[
 ['duplicate-json','packages/kernel/src/json.js',"if (Object.hasOwn(out, key))","if (false)",'tests/laws/kernel.test.mjs'],
 ['ignore-head','packages/ontology/src/authority/guards.js','if (canonicalJson({ ...expected.head }) !== canonicalJson({ ...actualHead }))','if (false)','tests/laws/protocol.test.mjs'],
 ['ignore-absence','packages/ontology/src/authority/guards.js','if (!Object.hasOwn(actualCut, domain) || actualCut[domain] !== version)','if (false)','tests/laws/protocol.test.mjs'],
 ['collapse-conflicts','packages/ontology/src/interpretation/reconcile.js','const contested = byValue.size > 1;','const contested = false;','tests/laws/interpretation.test.mjs'],
 ['inclusive-expiry','packages/kernel/src/time.js','compareTime(at, window.until) < 0','compareTime(at, window.until) <= 0','tests/laws/kernel.test.mjs'],
 ['credential-forward','packages/adapters/src/http-security.js',"['content-type', 'accept', 'accept-language']","['content-type', 'accept', 'accept-language', 'cookie']",'tests/security/boundaries.test.mjs'],
 ['remove-recipient','packages/ontology/src/apps/session-constraints.js',"(link.recipientId !== null && link.recipientId !== principalId)",'false','tests/security/boundaries.test.mjs'],
 ['permit-app-write','packages/ontology/src/apps/manifest.js',"descriptor.kind === 'read'","true",'tests/laws/definitions.test.mjs'],
 ['permit-code-export','packages/ontology/src/apps/session-constraints.js','if (!profile.isolatedHostAdmitted || (profile.classifiedData && !profile.disclosureApproved))','if (false)','tests/security/boundaries.test.mjs'],
];
const baseline=spawnSync(process.execPath,['--test','tests/laws/kernel.test.mjs','tests/laws/protocol.test.mjs','tests/laws/interpretation.test.mjs','tests/laws/definitions.test.mjs','tests/security/boundaries.test.mjs'],{encoding:'utf8',timeout:60_000});
if(baseline.status!==0)throw new Error('Baseline must pass before mutation testing');
const results=[];
for(const [id,path,before,after,test] of mutants){
 const directory=mkdtempSync(join(tmpdir(),'zoen-mutant-'));
 try{
  cpSync('.core-build',join(directory,'.core-build'),{recursive:true});cpSync('tests',join(directory,'tests'),{recursive:true});writeFileSync(join(directory,'package.json'),'{"type":"module"}');
  const target=join(directory,'.core-build',path),original=readFileSync(target,'utf8');
  if(original.split(before).length!==2)throw new Error(`Mutation ${id} does not match exactly once`);
  const changed=original.replace(before,after);writeFileSync(target,changed);
  const syntax=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});if(syntax.status!==0)throw new Error(`Mutation ${id} is not valid JavaScript`);
  const run=spawnSync(process.execPath,['--test',test],{cwd:directory,encoding:'utf8',timeout:30_000});
  const killed=run.status!==0&&/^not ok \d+/m.test(run.stdout??'')&&!/ERR_MODULE_NOT_FOUND|SyntaxError/.test((run.stdout??'')+(run.stderr??''));
  results.push({id,path,originalSha256:sha256(original),mutatedSha256:sha256(changed),test,outcome:killed?'killed-by-test':'survived-or-invalid',exitCode:run.status});
 }finally{rmSync(directory,{recursive:true,force:true});}
}
const report={status:results.every(r=>r.outcome==='killed-by-test')?'passed':'failed',baselineExitCode:baseline.status,selectedMutations:results.length,results,scope:'Nine selected compiled-artifact mutations, not exhaustive mutation coverage or a production security assessment.'};
mkdirSync('artifacts/current',{recursive:true});writeFileSync('artifacts/current/mutations.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.status!=='passed')process.exitCode=1;
