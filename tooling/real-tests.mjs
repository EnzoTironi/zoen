import { preflight } from './preflight.mjs';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
mkdirSync('artifacts/current',{recursive:true});
const check=preflight({real:true});
if(check.blockers.length) {
  writeFileSync('artifacts/current/real-tests.json', JSON.stringify({ ...check, executed:0, passed:0, skipped:0, reason:'prerequisites absent; no substitute services were executed' },null,2)+'\n');
  console.error(JSON.stringify(check,null,2)); process.exit(2);
}
const files=readdirSync('tests/real').filter(f=>f.endsWith('.test.mjs')).sort().map(f=>`tests/real/${f}`);
if(!files.length){console.error('FAIL: zero real test files');process.exit(1);}
const result=spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{encoding:'utf8',maxBuffer:20_000_000,timeout:300_000});
writeFileSync('artifacts/current/real-tests.tap',result.stdout??''); writeFileSync('artifacts/current/real-tests.stderr',result.stderr??'');
const count=Number(/^# tests (\d+)/m.exec(result.stdout??'')?.[1]??0); const skipped=Number(/^# skipped (\d+)/m.exec(result.stdout??'')?.[1]??0);
const passed=result.status===0&&count>0&&skipped===0;
writeFileSync('artifacts/current/real-tests.json',JSON.stringify({status:passed?'passed':'failed',executed:count,skipped,exitCode:result.status,productionQualified:false},null,2)+'\n');
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');process.exit(passed?0:1);
