import { ts } from './typescript.mjs';
import { readFileSync } from 'node:fs';
import { files } from './files.mjs';
const failures=[];const paths=[...files('packages'),...files('apps')].filter(p=>p.endsWith('.ts'));
for(const path of paths) {const parsed=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);for(const d of parsed.parseDiagnostics)failures.push({path,message:ts.flattenDiagnosticMessageText(d.messageText,' ')});}
console.log(JSON.stringify({status:failures.length?'failed':'passed',compiler:ts.version,files:paths.length,failures,scope:'Grammar only. Does NOT resolve or typecheck uninstalled external dependencies.'},null,2));
if(failures.length)process.exitCode=1;
