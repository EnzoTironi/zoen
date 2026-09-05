import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { files, hashes, sha256 } from './files.mjs';
const directory='artifacts/current';mkdirSync(directory,{recursive:true});
const compiler=existsSync('node_modules/typescript/bin/tsc')?{bin:process.execPath,prefix:['node_modules/typescript/bin/tsc']}:{bin:'tsc',prefix:[]};
const steps=[];
function run(name,command,args){const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:20_000_000,timeout:120_000});writeFileSync(`${directory}/${name}.stdout`,r.stdout??'');writeFileSync(`${directory}/${name}.stderr`,r.stderr??'');const info={name,command:[command,...args],exitCode:r.status,status:r.status===0?'passed':'failed'};steps.push(info);return r;}
const version=spawnSync(compiler.bin,[...compiler.prefix,'--version'],{encoding:'utf8'});
run('typecheck-core',compiler.bin,[...compiler.prefix,'-p','tsconfig.core.json']);
if(steps[0].status==='passed'){
 const testFiles=['tests/laws','tests/security'].flatMap(dir=>readdirSync(dir).filter(f=>f.endsWith('.test.mjs')).map(f=>`${dir}/${f}`)).sort();
 if(!testFiles.length)throw new Error('No test files');
 const result=run('core-tests',process.execPath,['--test',...testFiles]);
 const count=Number(/^# tests (\d+)/m.exec(result.stdout??'')?.[1]??0),skipped=Number(/^# skipped (\d+)/m.exec(result.stdout??'')?.[1]??0),failed=Number(/^# fail (\d+)/m.exec(result.stdout??'')?.[1]??1);
 steps.at(-1).executed=count;steps.at(-1).skipped=skipped;steps.at(-1).failed=failed;
 if(count===0||skipped>0||failed>0)steps.at(-1).status='failed';
}
run('architecture',process.execPath,['tooling/architecture.mjs']);run('syntax',process.execPath,['tooling/syntax.mjs']);
const commit=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
const dirty=spawnSync('git',['status','--porcelain'],{encoding:'utf8'}).stdout.trim().length>0;
// Record real candidate inputs, not bytecode caches or commented future product plans.
const candidatePaths=Object.keys(JSON.parse(readFileSync('planning/candidate-files.json','utf8')).files);
const runtimePaths=JSON.parse(readFileSync('planning/runtime-sources.json','utf8')).paths;
const toolPaths=files('tooling').filter(p=>/\.(?:mjs|py)$/.test(p)&&!p.includes('/__pycache__/'));
const sourceFiles=[...new Set([...candidatePaths,...runtimePaths,...toolPaths,'planning/candidate-files.json','planning/runtime-sources.json','package.json','tsconfig.core.json','tsconfig.json'])].sort();
const report={schemaVersion:1,generatedAt:new Date().toISOString(),git:{commit,dirty},runtime:{node:process.versions.node,compiler:version.stdout.trim()},status:steps.every(s=>s.status==='passed')?'passed':'failed',steps,sourceHashes:hashes(sourceFiles),sourceHashScope:'Candidate/build inputs and actual verification tooling; fingerprints do not assert per-file behavior coverage. All static plans/docs are sealed separately.',specificationSha256:sha256(readFileSync('archives/zoen-execution-v4.zip')),targetRuntimeQualified:false,postgresqlExecuted:false,realProviderTestsExecuted:false,acceptedV4Tickets:0,warning:'Local core/grammar/static validation only. Not the complete v4 application and not production qualification.'};
writeFileSync(`${directory}/core-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,runtime:report.runtime,steps,limits:report.warning},null,2));if(report.status!=='passed')process.exitCode=1;
