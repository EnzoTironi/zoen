import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { files } from './files.mjs';
import { ts } from './typescript.mjs';
/** Lightweight static guardrails, not a sandbox or proof against malicious source code. */
export function checkArchitecture() {
 const violations=[],source=[...files('packages'),...files('apps')].filter(p=>p.endsWith('.ts'));
 for(const path of source) {
  const text=readFileSync(path,'utf8');
  const ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const imports=[];
  function walk(node) {
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteralLike(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword) {
      if(node.arguments.length===1&&ts.isStringLiteralLike(node.arguments[0]))imports.push(node.arguments[0].text);
      else violations.push(`${path}: dynamic import prohibited`);
    }
    ts.forEachChild(node,walk);
  }
  walk(ast);
  for(const target of imports) {
   if(path.startsWith('packages/kernel/')&&!target.startsWith('.'))violations.push(`${path}: kernel external dependency ${target}`);
   if(path.startsWith('packages/kernel/')&&/contracts|ontology|adapters|apps|clients|door/.test(target))violations.push(`${path}: reversed kernel dependency`);
   if(path.startsWith('packages/contracts/')&&/ontology|adapters|apps|clients|door/.test(target))violations.push(`${path}: reversed contract dependency`);
   if(path.startsWith('packages/ontology/')&&!target.startsWith('.'))violations.push(`${path}: ontology must use ports, not external ${target}`);
   if(path.startsWith('packages/ontology/')&&/adapters|\/apps\/edge|\/door\/|\/clients\//.test(target))violations.push(`${path}: authority imports a client/adapter`);
   if(path.startsWith('packages/clients/')&&(/ontology|adapters|\/door\//.test(target)||['pg','better-auth','@cedar-policy/cedar-wasm'].includes(target)))violations.push(`${path}: client bypass import ${target}`);
   if(target.startsWith('.')) {
    const ts=resolve(dirname(path),target.replace(/\.js$/,'.ts'));
    if(!existsSync(ts))violations.push(`${path}: unresolved relative import ${target}`);
    if(relative(process.cwd(),ts).startsWith('..'))violations.push(`${path}: import escapes repository`);
   }
  }
  if(/\beval\s*\(|new\s+Function\s*\(|\bimport\s*\(\s*(?!['"])/.test(text))violations.push(`${path}: dynamic execution prohibited`);
  if(/@ts-ignore|@ts-nocheck|\bas any\b|:\s*any\b|declare\s+module/.test(text))violations.push(`${path}: type-check escape prohibited`);
  if(path.startsWith('packages/clients/')&&/\.query\s*\(|\bSELECT\b|\bUPDATE\b|\bINSERT INTO\b/.test(text))violations.push(`${path}: client SQL prohibited`);
 }
 for(const path of files('tests').filter(p=>p.endsWith('.mjs'))) {
  const text=readFileSync(path,'utf8');
  if(/\b(?:test|describe|it)\.(?:skip|todo|only)\s*\(/.test(text))violations.push(`${path}: skipped/partial test declaration`);
  if(/\b(?:mock\.method|mock\.fn|vi\.mock|jest\.mock|sinon\.|nock\(|setupServer\(|MemoryDatabase|FakeProvider|better-sqlite3)/.test(text))violations.push(`${path}: prohibited service replacement`);
 }
 const pkg=JSON.parse(readFileSync('package.json','utf8'));
 for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})) if(!/^\d+\.\d+\.\d+$/.test(version))violations.push(`Unpinned direct dependency ${name}`);
 for(const name of ['tsconfig.core.json','tsconfig.json']) {const c=JSON.parse(readFileSync(name,'utf8')).compilerOptions;if(!c.strict||!c.noEmitOnError||c.skipLibCheck)violations.push(`${name}: strictness or emission weakened`);}
 return {status:violations.length?'failed':'passed',sourceFiles:source.length,violations,note:'Static checks are not runtime isolation, complete information-flow proof or independent review.'};
}
if(process.argv[1]?.endsWith('/architecture.mjs')) {const r=checkArchitecture();console.log(JSON.stringify(r,null,2));if(r.violations.length)process.exitCode=1;}
