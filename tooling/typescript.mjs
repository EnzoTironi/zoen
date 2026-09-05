import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const require=createRequire(import.meta.url);
let compiler;
try {compiler=require('typescript');}catch{const root=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();compiler=require(join(root,'typescript'));}
export const ts=compiler;
